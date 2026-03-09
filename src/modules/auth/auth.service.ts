import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PermissionCacheService } from './permission-cache.service';
import { SignupWithReferralDto } from '../referrals/dto/signup-with-referral.dto';
import { ReferralsService } from '../referrals/referrals.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { SendPhoneOtpDto } from './dto/send-phone-otp.dto';
import { VerifyPhoneOtpDto } from './dto/verify-phone-otp.dto';
import { UpdateMeProfileDto } from './dto/update-me-profile.dto';
import { CompleteActivationDto } from './dto/complete-activation.dto';
import { UpdateActivationDraftDto } from './dto/update-activation-draft.dto';
import { VerifyLoginTwoFactorDto } from './dto/verify-login-two-factor.dto';
import { VerifySessionTakeoverDto } from './dto/verify-session-takeover.dto';
import { UpdateMeSecurityDto } from './dto/update-me-security.dto';
import { CreateProfileChangeRequestDto } from './dto/profile-change-request.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { IntegrationConfigService } from '../system-settings/integration-config.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ReferralConvertedEvent } from '../../events/contracts/referral-converted.event';
import {
  $Enums,
  AuthorizedFeeMode,
  InvoiceStatus,
  ProfileChangeRequestStatus,
  UserStatusEnum,
} from '@prisma/client';
import {
  cert,
  getApp,
  initializeApp,
  type App as FirebaseApp,
} from 'firebase-admin/app';
import { getAuth, type Auth as FirebaseAuth } from 'firebase-admin/auth';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private firebaseAuthApp: FirebaseApp | null = null;
  private readonly accessTokenExpiresIn = (process.env.JWT_ACCESS_EXPIRES_IN ||
    '12h') as any;
  private readonly refreshTokenExpiresInDays = Math.max(
    1,
    Number.parseInt(process.env.JWT_REFRESH_EXPIRES_IN_DAYS || '30', 10) || 30,
  );

  // Staff/admin roles are restricted to a single active session.
  // On new login, all previous refresh tokens for these roles are revoked.
  private readonly SINGLE_SESSION_ROLES = ['SUPER_ADMIN', 'MANAGER', 'COMPOUND_STAFF'];
  private readonly sessionTakeoverOtpRequired = this.parseEnvBoolean(
    process.env.ENABLE_SESSION_TAKEOVER_OTP ??
      process.env.SESSION_TAKEOVER_REQUIRE_OTP,
    false,
  );

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private permissionCache: PermissionCacheService,
    private referralsService: ReferralsService,
    private notificationsService: NotificationsService,
    private integrationConfigService: IntegrationConfigService,
    private eventEmitter: EventEmitter2,
  ) {}

  private parseEnvBoolean(raw: string | undefined, fallback: boolean): boolean {
    if (typeof raw !== 'string') return fallback;
    const normalized = raw.trim().toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
    return fallback;
  }

  private normalizePhoneForComparison(value: string | null | undefined): string {
    return String(value ?? '').replace(/[^\d]/g, '');
  }

  private normalizeFirebasePrivateKey(value: string | null | undefined): string {
    let normalized = String(value ?? '').trim();
    if (
      (normalized.startsWith('"') && normalized.endsWith('"')) ||
      (normalized.startsWith("'") && normalized.endsWith("'"))
    ) {
      normalized = normalized.slice(1, -1);
    }
    return normalized.replace(/\\n/g, '\n').replace(/\r\n/g, '\n');
  }

  private async ensureDefaultCommunityRoleForUser(userId: string): Promise<boolean> {
    const existingRoleCount = await this.prisma.userRole.count({
      where: { userId },
    });
    if (existingRoleCount > 0) return false;

    const userContext = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        resident: { select: { id: true } },
        owner: { select: { id: true } },
        tenant: { select: { id: true } },
        unitAccesses: {
          where: { status: 'ACTIVE' },
          select: { id: true },
          take: 1,
        },
      },
    });
    if (!userContext) return false;

    const isCommunityUser =
      Boolean(userContext.resident) ||
      Boolean(userContext.owner) ||
      Boolean(userContext.tenant) ||
      userContext.unitAccesses.length > 0;
    if (!isCommunityUser) return false;

    const communityRole = await this.prisma.role.findUnique({
      where: { name: 'COMMUNITY_USER' },
      select: { id: true },
    });
    if (!communityRole) return false;

    await this.prisma.userRole.create({
      data: {
        userId,
        roleId: communityRole.id,
      },
    });
    return true;
  }

  private async revokeSessionsAndBumpVersion(userId: string) {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revoked: false },
      data: { revoked: true },
    });

    return this.prisma.user.update({
      where: { id: userId },
      data: { sessionVersion: { increment: 1 } },
      include: { roles: { include: { role: true } } },
    });
  }

  private buildActivationChecklist(user: {
    phone: string | null;
    phoneVerifiedAt: Date | null;
    nationalIdFileId: string | null;
    profilePhotoId: string | null;
    userStatus: UserStatusEnum;
  }) {
    const requiresPhoneOtp = Boolean(user.phone);
    const phoneVerified = Boolean(user.phoneVerifiedAt);
    const hasNationalId = Boolean(user.nationalIdFileId);
    const hasProfilePhoto = Boolean(user.profilePhotoId);
    const mustCompleteActivation = user.userStatus !== UserStatusEnum.ACTIVE;
    const canCompleteActivation =
      mustCompleteActivation &&
      (!requiresPhoneOtp || phoneVerified) &&
      hasNationalId &&
      hasProfilePhoto;

    return {
      mustCompleteActivation,
      checklist: {
        requiresPhoneOtp,
        phoneVerified,
        hasNationalId,
        hasProfilePhoto,
        canCompleteActivation,
      },
    };
  }

  private formatActivationStatus(user: {
    id: string;
    email: string | null;
    phone: string | null;
    nameEN: string | null;
    nameAR: string | null;
    userStatus: UserStatusEnum;
    phoneVerifiedAt: Date | null;
    nationalIdFileId: string | null;
    profilePhotoId: string | null;
  }) {
    const computed = this.buildActivationChecklist(user);
    return {
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        nameEN: user.nameEN,
        nameAR: user.nameAR,
        userStatus: user.userStatus,
        nationalIdFileId: user.nationalIdFileId,
        profilePhotoId: user.profilePhotoId,
      },
      mustCompleteActivation: computed.mustCompleteActivation,
      checklist: computed.checklist,
    };
  }

  private async assertActivationFileCategory(
    fileId: string,
    expected: $Enums.FileCategory,
    reasonCode: 'NATIONAL_ID_REQUIRED' | 'PROFILE_PHOTO_REQUIRED',
  ): Promise<void> {
    const file = await this.prisma.file.findUnique({
      where: { id: fileId },
      select: { id: true, category: true },
    });
    if (!file || file.category !== expected) {
      throw new BadRequestException({
        message: reasonCode === 'NATIONAL_ID_REQUIRED' ? 'Invalid national ID file' : 'Invalid profile photo file',
        reasonCode,
      });
    }
  }

  private async getFirebaseAuthClient(): Promise<FirebaseAuth> {
    const integrations = await this.integrationConfigService.getResolvedIntegrations();
    const smsOtpDiagnostics = await this.integrationConfigService.getSmsOtpDiagnostics();
    if (!smsOtpDiagnostics.ready) {
      throw new ServiceUnavailableException({
        message: 'Firebase OTP verification is currently unavailable.',
        reasonCode: smsOtpDiagnostics.reasonCode,
        details: {
          smsOtpEnabled: smsOtpDiagnostics.smsOtpEnabled,
          smsOtpConfigured: smsOtpDiagnostics.smsOtpConfigured,
          fcmConfigured: smsOtpDiagnostics.fcmConfigured,
        },
      });
    }

    let parsedJson: Record<string, any> | null = null;
    let serviceJsonParseError = false;
    if (integrations.fcm.serviceAccountJson) {
      try {
        parsedJson = JSON.parse(integrations.fcm.serviceAccountJson);
      } catch {
        parsedJson = null;
        serviceJsonParseError = true;
      }
    }

    const projectId =
      integrations.fcm.projectId || parsedJson?.project_id || integrations.smsOtp.firebaseProjectId;
    const clientEmail = integrations.fcm.clientEmail || parsedJson?.client_email;
    const privateKey = this.normalizeFirebasePrivateKey(
      integrations.fcm.privateKey || parsedJson?.private_key || '',
    );

    if (!projectId || !clientEmail || !privateKey) {
      throw new ServiceUnavailableException({
        message: 'Firebase service account is incomplete. Configure FCM credentials first.',
        reasonCode: serviceJsonParseError
          ? 'FIREBASE_SERVICE_ACCOUNT_JSON_INVALID'
          : 'FIREBASE_CREDENTIALS_INCOMPLETE',
      });
    }
    const hasPemMarkers =
      privateKey.includes('-----BEGIN PRIVATE KEY-----') &&
      privateKey.includes('-----END PRIVATE KEY-----');
    if (!hasPemMarkers) {
      throw new ServiceUnavailableException({
        message: 'Firebase private key is invalid (PEM format required).',
        reasonCode: 'FIREBASE_PRIVATE_KEY_INVALID_PEM',
      });
    }

    if (!this.firebaseAuthApp) {
      const appName = 'community-firebase-auth';
      try {
        this.firebaseAuthApp = getApp(appName);
      } catch {
        try {
          this.firebaseAuthApp = initializeApp(
            {
              credential: cert({
                projectId,
                clientEmail,
                privateKey,
              }),
            },
            appName,
          );
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Failed to initialize Firebase app';
          const reasonCode = message.toLowerCase().includes('invalid pem')
            ? 'FIREBASE_PRIVATE_KEY_INVALID_PEM'
            : 'FIREBASE_CREDENTIALS_INCOMPLETE';
          throw new ServiceUnavailableException({
            message: 'Firebase OTP verification is currently unavailable.',
            reasonCode,
          });
        }
      }
    }

    return getAuth(this.firebaseAuthApp);
  }

  // ================= LOGIN =================
  async login(identifier: string, password: string) {
    // Look for user in Users table by email or phone
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: identifier }, { phone: identifier }],
      },
      include: { roles: { include: { role: true } } },
    });

    // Pending registrations are currently shelved (admin-driven onboarding is used).
    // Keep this check behind a feature flag for future re-enablement.
    const pendingRegistrationsEnabled =
      process.env.ENABLE_PENDING_REGISTRATIONS === 'true';

    if (pendingRegistrationsEnabled) {
      const pending = await this.prisma.pendingRegistration.findFirst({
        where: {
          OR: [
            { email: identifier, status: 'PENDING' },
            { phone: identifier, status: 'PENDING' },
          ],
        },
      });

      if (pending) {
        throw new UnauthorizedException(
          'Your registration is not approved yet. Please wait for admin approval.',
        );
      }
    }

    if (!user) throw new UnauthorizedException('Invalid credentials');

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new ForbiddenException(
        'Account temporarily locked. Try again later.',
      );
    }

    if (
      !user.passwordHash ||
      !(await bcrypt.compare(password, user.passwordHash))
    ) {
      const attempts = user.loginAttempts + 1;
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          loginAttempts: attempts,
          lockedUntil:
            attempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null,
        },
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    const rolePatched = await this.ensureDefaultCommunityRoleForUser(user.id);
    const authUser = rolePatched
      ? await this.prisma.user.findUnique({
          where: { id: user.id },
          include: { roles: { include: { role: true } } },
        })
      : user;
    if (!authUser) throw new UnauthorizedException('Invalid credentials');

    // Skip unit access check for admin roles (SUPER_ADMIN, MANAGER)
    const isAdmin = authUser.roles.some((ur) =>
      ['SUPER_ADMIN', 'MANAGER'].includes(ur.role.name),
    );

    if (!isAdmin) {
      let hasActiveAccess = await this.prisma.unitAccess.findFirst({
        where: {
          userId: authUser.id,
          status: 'ACTIVE',
        },
      });

      if (!hasActiveAccess) {
        const activation = await this.ensureAuthorizedAccessActivated(authUser.id);
        hasActiveAccess = await this.prisma.unitAccess.findFirst({
          where: {
            userId: authUser.id,
            status: 'ACTIVE',
          },
        });

        if (!hasActiveAccess) {
          if (activation.hasEligibleRequest && activation.blockedByUnpaidFee) {
            throw new ForbiddenException(
              'Your authorization is pending activation fee payment.',
            );
          }
          throw new ForbiddenException('Your access has been revoked.');
        }
      }
    }

    const shouldUseTwoFactor =
      authUser.twoFactorEnabled === true &&
      authUser.userStatus === UserStatusEnum.ACTIVE;
    if (shouldUseTwoFactor) {
      return this.beginLoginTwoFactorChallenge(authUser);
    }

    // ── Single-session enforcement for ALL users ──
    // If this account already has an active (non-revoked, non-expired) session,
    // require OTP verification before allowing session takeover.
    const activeSession = await this.prisma.refreshToken.findFirst({
      where: {
        userId: authUser.id,
        revoked: false,
        expiresAt: { gt: new Date() },
      },
    });

    let loginTargetUser = authUser;
    if (activeSession) {
      if (this.sessionTakeoverOtpRequired) {
        const challenge = await this.beginSessionTakeoverChallenge(authUser);
        if (challenge) return challenge;
      }

      // Fallback for clients that do not support the takeover OTP challenge:
      // revoke old sessions and complete login immediately after password check.
      loginTargetUser = await this.revokeSessionsAndBumpVersion(authUser.id);
    }

    const tokens = await this.generateTokens(loginTargetUser);
    await this.markSuccessfulLogin(loginTargetUser.id);
    return {
      ...tokens,
      userStatus: loginTargetUser.userStatus,
      mustCompleteActivation: loginTargetUser.userStatus !== 'ACTIVE',
    };
  }

  private async assertAdminUser(userId: string) {
    const admin = await this.prisma.admin.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!admin) throw new ForbiddenException('Admin access required');
  }

  private async markSuccessfulLogin(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { loginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
    });
  }

  // Delegate accounts created through household approvals can remain in
  // PENDING unit-access state until activation fee is paid by the owner.
  private async ensureAuthorizedAccessActivated(userId: string) {
    const requests = await this.prisma.authorizedAccessRequest.findMany({
      where: {
        activatedUserId: userId,
        status: 'APPROVED',
      },
      select: {
        id: true,
        unitId: true,
        feeMode: true,
        activationInvoiceId: true,
        activationInvoice: {
          select: { id: true, status: true },
        },
      },
    });

    if (!requests.length) {
      return {
        hasEligibleRequest: false,
        blockedByUnpaidFee: false,
      };
    }

    let blockedByUnpaidFee = false;
    let activatedAny = false;

    for (const req of requests) {
      const requiresPayment =
        req.feeMode === AuthorizedFeeMode.FEE_REQUIRED &&
        Boolean(req.activationInvoiceId);
      const paymentDone = req.activationInvoice?.status === InvoiceStatus.PAID;

      if (requiresPayment && !paymentDone) {
        blockedByUnpaidFee = true;
        continue;
      }

      const pendingRows = await this.prisma.unitAccess.findMany({
        where: {
          userId,
          unitId: req.unitId,
          role: 'DELEGATE',
          status: 'PENDING',
        },
        select: { id: true },
      });
      if (!pendingRows.length) continue;

      await this.prisma.unitAccess.updateMany({
        where: {
          id: {
            in: pendingRows.map((row) => row.id),
          },
        },
        data: {
          status: 'ACTIVE',
          startsAt: new Date(),
        },
      });
      activatedAny = true;
    }

    if (activatedAny) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { userStatus: UserStatusEnum.ACTIVE },
      });
    }

    return {
      hasEligibleRequest: true,
      blockedByUnpaidFee,
    };
  }

  private async beginLoginTwoFactorChallenge(user: any) {
    const capabilities = await this.integrationConfigService.getMobileCapabilities();
    const smsReady = capabilities.smsOtp && Boolean(user.phone);
    const emailReady = capabilities.smtpMail && Boolean(user.email);

    if (!smsReady && !emailReady) {
      throw new ServiceUnavailableException(
        'Two-factor authentication is enabled but no OTP channel is currently available.',
      );
    }

    const channel: $Enums.Channel = smsReady ? 'SMS' : 'EMAIL';
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = await bcrypt.hash(otp, 12);

    await this.prisma.phoneVerificationOtp.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    await this.prisma.phoneVerificationOtp.create({
      data: {
        userId: user.id,
        otpHash,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      },
    });

    await this.notificationsService.sendNotification(
      {
        type: 'OTP',
        title: 'Login security code',
        messageEn:
          channel === 'SMS'
            ? `Your SSS Community login OTP: ${otp}`
            : `Your SSS Community login OTP is ${otp}. It expires in 5 minutes.`,
        channels: [channel],
        targetAudience: 'SPECIFIC_RESIDENCES',
        audienceMeta: { userIds: [user.id] },
        payload: {
          eventKey: 'auth.login_2fa',
          channel,
        },
      },
      undefined,
    );

    const challengeToken = this.jwtService.sign(
      {
        sub: user.id,
        purpose: 'LOGIN_2FA',
      },
      {
        expiresIn: '5m',
      },
    );

    return {
      challengeRequired: true,
      challengeToken,
      method: channel,
      expiresInSeconds: 300,
      userStatus: user.userStatus,
      mustCompleteActivation: false,
    };
  }

  // ── Session Takeover Challenge ──
  // Triggered when a user tries to log in but already has an active session
  // on another device. Sends OTP for identity verification before revoking
  // the old session.
  private async beginSessionTakeoverChallenge(user: any) {
    const capabilities = await this.integrationConfigService.getMobileCapabilities();
    const smsReady = capabilities.smsOtp && Boolean(user.phone);
    const emailReady = capabilities.smtpMail && Boolean(user.email);

    if (!smsReady && !emailReady) {
      this.logger.warn(
        `Session takeover OTP skipped for user ${user.id}: no OTP channel available.`,
      );
      return null;
    }

    const channel: $Enums.Channel = smsReady ? 'SMS' : 'EMAIL';
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = await bcrypt.hash(otp, 12);

    // Invalidate any pending OTPs for this user
    await this.prisma.phoneVerificationOtp.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    await this.prisma.phoneVerificationOtp.create({
      data: {
        userId: user.id,
        otpHash,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      },
    });

    await this.notificationsService.sendNotification(
      {
        type: 'OTP',
        title: 'Session security verification',
        messageEn:
          channel === 'SMS'
            ? `Your SSS Community session verification OTP: ${otp}`
            : `Someone is attempting to sign in to your SSS Community account from a new device. Your verification OTP is ${otp}. It expires in 5 minutes. If this was not you, change your password immediately.`,
        channels: [channel],
        targetAudience: 'SPECIFIC_RESIDENCES',
        audienceMeta: { userIds: [user.id] },
        payload: {
          eventKey: 'auth.session_takeover',
          channel,
        },
      },
      undefined,
    );

    const challengeToken = this.jwtService.sign(
      {
        sub: user.id,
        purpose: 'SESSION_TAKEOVER',
      },
      {
        expiresIn: '5m',
      },
    );

    return {
      sessionConflict: true,
      challengeRequired: true,
      challengeToken,
      method: channel,
      expiresInSeconds: 300,
      message: 'Another device is already signed in. Verify your identity to continue.',
      userStatus: user.userStatus,
      mustCompleteActivation: false,
    };
  }

  async verifySessionTakeover(dto: VerifySessionTakeoverDto) {
    let payload: any;
    try {
      payload = this.jwtService.verify(dto.challengeToken);
    } catch {
      throw new UnauthorizedException('Session takeover challenge is invalid or expired.');
    }

    if (!payload?.sub || payload?.purpose !== 'SESSION_TAKEOVER') {
      throw new UnauthorizedException('Invalid session takeover challenge.');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub as string },
      include: { roles: { include: { role: true } } },
    });
    if (!user) throw new UnauthorizedException('User not found.');
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new ForbiddenException('Account temporarily locked. Try again later.');
    }

    const storedOtp = await this.prisma.phoneVerificationOtp.findFirst({
      where: {
        userId: user.id,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!storedOtp) {
      throw new BadRequestException('Invalid or expired OTP.');
    }

    const isValid = await bcrypt.compare(String(dto.otp ?? '').trim(), storedOtp.otpHash);
    if (!isValid) {
      throw new BadRequestException('Invalid OTP.');
    }

    await this.prisma.phoneVerificationOtp.update({
      where: { id: storedOtp.id },
      data: { usedAt: new Date() },
    });

    const updatedUser = await this.revokeSessionsAndBumpVersion(user.id);

    // Notify the old session(s) that they have been signed out
    await this.notificationsService.sendNotification(
      {
        type: 'ANNOUNCEMENT',
        title: 'Signed out',
        messageEn:
          'Your account was signed in from another device. You have been signed out for security.',
        channels: ['PUSH'],
        targetAudience: 'SPECIFIC_RESIDENCES',
        audienceMeta: { userIds: [user.id] },
        payload: {
          eventKey: 'auth.session_revoked',
          action: 'FORCE_LOGOUT',
        },
      },
      undefined,
    );

    const tokens = await this.generateTokens(updatedUser);
    await this.markSuccessfulLogin(user.id);
    return {
      ...tokens,
      userStatus: updatedUser.userStatus,
      mustCompleteActivation: updatedUser.userStatus !== 'ACTIVE',
    };
  }

  async verifyLoginTwoFactor(dto: VerifyLoginTwoFactorDto) {
    let payload: any;
    try {
      payload = this.jwtService.verify(dto.challengeToken);
    } catch {
      throw new UnauthorizedException('Two-factor challenge is invalid or expired.');
    }

    if (!payload?.sub || payload?.purpose !== 'LOGIN_2FA') {
      throw new UnauthorizedException('Invalid two-factor challenge.');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub as string },
      include: { roles: { include: { role: true } } },
    });
    if (!user) throw new UnauthorizedException('User not found.');
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new ForbiddenException(
        'Account temporarily locked. Try again later.',
      );
    }

    const storedOtp = await this.prisma.phoneVerificationOtp.findFirst({
      where: {
        userId: user.id,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!storedOtp) {
      throw new BadRequestException('Invalid or expired OTP.');
    }

    const isValid = await bcrypt.compare(String(dto.otp ?? '').trim(), storedOtp.otpHash);
    if (!isValid) {
      throw new BadRequestException('Invalid OTP.');
    }

    await this.prisma.phoneVerificationOtp.update({
      where: { id: storedOtp.id },
      data: { usedAt: new Date() },
    });

    const isAdmin = user.roles.some((ur) =>
      ['SUPER_ADMIN', 'MANAGER'].includes(ur.role.name),
    );
    if (!isAdmin) {
      let hasActiveAccess = await this.prisma.unitAccess.findFirst({
        where: {
          userId: user.id,
          status: 'ACTIVE',
        },
      });
      if (!hasActiveAccess) {
        const activation = await this.ensureAuthorizedAccessActivated(user.id);
        hasActiveAccess = await this.prisma.unitAccess.findFirst({
          where: {
            userId: user.id,
            status: 'ACTIVE',
          },
        });

        if (!hasActiveAccess) {
          if (activation.hasEligibleRequest && activation.blockedByUnpaidFee) {
            throw new ForbiddenException(
              'Your authorization is pending activation fee payment.',
            );
          }
          throw new ForbiddenException('Your access has been revoked.');
        }
      }
    }

    const updatedUser = await this.revokeSessionsAndBumpVersion(user.id);
    const tokens = await this.generateTokens(updatedUser);
    await this.markSuccessfulLogin(user.id);
    return {
      ...tokens,
      userStatus: updatedUser.userStatus,
      mustCompleteActivation: updatedUser.userStatus !== 'ACTIVE',
    };
  }

  private readonly defaultMobileFeaturePolicy = {
    canUseServices: true,
    canUseRequests: true,
    canUseBookings: true,
    canUseComplaints: true,
    canUseQr: true,
    canViewFinance: true,
    canManageHousehold: false,
    canUseDiscover: true,
    canUseHelpCenter: true,
    canUseUtilities: true,
  };

  private normalizeFeaturePolicy(value: unknown) {
    const raw =
      value && typeof value === 'object' && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};
    return {
      canUseServices:
        typeof raw.canUseServices === 'boolean'
          ? raw.canUseServices
          : this.defaultMobileFeaturePolicy.canUseServices,
      canUseRequests:
        typeof raw.canUseRequests === 'boolean'
          ? raw.canUseRequests
          : this.defaultMobileFeaturePolicy.canUseRequests,
      canUseBookings:
        typeof raw.canUseBookings === 'boolean'
          ? raw.canUseBookings
          : this.defaultMobileFeaturePolicy.canUseBookings,
      canUseComplaints:
        typeof raw.canUseComplaints === 'boolean'
          ? raw.canUseComplaints
          : this.defaultMobileFeaturePolicy.canUseComplaints,
      canUseQr:
        typeof raw.canUseQr === 'boolean'
          ? raw.canUseQr
          : this.defaultMobileFeaturePolicy.canUseQr,
      canViewFinance:
        typeof raw.canViewFinance === 'boolean'
          ? raw.canViewFinance
          : this.defaultMobileFeaturePolicy.canViewFinance,
      canManageHousehold:
        typeof raw.canManageHousehold === 'boolean'
          ? raw.canManageHousehold
          : this.defaultMobileFeaturePolicy.canManageHousehold,
      canUseDiscover:
        typeof raw.canUseDiscover === 'boolean'
          ? raw.canUseDiscover
          : this.defaultMobileFeaturePolicy.canUseDiscover,
      canUseHelpCenter:
        typeof raw.canUseHelpCenter === 'boolean'
          ? raw.canUseHelpCenter
          : this.defaultMobileFeaturePolicy.canUseHelpCenter,
      canUseUtilities:
        typeof raw.canUseUtilities === 'boolean'
          ? raw.canUseUtilities
          : this.defaultMobileFeaturePolicy.canUseUtilities,
    };
  }

  private async resolveMobileAccessPolicy(
    persona:
      | 'PRE_DELIVERY_OWNER'
      | 'CONTRACTOR'
      | 'AUTHORIZED'
      | 'OWNER'
      | 'TENANT'
      | 'FAMILY'
      | 'RESIDENT',
  ) {
    const row = await this.prisma.systemSetting.findUnique({
      where: { section: 'mobileAccess' },
      select: { value: true },
    });
    const root =
      row?.value && typeof row.value === 'object' && !Array.isArray(row.value)
        ? (row.value as Record<string, unknown>)
        : {};
    const key =
      persona === 'OWNER'
        ? 'owner'
        : persona === 'TENANT'
          ? 'tenant'
          : persona === 'FAMILY'
            ? 'family'
            : persona === 'AUTHORIZED'
              ? 'authorized'
              : persona === 'CONTRACTOR'
                ? 'contractor'
                : persona === 'PRE_DELIVERY_OWNER'
                  ? 'preDeliveryOwner'
                  : 'resident';

    return this.normalizeFeaturePolicy(root[key]);
  }

  async getCurrentUserBootstrap(userId: string) {
    const user: any = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: { include: { role: true } },
        resident: {
          include: {
            residentUnits: {
              include: {
                unit: {
                  select: {
                    id: true,
                    unitNumber: true,
                    block: true,
                    projectName: true,
                    status: true,
                    type: true,
                  },
                },
              },
            },
            vehicles: {
              orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
            },
          },
        },
        owner: { select: { id: true, userId: true } },
        tenant: { select: { id: true, userId: true } },
        admin: { select: { id: true, userId: true, status: true } },
        unitAccesses: {
          where: { status: 'ACTIVE' },
          include: {
            unit: {
              select: {
                id: true,
                unitNumber: true,
                block: true,
                projectName: true,
                status: true,
                type: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        profilePhoto: {
          select: {
            id: true,
            name: true,
            mimeType: true,
            size: true,
          },
        },
      },
    });

    if (!user) throw new NotFoundException('User not found');

    const roleNames = user.roles.map((r) => r.role.name);
    const resolvedPermissions = this.permissionCache.resolveUserPermissions(
      roleNames,
    ) as any;
    const permissions = Array.isArray(resolvedPermissions)
      ? resolvedPermissions
      : resolvedPermissions instanceof Set
        ? Array.from(resolvedPermissions)
        : [];

    const activeUnitsById = new Map<
      string,
      {
        id: string;
        unitNumber: string | null;
        block: string | null;
        projectName: string | null;
        status: any;
        type: any;
        accesses: any[];
        legacyResidentLinks: any[];
      }
    >();

    for (const access of user.unitAccesses) {
      if (!access.unit) continue;
      const existing = activeUnitsById.get(access.unit.id);
      if (existing) {
        existing.accesses.push({
          id: access.id,
          role: access.role,
          status: access.status,
          startsAt: access.startsAt,
          endsAt: access.endsAt,
          delegateType: access.delegateType,
          source: access.source,
          canViewFinancials: access.canViewFinancials,
          canReceiveBilling: access.canReceiveBilling,
          canBookFacilities: access.canBookFacilities,
          canGenerateQR: access.canGenerateQR,
          canManageWorkers: access.canManageWorkers,
          featurePermissions: access.featurePermissions,
        });
      } else {
        activeUnitsById.set(access.unit.id, {
          id: access.unit.id,
          unitNumber: access.unit.unitNumber ?? null,
          block: access.unit.block ?? null,
          projectName: access.unit.projectName ?? null,
          status: access.unit.status,
          type: access.unit.type,
          accesses: [
            {
              id: access.id,
              role: access.role,
              status: access.status,
              startsAt: access.startsAt,
              endsAt: access.endsAt,
              delegateType: access.delegateType,
              source: access.source,
              canViewFinancials: access.canViewFinancials,
              canReceiveBilling: access.canReceiveBilling,
              canBookFacilities: access.canBookFacilities,
              canGenerateQR: access.canGenerateQR,
              canManageWorkers: access.canManageWorkers,
              featurePermissions: access.featurePermissions,
            },
          ],
          legacyResidentLinks: [],
        });
      }
    }

    const legacyResidentLinks =
      user.resident?.residentUnits?.map((ru) => ({
        residentUnitId: ru.id,
        isPrimary: ru.isPrimary,
        unitId: ru.unitId,
        unit: ru.unit
          ? {
              id: ru.unit.id,
              unitNumber: ru.unit.unitNumber ?? null,
              block: ru.unit.block ?? null,
              projectName: ru.unit.projectName ?? null,
              status: ru.unit.status,
              type: ru.unit.type,
            }
          : null,
      })) ?? [];

    for (const link of legacyResidentLinks) {
      if (!link.unit) continue;
      const existing = activeUnitsById.get(link.unit.id);
      if (existing) {
        existing.legacyResidentLinks.push({
          residentUnitId: link.residentUnitId,
          isPrimary: link.isPrimary,
        });
      } else {
        activeUnitsById.set(link.unit.id, {
          id: link.unit.id,
          unitNumber: link.unit.unitNumber,
          block: link.unit.block,
          projectName: link.unit.projectName,
          status: link.unit.status,
          type: link.unit.type,
          accesses: [],
          legacyResidentLinks: [
            {
              residentUnitId: link.residentUnitId,
              isPrimary: link.isPrimary,
            },
          ],
        });
      }
    }

    const units = Array.from(activeUnitsById.values());

    const allAccesses = units.flatMap((u) => u.accesses ?? []);
    const accessRoles = new Set(
      allAccesses
        .map((a) => (typeof a.role === 'string' ? a.role.toUpperCase() : ''))
        .filter(Boolean),
    );
    const hasOwnerAccess = accessRoles.has('OWNER') || Boolean(user.owner);
    const hasTenantAccess = accessRoles.has('TENANT') || Boolean(user.tenant);
    const hasFamilyAccess = accessRoles.has('FAMILY');
    const hasDelegateAccess = accessRoles.has('DELEGATE');
    const canManageWorkers = allAccesses.some((a) => a.canManageWorkers === true);
    const canGenerateQr = allAccesses.some((a) => a.canGenerateQR === true);
    const canBookFacilities = allAccesses.some((a) => a.canBookFacilities === true);
    const canViewFinancials = allAccesses.some(
      (a) => a.canViewFinancials === true || a.canReceiveBilling === true,
    );
    const hasFeaturePermission = (key: string) =>
      allAccesses.some((a) => {
        const raw = a.featurePermissions;
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false;
        return Boolean((raw as Record<string, unknown>)[key]);
      });
    const isDashboardCreated = String(user.signupSource ?? '').toLowerCase() === 'dashboard';
    const isPreDeliveryOwner =
      !isDashboardCreated &&
      units.some(
        (u) =>
          String(u.status ?? '').toUpperCase() === 'NOT_DELIVERED' &&
          (u.accesses ?? []).some(
            (a) => String(a.role ?? '').toUpperCase() === 'OWNER',
          ),
      );

    let resolvedPersona:
      | 'PRE_DELIVERY_OWNER'
      | 'CONTRACTOR'
      | 'AUTHORIZED'
      | 'OWNER'
      | 'TENANT'
      | 'FAMILY'
      | 'RESIDENT' = 'RESIDENT';
    if (isPreDeliveryOwner) resolvedPersona = 'PRE_DELIVERY_OWNER';
    else if (hasDelegateAccess && canManageWorkers) resolvedPersona = 'CONTRACTOR';
    else if (hasDelegateAccess) resolvedPersona = 'AUTHORIZED';
    else if (hasOwnerAccess) resolvedPersona = 'OWNER';
    else if (hasTenantAccess) resolvedPersona = 'TENANT';
    else if (hasFamilyAccess) resolvedPersona = 'FAMILY';

    const permissionSet = new Set(permissions);
    const personaPolicy = await this.resolveMobileAccessPolicy(resolvedPersona);
    const baseCanUseServices =
      permissionSet.has('service.read') ||
      permissionSet.has('service_request.create') ||
      hasFeaturePermission('services');
    const baseCanUseRequests =
      permissionSet.has('service_request.create') ||
      permissionSet.has('service_request.read_own') ||
      hasFeaturePermission('requests');
    const baseCanUseBookings =
      permissionSet.has('booking.create') || canBookFacilities;
    const baseCanUseComplaints = permissionSet.has('complaint.report');
    const baseCanUseQr = permissionSet.has('qr.generate') && canGenerateQr;
    const baseCanViewFinance =
      permissionSet.has('invoice.view_own') &&
      permissionSet.has('violation.view_own') &&
      canViewFinancials;
    const baseCanManageHousehold =
      hasOwnerAccess || hasTenantAccess || hasDelegateAccess || canManageWorkers;

    return {
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        nameEN: user.nameEN,
        nameAR: user.nameAR,
        userStatus: user.userStatus,
        signupSource: user.signupSource,
        twoFactorEnabled: user.twoFactorEnabled === true,
        emailVerifiedAt: user.emailVerifiedAt,
        phoneVerifiedAt: user.phoneVerifiedAt,
        lastLoginAt: user.lastLoginAt,
        profilePhoto: user.profilePhoto
          ? {
              id: user.profilePhoto.id,
              name: user.profilePhoto.name,
              mimeType: user.profilePhoto.mimeType,
              size: user.profilePhoto.size,
            }
          : null,
      },
      roles: roleNames,
      permissions,
      profileKinds: {
        resident: Boolean(user.resident),
        owner: Boolean(user.owner),
        tenant: Boolean(user.tenant),
        admin: Boolean(user.admin),
      },
      residentProfile: user.resident
        ? {
            id: user.resident.id,
            nationalId: user.resident.nationalId,
            dateOfBirth: user.resident.dateOfBirth,
            relationship: user.resident.relationship,
          }
        : null,
      vehicles:
        user.resident?.vehicles?.map((vehicle: any) => ({
          id: vehicle.id,
          vehicleType: vehicle.vehicleType,
          model: vehicle.model,
          plateNumber: vehicle.plateNumber,
          color: vehicle.color,
          notes: vehicle.notes,
          isPrimary: vehicle.isPrimary,
          createdAt: vehicle.createdAt,
          updatedAt: vehicle.updatedAt,
        })) ?? [],
      units,
      legacyResidentLinks,
      personaHints: {
        resolvedPersona,
        isOwner: hasOwnerAccess,
        isTenant: hasTenantAccess,
        isFamily: hasFamilyAccess,
        isDelegate: hasDelegateAccess,
        isPreDeliveryOwner,
        canManageWorkers,
      },
      featureAvailability: {
        canViewBanners: permissionSet.has('banner.view'),
        canUseServices: baseCanUseServices && personaPolicy.canUseServices,
        canUseRequests: baseCanUseRequests && personaPolicy.canUseRequests,
        canUseBookings: baseCanUseBookings && personaPolicy.canUseBookings,
        canUseComplaints: baseCanUseComplaints && personaPolicy.canUseComplaints,
        canUseQr: baseCanUseQr && personaPolicy.canUseQr,
        canViewFinance: baseCanViewFinance && personaPolicy.canViewFinance,
        canManageHousehold:
          baseCanManageHousehold && personaPolicy.canManageHousehold,
        canUseDiscover: personaPolicy.canUseDiscover,
        canUseHelpCenter: personaPolicy.canUseHelpCenter,
        canUseUtilities: personaPolicy.canUseUtilities,
      },
    };
  }

  async updateCurrentUserBasicProfile(userId: string, dto: UpdateMeProfileDto) {
    // Product policy: contact profile edits are request-based and require admin approval.
    return this.createCurrentUserProfileChangeRequest(userId, dto);
  }

  async updateCurrentUserProfilePhoto(userId: string, profilePhotoId: string) {
    await this.assertActivationFileCategory(
      profilePhotoId,
      $Enums.FileCategory.PROFILE_PHOTO,
      'PROFILE_PHOTO_REQUIRED',
    );

    const conflict = await this.prisma.user.findFirst({
      where: {
        id: { not: userId },
        profilePhotoId,
      },
      select: { id: true },
    });
    if (conflict) {
      throw new BadRequestException({
        message: 'Provided profile photo is already linked to another account',
        reasonCode: 'PROFILE_PHOTO_REQUIRED',
      });
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { profilePhotoId },
    });

    return this.getCurrentUserBootstrap(userId);
  }

  async createCurrentUserProfileChangeRequest(
    userId: string,
    dto: CreateProfileChangeRequestDto,
  ) {
    const nameEN = dto.nameEN?.trim();
    const nameAR = dto.nameAR?.trim();
    const email = dto.email?.trim().toLowerCase();
    const phone = dto.phone?.trim();

    if (!nameEN && !nameAR && !email && !phone) {
      throw new BadRequestException('At least one profile field must be provided');
    }

    if (email) {
      const existingByEmail = await this.prisma.user.findFirst({
        where: { email, id: { not: userId } },
        select: { id: true },
      });
      if (existingByEmail) {
        throw new BadRequestException('Email is already in use by another account');
      }
    }

    if (phone) {
      const existingByPhone = await this.prisma.user.findFirst({
        where: { phone, id: { not: userId } },
        select: { id: true },
      });
      if (existingByPhone) {
        throw new BadRequestException('Phone is already in use by another account');
      }
    }

    const current = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, nameEN: true, nameAR: true, email: true, phone: true },
    });
    if (!current) throw new NotFoundException('User not found');

    const requestedFields = {
      ...(nameEN ? { nameEN } : {}),
      ...(nameAR ? { nameAR } : {}),
      ...(email ? { email } : {}),
      ...(phone ? { phone } : {}),
    } as Record<string, unknown>;

    if (Object.keys(requestedFields).length === 0) {
      throw new BadRequestException('No valid fields were provided');
    }

    const pending = await this.prisma.profileChangeRequest.findFirst({
      where: {
        userId,
        status: ProfileChangeRequestStatus.PENDING,
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });

    if (pending) {
      throw new BadRequestException(
        'A pending profile update request already exists. Wait for admin review.',
      );
    }

    return this.prisma.profileChangeRequest.create({
      data: {
        userId,
        requestedFields: requestedFields as any,
        previousSnapshot: {
          nameEN: current.nameEN,
          nameAR: current.nameAR,
          email: current.email,
          phone: current.phone,
        } as any,
      },
    });
  }

  async listCurrentUserProfileChangeRequests(userId: string) {
    return this.prisma.profileChangeRequest.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listProfileChangeRequestsForAdmin(
    actorUserId: string,
    status?: ProfileChangeRequestStatus | 'ALL',
  ) {
    await this.assertAdminUser(actorUserId);
    return this.prisma.profileChangeRequest.findMany({
      where:
        status && status !== 'ALL'
          ? {
              status: status as ProfileChangeRequestStatus,
            }
          : undefined,
      include: {
        user: {
          select: {
            id: true,
            nameEN: true,
            nameAR: true,
            email: true,
            phone: true,
          },
        },
        reviewedBy: {
          select: { id: true, nameEN: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async approveProfileChangeRequest(requestId: string, actorUserId: string) {
    await this.assertAdminUser(actorUserId);

    const request = await this.prisma.profileChangeRequest.findUnique({
      where: { id: requestId },
      select: {
        id: true,
        userId: true,
        status: true,
        requestedFields: true,
      },
    });

    if (!request) throw new NotFoundException('Profile change request not found');
    if (request.status !== ProfileChangeRequestStatus.PENDING) {
      throw new BadRequestException('Profile change request is no longer pending');
    }

    const fields = (request.requestedFields ?? {}) as Record<string, unknown>;
    const nameEN = typeof fields.nameEN === 'string' ? fields.nameEN.trim() : undefined;
    const nameAR = typeof fields.nameAR === 'string' ? fields.nameAR.trim() : undefined;
    const email =
      typeof fields.email === 'string' ? fields.email.trim().toLowerCase() : undefined;
    const phone = typeof fields.phone === 'string' ? fields.phone.trim() : undefined;

    if (email) {
      const existingByEmail = await this.prisma.user.findFirst({
        where: { email, id: { not: request.userId } },
        select: { id: true },
      });
      if (existingByEmail) {
        throw new BadRequestException('Email is already in use by another account');
      }
    }

    if (phone) {
      const existingByPhone = await this.prisma.user.findFirst({
        where: { phone, id: { not: request.userId } },
        select: { id: true },
      });
      if (existingByPhone) {
        throw new BadRequestException('Phone is already in use by another account');
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: request.userId },
        data: {
          ...(nameEN ? { nameEN } : {}),
          ...(nameAR ? { nameAR } : {}),
          ...(email ? { email } : {}),
          ...(phone ? { phone } : {}),
        },
      });

      await tx.profileChangeRequest.update({
        where: { id: request.id },
        data: {
          status: ProfileChangeRequestStatus.APPROVED,
          reviewedById: actorUserId,
          reviewedAt: new Date(),
          rejectionReason: null,
        },
      });
    });

    return this.prisma.profileChangeRequest.findUnique({
      where: { id: request.id },
      include: {
        user: {
          select: { id: true, nameEN: true, nameAR: true, email: true, phone: true },
        },
        reviewedBy: {
          select: { id: true, nameEN: true, email: true },
        },
      },
    });
  }

  async rejectProfileChangeRequest(
    requestId: string,
    actorUserId: string,
    rejectionReason?: string,
  ) {
    await this.assertAdminUser(actorUserId);

    const request = await this.prisma.profileChangeRequest.findUnique({
      where: { id: requestId },
      select: { id: true, status: true },
    });

    if (!request) throw new NotFoundException('Profile change request not found');
    if (request.status !== ProfileChangeRequestStatus.PENDING) {
      throw new BadRequestException('Profile change request is no longer pending');
    }

    return this.prisma.profileChangeRequest.update({
      where: { id: request.id },
      data: {
        status: ProfileChangeRequestStatus.REJECTED,
        reviewedById: actorUserId,
        reviewedAt: new Date(),
        rejectionReason: rejectionReason?.trim() || null,
      },
      include: {
        user: {
          select: { id: true, nameEN: true, nameAR: true, email: true, phone: true },
        },
        reviewedBy: {
          select: { id: true, nameEN: true, email: true },
        },
      },
    });
  }

  async updateCurrentUserSecurity(userId: string, dto: UpdateMeSecurityDto) {
    const targetState = dto.twoFactorEnabled === true;
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        phone: true,
        twoFactorEnabled: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');

    if (targetState) {
      const capabilities = await this.integrationConfigService.getMobileCapabilities();
      const smsReady = capabilities.smsOtp && Boolean(user.phone);
      const emailReady = capabilities.smtpMail && Boolean(user.email);
      if (!smsReady && !emailReady) {
        throw new BadRequestException(
          '2FA cannot be enabled now. Add phone/email and ensure OTP channels are configured.',
        );
      }
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorEnabled: targetState,
      },
    });

    return this.getCurrentUserBootstrap(userId);
  }

  async getActivationStatus(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        phone: true,
        nameEN: true,
        nameAR: true,
        userStatus: true,
        phoneVerifiedAt: true,
        emailVerifiedAt: true,
        nationalIdFileId: true,
        profilePhotoId: true,
      },
    });

    if (!user) throw new NotFoundException('User not found');
    return this.formatActivationStatus(user);
  }

  async updateActivationDraft(userId: string, dto: UpdateActivationDraftDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        phone: true,
        nameEN: true,
        nameAR: true,
        userStatus: true,
        phoneVerifiedAt: true,
        nationalIdFileId: true,
        profilePhotoId: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');

    if (user.userStatus === UserStatusEnum.SUSPENDED) {
      throw new ForbiddenException('Account is suspended');
    }
    if (user.userStatus === UserStatusEnum.DISABLED) {
      throw new ForbiddenException('Account is disabled');
    }

    const updateData: { nationalIdFileId?: string; profilePhotoId?: string } = {};

    if (dto.nationalIdFileId !== undefined) {
      await this.assertActivationFileCategory(
        dto.nationalIdFileId,
        $Enums.FileCategory.NATIONAL_ID,
        'NATIONAL_ID_REQUIRED',
      );
      const conflict = await this.prisma.user.findFirst({
        where: {
          id: { not: userId },
          nationalIdFileId: dto.nationalIdFileId,
        },
        select: { id: true },
      });
      if (conflict) {
        throw new BadRequestException({
          message: 'Provided national ID file is already linked to another account',
          reasonCode: 'NATIONAL_ID_REQUIRED',
        });
      }
      updateData.nationalIdFileId = dto.nationalIdFileId;
    }

    if (dto.profilePhotoId !== undefined) {
      await this.assertActivationFileCategory(
        dto.profilePhotoId,
        $Enums.FileCategory.PROFILE_PHOTO,
        'PROFILE_PHOTO_REQUIRED',
      );
      const conflict = await this.prisma.user.findFirst({
        where: {
          id: { not: userId },
          profilePhotoId: dto.profilePhotoId,
        },
        select: { id: true },
      });
      if (conflict) {
        throw new BadRequestException({
          message: 'Provided profile photo is already linked to another account',
          reasonCode: 'PROFILE_PHOTO_REQUIRED',
        });
      }
      updateData.profilePhotoId = dto.profilePhotoId;
    }

    if (Object.keys(updateData).length > 0) {
      await this.prisma.user.update({
        where: { id: userId },
        data: updateData,
      });
    }

    const fresh = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        phone: true,
        nameEN: true,
        nameAR: true,
        userStatus: true,
        phoneVerifiedAt: true,
        nationalIdFileId: true,
        profilePhotoId: true,
      },
    });
    if (!fresh) throw new NotFoundException('User not found');
    return this.formatActivationStatus(fresh);
  }

  async completeActivation(userId: string, dto: CompleteActivationDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        nameEN: true,
        nameAR: true,
        userStatus: true,
        phone: true,
        phoneVerifiedAt: true,
        nationalIdFileId: true,
        profilePhotoId: true,
      },
    });

    if (!user) throw new NotFoundException('User not found');

    if (user.userStatus === UserStatusEnum.SUSPENDED) {
      throw new ForbiddenException('Account is suspended');
    }
    if (user.userStatus === UserStatusEnum.DISABLED) {
      throw new ForbiddenException('Account is disabled');
    }

    if (!dto.newPassword || dto.newPassword.length < 8) {
      throw new BadRequestException({
        message: 'Password must be at least 8 characters',
        reasonCode: 'PASSWORD_INVALID',
      });
    }

    const [nationalIdFile, profilePhotoFile] = await Promise.all([
      this.prisma.file.findUnique({
        where: { id: dto.nationalIdFileId },
        select: { id: true, category: true },
      }),
      this.prisma.file.findUnique({
        where: { id: dto.profilePhotoId },
        select: { id: true, category: true },
      }),
    ]);

    if (!nationalIdFile || nationalIdFile.category !== $Enums.FileCategory.NATIONAL_ID) {
      throw new BadRequestException({
        message: 'Invalid national ID file',
        reasonCode: 'NATIONAL_ID_REQUIRED',
      });
    }
    if (
      !profilePhotoFile ||
      profilePhotoFile.category !== $Enums.FileCategory.PROFILE_PHOTO
    ) {
      throw new BadRequestException({
        message: 'Invalid profile photo file',
        reasonCode: 'PROFILE_PHOTO_REQUIRED',
      });
    }

    const fileConflict = await this.prisma.user.findFirst({
      where: {
        id: { not: userId },
        OR: [
          { nationalIdFileId: dto.nationalIdFileId },
          { profilePhotoId: dto.profilePhotoId },
        ],
      },
      select: { id: true },
    });
    if (fileConflict) {
      throw new BadRequestException(
        'Provided files are already linked to another account',
      );
    }

    if (user.phone && !user.phoneVerifiedAt) {
      throw new BadRequestException({
        message: 'Phone verification is required before activation',
        reasonCode: 'PHONE_OTP_REQUIRED',
      });
    }

    const precheck = this.buildActivationChecklist({
      phone: user.phone,
      phoneVerifiedAt: user.phoneVerifiedAt,
      nationalIdFileId: dto.nationalIdFileId,
      profilePhotoId: dto.profilePhotoId,
      userStatus: user.userStatus,
    });
    if (!precheck.checklist.hasNationalId) {
      throw new BadRequestException({
        message: 'National ID file is required before activation',
        reasonCode: 'NATIONAL_ID_REQUIRED',
      });
    }
    if (!precheck.checklist.hasProfilePhoto) {
      throw new BadRequestException({
        message: 'Profile photo is required before activation',
        reasonCode: 'PROFILE_PHOTO_REQUIRED',
      });
    }
    if (precheck.checklist.requiresPhoneOtp && !precheck.checklist.phoneVerified) {
      throw new BadRequestException({
        message: 'Phone verification is required before activation',
        reasonCode: 'PHONE_OTP_REQUIRED',
      });
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 12);
    const nameEN = dto.nameEN?.trim();
    const nameAR = dto.nameAR?.trim();

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          passwordHash,
          nationalIdFileId: dto.nationalIdFileId,
          profilePhotoId: dto.profilePhotoId,
          userStatus: UserStatusEnum.ACTIVE,
          ...(nameEN ? { nameEN } : {}),
          ...(nameAR ? { nameAR } : {}),
        },
      });

      await tx.userStatusLog.create({
        data: {
          userId,
          newStatus: UserStatusEnum.ACTIVE,
          source: 'MANUAL',
          note: 'First-login activation completed by user',
        },
      });
    });
    await this.ensureDefaultCommunityRoleForUser(userId);

    return {
      message: 'Activation completed successfully',
      userStatus: UserStatusEnum.ACTIVE,
      mustCompleteActivation: false,
    };
  }

  // ================= REGISTER =================
  async register(
    email: string,
    password: string,
    nameEN: string,
    nameAR?: string,
  ) {
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new BadRequestException('Email already in use');

    const hashed = await bcrypt.hash(password, 12);

    const user = await this.prisma.user.create({
      data: { email, passwordHash: hashed, nameEN, nameAR },
      include: { roles: { include: { role: true } } },
    });

    return this.generateTokens(user);
  }

  // ================= GENERATE TOKENS =================
  async generateTokens(user: any, prismaClient?: any) {
    // Roles of the user
    const roles = user.roles.map((ur) => ur.role.name);

    // Permissions resolved via cache service
    const permissions = this.permissionCache.resolveUserPermissions(roles);

    const payload = {
      sub: user.id,
      roles,
      permissions: Array.from(permissions), // convert Set to array for JWT
      sv: user.sessionVersion ?? 0, // session version — used to invalidate old JWTs on session takeover
    };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: this.accessTokenExpiresIn,
    });

    // Refresh token
    const rawRefreshToken = crypto.randomUUID();
    const tokenHash = await bcrypt.hash(rawRefreshToken, 12);

    const prisma = prismaClient || this.prisma;
    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(
          Date.now() + this.refreshTokenExpiresInDays * 24 * 60 * 60 * 1000,
        ),
      },
    });

    return { accessToken, refreshToken: rawRefreshToken };
  }

  // ================= SIGNUP WITH REFERRAL =================
  async signupWithReferral(dto: SignupWithReferralDto) {
    if (process.env.ENABLE_REFERRAL_SIGNUP !== 'true') {
      throw new NotFoundException();
    }
    const { phone, name, password } = dto;

    const { tokens, convertedReferral, createdUser } = await this.prisma.$transaction(async (tx) => {
      // Validate referral exists and is valid
      const validation = await this.referralsService.validateReferral(phone, tx);
      if (!validation.valid) {
        console.error(
          `Referral validation failed for phone ${phone}: ${validation.message || 'Unknown reason'}`,
        );
        throw new BadRequestException(
          'No valid referral found for this phone number',
        );
      }

      // Check if user already exists
      const existingUser = await tx.user.findFirst({
        where: {
          OR: [{ phone }, { email: phone }], // Allow phone as email fallback
        },
      });

      if (existingUser) {
        console.error(
          `User already exists for phone ${phone}: user ID ${existingUser.id}, email: ${existingUser.email}`,
        );
        throw new BadRequestException(
          'User already exists with this phone number',
        );
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 12);

      // Create user
      const user = await tx.user.create({
        data: {
          phone,
          nameEN: name,
          passwordHash,
          signupSource: 'referral',
        },
        include: { roles: { include: { role: true } } },
      });

      // Convert the referral
      const convertedReferral = await this.referralsService.convertReferral(
        phone,
        user.id,
        tx,
      );

      const tokens = await this.generateTokens(user, tx);

      return { tokens, convertedReferral, createdUser: user };
    });

    try {
      const referrerName =
        convertedReferral.referrer?.nameEN ||
        convertedReferral.referrer?.nameAR ||
        'User';
      this.eventEmitter.emit(
        'referral.converted',
        new ReferralConvertedEvent(
          convertedReferral.id,
          convertedReferral.referrerId,
          referrerName,
          createdUser.id,
          (createdUser.nameEN ?? createdUser.nameAR ?? createdUser.phone) as string,
        ),
      );
    } catch (err: unknown) {
      // Don’t fail signup if notifications fail.
      const message = err instanceof Error ? err.message : String(err);
      console.error('Failed to emit referral.converted event:', message);
    }

    return tokens;
  }

  // ================= REFRESH TOKEN =================
  async refresh(userId: string, incomingToken: string) {
    const stored = await this.prisma.refreshToken.findFirst({
      where: { userId, revoked: false },
      orderBy: { createdAt: 'desc' },
    });

    if (!stored || stored.expiresAt < new Date()) {
      await this.prisma.refreshToken.updateMany({
        where: { userId },
        data: { revoked: true },
      });
      throw new UnauthorizedException('Session expired. Please login again.');
    }

    const isValid = await bcrypt.compare(incomingToken, stored.tokenHash);
    if (!isValid) {
      await this.prisma.refreshToken.updateMany({
        where: { userId },
        data: { revoked: true },
      });
      throw new UnauthorizedException(
        'Compromised session. Please login again.',
      );
    }

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revoked: true },
    });

    // Fetch user with roles only, no need to fetch permissions manually
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { roles: { include: { role: true } } },
    });

    return this.generateTokens(user);
  }

  async logout(userId: string, incomingRefreshToken?: string) {
    const activeTokens = await this.prisma.refreshToken.findMany({
      where: {
        userId,
        revoked: false,
        expiresAt: { gt: new Date() },
      },
      select: {
        id: true,
        tokenHash: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (activeTokens.length === 0) {
      return { success: true, revokedCount: 0 };
    }

    if (incomingRefreshToken && incomingRefreshToken.trim().length > 0) {
      for (const token of activeTokens) {
        const isMatch = await bcrypt.compare(
          incomingRefreshToken,
          token.tokenHash,
        );
        if (isMatch) {
          await this.prisma.refreshToken.update({
            where: { id: token.id },
            data: { revoked: true },
          });
          return { success: true, revokedCount: 1 };
        }
      }
    }

    const revokeResult = await this.prisma.refreshToken.updateMany({
      where: {
        userId,
        revoked: false,
      },
      data: { revoked: true },
    });

    return { success: true, revokedCount: revokeResult.count };
  }

  // ================= FORGOT PASSWORD =================
  async forgotPassword(dto: ForgotPasswordDto) {
    const { email, phone } = dto;
    if (!email && !phone) {
      throw new BadRequestException('Either email or phone must be provided');
    }

    const user = await this.prisma.user.findFirst({
      where: {
        OR: email ? [{ email }] : phone ? [{ phone }] : [],
      },
    });

    if (!user) {
      // Return generic success to prevent user enumeration
      return { message: 'If the account exists, a reset link has been sent.' };
    }

    if (user.userStatus !== 'ACTIVE') {
      return {
        message:
          'Account is not activated yet. Please sign in with your initial credentials first to complete activation.',
        code: 'ACCOUNT_NOT_ACTIVATED',
      };
    }

    // Invalidate any existing tokens
    await this.prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });

    // Generate secure token
    const rawToken = crypto.randomBytes(32).toString('hex');
    // Use a deterministic digest so we can look up the token efficiently during reset.
    // Backwards compatibility: resetPassword also supports legacy bcrypt-hashed tokens.
    const tokenHash = crypto
      .createHash('sha256')
      .update(rawToken)
      .digest('hex');

    // Store token
    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
      },
    });

    const capabilities = await this.integrationConfigService.getMobileCapabilities();

    // Send reset link
    if (email) {
      if (!capabilities.smtpMail) {
        return {
          message:
            'If the account exists, a reset link has been sent. Email reset is currently unavailable.',
        };
      }
      const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${rawToken}`;
      await this.notificationsService.sendNotification(
        {
          type: 'OTP', // reuse, or create new type
          title: 'Password Reset',
          messageEn: `Click here to reset your password: ${resetLink}`,
          channels: ['EMAIL'],
          targetAudience: 'SPECIFIC_RESIDENCES',
          audienceMeta: { userIds: [user.id] },
        },
        undefined, // no sender
      );
    } else if (phone) {
      if (!capabilities.smsOtp) {
        return {
          message:
            'If the account exists, a reset link has been sent. SMS reset is currently unavailable.',
        };
      }
      // For phone, send OTP instead of link
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const otpHash = await bcrypt.hash(otp, 12);

      await this.prisma.phoneVerificationOtp.create({
        data: {
          userId: user.id,
          otpHash,
          expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
        },
      });

      await this.notificationsService.sendNotification(
        {
          type: 'OTP',
          title: 'Password Reset OTP',
          messageEn: `Your OTP for password reset: ${otp}`,
          channels: ['SMS'],
          targetAudience: 'SPECIFIC_RESIDENCES',
          audienceMeta: { userIds: [user.id] },
        },
        undefined,
      );
    }

    return { message: 'If the account exists, a reset link has been sent.' };
  }

  // ================= RESET PASSWORD =================
  async resetPassword(dto: ResetPasswordDto) {
    const { token, newPassword } = dto;

    const now = new Date();

    // Prefer deterministic lookup (new tokens).
    const tokenDigest = crypto.createHash('sha256').update(token).digest('hex');

    let storedToken = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash: tokenDigest },
    });

    // Fallback: legacy tokens stored with bcrypt.
    if (!storedToken) {
      const candidates = await this.prisma.passwordResetToken.findMany({
        where: { usedAt: null, expiresAt: { gt: now } },
        orderBy: { createdAt: 'desc' },
        take: 200,
      });

      for (const candidate of candidates) {
        const hash = candidate.tokenHash;
        if (typeof hash !== 'string' || !hash.startsWith('$2')) continue;
        const match = await bcrypt.compare(token, hash).catch(() => false);
        if (match) {
          storedToken = candidate;
          break;
        }
      }
    }

    if (!storedToken || storedToken.usedAt || storedToken.expiresAt <= now) {
      throw new BadRequestException('Invalid or expired token');
    }

    // Mark as used
    await this.prisma.passwordResetToken.update({
      where: { id: storedToken.id },
      data: { usedAt: new Date() },
    });

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 12);

    // Update password
    await this.prisma.user.update({
      where: { id: storedToken.userId },
      data: { passwordHash },
    });

    // Revoke all refresh tokens for security
    await this.prisma.refreshToken.updateMany({
      where: { userId: storedToken.userId },
      data: { revoked: true },
    });

    return { message: 'Password reset successfully' };
  }

  // ================= VERIFY EMAIL =================
  async verifyEmail(dto: VerifyEmailDto, userId: string) {
    const { token } = dto;

    const storedToken = await this.prisma.emailVerificationToken.findFirst({
      where: { userId, usedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });

    if (!storedToken) {
      throw new BadRequestException('Invalid or expired token');
    }

    const isValid = await bcrypt.compare(token, storedToken.tokenHash);
    if (!isValid) {
      throw new BadRequestException('Invalid token');
    }

    await this.prisma.emailVerificationToken.update({
      where: { id: storedToken.id },
      data: { usedAt: new Date() },
    });

    await this.prisma.user.update({
      where: { id: userId },
      data: { emailVerifiedAt: new Date() },
    });

    return { message: 'Email verified successfully' };
  }

  // ================= SEND EMAIL VERIFICATION =================
  async sendEmailVerification(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    });

    if (!user?.email) {
      throw new BadRequestException('User has no email address on file');
    }

    // Invalidate existing tokens for this user
    await this.prisma.emailVerificationToken.updateMany({
      where: { userId, usedAt: null },
      data: { usedAt: new Date() },
    });

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = await bcrypt.hash(rawToken, 12);

    await this.prisma.emailVerificationToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
      },
    });

    const verifyLink = `${process.env.FRONTEND_URL}/verify-email?token=${rawToken}`;

    await this.notificationsService.sendNotification(
      {
        type: 'OTP',
        title: 'Verify your email',
        messageEn: `Use this token to verify your email: ${rawToken}\n\nOr click: ${verifyLink}`,
        channels: ['EMAIL'],
        targetAudience: 'SPECIFIC_RESIDENCES',
        audienceMeta: { userIds: [userId] },
      },
      undefined,
    );

    return { message: 'Verification email sent' };
  }

  // ================= SEND PHONE OTP =================
  async sendPhoneOtp(dto: SendPhoneOtpDto, userId: string) {
    const { phone } = dto;

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { phone: true },
    });

    if (!user?.phone) {
      throw new BadRequestException('User has no phone number on file');
    }

    if (user.phone !== phone) {
      throw new BadRequestException('Phone does not match the current profile');
    }

    const smsOtpDiagnostics = await this.integrationConfigService.getSmsOtpDiagnostics();
    if (!smsOtpDiagnostics.ready) {
      throw new ServiceUnavailableException({
        message: 'Firebase OTP verification is currently unavailable. Please try again later.',
        reasonCode: 'FIREBASE_OTP_NOT_CONFIGURED',
        details: {
          smsOtpEnabled: smsOtpDiagnostics.smsOtpEnabled,
          smsOtpConfigured: smsOtpDiagnostics.smsOtpConfigured,
          fcmConfigured: smsOtpDiagnostics.fcmConfigured,
        },
      });
    }
    this.logger.log(
      `Firebase OTP flow initiated for user ${userId}. OTP dispatch is handled client-side by Firebase SDK.`,
    );
    return {
      message:
        'Start phone verification from the mobile Firebase flow, then submit firebaseIdToken to verify-phone-otp.',
      provider: 'FIREBASE_AUTH',
    };
  }

  // ================= VERIFY PHONE OTP =================
  async verifyPhoneOtp(dto: VerifyPhoneOtpDto, userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, phone: true },
    });
    if (!user?.phone) {
      throw new BadRequestException('User has no phone number on file');
    }

    const authClient = await this.getFirebaseAuthClient();
    const token = String(dto.firebaseIdToken ?? '').trim();
    if (!token) {
      throw new BadRequestException('firebaseIdToken is required');
    }
    let decoded: any;
    try {
      decoded = await authClient.verifyIdToken(token, true);
    } catch {
      throw new BadRequestException('Invalid or expired Firebase ID token');
    }
    const firebasePhone = String(decoded?.phone_number ?? '').trim();
    if (!firebasePhone) {
      throw new BadRequestException('Firebase token does not include phone_number claim');
    }

    const expected = this.normalizePhoneForComparison(user.phone);
    const actual = this.normalizePhoneForComparison(firebasePhone);
    if (!expected || expected !== actual) {
      throw new BadRequestException(
        'Verified Firebase phone number does not match account phone number',
      );
    }

    await this.prisma.phoneVerificationOtp.updateMany({
      where: { userId, usedAt: null },
      data: { usedAt: new Date() },
    });

    await this.prisma.user.update({
      where: { id: userId },
      data: { phoneVerifiedAt: new Date() },
    });

    return { message: 'Phone verified successfully' };
  }
}

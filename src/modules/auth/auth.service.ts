import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
  NotFoundException,
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
import { NotificationsService } from '../notifications/notifications.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ReferralConvertedEvent } from '../../events/contracts/referral-converted.event';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private permissionCache: PermissionCacheService,
    private referralsService: ReferralsService,
    private notificationsService: NotificationsService,
    private eventEmitter: EventEmitter2,
  ) {}

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

    await this.prisma.user.update({
      where: { id: user.id },
      data: { loginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
    });

    // Skip unit access check for admin roles (SUPER_ADMIN, MANAGER)
    const isAdmin = user.roles.some((ur) =>
      ['SUPER_ADMIN', 'MANAGER'].includes(ur.role.name),
    );

    if (!isAdmin) {
      const hasActiveAccess = await this.prisma.unitAccess.findFirst({
        where: {
          userId: user.id,
          status: 'ACTIVE',
        },
      });

      if (!hasActiveAccess) {
        throw new ForbiddenException('Your access has been revoked.');
      }
    }

    const permissions = this.permissionCache.resolveUserPermissions(
      user.roles.map((ur) => ur.role.name),
    );

    return this.generateTokens(user);
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
    const isPreDeliveryOwner = units.some(
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

    return {
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        nameEN: user.nameEN,
        nameAR: user.nameAR,
        userStatus: user.userStatus,
        signupSource: user.signupSource,
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
        canUseServices:
          permissionSet.has('service.read') ||
          permissionSet.has('service_request.create'),
        canUseBookings:
          permissionSet.has('booking.create') || canBookFacilities,
        canUseComplaints: permissionSet.has('complaint.report'),
        canUseQr: permissionSet.has('qr.generate') && canGenerateQr,
        canViewFinance:
          permissionSet.has('invoice.view_own') &&
          permissionSet.has('violation.view_own') &&
          canViewFinancials,
        canManageHousehold:
          hasOwnerAccess || hasTenantAccess || hasDelegateAccess || canManageWorkers,
      },
    };
  }

  async updateCurrentUserBasicProfile(userId: string, dto: UpdateMeProfileDto) {
    const nameEN = dto.nameEN?.trim();
    const nameAR = dto.nameAR?.trim();

    if (!nameEN && !nameAR) {
      throw new BadRequestException('At least one profile field must be provided');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(nameEN ? { nameEN } : {}),
        ...(nameAR ? { nameAR } : {}),
      },
    });

    return this.getCurrentUserBootstrap(userId);
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
    };

    const accessToken = this.jwtService.sign(payload, { expiresIn: '15m' });

    // Refresh token
    const rawRefreshToken = crypto.randomUUID();
    const tokenHash = await bcrypt.hash(rawRefreshToken, 12);

    const prisma = prismaClient || this.prisma;
    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
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

    // Send reset link
    if (email) {
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

    // Invalidate existing OTPs
    await this.prisma.phoneVerificationOtp.updateMany({
      where: { userId, usedAt: null },
      data: { usedAt: new Date() },
    });

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = await bcrypt.hash(otp, 12);

    await this.prisma.phoneVerificationOtp.create({
      data: {
        userId,
        otpHash,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
      },
    });

    // Send SMS
    await this.notificationsService.sendNotification(
      {
        type: 'OTP',
        title: 'Phone Verification OTP',
        messageEn: `Your OTP: ${otp}`,
        channels: ['SMS'],
        targetAudience: 'SPECIFIC_RESIDENCES',
        audienceMeta: { userIds: [userId] },
      },
      undefined,
    );

    return { message: 'OTP sent successfully' };
  }

  // ================= VERIFY PHONE OTP =================
  async verifyPhoneOtp(dto: VerifyPhoneOtpDto, userId: string) {
    const { otp } = dto;

    const storedOtp = await this.prisma.phoneVerificationOtp.findFirst({
      where: { userId, usedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });

    if (!storedOtp) {
      throw new BadRequestException('Invalid or expired OTP');
    }

    const isValid = await bcrypt.compare(otp, storedOtp.otpHash);
    if (!isValid) {
      throw new BadRequestException('Invalid OTP');
    }

    await this.prisma.phoneVerificationOtp.update({
      where: { id: storedOtp.id },
      data: { usedAt: new Date() },
    });

    await this.prisma.user.update({
      where: { id: userId },
      data: { phoneVerifiedAt: new Date() },
    });

    return { message: 'Phone verified successfully' };
  }
}

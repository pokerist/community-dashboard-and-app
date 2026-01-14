import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
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
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private permissionCache: PermissionCacheService,
    private referralsService: ReferralsService,
    private notificationsService: NotificationsService,
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

    // Check if still pending registration (email OR phone)
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

    const permissions = this.permissionCache.resolveUserPermissions(
      user.roles.map((ur) => ur.role.name),
    );

    return this.generateTokens(user);
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
  async generateTokens(user: any) {
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

    await this.prisma.refreshToken.create({
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
    const { phone, name, password } = dto;

    // Validate referral exists and is valid
    const validation = await this.referralsService.validateReferral(phone);
    if (!validation.valid) {
      throw new BadRequestException(
        'No valid referral found for this phone number',
      );
    }

    // Check if user already exists
    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [{ phone }, { email: phone }], // Allow phone as email fallback
      },
    });

    if (existingUser) {
      throw new BadRequestException(
        'User already exists with this phone number',
      );
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create user
    const user = await this.prisma.user.create({
      data: {
        phone,
        nameEN: name,
        passwordHash,
        signupSource: 'referral',
      },
      include: { roles: { include: { role: true } } },
    });

    // Convert the referral
    await this.referralsService.convertReferral(phone, user.id);

    // Generate tokens
    return this.generateTokens(user);
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
    const tokenHash = await bcrypt.hash(rawToken, 12);

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
          type: 'PAYMENT_REMINDER', // reuse, or create new type
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
          type: 'PAYMENT_REMINDER',
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

    // Find token
    const storedToken = await this.prisma.passwordResetToken.findFirst({
      where: { usedAt: null, expiresAt: { gt: new Date() } },
    });

    if (!storedToken) {
      throw new BadRequestException('Invalid or expired token');
    }

    // Verify token
    const isValid = await bcrypt.compare(token, storedToken.tokenHash);
    if (!isValid) {
      throw new BadRequestException('Invalid token');
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

  // ================= SEND PHONE OTP =================
  async sendPhoneOtp(dto: SendPhoneOtpDto, userId: string) {
    const { phone } = dto;

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
        type: 'PAYMENT_REMINDER',
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

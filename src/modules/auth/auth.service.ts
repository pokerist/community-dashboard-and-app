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

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private permissionCache: PermissionCacheService,
    private referralsService: ReferralsService,
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
      throw new BadRequestException('No valid referral found for this phone number');
    }

    // Check if user already exists
    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [{ phone }, { email: phone }], // Allow phone as email fallback
      },
    });

    if (existingUser) {
      throw new BadRequestException('User already exists with this phone number');
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
}

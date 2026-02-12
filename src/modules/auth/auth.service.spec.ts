import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { PermissionCacheService } from './permission-cache.service';
import { ReferralsService } from '../referrals/referrals.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const mockPrisma: Partial<Record<keyof PrismaService, any>> = {
      user: {},
      refreshToken: {},
      pendingRegistration: {},
      unitAccess: {},
      passwordResetToken: {},
      phoneVerificationOtp: {},
      emailVerificationToken: {},
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: { sign: jest.fn() } },
        {
          provide: PermissionCacheService,
          useValue: { resolveUserPermissions: jest.fn(() => new Set()) },
        },
        {
          provide: ReferralsService,
          useValue: {
            validateReferral: jest.fn(),
            convertReferral: jest.fn(),
          },
        },
        { provide: NotificationsService, useValue: { sendNotification: jest.fn() } },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

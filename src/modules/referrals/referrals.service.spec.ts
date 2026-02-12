import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { ReferralsService } from './referrals.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

const mockPrisma: any = {
  user: { findUnique: jest.fn(), findFirst: jest.fn() },
  referral: {
    findFirst: jest.fn(),
    create: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
};

describe('ReferralsService', () => {
  let service: ReferralsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReferralsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    service = module.get<ReferralsService>(ReferralsService);
    jest.clearAllMocks();
  });

  it('create should throw if referrer is not found', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    await expect(
      service.create(
        { friendFullName: 'X', friendMobile: '+201234567890' } as any,
        'ref-1',
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('create should prevent self-referral', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ phone: '+201234567890' });

    await expect(
      service.create(
        { friendFullName: 'X', friendMobile: '+201234567890' } as any,
        'ref-1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('create should prevent duplicate active referral for same phone', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ phone: '+201111111111' });
    mockPrisma.referral.findFirst.mockResolvedValue({ id: 'r1' });

    await expect(
      service.create(
        { friendFullName: 'X', friendMobile: '+201234567890' } as any,
        'ref-1',
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('validateReferral should return valid=false when none found', async () => {
    mockPrisma.referral.findFirst.mockResolvedValue(null);

    const res = await service.validateReferral('+201234567890');
    expect(res).toEqual(
      expect.objectContaining({
        valid: false,
      }),
    );
  });

  it('validateReferral should return valid=true and referrerName when found', async () => {
    mockPrisma.referral.findFirst.mockResolvedValue({
      id: 'r1',
      referrer: { nameEN: 'Jane', nameAR: null },
    });

    const res = await service.validateReferral('+201234567890');
    expect(res).toEqual(
      expect.objectContaining({
        valid: true,
        referrerName: 'Jane',
      }),
    );
  });

  it('reject should not allow rejecting converted referral', async () => {
    mockPrisma.referral.findUnique.mockResolvedValue({ id: 'r1', status: 'CONVERTED' });

    await expect(service.reject('r1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('convertReferral should throw if no valid referral found', async () => {
    mockPrisma.referral.findFirst.mockResolvedValue(null);

    await expect(service.convertReferral('+201234567890', 'u1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});

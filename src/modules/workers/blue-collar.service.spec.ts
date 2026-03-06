import { ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../prisma/prisma.service';
import { HikCentralQrService } from '../access-control/hikcentral/hikcentral-qr.service';
import { BlueCollarService } from './blue-collar.service';

describe('BlueCollarService', () => {
  let service: BlueCollarService;

  const prismaMock = {
    admin: {
      findUnique: jest.fn(),
    },
    community: {
      findUnique: jest.fn(),
    },
    blueCollarSetting: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
    blueCollarHoliday: {
      findMany: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
    worker: {
      count: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    accessProfile: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  const hikCentralMock = {
    createQrCode: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BlueCollarService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
        {
          provide: HikCentralQrService,
          useValue: hikCentralMock,
        },
      ],
    }).compile();

    service = module.get<BlueCollarService>(BlueCollarService);
  });

  it('upsertSettings is idempotent for same community', async () => {
    prismaMock.admin.findUnique.mockResolvedValue({ id: 'admin-1' });
    prismaMock.community.findUnique.mockResolvedValue({ id: 'community-1' });
    prismaMock.blueCollarSetting.upsert
      .mockResolvedValueOnce({
        id: 'setting-1',
        communityId: 'community-1',
        workingHoursStart: '07:00',
        workingHoursEnd: '18:00',
        allowedDays: [1, 2, 3, 4, 5],
        termsAndConditions: null,
        termsVersion: 1,
        updatedAt: new Date('2026-03-06T10:00:00.000Z'),
        updatedById: 'admin-1',
      })
      .mockResolvedValueOnce({
        id: 'setting-1',
        communityId: 'community-1',
        workingHoursStart: '07:00',
        workingHoursEnd: '18:00',
        allowedDays: [1, 2, 3, 4, 5],
        termsAndConditions: null,
        termsVersion: 1,
        updatedAt: new Date('2026-03-06T10:05:00.000Z'),
        updatedById: 'admin-1',
      });

    const first = await service.upsertSettings(
      'community-1',
      {
        workingHoursStart: '07:00',
        workingHoursEnd: '18:00',
        allowedDays: [1, 2, 3, 4, 5],
      },
      'admin-1',
    );

    const second = await service.upsertSettings(
      'community-1',
      {
        workingHoursStart: '07:00',
        workingHoursEnd: '18:00',
        allowedDays: [1, 2, 3, 4, 5],
      },
      'admin-1',
    );

    expect(first.id).toBe('setting-1');
    expect(second.id).toBe('setting-1');
    expect(prismaMock.blueCollarSetting.upsert).toHaveBeenCalledTimes(2);
  });

  it('updateTermsAndConditions increments version', async () => {
    prismaMock.admin.findUnique.mockResolvedValue({ id: 'admin-1' });
    prismaMock.community.findUnique.mockResolvedValue({ id: 'community-1' });
    prismaMock.blueCollarSetting.findUnique.mockResolvedValue({
      id: 'setting-1',
      termsVersion: 3,
    });
    prismaMock.blueCollarSetting.update.mockResolvedValue({
      id: 'setting-1',
      termsAndConditions: 'Updated terms',
      termsVersion: 4,
      updatedAt: new Date('2026-03-06T12:00:00.000Z'),
    });

    const result = await service.updateTermsAndConditions(
      'community-1',
      { terms: 'Updated terms' },
      'admin-1',
    );

    expect(result.version).toBe(4);
  });

  it('blocks non-admin from settings update', async () => {
    prismaMock.admin.findUnique.mockResolvedValue(null);

    await expect(
      service.upsertSettings(
        'community-1',
        {
          workingHoursStart: '07:00',
          workingHoursEnd: '18:00',
          allowedDays: [1, 2, 3, 4, 5],
        },
        'user-1',
      ),
    ).rejects.toThrow(ForbiddenException);
  });
});

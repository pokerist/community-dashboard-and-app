import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { getActiveUnitAccess } from '../../common/utils/unit-access.util';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ClubhouseService } from '../clubhouse/clubhouse.service';

jest.mock('../../common/utils/unit-access.util', () => ({
  getActiveUnitAccess: jest.fn(),
}));

const mockPrisma: any = {
  facility: { findUnique: jest.fn() },
  unit: { findUnique: jest.fn() },
  resident: { findUnique: jest.fn() },
  booking: {
    create: jest.fn(),
    findUnique: jest.fn(),
    count: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
  },
  $transaction: jest.fn(async (cb: any) => cb(mockPrisma)),
};

describe('BookingsService', () => {
  let service: BookingsService;
  let clubhouseService: { hasClubhouseAccess: jest.Mock };

  beforeEach(async () => {
    clubhouseService = { hasClubhouseAccess: jest.fn().mockResolvedValue(true) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
        { provide: ClubhouseService, useValue: clubhouseService },
      ],
    }).compile();

    service = module.get<BookingsService>(BookingsService);
    jest.clearAllMocks();

    (getActiveUnitAccess as jest.Mock).mockResolvedValue({
      canBookFacilities: true,
    });

    mockPrisma.booking.count.mockResolvedValue(0);
    mockPrisma.booking.findFirst.mockResolvedValue(null);
  });

  it('createForActor should create booking with actor userId and resolved residentId', async () => {
    mockPrisma.unit.findUnique.mockResolvedValue({ status: 'DELIVERED' });
    mockPrisma.resident.findUnique.mockResolvedValue({ id: 'res-1' });

    mockPrisma.facility.findUnique.mockResolvedValue({
      id: 'fac-1',
      isActive: true,
      type: 'CUSTOM',
      capacity: 10,
      slotConfig: [
        {
          dayOfWeek: 5,
          startTime: '18:00',
          endTime: '19:00',
          slotDurationMinutes: 60,
          slotCapacity: 10,
        },
      ],
      slotExceptions: [],
    });

    mockPrisma.booking.create.mockResolvedValue({ id: 'b1' });

    const res = await service.createForActor('u1', {
      facilityId: 'fac-1',
      unitId: 'unit-1',
      date: '2026-02-20T00:00:00.000Z',
      startTime: '18:00',
      endTime: '19:00',
    } as any);

    expect(mockPrisma.booking.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'u1',
          residentId: 'res-1',
          unitId: 'unit-1',
          facilityId: 'fac-1',
          status: 'PENDING',
        }),
      }),
    );
    expect(res).toEqual({ id: 'b1' });
  });

  it('createForActor should require clubhouse access for multipurpose hall facilities', async () => {
    mockPrisma.unit.findUnique.mockResolvedValue({ status: 'DELIVERED' });
    mockPrisma.resident.findUnique.mockResolvedValue({ id: 'res-1' });

    mockPrisma.facility.findUnique.mockResolvedValue({
      id: 'fac-1',
      isActive: true,
      type: 'MULTIPURPOSE_HALL',
      capacity: 10,
      slotConfig: [
        {
          dayOfWeek: 5,
          startTime: '18:00',
          endTime: '19:00',
          slotDurationMinutes: 60,
          slotCapacity: 10,
        },
      ],
      slotExceptions: [],
    });

    clubhouseService.hasClubhouseAccess.mockResolvedValue(false);

    await expect(
      service.createForActor('u1', {
        facilityId: 'fac-1',
        unitId: 'unit-1',
        date: '2026-02-20T00:00:00.000Z',
        startTime: '18:00',
        endTime: '19:00',
      } as any),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('createForActor should reject when unit is not delivered', async () => {
    mockPrisma.unit.findUnique.mockResolvedValue({ status: 'NOT_DELIVERED' });

    await expect(
      service.createForActor('u1', {
        facilityId: 'fac-1',
        unitId: 'unit-1',
        date: '2026-02-20T00:00:00.000Z',
        startTime: '18:00',
        endTime: '19:00',
      } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('findOneForActor should forbid viewing another user booking with booking.view_own', async () => {
    mockPrisma.booking.findUnique.mockResolvedValue({
      id: 'b1',
      userId: 'other',
      facility: {},
      user: {},
      resident: null,
      unit: null,
    });

    await expect(
      service.findOneForActor('b1', {
        actorUserId: 'me',
        permissions: ['booking.view_own'],
        roles: [],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

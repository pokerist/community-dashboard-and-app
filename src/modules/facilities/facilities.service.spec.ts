import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../prisma/prisma.service';
import { FacilitiesService } from './facilities.service';

describe('FacilitiesService', () => {
  let service: FacilitiesService;

  const prismaMock = {
    facility: {
      findUnique: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn(),
    },
    booking: {
      findMany: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
    },
    invoice: {
      aggregate: jest.fn(),
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FacilitiesService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<FacilitiesService>(FacilitiesService);
    jest.clearAllMocks();
  });

  it('generates available slots and marks booked slots', async () => {
    prismaMock.facility.findUnique.mockResolvedValue({
      id: 'facility-1',
      slotConfig: [
        {
          id: 'cfg-1',
          dayOfWeek: 1,
          startTime: '08:00',
          endTime: '10:00',
          slotDurationMinutes: 60,
          slotCapacity: 1,
        },
      ],
      slotExceptions: [],
    });
    prismaMock.booking.findMany.mockResolvedValue([
      { id: 'booking-1', startTime: '09:00', endTime: '10:00' },
    ]);

    const result = await service.getAvailableSlots('facility-1', '2026-03-09');

    expect(result.slots).toEqual([
      { startTime: '08:00', endTime: '09:00', status: 'AVAILABLE', bookingId: null },
      { startTime: '09:00', endTime: '10:00', status: 'BOOKED', bookingId: 'booking-1' },
    ]);
  });

  it('applies slot exception override to generated slots', async () => {
    prismaMock.facility.findUnique.mockResolvedValue({
      id: 'facility-1',
      slotConfig: [
        {
          id: 'cfg-1',
          dayOfWeek: 1,
          startTime: '08:00',
          endTime: '10:00',
          slotDurationMinutes: 60,
          slotCapacity: 1,
        },
      ],
      slotExceptions: [
        {
          id: 'ex-1',
          date: new Date('2026-03-09T00:00:00.000Z'),
          isClosed: false,
          startTime: '10:00',
          endTime: '12:00',
          slotDurationMinutes: 30,
          slotCapacity: 1,
        },
      ],
    });
    prismaMock.booking.findMany.mockResolvedValue([]);

    const result = await service.getAvailableSlots('facility-1', '2026-03-09');

    expect(result.slots.map((slot) => `${slot.startTime}-${slot.endTime}`)).toEqual([
      '10:00-10:30',
      '10:30-11:00',
      '11:00-11:30',
      '11:30-12:00',
    ]);
  });
});

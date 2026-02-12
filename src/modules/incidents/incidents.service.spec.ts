import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { IncidentsService } from './incidents.service';
import { PrismaService } from '../../../prisma/prisma.service';

const mockEmitter = { emit: jest.fn() };

const mockPrisma: any = {
  incidentSequence: { upsert: jest.fn() },
  $transaction: jest.fn(async (cb: any) => cb(mockPrisma)),
  unit: { findUnique: jest.fn() },
  incident: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
    findMany: jest.fn(),
  },
  attachment: { createMany: jest.fn() },
  smartDevice: { count: jest.fn() },
};

describe('IncidentsService', () => {
  let service: IncidentsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IncidentsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EventEmitter2, useValue: mockEmitter },
      ],
    }).compile();

    service = module.get<IncidentsService>(IncidentsService);
    jest.clearAllMocks();
  });

  it('create should link attachments via incidentId and emit incident.created', async () => {
    mockPrisma.incidentSequence.upsert.mockResolvedValue({ counter: 1 });
    mockPrisma.unit.findUnique.mockResolvedValue({ id: 'u1' });
    mockPrisma.incident.create.mockResolvedValue({
      id: 'inc-1',
      incidentNumber: 'INC-0001',
      type: 'Test',
      priority: 'HIGH',
      unitId: 'u1',
    });

    const dto: any = {
      type: 'Test',
      description: 'Something happened',
      priority: 'HIGH',
      unitId: 'd290f1ee-6c54-4b01-90e6-d701748f0851',
      attachmentIds: ['a01a01a0-b1b1-c2c2-d3d3-e4e4e4e4e4e4'],
    };

    const result = await service.create(dto);

    expect(mockPrisma.attachment.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [
          expect.objectContaining({
            incidentId: 'inc-1',
            entity: 'INCIDENT',
            entityId: 'inc-1',
          }),
        ],
      }),
    );

    expect(mockEmitter.emit).toHaveBeenCalledWith(
      'incident.created',
      expect.any(Object),
    );

    expect(result).toEqual(expect.objectContaining({ id: 'inc-1' }));
  });

  it('create should throw when unitId does not exist', async () => {
    mockPrisma.incidentSequence.upsert.mockResolvedValue({ counter: 1 });
    mockPrisma.unit.findUnique.mockResolvedValue(null);

    await expect(
      service.create({
        type: 'Test',
        description: 'Something happened',
        priority: 'HIGH',
        unitId: 'd290f1ee-6c54-4b01-90e6-d701748f0851',
      } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('resolve should throw when incident does not exist', async () => {
    mockPrisma.incident.findUnique.mockResolvedValue(null);

    await expect(service.resolve('inc-x')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('resolve should throw when incident is not OPEN', async () => {
    mockPrisma.incident.findUnique.mockResolvedValue({
      id: 'inc-1',
      status: 'RESOLVED',
      reportedAt: new Date(Date.now() - 1000),
    });

    await expect(service.resolve('inc-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('resolve should update status, set responseTime, and emit incident.resolved', async () => {
    mockPrisma.incident.findUnique.mockResolvedValue({
      id: 'inc-1',
      incidentNumber: 'INC-0001',
      type: 'Test',
      unitId: 'u1',
      status: 'OPEN',
      reportedAt: new Date(Date.now() - 5000),
    });

    mockPrisma.incident.update.mockResolvedValue({
      id: 'inc-1',
      incidentNumber: 'INC-0001',
      type: 'Test',
      unitId: 'u1',
      status: 'RESOLVED',
      responseTime: 5,
    });

    const result = await service.resolve('inc-1');

    expect(mockPrisma.incident.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'inc-1' },
        data: expect.objectContaining({
          status: 'RESOLVED',
          resolvedAt: expect.any(Date),
          responseTime: expect.any(Number),
        }),
      }),
    );

    expect(mockEmitter.emit).toHaveBeenCalledWith(
      'incident.resolved',
      expect.any(Object),
    );

    expect(result).toEqual(expect.objectContaining({ status: 'RESOLVED' }));
  });
});


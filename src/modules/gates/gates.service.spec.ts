import { BadRequestException, ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AccessStatus, EntityStatus, GateRole, QRType } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { GateLogStatusFilter } from './dto/list-gate-logs.dto';
import { GatesService } from './gates.service';

describe('GatesService', () => {
  let service: GatesService;

  const prismaMock = {
    community: {
      findUnique: jest.fn(),
    },
    gate: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    gateUnitAccess: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
      upsert: jest.fn(),
    },
    accessQRCode: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    unit: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    prismaMock.$transaction.mockImplementation(
      async (callback: (tx: typeof prismaMock) => Promise<unknown>): Promise<unknown> =>
        callback(prismaMock),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GatesService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
      ],
    }).compile();

    service = module.get<GatesService>(GatesService);
  });

  it('validates gate role array for create', async () => {
    prismaMock.community.findUnique.mockResolvedValue({ id: 'community-1' });

    await expect(
      service.create({
        communityId: 'community-1',
        name: 'Gate 1',
        allowedRoles: [],
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('creates gate with valid roles', async () => {
    prismaMock.community.findUnique.mockResolvedValue({ id: 'community-1' });
    prismaMock.gate.findFirst.mockResolvedValue(null);
    prismaMock.gate.create.mockResolvedValue({
      id: 'gate-1',
      communityId: 'community-1',
      name: 'Gate 1',
      code: 'GATE_1',
      status: EntityStatus.ACTIVE,
      allowedRoles: [GateRole.VISITOR],
      etaMinutes: 2,
      isActive: true,
      isVisitorRequestRequired: false,
      createdAt: new Date('2026-03-05T10:00:00.000Z'),
      updatedAt: new Date('2026-03-05T10:00:00.000Z'),
      deletedAt: null,
      unitAccesses: [],
    });

    const result = await service.create({
      communityId: 'community-1',
      name: 'Gate 1',
      code: 'gate_1',
      allowedRoles: [GateRole.VISITOR],
      etaMinutes: 2,
    });

    expect(result.id).toBe('gate-1');
    expect(result.code).toBe('GATE_1');
    expect(prismaMock.gate.create).toHaveBeenCalled();
  });

  it('rejects duplicate gate create', async () => {
    prismaMock.community.findUnique.mockResolvedValue({ id: 'community-1' });
    prismaMock.gate.findFirst.mockResolvedValue({ id: 'gate-dup' });

    await expect(
      service.create({
        communityId: 'community-1',
        name: 'Gate 1',
        allowedRoles: [GateRole.VISITOR],
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('rejects soft delete when active QR references gate with required message', async () => {
    prismaMock.gate.findFirst.mockResolvedValue({ id: 'gate-1' });
    prismaMock.accessQRCode.count.mockResolvedValue(1);

    await expect(service.softDeleteGate('gate-1')).rejects.toThrow(
      'Gate has active QR codes. Revoke them first.',
    );
  });

  it('calculates durationMinutes for exited log items', async () => {
    prismaMock.gate.findFirst.mockResolvedValue({ id: 'gate-1' });
    prismaMock.accessQRCode.count.mockResolvedValue(1);
    prismaMock.accessQRCode.findMany.mockResolvedValue([
      {
        id: 'qr-1',
        visitorName: 'John Visitor',
        requesterNameSnapshot: 'Ahmed Owner',
        type: QRType.VISITOR,
        status: AccessStatus.USED,
        checkedInAt: new Date('2026-03-06T08:00:00.000Z'),
        checkedOutAt: new Date('2026-03-06T09:30:00.000Z'),
        forUnit: { unitNumber: 'A-101' },
        gateOperator: { nameEN: 'Gate Operator', nameAR: null },
      },
    ]);

    const result = await service.getGateLog('gate-1', {
      status: GateLogStatusFilter.EXITED,
      page: 1,
      limit: 20,
    });

    expect(result.total).toBe(1);
    expect(result.data[0].durationMinutes).toBe(90);
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../prisma/prisma.service';
import { DashboardService, resolvePeriodWindow } from './dashboard.service';
import {
  DashboardActivityType,
  DashboardPeriod,
} from './dto/dashboard-stats-response.dto';
import { AccessStatus, ComplaintStatus, PushPlatform } from '@prisma/client';
import dayjs from 'dayjs';

describe('DashboardService', () => {
  let service: DashboardService;

  const prismaMock = {
    notificationDeviceToken: {
      groupBy: jest.fn(),
      findMany: jest.fn(),
    },
    user: {
      count: jest.fn(),
    },
    complaint: {
      count: jest.fn(),
      groupBy: jest.fn(),
      findMany: jest.fn(),
    },
    invoice: {
      aggregate: jest.fn(),
      findMany: jest.fn(),
    },
    unit: {
      count: jest.fn(),
    },
    accessQRCode: {
      count: jest.fn(),
    },
    worker: {
      count: jest.fn(),
    },
    residentVehicle: {
      count: jest.fn(),
    },
    serviceRequest: {
      findMany: jest.fn(),
    },
    violation: {
      findMany: jest.fn(),
    },
    pendingRegistration: {
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
      ],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
  });

  it('resolves period windows correctly', () => {
    const reference = new Date('2026-08-15T12:00:00.000Z');

    const monthly = resolvePeriodWindow(DashboardPeriod.MONTHLY, reference);
    expect(dayjs(monthly.from).year()).toBe(2026);
    expect(dayjs(monthly.from).month()).toBe(7);
    expect(dayjs(monthly.from).date()).toBe(1);
    expect(monthly.label).toBe('August 2026');

    const quarterly = resolvePeriodWindow(DashboardPeriod.QUARTERLY, reference);
    expect(dayjs(quarterly.from).year()).toBe(2026);
    expect(dayjs(quarterly.from).month()).toBe(6);
    expect(dayjs(quarterly.from).date()).toBe(1);
    expect(quarterly.label).toBe('Q3 2026');

    const semiAnnual = resolvePeriodWindow(DashboardPeriod.SEMI_ANNUAL, reference);
    expect(dayjs(semiAnnual.from).year()).toBe(2026);
    expect(dayjs(semiAnnual.from).month()).toBe(6);
    expect(dayjs(semiAnnual.from).date()).toBe(1);
    expect(semiAnnual.label).toBe('H2 2026');

    const annual = resolvePeriodWindow(DashboardPeriod.ANNUAL, reference);
    expect(dayjs(annual.from).year()).toBe(2026);
    expect(dayjs(annual.from).month()).toBe(0);
    expect(dayjs(annual.from).date()).toBe(1);
    expect(annual.label).toBe('2026');
  });

  it('computes KPI values and platform breakdowns', async () => {
    prismaMock.notificationDeviceToken.groupBy.mockResolvedValue([
      { platform: PushPlatform.ANDROID, _count: { id: 7 } },
      { platform: PushPlatform.IOS, _count: { id: 5 } },
    ]);
    prismaMock.user.count.mockResolvedValue(9);
    prismaMock.notificationDeviceToken.findMany.mockResolvedValue([
      { userId: 'u1', platform: PushPlatform.ANDROID },
      { userId: 'u2', platform: PushPlatform.ANDROID },
      { userId: 'u3', platform: PushPlatform.IOS },
    ]);
    prismaMock.complaint.count
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(6)
      .mockResolvedValueOnce(10);
    prismaMock.complaint.groupBy.mockResolvedValue([
      { status: ComplaintStatus.NEW, _count: { id: 2 } },
      { status: ComplaintStatus.IN_PROGRESS, _count: { id: 2 } },
      { status: ComplaintStatus.RESOLVED, _count: { id: 4 } },
      { status: ComplaintStatus.CLOSED, _count: { id: 2 } },
    ]);
    prismaMock.invoice.aggregate.mockResolvedValue({
      _sum: { amount: { toNumber: () => 12345 } },
    });
    prismaMock.unit.count.mockResolvedValueOnce(40).mockResolvedValueOnce(50);
    prismaMock.accessQRCode.count.mockResolvedValue(3);
    prismaMock.worker.count.mockResolvedValue(12);
    prismaMock.residentVehicle.count.mockResolvedValue(27);

    const result = await service.getStats({ period: DashboardPeriod.QUARTERLY });

    expect(result.period).toBe(DashboardPeriod.QUARTERLY);
    expect(result.kpis.totalRegisteredDevices).toBe(12);
    expect(result.kpis.totalRegisteredDevicesByPlatform.android).toBe(7);
    expect(result.kpis.totalRegisteredDevicesByPlatform.ios).toBe(5);
    expect(result.kpis.activeMobileUsers).toBe(9);
    expect(result.kpis.activeMobileUsersByPlatform.android).toBe(2);
    expect(result.kpis.activeMobileUsersByPlatform.ios).toBe(1);
    expect(result.kpis.openComplaints).toBe(4);
    expect(result.kpis.closedComplaints).toBe(6);
    expect(result.kpis.totalComplaints).toBe(10);
    expect(result.kpis.ticketsByStatus.NEW).toBe(2);
    expect(result.kpis.revenueCurrentMonth).toBe(12345);
    expect(result.kpis.currentVisitors).toBe(3);
    expect(result.kpis.blueCollarWorkers).toBe(12);
    expect(result.kpis.totalCars).toBe(27);

    const visitorCountCall = prismaMock.accessQRCode.count.mock.calls[0][0] as {
      where: { type: string; status: AccessStatus };
    };
    expect(visitorCountCall.where.type).toBe('VISITOR');
    expect(visitorCountCall.where.status).toBe(AccessStatus.ACTIVE);
  });

  it('merges and sorts activity feed rows descending by timestamp', async () => {
    prismaMock.complaint.findMany.mockResolvedValue([
      {
        id: 'c1',
        complaintNumber: 'CMP-001',
        categoryLegacy: 'Noise',
        category: null,
        createdAt: new Date('2026-03-06T08:00:00.000Z'),
        reporter: { nameEN: 'Ali', nameAR: null },
        unit: { unitNumber: 'A-101' },
      },
    ]);
    prismaMock.serviceRequest.findMany.mockResolvedValue([
      {
        id: 'sr1',
        requestedAt: new Date('2026-03-06T09:00:00.000Z'),
        createdBy: { nameEN: 'Mona', nameAR: null },
        unit: { unitNumber: 'B-202' },
      },
    ]);
    prismaMock.violation.findMany.mockResolvedValue([
      {
        id: 'v1',
        violationNumber: 'V-100',
        typeLegacy: 'Parking',
        category: null,
        createdAt: new Date('2026-03-06T07:30:00.000Z'),
        issuedBy: { nameEN: 'Security', nameAR: null },
        unit: { unitNumber: 'C-303' },
      },
    ]);
    prismaMock.invoice.findMany.mockResolvedValue([
      {
        id: 'i1',
        invoiceNumber: 'INV-1',
        amount: { toNumber: () => 500 },
        paidDate: new Date('2026-03-06T10:00:00.000Z'),
        resident: { nameEN: 'Nour', nameAR: null },
        unit: { unitNumber: 'D-404' },
      },
    ]);
    prismaMock.pendingRegistration.findMany.mockResolvedValue([
      {
        id: 'r1',
        name: 'New User',
        createdAt: new Date('2026-03-06T06:00:00.000Z'),
      },
    ]);

    const result = await service.getActivity();

    expect(result.length).toBe(5);
    expect(result[0].type).toBe(DashboardActivityType.INVOICE);
    expect(result[1].type).toBe(DashboardActivityType.SERVICE_REQUEST);
    expect(result[2].type).toBe(DashboardActivityType.COMPLAINT);
    expect(result[3].type).toBe(DashboardActivityType.VIOLATION);
    expect(result[4].type).toBe(DashboardActivityType.REGISTRATION);
    expect(result[0].timestamp >= result[1].timestamp).toBe(true);
  });
});

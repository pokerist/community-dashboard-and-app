import {
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import {
  Priority,
  ServiceCategory,
  ServiceRequestStatus,
} from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { InvoicesService } from '../invoices/invoices.service';
import { ServiceRequestService } from './service-request.service';

describe('ServiceRequestService SLA and lifecycle', () => {
  const mockPrisma = {
    serviceRequest: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      updateMany: jest.fn(),
      update: jest.fn(),
    },
    user: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
  };

  const mockInvoices = {
    generateInvoice: jest.fn(),
  };

  let service: ServiceRequestService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ServiceRequestService(
      mockPrisma as unknown as PrismaService,
      mockInvoices as unknown as InvoicesService,
    );
  });

  it('computes SLA status and deadline in listRequests', async () => {
    const requestedAt = new Date(Date.now() - 2 * 60 * 60 * 1000);

    mockPrisma.serviceRequest.findMany.mockResolvedValue([
      {
        id: 'sr-1',
        status: ServiceRequestStatus.NEW,
        priority: Priority.HIGH,
        requestedAt,
        slaBreachedAt: null,
        assignedToId: null,
        service: {
          id: 'svc-1',
          name: 'Maintenance',
          category: ServiceCategory.MAINTENANCE,
          slaHours: 24,
        },
        unit: {
          id: 'u-1',
          unitNumber: '101',
          block: 'A',
        },
        createdBy: {
          id: 'user-1',
          nameEN: 'Resident A',
          email: 'resident@example.com',
        },
      },
      {
        id: 'sr-2',
        status: ServiceRequestStatus.IN_PROGRESS,
        priority: Priority.MEDIUM,
        requestedAt: new Date(Date.now() - 30 * 60 * 60 * 1000),
        slaBreachedAt: null,
        assignedToId: null,
        service: {
          id: 'svc-1',
          name: 'Maintenance',
          category: ServiceCategory.MAINTENANCE,
          slaHours: 24,
        },
        unit: {
          id: 'u-2',
          unitNumber: '202',
          block: 'B',
        },
        createdBy: {
          id: 'user-2',
          nameEN: 'Resident B',
          email: 'resident2@example.com',
        },
      },
    ]);
    mockPrisma.user.findMany.mockResolvedValue([]);

    const rows = await service.listRequests({});

    expect(rows[0]?.slaStatus).toBe('ON_TRACK');
    expect(rows[0]?.slaDeadline).not.toBeNull();
    expect(rows[1]?.slaStatus).toBe('BREACHED');
    expect((rows[1]?.hoursRemaining ?? 0) < 0).toBe(true);
  });

  it('rejects invalid status transitions', async () => {
    mockPrisma.serviceRequest.findUnique.mockResolvedValue({
      id: 'sr-1',
      status: ServiceRequestStatus.NEW,
      assignedToId: null,
      internalNotes: null,
    });

    await expect(
      service.updateRequestStatus('sr-1', {
        status: ServiceRequestStatus.IN_PROGRESS,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('marks SLA breaches idempotently', async () => {
    mockPrisma.serviceRequest.findMany
      .mockResolvedValueOnce([
        {
          id: 'sr-1',
          requestedAt: new Date(Date.now() - 26 * 60 * 60 * 1000),
          service: { slaHours: 24 },
        },
      ])
      .mockResolvedValueOnce([]);

    mockPrisma.serviceRequest.updateMany.mockResolvedValue({ count: 1 });

    const first = await service.checkSlaBreaches();
    const second = await service.checkSlaBreaches();

    expect(first).toBe(1);
    expect(second).toBe(0);
    expect(mockPrisma.serviceRequest.updateMany).toHaveBeenCalledTimes(1);
  });

  it('validates rating requester identity and status', async () => {
    mockPrisma.serviceRequest.findUnique.mockResolvedValueOnce({
      id: 'sr-1',
      createdById: 'user-1',
      status: ServiceRequestStatus.RESOLVED,
    });

    await expect(
      service.submitRating('sr-1', 'user-2', { rating: 5 }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    mockPrisma.serviceRequest.findUnique.mockResolvedValueOnce({
      id: 'sr-1',
      createdById: 'user-1',
      status: ServiceRequestStatus.NEW,
    });

    await expect(
      service.submitRating('sr-1', 'user-1', { rating: 5 }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

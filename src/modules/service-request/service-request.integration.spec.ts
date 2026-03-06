import { Priority, ServiceCategory, ServiceRequestStatus } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { InvoicesService } from '../invoices/invoices.service';
import { ServiceRequestService } from './service-request.service';

type ServiceRequestState = {
  id: string;
  serviceId: string;
  unitId: string;
  createdById: string;
  assignedToId: string | null;
  status: ServiceRequestStatus;
  priority: Priority;
  description: string;
  requestedAt: Date;
  updatedAt: Date;
  slaBreachedAt: Date | null;
  resolvedAt: Date | null;
  closedAt: Date | null;
  assignedAt: Date | null;
  customerRating: number | null;
  internalNotes: string | null;
};

describe('ServiceRequestService integration-style', () => {
  let service: ServiceRequestService;

  const requests: ServiceRequestState[] = [];

  const mockPrisma = {
    user: {
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) => {
        if (where.id === 'assignee-1') {
          return { id: 'assignee-1', nameEN: 'Assignee', email: 'assignee@example.com' };
        }
        if (where.id === 'requester-1') {
          return { id: 'requester-1', nameEN: 'Requester', email: 'requester@example.com' };
        }
        return null;
      }),
      findMany: jest.fn(async () => [{ id: 'assignee-1', nameEN: 'Assignee', email: 'assignee@example.com' }]),
    },
    serviceRequest: {
      findUnique: jest.fn(async ({ where, select, include }: { where: { id: string }; select?: unknown; include?: unknown }) => {
        const row = requests.find((request) => request.id === where.id) ?? null;
        if (!row) return null;

        if (select) {
          return {
            id: row.id,
            status: row.status,
            assignedToId: row.assignedToId,
            internalNotes: row.internalNotes,
            createdById: row.createdById,
          };
        }

        if (include) {
          return {
            ...row,
            service: {
              id: row.serviceId,
              name: 'Maintenance',
              category: ServiceCategory.MAINTENANCE,
              slaHours: 24,
            },
            unit: {
              id: row.unitId,
              unitNumber: '101',
              block: 'A',
            },
            createdBy: {
              id: row.createdById,
              nameEN: 'Requester',
              email: 'requester@example.com',
              phone: '0100',
            },
            fieldValues: [],
            comments: [],
            invoices: [],
          };
        }

        return row;
      }),
      update: jest.fn(async ({ where, data }: { where: { id: string }; data: Partial<ServiceRequestState> }) => {
        const idx = requests.findIndex((request) => request.id === where.id);
        if (idx < 0) throw new Error('Not found');
        requests[idx] = {
          ...requests[idx],
          ...data,
          updatedAt: new Date(),
        };
        return requests[idx];
      }),
      findMany: jest.fn(async () =>
        requests
          .filter(
            (request) =>
              (request.status === ServiceRequestStatus.NEW ||
                request.status === ServiceRequestStatus.IN_PROGRESS) &&
              request.slaBreachedAt === null,
          )
          .map((request) => ({
            id: request.id,
            requestedAt: request.requestedAt,
            service: { slaHours: 24 },
          })),
      ),
      updateMany: jest.fn(async ({ where, data }: { where: { id: { in: string[] } }; data: { slaBreachedAt: Date } }) => {
        let count = 0;
        requests.forEach((request, index) => {
          if (where.id.in.includes(request.id) && !request.slaBreachedAt) {
            requests[index] = {
              ...request,
              slaBreachedAt: data.slaBreachedAt,
            };
            count += 1;
          }
        });
        return { count };
      }),
    },
  };

  beforeEach(() => {
    requests.length = 0;
    requests.push({
      id: 'sr-1',
      serviceId: 'svc-1',
      unitId: 'unit-1',
      createdById: 'requester-1',
      assignedToId: null,
      status: ServiceRequestStatus.NEW,
      priority: Priority.MEDIUM,
      description: 'Need maintenance',
      requestedAt: new Date(Date.now() - 30 * 60 * 60 * 1000),
      updatedAt: new Date(),
      slaBreachedAt: null,
      resolvedAt: null,
      closedAt: null,
      assignedAt: null,
      customerRating: null,
      internalNotes: null,
    });

    service = new ServiceRequestService(
      mockPrisma as unknown as PrismaService,
      { generateInvoice: jest.fn() } as unknown as InvoicesService,
    );
  });

  it('handles full request lifecycle and SLA breach flow', async () => {
    const assigned = await service.assignRequest(
      'sr-1',
      { assignedToId: 'assignee-1' },
      'admin-1',
    );
    expect(assigned.assignee?.id).toBe('assignee-1');

    const inProgress = await service.updateRequestStatus('sr-1', {
      status: ServiceRequestStatus.IN_PROGRESS,
    });
    expect(inProgress.status).toBe(ServiceRequestStatus.IN_PROGRESS);

    const breachedFirst = await service.checkSlaBreaches();
    const breachedSecond = await service.checkSlaBreaches();
    expect(breachedFirst).toBe(1);
    expect(breachedSecond).toBe(0);

    const resolved = await service.updateRequestStatus('sr-1', {
      status: ServiceRequestStatus.RESOLVED,
    });
    expect(resolved.status).toBe(ServiceRequestStatus.RESOLVED);

    const closed = await service.updateRequestStatus('sr-1', {
      status: ServiceRequestStatus.CLOSED,
    });
    expect(closed.status).toBe(ServiceRequestStatus.CLOSED);

    const rated = await service.submitRating('sr-1', 'requester-1', { rating: 5 });
    expect(rated.customerRating).toBe(5);
  });
});

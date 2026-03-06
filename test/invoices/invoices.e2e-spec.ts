import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, INestApplication } from '@nestjs/common';
import request from 'supertest';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { InvoiceStatus, InvoiceType, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../../src/modules/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../src/modules/auth/guards/permissions.guard';
import { InvoicesModule } from '../../src/modules/invoices/invoices.module';

type CategoryRecord = {
  id: string;
  label: string;
  mappedType: InvoiceType;
  description: string | null;
  isActive: boolean;
  displayOrder: number;
  color: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type InvoiceRecord = {
  id: string;
  invoiceNumber: string;
  unitId: string;
  residentId: string | null;
  type: InvoiceType;
  amount: Prisma.Decimal;
  dueDate: Date;
  status: InvoiceStatus;
  paidDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
  violationId: string | null;
  serviceRequestId: string | null;
  bookingId: string | null;
  complaintId: string | null;
  incidentId: string | null;
};

describe('InvoicesModule (e2e)', () => {
  let app: INestApplication;

  let categoryCounter = 0;
  let invoiceCounter = 0;
  let invoiceSeq = BigInt(0);

  const categories = new Map<string, CategoryRecord>();
  const invoices = new Map<string, InvoiceRecord>();

  const buildInvoiceDetail = (invoice: InvoiceRecord) => ({
    ...invoice,
    unit: {
      id: invoice.unitId,
      unitNumber: 'A-101',
      projectName: 'Community One',
      community: { name: 'Community One' },
    },
    resident: invoice.residentId
      ? {
          id: invoice.residentId,
          nameEN: 'Resident User',
          phone: '+201000000000',
        }
      : null,
    violation: null,
    serviceRequest: null,
    booking: null,
    complaint: null,
    unitFees: [],
    documents: [],
  });

  const prismaMock = {
    role: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    invoiceCategory: {
      findMany: jest
        .fn()
        .mockImplementation(
          ({
            where,
          }: {
            where?: { isActive?: boolean } | { id?: { in?: string[] } };
          }) => {
            let rows = Array.from(categories.values());
            if (where && 'isActive' in where && where.isActive !== undefined) {
              rows = rows.filter((row) => row.isActive === where.isActive);
            }
            if (where && 'id' in where && where.id?.in) {
              rows = rows.filter((row) => where.id?.in?.includes(row.id));
            }
            rows.sort((a, b) => a.displayOrder - b.displayOrder);
            return Promise.resolve(rows);
          },
        ),
      create: jest
        .fn()
        .mockImplementation(({ data }: { data: Partial<CategoryRecord> }) => {
          categoryCounter += 1;
          const now = new Date();
          const row: CategoryRecord = {
            id: `cat-${categoryCounter}`,
            label: data.label ?? '',
            mappedType: data.mappedType ?? InvoiceType.RENT,
            description: (data.description as string | null) ?? null,
            isActive: true,
            displayOrder: 0,
            color: (data.color as string | null) ?? null,
            createdAt: now,
            updatedAt: now,
          };
          categories.set(row.id, row);
          return Promise.resolve(row);
        }),
      findUnique: jest
        .fn()
        .mockImplementation(({ where }: { where: { id: string } }) => {
          const row = categories.get(where.id) ?? null;
          return Promise.resolve(row);
        }),
      update: jest
        .fn()
        .mockImplementation(
          ({
            where,
            data,
          }: {
            where: { id: string };
            data: Partial<CategoryRecord>;
          }) => {
            const existing = categories.get(where.id);
            if (!existing) {
              return Promise.resolve(null);
            }
            const next: CategoryRecord = {
              ...existing,
              ...data,
              updatedAt: new Date(),
            };
            categories.set(where.id, next);
            return Promise.resolve(next);
          },
        ),
    },
    invoiceSequence: {
      upsert: jest.fn().mockResolvedValue({ name: 'invoices' }),
      update: jest.fn().mockImplementation(() => {
        invoiceSeq += BigInt(1);
        return Promise.resolve({ name: 'invoices', counter: invoiceSeq });
      }),
    },
    unit: {
      findUnique: jest.fn().mockResolvedValue({ id: 'unit-1' }),
    },
    residentUnit: {
      findFirst: jest.fn().mockResolvedValue({ id: 'resident-unit-1' }),
    },
    invoice: {
      count: jest.fn().mockImplementation(() => Promise.resolve(invoices.size)),
      findMany: jest.fn().mockImplementation(() => {
        const rows = Array.from(invoices.values()).map((invoice) => ({
          ...invoice,
          unit: {
            unitNumber: 'A-101',
            projectName: 'Community One',
            community: { name: 'Community One' },
          },
          resident: invoice.residentId ? { nameEN: 'Resident User' } : null,
          unitFees: [],
        }));
        return Promise.resolve(rows);
      }),
      findUnique: jest
        .fn()
        .mockImplementation(
          ({
            where,
            include,
            select,
          }: {
            where: { id: string };
            include?: Record<string, unknown>;
            select?: Record<string, boolean>;
          }) => {
            const row = invoices.get(where.id);
            if (!row) {
              return Promise.resolve(null);
            }
            if (include) {
              return Promise.resolve(buildInvoiceDetail(row));
            }
            if (select) {
              const selected: Record<string, unknown> = {};
              Object.keys(select).forEach((key) => {
                selected[key] =
                  (row as unknown as Record<string, unknown>)[key] ?? null;
              });
              return Promise.resolve(selected);
            }
            return Promise.resolve(row);
          },
        ),
      create: jest.fn().mockImplementation(
        ({
          data,
          select,
        }: {
          data: {
            unitId: string;
            residentId?: string | null;
            type: InvoiceType;
            amount: Prisma.Decimal;
            dueDate: Date;
            invoiceNumber: string;
          };
          select?: { id?: boolean };
        }) => {
          invoiceCounter += 1;
          const now = new Date();
          const row: InvoiceRecord = {
            id: `inv-${invoiceCounter}`,
            invoiceNumber: data.invoiceNumber,
            unitId: data.unitId,
            residentId: data.residentId ?? null,
            type: data.type,
            amount: data.amount,
            dueDate: data.dueDate,
            status: InvoiceStatus.PENDING,
            paidDate: null,
            createdAt: now,
            updatedAt: now,
            violationId: null,
            serviceRequestId: null,
            bookingId: null,
            complaintId: null,
            incidentId: null,
          };
          invoices.set(row.id, row);
          if (select?.id) {
            return Promise.resolve({ id: row.id });
          }
          return Promise.resolve(row);
        },
      ),
      update: jest
        .fn()
        .mockImplementation(
          ({
            where,
            data,
            select,
          }: {
            where: { id: string };
            data: Partial<InvoiceRecord>;
            select?: Record<string, boolean>;
          }) => {
            const existing = invoices.get(where.id);
            if (!existing) {
              return Promise.resolve(null);
            }
            const next: InvoiceRecord = {
              ...existing,
              ...data,
              updatedAt: new Date(),
            };
            invoices.set(where.id, next);
            if (select) {
              const selected: Record<string, unknown> = {};
              Object.keys(select).forEach((key) => {
                selected[key] =
                  (next as unknown as Record<string, unknown>)[key] ?? null;
              });
              return Promise.resolve(selected);
            }
            return Promise.resolve(next);
          },
        ),
      delete: jest
        .fn()
        .mockImplementation(({ where }: { where: { id: string } }) => {
          invoices.delete(where.id);
          return Promise.resolve({ id: where.id });
        }),
      updateMany: jest.fn().mockResolvedValue({ count: 2 }),
      aggregate: jest
        .fn()
        .mockResolvedValue({ _sum: { amount: new Prisma.Decimal(0) } }),
      groupBy: jest.fn().mockResolvedValue([]),
    },
    unitAccess: {
      findFirst: jest
        .fn()
        .mockResolvedValue({ id: 'ua-1', canViewFinancials: true }),
      findMany: jest.fn().mockResolvedValue([{ unitId: 'unit-1' }]),
    },
    unitFee: {
      findMany: jest.fn().mockResolvedValue([]),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      create: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
    violation: { update: jest.fn() },
    serviceRequest: {
      update: jest.fn().mockResolvedValue({ serviceId: 'service-1' }),
    },
    service: { update: jest.fn() },
    complaint: { update: jest.fn() },
    booking: { update: jest.fn() },
    incident: { update: jest.fn() },
    $transaction: jest.fn(),
  };

  beforeAll(async () => {
    prismaMock.$transaction.mockImplementation(
      async (
        arg: ((tx: typeof prismaMock) => Promise<unknown>) | Promise<unknown>[],
      ): Promise<unknown> => {
        if (Array.isArray(arg)) {
          return Promise.all(arg);
        }
        return arg(prismaMock);
      },
    );

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [EventEmitterModule.forRoot(), InvoicesModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          const req = context.switchToHttp().getRequest<{
            user?: { id: string; roles: string[]; permissions: string[] };
          }>();
          req.user = {
            id: 'admin-1',
            roles: ['SUPER_ADMIN'],
            permissions: [
              'invoice.view_all',
              'invoice.create',
              'invoice.update',
              'invoice.mark_paid',
              'invoice.delete',
            ],
          };
          return true;
        },
      })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('handles invoice category CRUD + reorder', async () => {
    const createdCategoryId = await request(app.getHttpServer())
      .post('/invoice-categories')
      .send({
        label: 'Community Fees',
        mappedType: InvoiceType.SERVICE_FEE,
        description: 'Recurring charges',
        color: '#3b82f6',
      })
      .expect(201)
      .then((response) => {
        expect(response.body.label).toBe('Community Fees');
        return String(response.body.id);
      });

    await request(app.getHttpServer())
      .patch(`/invoice-categories/${createdCategoryId}`)
      .send({ description: 'Updated description' })
      .expect(200)
      .then((response) => {
        expect(response.body.description).toBe('Updated description');
      });

    await request(app.getHttpServer())
      .patch(`/invoice-categories/${createdCategoryId}/toggle`)
      .expect(200)
      .then((response) => {
        expect(response.body.isActive).toBe(false);
      });

    await request(app.getHttpServer())
      .patch('/invoice-categories/reorder')
      .send({ orderedIds: [createdCategoryId] })
      .expect(200)
      .then((response) => {
        expect(Array.isArray(response.body)).toBe(true);
      });

    await request(app.getHttpServer())
      .get('/invoice-categories')
      .expect(200)
      .then((response) => {
        expect(Array.isArray(response.body)).toBe(true);
      });
  });

  it('handles invoice lifecycle (create -> detail -> pay -> cancel guard)', async () => {
    const invoiceId = await request(app.getHttpServer())
      .post('/invoices')
      .send({
        unitId: 'unit-1',
        residentId: 'resident-user-1',
        type: InvoiceType.RENT,
        amount: 15000,
        dueDate: '2026-04-01T00:00:00.000Z',
      })
      .expect(201)
      .then((response) => {
        expect(response.body.invoiceNumber).toMatch(/^INV-/);
        return String(response.body.id);
      });

    await request(app.getHttpServer())
      .get(`/invoices/${invoiceId}`)
      .expect(200)
      .then((response) => {
        expect(response.body.id).toBe(invoiceId);
      });

    await request(app.getHttpServer())
      .patch(`/invoices/${invoiceId}/pay`)
      .send({})
      .expect(200)
      .then((response) => {
        expect(response.body.status).toBe(InvoiceStatus.PAID);
        expect(response.body.paidDate).toBeTruthy();
      });

    await request(app.getHttpServer())
      .patch(`/invoices/${invoiceId}/cancel`)
      .send({ reason: 'Should fail because paid' })
      .expect(409);
  });

  it('handles invoice cancel + bulk overdue endpoint', async () => {
    const invoiceId = await request(app.getHttpServer())
      .post('/invoices')
      .send({
        unitId: 'unit-1',
        residentId: 'resident-user-1',
        type: InvoiceType.SERVICE_FEE,
        amount: 900,
        dueDate: '2026-05-01T00:00:00.000Z',
      })
      .expect(201)
      .then((response) => String(response.body.id));

    await request(app.getHttpServer())
      .patch(`/invoices/${invoiceId}/cancel`)
      .send({ reason: 'Waived by admin' })
      .expect(200)
      .then((response) => {
        expect(response.body.status).toBe(InvoiceStatus.CANCELLED);
      });

    await request(app.getHttpServer())
      .post('/invoices/bulk-overdue')
      .expect(201)
      .then((response) => {
        expect(response.body.updatedCount).toBe(2);
      });
  });
});

import { INestApplication } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { InvoiceStatus, InvoiceType, ViolationActionStatus, ViolationActionType, ViolationStatus } from '@prisma/client';
import request from 'supertest';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../../src/modules/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../src/modules/auth/guards/permissions.guard';
import { InvoicesService } from '../../src/modules/invoices/invoices.service';
import { ViolationsModule } from '../../src/modules/violations/violations.module';

interface UnitState {
  id: string;
  unitNumber: string;
}

interface UserState {
  id: string;
  nameEN: string | null;
  nameAR: string | null;
  email: string | null;
  phone: string | null;
}

interface ViolationCategoryState {
  id: string;
  name: string;
  defaultFineAmount: number;
  description: string | null;
  isActive: boolean;
  displayOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

interface InvoiceState {
  id: string;
  invoiceNumber: string;
  violationId: string;
  unitId: string;
  residentId: string | null;
  amount: number;
  type: InvoiceType;
  status: InvoiceStatus;
  dueDate: Date;
  paidDate: Date | null;
}

interface ViolationState {
  id: string;
  violationNumber: string;
  unitId: string;
  residentId: string | null;
  issuedById: string | null;
  categoryId: string | null;
  typeLegacy: string | null;
  description: string;
  fineAmount: number;
  photoEvidenceIds: string[];
  status: ViolationStatus;
  appealStatus: string | null;
  closedAt: Date | null;
  appealDeadline: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface ViolationActionRequestState {
  id: string;
  violationId: string;
  requestedById: string;
  type: ViolationActionType;
  status: ViolationActionStatus;
  note: string | null;
  attachmentIds: string[];
  reviewedById: string | null;
  reviewedAt: Date | null;
  rejectionReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

function applySelect<T extends Record<string, unknown>>(
  source: T,
  select?: Record<string, boolean>,
): Record<string, unknown> {
  if (!select) {
    return source;
  }

  const out: Record<string, unknown> = {};
  for (const [key, enabled] of Object.entries(select)) {
    if (enabled) {
      out[key] = source[key];
    }
  }
  return out;
}

describe('ViolationsModule (e2e)', () => {
  let app: INestApplication;

  let categorySeq = 0;
  let violationSeq = 0;
  let invoiceSeq = 0;
  let actionSeq = 0;

  const units: UnitState[] = [{ id: 'unit-1', unitNumber: 'A-101' }];
  const users: UserState[] = [
    { id: 'admin-1', nameEN: 'Admin', nameAR: null, email: 'admin@example.com', phone: '+201000000001' },
    { id: 'resident-1', nameEN: 'Resident One', nameAR: null, email: 'resident1@example.com', phone: '+201000000011' },
  ];
  const categories: ViolationCategoryState[] = [];
  const violations: ViolationState[] = [];
  const invoices: InvoiceState[] = [];
  const actions: ViolationActionRequestState[] = [];

  const invoicesServiceMock = {
    generateInvoiceTx: jest.fn(
      async (
        _tx: unknown,
        dto: {
          unitId: string;
          residentId?: string;
          amount: number;
          type: InvoiceType;
          dueDate: Date;
          sources?: { violationIds?: string[] };
          status?: InvoiceStatus;
        },
      ) => {
        invoiceSeq += 1;
        const invoice: InvoiceState = {
          id: `inv-${invoiceSeq}`,
          invoiceNumber: `INV-${invoiceSeq.toString().padStart(5, '0')}`,
          violationId: dto.sources?.violationIds?.[0] ?? '',
          unitId: dto.unitId,
          residentId: dto.residentId ?? null,
          amount: dto.amount,
          type: dto.type,
          status: dto.status ?? InvoiceStatus.PENDING,
          dueDate: dto.dueDate,
          paidDate: null,
        };
        invoices.push(invoice);
        return invoice;
      },
    ),
  };

  const prismaTx = {
    violation: {
      create: jest.fn(
        async ({
          data,
          select,
        }: {
          data: {
            violationNumber: string;
            unitId: string;
            residentId: string | null;
            categoryId: string | null;
            typeLegacy: string | null;
            description: string;
            fineAmount: number;
            photoEvidenceIds: string[];
            status: ViolationStatus;
            issuedById: string;
            appealDeadline: Date;
          };
          select?: Record<string, boolean>;
        }) => {
          violationSeq += 1;
          const now = new Date();
          const row: ViolationState = {
            id: `vio-${violationSeq}`,
            violationNumber: data.violationNumber,
            unitId: data.unitId,
            residentId: data.residentId,
            issuedById: data.issuedById,
            categoryId: data.categoryId,
            typeLegacy: data.typeLegacy,
            description: data.description,
            fineAmount: data.fineAmount,
            photoEvidenceIds: data.photoEvidenceIds,
            status: data.status,
            appealStatus: null,
            closedAt: null,
            appealDeadline: data.appealDeadline,
            createdAt: now,
            updatedAt: now,
          };
          violations.push(row);
          return applySelect(row as unknown as Record<string, unknown>, select);
        },
      ),
      update: jest.fn(
        async ({
          where,
          data,
        }: {
          where: { id: string };
          data: Partial<
            Pick<
              ViolationState,
              'status' | 'appealStatus' | 'closedAt' | 'description' | 'fineAmount' | 'categoryId' | 'typeLegacy' | 'photoEvidenceIds'
            >
          >;
        }) => {
          const row = violations.find((item) => item.id === where.id);
          if (!row) {
            throw new Error('Violation not found');
          }
          if (data.status !== undefined) row.status = data.status;
          if (data.appealStatus !== undefined) row.appealStatus = data.appealStatus;
          if (data.closedAt !== undefined) row.closedAt = data.closedAt;
          if (data.description !== undefined) row.description = data.description;
          if (data.fineAmount !== undefined) row.fineAmount = data.fineAmount;
          if (data.categoryId !== undefined) row.categoryId = data.categoryId;
          if (data.typeLegacy !== undefined) row.typeLegacy = data.typeLegacy;
          if (data.photoEvidenceIds !== undefined) row.photoEvidenceIds = data.photoEvidenceIds;
          row.updatedAt = new Date();
          return row;
        },
      ),
    },
    invoice: {
      updateMany: jest.fn(
        async ({
          where,
          data,
        }: {
          where: {
            violationId?: string;
            type?: InvoiceType;
            status?: InvoiceStatus | { in: InvoiceStatus[] };
          };
          data: Partial<Pick<InvoiceState, 'status' | 'paidDate'>>;
        }) => {
          let rows = invoices.filter((item) =>
            where.violationId ? item.violationId === where.violationId : true,
          );
          if (where.type) {
            rows = rows.filter((item) => item.type === where.type);
          }
          if (where.status && typeof where.status === 'object' && 'in' in where.status) {
            rows = rows.filter((item) => (where.status as { in: InvoiceStatus[] }).in.includes(item.status));
          } else if (where.status) {
            rows = rows.filter((item) => item.status === where.status);
          }
          rows.forEach((row) => {
            if (data.status !== undefined) row.status = data.status;
            if (data.paidDate !== undefined) row.paidDate = data.paidDate;
          });
          return { count: rows.length };
        },
      ),
    },
    violationActionRequest: {
      update: jest.fn(
        async ({
          where,
          data,
        }: {
          where: { id: string };
          data: Partial<
            Pick<ViolationActionRequestState, 'status' | 'rejectionReason' | 'reviewedById' | 'reviewedAt'>
          >;
        }) => {
          const row = actions.find((item) => item.id === where.id);
          if (!row) {
            throw new Error('Action not found');
          }
          if (data.status !== undefined) row.status = data.status;
          if (data.rejectionReason !== undefined) row.rejectionReason = data.rejectionReason;
          if (data.reviewedById !== undefined) row.reviewedById = data.reviewedById;
          if (data.reviewedAt !== undefined) row.reviewedAt = data.reviewedAt;
          row.updatedAt = new Date();
          return row;
        },
      ),
    },
  };

  const prismaMock = {
    role: {
      findMany: jest.fn(async () => []),
    },
    unit: {
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) => {
        const row = units.find((item) => item.id === where.id);
        return row ? { id: row.id } : null;
      }),
    },
    user: {
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) => {
        const row = users.find((item) => item.id === where.id);
        return row ? { id: row.id } : null;
      }),
    },
    file: {
      findMany: jest.fn(async () => []),
    },
    violationCategory: {
      findMany: jest.fn(async () => [...categories]),
      findUnique: jest.fn(
        async ({
          where,
          select,
        }: {
          where: { id?: string; name?: string };
          select?: Record<string, boolean>;
        }) => {
          const row = where.id
            ? categories.find((item) => item.id === where.id)
            : categories.find((item) => item.name === where.name);
          if (!row) {
            return null;
          }
          return applySelect(
            {
              ...row,
              defaultFineAmount: { toNumber: () => row.defaultFineAmount },
            } as unknown as Record<string, unknown>,
            select,
          );
        },
      ),
      findFirst: jest.fn(
        async ({
          where,
          select,
        }: {
          where: { id?: { not?: string }; name?: string };
          select?: Record<string, boolean>;
        }) => {
          const row = categories.find(
            (item) =>
              item.name === where.name &&
              item.id !== (where.id?.not ?? ''),
          );
          if (!row) {
            return null;
          }
          return applySelect(row as unknown as Record<string, unknown>, select);
        },
      ),
      create: jest.fn(
        async ({
          data,
        }: {
          data: { name: string; defaultFineAmount: number; description: string | null };
        }) => {
          categorySeq += 1;
          const now = new Date();
          const row: ViolationCategoryState = {
            id: `vcat-${categorySeq}`,
            name: data.name,
            defaultFineAmount: data.defaultFineAmount,
            description: data.description,
            isActive: true,
            displayOrder: categories.length,
            createdAt: now,
            updatedAt: now,
          };
          categories.push(row);
          return {
            ...row,
            defaultFineAmount: { toNumber: () => row.defaultFineAmount },
          };
        },
      ),
      update: jest.fn(
        async ({
          where,
          data,
        }: {
          where: { id: string };
          data: Partial<
            Pick<ViolationCategoryState, 'name' | 'description' | 'isActive' | 'displayOrder'>
          > & { defaultFineAmount?: number };
        }) => {
          const row = categories.find((item) => item.id === where.id);
          if (!row) {
            throw new Error('Category not found');
          }
          if (data.name !== undefined) row.name = data.name;
          if (data.description !== undefined) row.description = data.description;
          if (data.isActive !== undefined) row.isActive = data.isActive;
          if (data.displayOrder !== undefined) row.displayOrder = data.displayOrder;
          if (data.defaultFineAmount !== undefined) {
            row.defaultFineAmount = data.defaultFineAmount;
          }
          row.updatedAt = new Date();
          return {
            ...row,
            defaultFineAmount: { toNumber: () => row.defaultFineAmount },
          };
        },
      ),
    },
    violation: {
      findFirst: jest.fn(async () => {
        if (violations.length === 0) {
          return null;
        }
        const latest = [...violations].sort(
          (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
        )[0];
        return { violationNumber: latest.violationNumber };
      }),
      findUnique: jest.fn(
        async ({
          where,
          select,
          include,
        }: {
          where: { id: string };
          select?: Record<string, boolean>;
          include?: Record<string, unknown>;
        }) => {
          const row = violations.find((item) => item.id === where.id);
          if (!row) {
            return null;
          }
          if (select) {
            return applySelect(row as unknown as Record<string, unknown>, select);
          }
          if (!include) {
            return row;
          }

          const category = row.categoryId
            ? categories.find((item) => item.id === row.categoryId) ?? null
            : null;
          const unit = units.find((item) => item.id === row.unitId);
          const resident = row.residentId
            ? users.find((item) => item.id === row.residentId) ?? null
            : null;
          const issuer = row.issuedById
            ? users.find((item) => item.id === row.issuedById) ?? null
            : null;

          return {
            ...row,
            fineAmount: { toNumber: () => row.fineAmount },
            category: category
              ? { id: category.id, name: category.name, description: category.description }
              : null,
            unit: { id: row.unitId, unitNumber: unit?.unitNumber ?? 'Unknown' },
            resident: resident
              ? {
                  id: resident.id,
                  nameEN: resident.nameEN,
                  nameAR: resident.nameAR,
                  phone: resident.phone,
                  email: resident.email,
                }
              : null,
            issuedBy: issuer
              ? { id: issuer.id, nameEN: issuer.nameEN, nameAR: issuer.nameAR, email: issuer.email }
              : null,
            actionRequests: actions
              .filter((item) => item.violationId === row.id)
              .map((item) => ({
                ...item,
                requestedBy: users.find((user) => user.id === item.requestedById) ?? users[0],
                reviewedBy: item.reviewedById
                  ? users.find((user) => user.id === item.reviewedById) ?? null
                  : null,
              })),
            invoices: invoices
              .filter((item) => item.violationId === row.id)
              .map((item) => ({
                id: item.id,
                invoiceNumber: item.invoiceNumber,
                amount: { toNumber: () => item.amount },
                type: item.type,
                status: item.status,
                dueDate: item.dueDate,
              })),
          };
        },
      ),
      findMany: jest.fn(async () => []),
      count: jest.fn(async () => violations.length),
      groupBy: jest.fn(async () => []),
      aggregate: jest.fn(async () => ({ _sum: { fineAmount: 0 } })),
      update: prismaTx.violation.update,
    },
    violationActionRequest: {
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) => {
        const row = actions.find((item) => item.id === where.id);
        if (!row) {
          return null;
        }
        return {
          ...row,
          violation: { id: row.violationId },
        };
      }),
      findMany: jest.fn(async () => []),
      count: jest.fn(async () => 0),
    },
    invoice: {
      updateMany: prismaTx.invoice.updateMany,
    },
    $transaction: jest.fn(
      async (callback: (tx: typeof prismaTx) => Promise<unknown>) => callback(prismaTx),
    ),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [EventEmitterModule.forRoot(), ViolationsModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .overrideProvider(InvoicesService)
      .useValue(invoicesServiceMock)
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: { switchToHttp: () => { getRequest: () => { user?: unknown } } }) => {
          const req = context.switchToHttp().getRequest();
          req.user = { id: 'admin-1' };
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

  it('full violation lifecycle and appeal flow', async () => {
    const categoryId = await request(app.getHttpServer())
      .post('/violation-categories')
      .send({
        name: 'Parking',
        defaultFineAmount: 500,
      })
      .expect(201)
      .then((response) => String(response.body.id));

    const createdViolationId = await request(app.getHttpServer())
      .post('/violations')
      .send({
        unitId: 'unit-1',
        residentId: 'resident-1',
        categoryId,
        description: 'Double parking',
      })
      .expect(201)
      .then((response) => String(response.body.id));

    await request(app.getHttpServer())
      .patch(`/violations/${createdViolationId}/pay`)
      .expect(200)
      .then((response) => {
        expect(response.body.status).toBe('PAID');
      });

    await request(app.getHttpServer())
      .patch(`/violations/${createdViolationId}/cancel`)
      .expect(400);

    const secondViolationId = await request(app.getHttpServer())
      .post('/violations')
      .send({
        unitId: 'unit-1',
        residentId: 'resident-1',
        categoryId,
        description: 'Unauthorized alteration',
      })
      .expect(201)
      .then((response) => String(response.body.id));

    actionSeq += 1;
    actions.push({
      id: `action-${actionSeq}`,
      violationId: secondViolationId,
      requestedById: 'resident-1',
      type: ViolationActionType.APPEAL,
      status: ViolationActionStatus.PENDING,
      note: 'Please review this appeal',
      attachmentIds: [],
      reviewedById: null,
      reviewedAt: null,
      rejectionReason: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await request(app.getHttpServer())
      .post(`/violations/appeals/action-${actionSeq}/review`)
      .send({ approved: true })
      .expect(201)
      .then((response) => {
        expect(response.body.status).toBe('CANCELLED');
        expect(response.body.appealStatus).toBe('APPROVED');
      });

    const linkedInvoice = invoices.find((item) => item.violationId === secondViolationId);
    expect(linkedInvoice?.status).toBe(InvoiceStatus.CANCELLED);

    const action = actions.find((item) => item.id === `action-${actionSeq}`);
    expect(action?.status).toBe(ViolationActionStatus.APPROVED);
  });
});

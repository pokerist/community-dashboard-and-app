import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { ComplaintsModule } from '../../src/modules/complaints/complaints.module';
import { JwtAuthGuard } from '../../src/modules/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../src/modules/auth/guards/permissions.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { ComplaintStatus, Priority } from '@prisma/client';
import { EventEmitterModule } from '@nestjs/event-emitter';

interface CategoryState {
  id: string;
  name: string;
  slaHours: number;
  description: string | null;
  isActive: boolean;
  displayOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

interface ComplaintState {
  id: string;
  complaintNumber: string;
  title: string | null;
  team: string | null;
  reporterId: string;
  unitId: string | null;
  categoryId: string | null;
  categoryLegacy: string | null;
  description: string;
  priority: Priority;
  status: ComplaintStatus;
  resolutionNotes: string | null;
  resolvedAt: Date | null;
  assignedToId: string | null;
  slaDeadline: Date | null;
  slaBreachedAt: Date | null;
  closedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface CommentState {
  id: string;
  complaintId: string;
  createdById: string;
  body: string;
  isInternal: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface UserState {
  id: string;
  nameEN: string | null;
  nameAR: string | null;
  email: string | null;
  phone: string | null;
}

interface UnitState {
  id: string;
  unitNumber: string;
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

describe('ComplaintsModule (e2e)', () => {
  let app: INestApplication;

  let categorySeq = 0;
  let complaintSeq = 0;
  let commentSeq = 0;

  const users: UserState[] = [
    {
      id: 'admin-1',
      nameEN: 'Admin User',
      nameAR: null,
      email: 'admin@example.com',
      phone: '+201000000001',
    },
    {
      id: 'agent-1',
      nameEN: 'Agent User',
      nameAR: null,
      email: 'agent@example.com',
      phone: '+201000000002',
    },
  ];

  const units: UnitState[] = [{ id: 'unit-1', unitNumber: 'A-101' }];
  const categories: CategoryState[] = [];
  const complaints: ComplaintState[] = [];
  const comments: CommentState[] = [];

  const mockPrisma = {
    role: {
      findMany: jest.fn(async () => []),
    },
    unit: {
      findUnique: jest.fn(
        async ({ where }: { where: { id: string } }): Promise<{ id: string } | null> => {
          const row = units.find((item) => item.id === where.id);
          return row ? { id: row.id } : null;
        },
      ),
    },
    user: {
      findUnique: jest.fn(
        async ({ where }: { where: { id: string } }): Promise<{ id: string } | null> => {
          const row = users.find((item) => item.id === where.id);
          return row ? { id: row.id } : null;
        },
      ),
    },
    complaintCategory: {
      findMany: jest.fn(
        async ({
          where,
          orderBy,
        }: {
          where?: { isActive?: boolean };
          orderBy?: Array<{ displayOrder?: 'asc' | 'desc'; name?: 'asc' | 'desc' }>;
        }) => {
          let rows = [...categories];
          if (typeof where?.isActive === 'boolean') {
            rows = rows.filter((item) => item.isActive === where.isActive);
          }
          if (orderBy) {
            rows.sort((a, b) => {
              if (a.displayOrder !== b.displayOrder) {
                return a.displayOrder - b.displayOrder;
              }
              return a.name.localeCompare(b.name);
            });
          }
          return rows;
        },
      ),
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
          return applySelect(row as unknown as Record<string, unknown>, select);
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
          data: { name: string; slaHours: number; description: string | null };
        }) => {
          categorySeq += 1;
          const now = new Date();
          const row: CategoryState = {
            id: `cat-${categorySeq}`,
            name: data.name,
            slaHours: data.slaHours,
            description: data.description,
            isActive: true,
            displayOrder: categories.length,
            createdAt: now,
            updatedAt: now,
          };
          categories.push(row);
          return row;
        },
      ),
      update: jest.fn(
        async ({
          where,
          data,
        }: {
          where: { id: string };
          data: Partial<Pick<CategoryState, 'name' | 'slaHours' | 'description' | 'isActive' | 'displayOrder'>>;
        }) => {
          const row = categories.find((item) => item.id === where.id);
          if (!row) {
            throw new Error('Category not found');
          }
          if (data.name !== undefined) row.name = data.name;
          if (data.slaHours !== undefined) row.slaHours = data.slaHours;
          if (data.description !== undefined) row.description = data.description;
          if (data.isActive !== undefined) row.isActive = data.isActive;
          if (data.displayOrder !== undefined) row.displayOrder = data.displayOrder;
          row.updatedAt = new Date();
          return row;
        },
      ),
    },
    complaint: {
      findFirst: jest.fn(async () => {
        if (complaints.length === 0) {
          return null;
        }
        const latest = [...complaints].sort(
          (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
        )[0];
        return { complaintNumber: latest.complaintNumber };
      }),
      create: jest.fn(
        async ({
          data,
          select,
        }: {
          data: {
            complaintNumber: string;
            title: string | null;
            team: string | null;
            reporterId: string;
            unitId: string | null;
            categoryId: string | null;
            categoryLegacy: string | null;
            description: string;
            priority: Priority;
            status: ComplaintStatus;
            slaDeadline: Date | null;
          };
          select?: Record<string, boolean>;
        }) => {
          complaintSeq += 1;
          const now = new Date();
          const row: ComplaintState = {
            id: `cmp-${complaintSeq}`,
            complaintNumber: data.complaintNumber,
            title: data.title,
            team: data.team,
            reporterId: data.reporterId,
            unitId: data.unitId,
            categoryId: data.categoryId,
            categoryLegacy: data.categoryLegacy,
            description: data.description,
            priority: data.priority,
            status: data.status,
            resolutionNotes: null,
            resolvedAt: null,
            assignedToId: null,
            slaDeadline: data.slaDeadline,
            slaBreachedAt: null,
            closedAt: null,
            createdAt: now,
            updatedAt: now,
          };
          complaints.push(row);
          return applySelect(row as unknown as Record<string, unknown>, select);
        },
      ),
      findUnique: jest.fn(
        async ({
          where,
          include,
          select,
        }: {
          where: { id: string };
          include?: Record<string, unknown>;
          select?: Record<string, boolean>;
        }) => {
          const complaint = complaints.find((item) => item.id === where.id);
          if (!complaint) {
            return null;
          }

          if (select) {
            return applySelect(complaint as unknown as Record<string, unknown>, select);
          }

          if (!include) {
            return complaint;
          }

          const category = complaint.categoryId
            ? categories.find((item) => item.id === complaint.categoryId) ?? null
            : null;
          const unit = complaint.unitId
            ? units.find((item) => item.id === complaint.unitId) ?? null
            : null;
          const reporter = users.find((item) => item.id === complaint.reporterId) ?? null;
          const assignedTo = complaint.assignedToId
            ? users.find((item) => item.id === complaint.assignedToId) ?? null
            : null;
          const complaintComments = comments
            .filter((item) => item.complaintId === complaint.id)
            .map((item) => ({
              ...item,
              createdBy:
                users.find((user) => user.id === item.createdById) ?? users[0],
            }));

          return {
            ...complaint,
            category: category
              ? { id: category.id, name: category.name, slaHours: category.slaHours }
              : null,
            unit: unit ? { id: unit.id, unitNumber: unit.unitNumber } : null,
            reporter: reporter
              ? {
                  id: reporter.id,
                  nameEN: reporter.nameEN,
                  nameAR: reporter.nameAR,
                  phone: reporter.phone,
                  email: reporter.email,
                }
              : {
                  id: 'unknown',
                  nameEN: null,
                  nameAR: null,
                  phone: null,
                  email: null,
                },
            assignedTo: assignedTo
              ? {
                  id: assignedTo.id,
                  nameEN: assignedTo.nameEN,
                  nameAR: assignedTo.nameAR,
                  email: assignedTo.email,
                }
              : null,
            comments: complaintComments,
            invoices: [],
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
            Pick<
              ComplaintState,
              'assignedToId' | 'status' | 'resolutionNotes' | 'resolvedAt' | 'closedAt'
            >
          >;
        }) => {
          const complaint = complaints.find((item) => item.id === where.id);
          if (!complaint) {
            throw new Error('Complaint not found');
          }
          if (data.assignedToId !== undefined) complaint.assignedToId = data.assignedToId;
          if (data.status !== undefined) complaint.status = data.status;
          if (data.resolutionNotes !== undefined)
            complaint.resolutionNotes = data.resolutionNotes;
          if (data.resolvedAt !== undefined) complaint.resolvedAt = data.resolvedAt;
          if (data.closedAt !== undefined) complaint.closedAt = data.closedAt;
          complaint.updatedAt = new Date();
          return complaint;
        },
      ),
      findMany: jest.fn(async () => complaints),
      count: jest.fn(async () => complaints.length),
      groupBy: jest.fn(async () => []),
      updateMany: jest.fn(async () => ({ count: 0 })),
    },
    complaintComment: {
      create: jest.fn(
        async ({
          data,
          include,
        }: {
          data: { complaintId: string; createdById: string; body: string; isInternal: boolean };
          include?: Record<string, unknown>;
        }) => {
          commentSeq += 1;
          const now = new Date();
          const row: CommentState = {
            id: `com-${commentSeq}`,
            complaintId: data.complaintId,
            createdById: data.createdById,
            body: data.body,
            isInternal: data.isInternal,
            createdAt: now,
            updatedAt: now,
          };
          comments.push(row);

          if (!include) {
            return row;
          }

          const author = users.find((item) => item.id === row.createdById) ?? users[0];
          return {
            ...row,
            createdBy: {
              id: author.id,
              nameEN: author.nameEN,
              nameAR: author.nameAR,
              email: author.email,
            },
          };
        },
      ),
    },
    $transaction: jest.fn(async (ops: Array<Promise<unknown>>) => Promise.all(ops)),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [EventEmitterModule.forRoot(), ComplaintsModule],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrisma)
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

  it('category CRUD flow', async () => {
    const createdCategory = await request(app.getHttpServer())
      .post('/complaint-categories')
      .send({
        name: 'Security',
        slaHours: 12,
        description: 'Security incidents',
      })
      .expect(201)
      .then((response) => response.body as CategoryState);

    expect(createdCategory.name).toBe('Security');
    expect(createdCategory.slaHours).toBe(12);

    await request(app.getHttpServer())
      .get('/complaint-categories')
      .expect(200)
      .then((response) => {
        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.length).toBeGreaterThan(0);
      });

    await request(app.getHttpServer())
      .patch(`/complaint-categories/${createdCategory.id}`)
      .send({ slaHours: 24 })
      .expect(200)
      .then((response) => {
        expect(response.body.slaHours).toBe(24);
      });

    await request(app.getHttpServer())
      .patch(`/complaint-categories/${createdCategory.id}/toggle`)
      .expect(200)
      .then((response) => {
        expect(response.body.isActive).toBe(false);
      });

    await request(app.getHttpServer())
      .patch('/complaint-categories/reorder')
      .send({ orderedIds: [createdCategory.id] })
      .expect(200)
      .then((response) => {
        expect(Array.isArray(response.body)).toBe(true);
      });
  });

  it('full complaint lifecycle flow', async () => {
    const categoryId = await request(app.getHttpServer())
      .post('/complaint-categories')
      .send({
        name: 'Maintenance',
        slaHours: 24,
      })
      .expect(201)
      .then((response) => String(response.body.id));

    const createdComplaint = await request(app.getHttpServer())
      .post('/complaints')
      .send({
        unitId: 'unit-1',
        categoryId,
        title: 'Noise Issue',
        description: 'Late-night noise from nearby unit',
        priority: 'HIGH',
      })
      .expect(201)
      .then((response) => response.body as { id: string; status: ComplaintStatus });

    expect(createdComplaint.status).toBe(ComplaintStatus.NEW);

    await request(app.getHttpServer())
      .patch(`/complaints/${createdComplaint.id}/assign`)
      .send({ assignedToId: 'agent-1' })
      .expect(200)
      .then((response) => {
        expect(response.body.assigneeId).toBe('agent-1');
      });

    await request(app.getHttpServer())
      .patch(`/complaints/${createdComplaint.id}/status`)
      .send({ status: 'IN_PROGRESS' })
      .expect(200)
      .then((response) => {
        expect(response.body.status).toBe('IN_PROGRESS');
      });

    await request(app.getHttpServer())
      .patch(`/complaints/${createdComplaint.id}/status`)
      .send({ status: 'RESOLVED', resolutionNotes: 'Resolved on-site' })
      .expect(200)
      .then((response) => {
        expect(response.body.status).toBe('RESOLVED');
        expect(response.body.resolutionNotes).toBe('Resolved on-site');
      });

    await request(app.getHttpServer())
      .patch(`/complaints/${createdComplaint.id}/status`)
      .send({ status: 'CLOSED' })
      .expect(200)
      .then((response) => {
        expect(response.body.status).toBe('CLOSED');
      });

    await request(app.getHttpServer())
      .get(`/complaints/${createdComplaint.id}`)
      .expect(200)
      .then((response) => {
        expect(response.body.status).toBe('CLOSED');
      });
  });
});

import { INestApplication } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { BillingCycle, BookingStatus, FacilityType, InvoiceStatus, InvoiceType } from '@prisma/client';
import request from 'supertest';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../../src/modules/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../src/modules/auth/guards/permissions.guard';
import { BookingsModule } from '../../src/modules/bookings/bookings.module';
import { FacilitiesModule } from '../../src/modules/facilities/facilities.module';
import { InvoicesService } from '../../src/modules/invoices/invoices.service';

type FacilityState = {
  id: string;
  name: string;
  type: FacilityType;
  description: string | null;
  iconName: string | null;
  color: string | null;
  rules: string | null;
  isActive: boolean;
  capacity: number | null;
  price: number | null;
  billingCycle: BillingCycle;
  isBookable: boolean;
  requiresPrepayment: boolean;
  reminderMinutesBefore: number | null;
  maxReservationsPerDay: number | null;
  cooldownMinutes: number | null;
  createdAt: Date;
  updatedAt: Date;
};

type SlotConfigState = {
  id: string;
  facilityId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  slotDurationMinutes: number;
  slotCapacity: number | null;
};

type SlotExceptionState = {
  id: string;
  facilityId: string;
  date: Date;
  isClosed: boolean;
  startTime: string | null;
  endTime: string | null;
  slotDurationMinutes: number | null;
  slotCapacity: number | null;
};

type BookingState = {
  id: string;
  facilityId: string;
  date: Date;
  startTime: string;
  endTime: string;
  status: BookingStatus;
  cancelledAt: Date | null;
  cancelledById: string | null;
  rejectedById: string | null;
  rejectionReason: string | null;
  cancellationReason: string | null;
  checkedInAt: Date | null;
  totalAmount: number | null;
  userId: string;
  residentId: string | null;
  unitId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type InvoiceState = {
  id: string;
  invoiceNumber: string;
  bookingId: string;
  unitId: string;
  residentId: string | null;
  amount: number;
  type: InvoiceType;
  status: InvoiceStatus;
  dueDate: Date;
  paidDate: Date | null;
  createdAt: Date;
};

type UserState = {
  id: string;
  nameEN: string | null;
  nameAR: string | null;
  email: string | null;
  phone: string | null;
};

type UnitState = { id: string; unitNumber: string };

function inRange(value: Date, gte?: Date, lte?: Date): boolean {
  if (gte && value < gte) return false;
  if (lte && value > lte) return false;
  return true;
}

describe('Amenities Modules (e2e)', () => {
  let app: INestApplication;

  let facilitySeq = 0;
  let slotSeq = 0;
  let exceptionSeq = 0;
  let bookingSeq = 0;
  let invoiceSeq = 0;

  const users: UserState[] = [
    { id: 'admin-1', nameEN: 'Admin', nameAR: null, email: 'admin@example.com', phone: '+201000000001' },
    { id: 'resident-1', nameEN: 'Resident', nameAR: null, email: 'resident@example.com', phone: '+201000000011' },
  ];
  const units: UnitState[] = [{ id: 'unit-1', unitNumber: 'A-101' }];
  const facilities: FacilityState[] = [];
  const slotConfigs: SlotConfigState[] = [];
  const slotExceptions: SlotExceptionState[] = [];
  const bookings: BookingState[] = [];
  const invoices: InvoiceState[] = [];

  const invoicesServiceMock = {
    generateInvoiceTx: jest.fn(async (_tx: unknown, dto: {
      unitId: string;
      residentId?: string;
      amount: number;
      dueDate: Date;
      type: InvoiceType;
      status?: InvoiceStatus;
      sources?: { bookingIds?: string[] };
    }) => {
      invoiceSeq += 1;
      const row: InvoiceState = {
        id: `inv-${invoiceSeq}`,
        invoiceNumber: `INV-${invoiceSeq.toString().padStart(5, '0')}`,
        bookingId: dto.sources?.bookingIds?.[0] ?? '',
        unitId: dto.unitId,
        residentId: dto.residentId ?? null,
        amount: dto.amount,
        type: dto.type,
        status: dto.status ?? InvoiceStatus.PENDING,
        dueDate: dto.dueDate,
        paidDate: null,
        createdAt: new Date(),
      };
      invoices.push(row);
      return row;
    }),
  };

  const prismaMock = {
    role: { findMany: jest.fn(async () => []) },
    user: { findUnique: jest.fn(async ({ where }: { where: { id: string } }) => users.find((u) => u.id === where.id) ?? null) },
    unit: { findUnique: jest.fn(async ({ where }: { where: { id: string } }) => units.find((u) => u.id === where.id) ?? null) },
    facility: {
      create: jest.fn(async ({ data, select }: { data: Record<string, unknown>; select?: Record<string, boolean> }) => {
        facilitySeq += 1;
        const now = new Date();
        const row: FacilityState = {
          id: `fac-${facilitySeq}`,
          name: String(data.name),
          description: (data.description as string | undefined) ?? null,
          type: data.type as FacilityType,
          iconName: (data.iconName as string | undefined) ?? null,
          color: (data.color as string | undefined) ?? null,
          rules: (data.rules as string | undefined) ?? null,
          isActive: (data.isActive as boolean | undefined) ?? true,
          capacity: (data.capacity as number | undefined) ?? null,
          price: (data.price as number | undefined) ?? null,
          billingCycle: (data.billingCycle as BillingCycle | undefined) ?? BillingCycle.NONE,
          isBookable: (data.isBookable as boolean | undefined) ?? true,
          requiresPrepayment: (data.requiresPrepayment as boolean | undefined) ?? false,
          reminderMinutesBefore: (data.reminderMinutesBefore as number | undefined) ?? 60,
          maxReservationsPerDay: (data.maxReservationsPerDay as number | undefined) ?? null,
          cooldownMinutes: (data.cooldownMinutes as number | undefined) ?? null,
          createdAt: now,
          updatedAt: now,
        };
        facilities.push(row);
        return select?.id ? { id: row.id } : row;
      }),
      findUnique: jest.fn(async ({ where, select, include }: {
        where: { id: string };
        select?: Record<string, boolean>;
        include?: {
          slotConfig?: { where?: { dayOfWeek?: number } };
          slotExceptions?: { where?: { date?: { gte?: Date; lte?: Date } }; take?: number };
        };
      }) => {
        const row = facilities.find((f) => f.id === where.id);
        if (!row) return null;
        if (select?.id) return { id: row.id };
        if (select?.isActive) return { isActive: row.isActive };
        if (!include) return row;

        let cfg = slotConfigs.filter((c) => c.facilityId === row.id);
        if (include.slotConfig?.where?.dayOfWeek !== undefined) {
          cfg = cfg.filter((c) => c.dayOfWeek === include.slotConfig?.where?.dayOfWeek);
        }
        cfg.sort((a, b) => a.startTime.localeCompare(b.startTime));

        let ex = slotExceptions.filter((e) => e.facilityId === row.id);
        const dateFilter = include.slotExceptions?.where?.date;
        if (dateFilter) {
          ex = ex.filter((e) => inRange(e.date, dateFilter.gte, dateFilter.lte));
        }
        ex.sort((a, b) => a.date.getTime() - b.date.getTime());
        if (include.slotExceptions?.take) {
          ex = ex.slice(0, include.slotExceptions.take);
        }

        return { ...row, slotConfig: cfg, slotExceptions: ex };
      }),
      update: jest.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const row = facilities.find((f) => f.id === where.id);
        if (!row) throw new Error('Facility not found');
        for (const [key, value] of Object.entries(data)) {
          if (value !== undefined && key in row) {
            (row as unknown as Record<string, unknown>)[key] = value;
          }
        }
        row.updatedAt = new Date();
        return row;
      }),
      findMany: jest.fn(async () => facilities),
      count: jest.fn(async () => facilities.length),
    },
    facilitySlotConfig: {
      findFirst: jest.fn(async ({ where }: { where: { facilityId: string; dayOfWeek: number } }) => slotConfigs.find((c) => c.facilityId === where.facilityId && c.dayOfWeek === where.dayOfWeek) ?? null),
      create: jest.fn(async ({ data }: { data: Omit<SlotConfigState, 'id'> }) => {
        slotSeq += 1;
        const row: SlotConfigState = { id: `cfg-${slotSeq}`, ...data };
        slotConfigs.push(row);
        return row;
      }),
      update: jest.fn(async ({ where, data }: { where: { id: string }; data: Partial<SlotConfigState> }) => {
        const row = slotConfigs.find((c) => c.id === where.id);
        if (!row) throw new Error('Config not found');
        Object.assign(row, data);
        return row;
      }),
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) => slotConfigs.find((c) => c.id === where.id) ?? null),
      delete: jest.fn(async ({ where }: { where: { id: string } }) => {
        const idx = slotConfigs.findIndex((c) => c.id === where.id);
        if (idx >= 0) slotConfigs.splice(idx, 1);
        return { id: where.id };
      }),
      deleteMany: jest.fn(async () => ({ count: 0 })),
      createMany: jest.fn(async () => ({ count: 0 })),
    },
    facilitySlotException: {
      findFirst: jest.fn(async ({ where }: { where: { facilityId: string; date: { gte: Date; lte: Date } } }) => slotExceptions.find((e) => e.facilityId === where.facilityId && inRange(e.date, where.date.gte, where.date.lte)) ?? null),
      create: jest.fn(async ({ data }: { data: Omit<SlotExceptionState, 'id'> }) => {
        exceptionSeq += 1;
        const row: SlotExceptionState = { id: `exc-${exceptionSeq}`, ...data };
        slotExceptions.push(row);
        return row;
      }),
      update: jest.fn(async ({ where, data }: { where: { id: string }; data: Partial<SlotExceptionState> }) => {
        const row = slotExceptions.find((e) => e.id === where.id);
        if (!row) throw new Error('Exception not found');
        Object.assign(row, data);
        return row;
      }),
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) => slotExceptions.find((e) => e.id === where.id) ?? null),
      delete: jest.fn(async ({ where }: { where: { id: string } }) => {
        const idx = slotExceptions.findIndex((e) => e.id === where.id);
        if (idx >= 0) slotExceptions.splice(idx, 1);
        return { id: where.id };
      }),
      deleteMany: jest.fn(async () => ({ count: 0 })),
      createMany: jest.fn(async () => ({ count: 0 })),
    },
    booking: {
      findMany: jest.fn(async ({ where }: { where?: { facilityId?: string; date?: { gte?: Date; lte?: Date }; status?: { in: BookingStatus[] } } }) => {
        let rows = [...bookings];
        if (where?.facilityId) rows = rows.filter((b) => b.facilityId === where.facilityId);
        if (where?.date) rows = rows.filter((b) => inRange(b.date, where.date?.gte, where.date?.lte));
        if (where?.status?.in) rows = rows.filter((b) => where.status?.in.includes(b.status));
        return rows.map((b) => ({ id: b.id, startTime: b.startTime, endTime: b.endTime }));
      }),
      groupBy: jest.fn(async () => []),
      count: jest.fn(async () => bookings.length),
      findUnique: jest.fn(async ({ where, include }: { where: { id: string }; include?: Record<string, unknown> }) => {
        const b = bookings.find((row) => row.id === where.id);
        if (!b) return null;
        if (!include) return b;
        const facility = facilities.find((f) => f.id === b.facilityId);
        const unit = units.find((u) => u.id === b.unitId);
        const user = users.find((u) => u.id === b.userId);
        const bookingInvoices = invoices.filter((i) => i.bookingId === b.id).map((i) => ({
          id: i.id,
          invoiceNumber: i.invoiceNumber,
          amount: i.amount,
          status: i.status,
          dueDate: i.dueDate,
          paidDate: i.paidDate,
          type: i.type,
        }));
        return {
          ...b,
          facility,
          unit,
          user,
          invoices: bookingInvoices,
        };
      }),
      update: jest.fn(async ({ where, data }: { where: { id: string }; data: Partial<BookingState> }) => {
        const b = bookings.find((row) => row.id === where.id);
        if (!b) throw new Error('Booking not found');
        Object.assign(b, data);
        b.updatedAt = new Date();
        return b;
      }),
    },
    invoice: {
      aggregate: jest.fn(async () => ({ _sum: { amount: 0 } })),
      findMany: jest.fn(async () => []),
      updateMany: jest.fn(async ({ where, data }: { where: { bookingId?: string; status?: { in: InvoiceStatus[] } }; data: { status?: InvoiceStatus } }) => {
        const rows = invoices.filter((i) => (where.bookingId ? i.bookingId === where.bookingId : true) && (where.status?.in ? where.status.in.includes(i.status) : true));
        rows.forEach((row) => {
          if (data.status) row.status = data.status;
        });
        return { count: rows.length };
      }),
    },
    $transaction: jest.fn(async (callback: (tx: unknown) => Promise<unknown>) => callback({
      booking: { update: prismaMock.booking.update },
      invoice: { updateMany: prismaMock.invoice.updateMany },
      facility: { update: prismaMock.facility.update },
      facilitySlotConfig: { deleteMany: prismaMock.facilitySlotConfig.deleteMany, createMany: prismaMock.facilitySlotConfig.createMany },
      facilitySlotException: { deleteMany: prismaMock.facilitySlotException.deleteMany, createMany: prismaMock.facilitySlotException.createMany },
    } as unknown)),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [EventEmitterModule.forRoot(), FacilitiesModule, BookingsModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .overrideProvider(InvoicesService)
      .useValue(invoicesServiceMock)
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: (context: { switchToHttp: () => { getRequest: () => { user?: unknown } } }) => {
        context.switchToHttp().getRequest().user = { id: 'admin-1' };
        return true;
      }})
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('facility slot config CRUD and available slots', async () => {
    const facilityId = await request(app.getHttpServer())
      .post('/facilities')
      .send({ name: 'Main Pool', type: 'POOL', billingCycle: 'NONE' })
      .expect(201)
      .then((res) => String(res.body.id));

    const slotId = await request(app.getHttpServer())
      .put(`/facilities/${facilityId}/slots/1`)
      .send({ startTime: '08:00', endTime: '10:00', slotDurationMinutes: 60 })
      .expect(200)
      .then((res) => String(res.body.id));

    bookingSeq += 1;
    bookings.push({
      id: `booking-${bookingSeq}`,
      facilityId,
      date: new Date('2099-01-05T00:00:00.000Z'),
      startTime: '09:00',
      endTime: '10:00',
      status: BookingStatus.APPROVED,
      cancelledAt: null,
      cancelledById: null,
      rejectedById: null,
      rejectionReason: null,
      cancellationReason: null,
      checkedInAt: null,
      totalAmount: null,
      userId: 'resident-1',
      residentId: null,
      unitId: 'unit-1',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await request(app.getHttpServer())
      .get(`/facilities/${facilityId}/available-slots`)
      .query({ date: '2099-01-05' })
      .expect(200)
      .then((res) => {
        expect(res.body.slots).toEqual([
          { startTime: '08:00', endTime: '09:00', status: 'AVAILABLE', bookingId: null },
          { startTime: '09:00', endTime: '10:00', status: 'BOOKED', bookingId: `booking-${bookingSeq}` },
        ]);
      });

    await request(app.getHttpServer())
      .post(`/facilities/${facilityId}/exceptions`)
      .send({ date: '2099-01-05T00:00:00.000Z', isClosed: true })
      .expect(201);

    await request(app.getHttpServer())
      .get(`/facilities/${facilityId}/available-slots`)
      .query({ date: '2099-01-05' })
      .expect(200)
      .then((res) => {
        expect(res.body.slots[0].status).toBe('CLOSED');
        expect(res.body.slots[1].status).toBe('CLOSED');
      });

    await request(app.getHttpServer())
      .delete(`/facilities/slots/${slotId}`)
      .expect(200);

    await request(app.getHttpServer())
      .get(`/facilities/${facilityId}/available-slots`)
      .query({ date: '2099-01-05' })
      .expect(200)
      .then((res) => {
        expect(res.body.slots).toEqual([]);
      });
  });

  it('booking lifecycle approve and cancel with refund flag', async () => {
    const facilityId = await request(app.getHttpServer())
      .post('/facilities')
      .send({
        name: 'Indoor Hall',
        type: 'MULTIPURPOSE_HALL',
        billingCycle: 'PER_HOUR',
        price: 100,
        requiresPrepayment: true,
      })
      .expect(201)
      .then((res) => String(res.body.id));

    bookingSeq += 1;
    const bookingId = `booking-${bookingSeq}`;
    bookings.push({
      id: bookingId,
      facilityId,
      date: new Date('2099-01-08T00:00:00.000Z'),
      startTime: '10:00',
      endTime: '11:00',
      status: BookingStatus.PENDING,
      cancelledAt: null,
      cancelledById: null,
      rejectedById: null,
      rejectionReason: null,
      cancellationReason: null,
      checkedInAt: null,
      totalAmount: null,
      userId: 'resident-1',
      residentId: null,
      unitId: 'unit-1',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await request(app.getHttpServer())
      .post(`/bookings/${bookingId}/approve`)
      .expect(201)
      .then((res) => {
        expect(res.body.status).toBe('PENDING_PAYMENT');
        expect(res.body.totalAmount).toBe(100);
      });

    const linkedInvoice = invoices.find((item) => item.bookingId === bookingId);
    expect(linkedInvoice?.type).toBe(InvoiceType.BOOKING_FEE);

    if (linkedInvoice) {
      linkedInvoice.status = InvoiceStatus.PAID;
      linkedInvoice.paidDate = new Date('2099-01-09T10:00:00.000Z');
    }

    await request(app.getHttpServer())
      .post(`/bookings/${bookingId}/cancel`)
      .send({ reason: 'Resident requested cancellation' })
      .expect(201)
      .then((res) => {
        expect(res.body.status).toBe('CANCELLED');
        expect(res.body.refundRequired).toBe(true);
        expect(String(res.body.cancellationReason)).toContain('[REFUND_REQUIRED]');
      });
  });
});

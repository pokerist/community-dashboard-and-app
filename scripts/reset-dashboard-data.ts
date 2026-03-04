import {
  AccessStatus,
  Audience,
  BookingStatus,
  Channel,
  ComplaintStatus,
  DeviceType,
  FacilityType,
  InvoiceStatus,
  InvoiceType,
  NotificationLogStatus,
  NotificationStatus,
  NotificationType,
  PrismaClient,
  Priority,
  QRType,
  ServiceCategory,
  ServiceFieldType,
  ServiceRequestStatus,
  SmartDeviceStatus,
  UnitStatus,
  UnitType,
  ViolationStatus,
} from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

function loadDatabaseUrlFromEnvFiles() {
  if (process.env.DATABASE_URL) return;
  const candidates = ['.env.production', '.env.local', '.env'];
  for (const fileName of candidates) {
    const filePath = path.resolve(process.cwd(), fileName);
    if (!fs.existsSync(filePath)) continue;
    const content = fs.readFileSync(filePath, 'utf8');
    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const match = line.match(/^(?:export\s+)?DATABASE_URL\s*=\s*(.+)$/);
      if (!match?.[1]) continue;
      const value = match[1].trim().replace(/^['"]|['"]$/g, '');
      if (!value) continue;
      process.env.DATABASE_URL = value;
      break;
    }
    if (process.env.DATABASE_URL) break;
  }
}

loadDatabaseUrlFromEnvFiles();

const prisma = new PrismaClient();
let s = 20260225;
const rnd = () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];
const ri = (min: number, max: number) => Math.floor(rnd() * (max - min + 1)) + min;
const maybe = (p = 0.5) => rnd() < p;
const daysAgo = (d: number) => new Date(Date.now() - d * 86400000);
const addDays = (dt: Date, d: number) => new Date(dt.getTime() + d * 86400000);
const randDate = (maxDays: number) => new Date(Date.now() - ri(1, maxDays) * 86400000 - ri(0, 23) * 3600000);
const seq = (p: string, i: number) => `${p}-${String(i).padStart(5, '0')}`;

const DEMO_EMAILS = [
  'test@admin.com',
  'ahmed.hassan.owner@alkarma.demo',
  'mostafa.ali.tenant@alkarma.demo',
  'karim.fathy.predelivery@alkarma.demo',
  'nour.hassan.family@alkarma.demo',
  'youssef.mahmoud.authorized@alkarma.demo',
  'mohamed.saber.contractor@alkarma.demo',
];

async function ensureUnits() {
  const defs = [
    ['Alkarma Heights', 'A', UnitType.APARTMENT, 101, 8],
    ['Alkarma Heights', 'B', UnitType.APARTMENT, 201, 8],
    ['Alkarma Gates', 'V', UnitType.VILLA, 1, 8],
    ['Alkarma Kay', 'T', UnitType.TOWNHOUSE, 1, 6],
  ] as const;
  const statuses = [UnitStatus.OCCUPIED, UnitStatus.OCCUPIED, UnitStatus.LEASED, UnitStatus.DELIVERED, UnitStatus.AVAILABLE, UnitStatus.NOT_DELIVERED];
  const deliveredStatuses: UnitStatus[] = [UnitStatus.DELIVERED, UnitStatus.OCCUPIED, UnitStatus.LEASED];
  for (const [projectName, block, type, start, count] of defs) {
    for (let i = 0; i < count; i++) {
      const unitNumber = String(start + i);
      const status = statuses[i % statuses.length];
      const existing = await prisma.unit.findFirst({ where: { projectName, block, unitNumber }, select: { id: true } });
      const data = {
        projectName,
        block,
        unitNumber,
        type,
        status,
        isDelivered: deliveredStatuses.includes(status),
        bedrooms: type === UnitType.APARTMENT ? ri(2, 4) : ri(3, 5),
        bathrooms: type === UnitType.APARTMENT ? ri(2, 3) : ri(3, 4),
        sizeSqm: type === UnitType.APARTMENT ? ri(110, 210) : ri(210, 380),
      };
      if (existing) await prisma.unit.update({ where: { id: existing.id }, data });
      else await prisma.unit.create({ data: { ...data, price: String(ri(1500000, 12000000)) } });
    }
  }
}

async function cleanupTransactional() {
  await prisma.attachment.deleteMany({
    where: {
      OR: [
        { serviceRequestId: { not: null } },
        { invoiceId: { not: null } },
        { incidentId: { not: null } },
        { entity: { in: ['SERVICE_REQUEST', 'COMPLAINT', 'INCIDENT', 'VIOLATION', 'INVOICE'] } },
      ],
    },
  });
  await prisma.notificationLog.deleteMany({});
  await prisma.notification.deleteMany({});
  await prisma.notificationDeviceToken.deleteMany({});
  await prisma.unitFee.deleteMany({});
  await prisma.invoice.deleteMany({});
  await prisma.serviceRequestFieldValue.deleteMany({});
  await prisma.serviceRequest.deleteMany({});
  await prisma.booking.deleteMany({});
  await prisma.complaint.deleteMany({});
  await prisma.violation.deleteMany({});
  await prisma.incident.deleteMany({});
  await prisma.accessQRCode.deleteMany({});
  await prisma.smartDevice.deleteMany({});
  await prisma.generatedReport.deleteMany({});
  await prisma.reportSchedule.deleteMany({});
}

async function ensureServicesAndFacilities() {
  const services = [
    ['AC Maintenance Visit', ServiceCategory.MAINTENANCE, 'DELIVERED_ONLY', 'Schedule AC maintenance and inspection.', '350'],
    ['Plumbing Repair', ServiceCategory.MAINTENANCE, 'DELIVERED_ONLY', 'Leaks and drainage repair visit.', '220'],
    ['Electrical Inspection', ServiceCategory.SECURITY, 'DELIVERED_ONLY', 'Electrical load and breaker inspection.', '300'],
    ['Guest Parking Request', ServiceCategory.REQUESTS, 'DELIVERED_ONLY', 'Temporary guest parking request.', '0'],
    ['Moving Truck Permit', ServiceCategory.REQUESTS, 'DELIVERED_ONLY', 'Moving-in/out truck permit request.', '150'],
    ['Car Sticker Request', ServiceCategory.REQUESTS, 'ALL', 'New / replacement access sticker.', '75'],
    ['Clubhouse Event Request', ServiceCategory.REQUESTS, 'DELIVERED_ONLY', 'Private event permit / booking request.', '500'],
  ] as const;
  for (const [name, category, unitEligibility, description, startingPrice] of services) {
    const existing = await prisma.service.findFirst({ where: { name }, select: { id: true } });
    const service = existing
      ? await prisma.service.update({ where: { id: existing.id }, data: { category, unitEligibility: unitEligibility as any, description, startingPrice, status: true } })
      : await prisma.service.create({ data: { name, category, unitEligibility: unitEligibility as any, description, startingPrice, status: true } });
    await prisma.serviceField.deleteMany({ where: { serviceId: service.id } });
    await prisma.serviceField.createMany({
      data: [
        { serviceId: service.id, label: 'Preferred Date', type: ServiceFieldType.DATE, required: true, order: 1 },
        { serviceId: service.id, label: 'Details', type: ServiceFieldType.TEXTAREA, required: true, order: 2 },
        { serviceId: service.id, label: 'Attachment', type: ServiceFieldType.FILE, required: false, order: 3 },
      ],
    });
  }

  const facilities = [
    ['Main Pool', FacilityType.POOL, 75, 'PER_SLOT'],
    ['Gym Studio', FacilityType.GYM, 0, 'NONE'],
    ['Multipurpose Hall', FacilityType.MULTIPURPOSE_HALL, 1200, 'PER_USE'],
  ] as const;
  for (const [name, type, price, billingCycle] of facilities) {
    const ex = await prisma.facility.findFirst({ where: { name }, select: { id: true } });
    const f = ex
      ? await prisma.facility.update({ where: { id: ex.id }, data: { type, price, billingCycle: billingCycle as any, isActive: true } })
      : await prisma.facility.create({ data: { name, type, price, billingCycle: billingCycle as any, isActive: true, capacity: 20 } });
    await prisma.facilitySlotConfig.deleteMany({ where: { facilityId: f.id } });
    await prisma.facilitySlotConfig.createMany({
      data: [0, 4, 5, 6].map((day, idx) => ({ facilityId: f.id, dayOfWeek: day, startTime: idx === 0 ? '10:00' : '09:00', endTime: '21:00', slotDurationMinutes: 60, slotCapacity: 10 + idx * 2 })),
    });
  }
}

async function seedLoad() {
  const users = await prisma.user.findMany({
    where: { email: { in: DEMO_EMAILS } },
    select: {
      id: true, email: true, nameEN: true,
      resident: { select: { id: true } },
      unitAccesses: { where: { status: AccessStatus.ACTIVE }, select: { unitId: true } },
    },
  });
  if (!users.some((u) => u.email === 'ahmed.hassan.owner@alkarma.demo')) throw new Error('Run npm run seed:mobile-personas first');
  const residents = users.filter((u) => u.resident && u.unitAccesses.length > 0);
  const admin = users.find((u) => u.email === 'test@admin.com') ?? users[0];
  const services = await prisma.service.findMany({ where: { status: true }, select: { id: true, name: true, category: true } });
  const facilities = await prisma.facility.findMany({ where: { isActive: true }, select: { id: true, price: true } });
  const units = await prisma.unit.findMany({ select: { id: true } });

  let cmp = 1, vio = 1, inc = 1, inv = 1;
  const createdReqs: Array<{ id: string; unitId: string | null; userId: string; status: ServiceRequestStatus }> = [];
  const createdViolations: Array<{ id: string; unitId: string; userId: string; fineAmount: string; createdAt: Date; status: ViolationStatus }> = [];

  for (let i = 0; i < 55; i++) {
    const u = pick(residents); const unitId = pick(u.unitAccesses.map((x) => x.unitId)); const svc = pick(services);
    const status = pick([ServiceRequestStatus.NEW, ServiceRequestStatus.IN_PROGRESS, ServiceRequestStatus.RESOLVED, ServiceRequestStatus.CLOSED, ServiceRequestStatus.NEW]);
    const requestedAt = randDate(35);
    const req = await prisma.serviceRequest.create({ data: {
      serviceId: svc.id, unitId, createdById: u.id, status,
      priority: pick([Priority.LOW, Priority.MEDIUM, Priority.MEDIUM, Priority.HIGH, Priority.CRITICAL]),
      description: `${svc.name} request submitted by resident for unit service follow-up.`,
      requestedAt,
    }, select: { id: true, unitId: true, createdById: true, status: true } });
    createdReqs.push({ id: req.id, unitId: req.unitId, userId: req.createdById, status: req.status });
  }

  for (let i = 0; i < 28; i++) {
    const u = pick(residents); const unitId = pick(u.unitAccesses.map((x) => x.unitId)); const createdAt = randDate(30);
    await prisma.complaint.create({ data: {
      complaintNumber: seq('CMP', cmp++), reporterId: u.id, unitId,
      category: pick(['Noise','Parking','Security','Waste','Landscape']),
      description: 'Resident complaint logged and tracked by management.',
      priority: pick([Priority.LOW, Priority.MEDIUM, Priority.HIGH]),
      status: pick([ComplaintStatus.NEW, ComplaintStatus.IN_PROGRESS, ComplaintStatus.RESOLVED, ComplaintStatus.IN_PROGRESS]),
      createdAt,
    }});
  }

  for (let i = 0; i < 22; i++) {
    const u = pick(residents); const unitId = pick(u.unitAccesses.map((x) => x.unitId)); const createdAt = randDate(45);
    const status = pick([ViolationStatus.PENDING, ViolationStatus.PENDING, ViolationStatus.PAID, ViolationStatus.APPEALED]);
    const fineAmount = String(ri(300, 2500));
    const v = await prisma.violation.create({ data: {
      violationNumber: seq('VIO', vio++), unitId, residentId: u.id, issuedById: admin.id,
      type: pick(['Noise Violation','Parking Misuse','Unauthorized Alteration','Waste Disposal']),
      description: 'Violation recorded after inspection by community operations.',
      fineAmount, status, createdAt,
    }, select: { id: true }});
    createdViolations.push({ id: v.id, unitId, userId: u.id, fineAmount, createdAt, status });
  }

  for (let i = 0; i < 34; i++) {
    const unit = maybe(0.8) ? pick(units) : null; const reporter = pick(residents); const reportedAt = randDate(20);
    const status = pick(['OPEN','OPEN','RESOLVED','CLOSED'] as const);
    await prisma.incident.create({ data: {
      incidentNumber: seq('INC', inc++),
      type: pick(['Gate Access','Medical','Fire Alarm','Parking','Water Leak','Security Patrol']),
      location: unit ? `Block Incident Zone` : 'Common Area',
      residentName: reporter.nameEN ?? null,
      description: 'Operational incident handled by security / facilities teams.',
      priority: pick([Priority.LOW, Priority.MEDIUM, Priority.HIGH, Priority.CRITICAL]),
      status: status as any,
      responseTime: status === 'OPEN' ? null : ri(4, 42),
      reportedAt,
      resolvedAt: status === 'OPEN' ? null : addDays(reportedAt, ri(0, 2)),
      unitId: unit?.id ?? null,
      createdAt: reportedAt,
    }});
  }

  for (let i = 0; i < 28; i++) {
    const u = pick(residents); const unitId = pick(u.unitAccesses.map((x) => x.unitId)); const f = pick(facilities);
    const date = addDays(new Date(), ri(-10, 18)); date.setHours(0,0,0,0);
    const hour = pick([9,10,11,16,17,18,19]);
    await prisma.booking.create({ data: {
      facilityId: f.id, date, startTime: `${String(hour).padStart(2,'0')}:00`, endTime: `${String(hour+1).padStart(2,'0')}:00`,
      status: pick([BookingStatus.APPROVED, BookingStatus.APPROVED, BookingStatus.PENDING, BookingStatus.CANCELLED, BookingStatus.REJECTED]),
      cancelledAt: null,
      userId: u.id, residentId: u.resident!.id, unitId,
      createdAt: randDate(18),
    }});
  }

  for (let i = 0; i < 70; i++) {
    const u = pick(residents); const unitId = pick(u.unitAccesses.map((x) => x.unitId)); const t = randDate(14);
    await prisma.accessQRCode.create({ data: {
      qrId: `QR-${Date.now()}-${i}-${ri(100,999)}`, type: pick([QRType.VISITOR, QRType.DELIVERY, QRType.RIDESHARE, QRType.SELF]),
      generatedById: u.id, unitId, visitorName: maybe(0.65) ? `Visitor ${i+1}` : null,
      validFrom: t, validTo: addDays(t,1), gates: ['Main Gate'], scans: ri(0,6),
      status: pick([AccessStatus.ACTIVE, AccessStatus.USED, AccessStatus.EXPIRED, AccessStatus.REVOKED]), createdAt: t,
    }});
  }

  for (let i = 0; i < 60; i++) {
    const unit = pick(units); const type = pick([DeviceType.CAMERA, DeviceType.SMART_LOCK, DeviceType.THERMOSTAT, DeviceType.LIGHT, DeviceType.DOORBELL]);
    await prisma.smartDevice.create({ data: {
      name: `${String(type).replace(/_/g,' ')} ${i+1}`, type, unitId: unit.id,
      status: pick([SmartDeviceStatus.ONLINE, SmartDeviceStatus.ONLINE, SmartDeviceStatus.OFFLINE, SmartDeviceStatus.ERROR]),
      lastActive: maybe(0.9) ? randDate(3) : null,
      integrationInfo: { provider: 'demo-sim', seeded: true },
    }});
  }

  for (let i = 0; i < 50; i++) {
    const u = pick(residents); const unitId = pick(u.unitAccesses.map((x) => x.unitId)); const createdAt = randDate(90);
    const status = pick([InvoiceStatus.PAID, InvoiceStatus.PAID, InvoiceStatus.PENDING, InvoiceStatus.OVERDUE, InvoiceStatus.PAID]);
    await prisma.invoice.create({ data: {
      invoiceNumber: `OPS-${new Date().getFullYear()}-${String(inv++).padStart(5,'0')}`,
      unitId, residentId: u.id, type: pick([InvoiceType.SERVICE_FEE, InvoiceType.UTILITY, InvoiceType.MAINTENANCE_FEE]),
      amount: String(ri(180, 4800)), dueDate: addDays(createdAt, ri(7, 25)), status,
      paidDate: status === InvoiceStatus.PAID ? addDays(createdAt, ri(1,20)) : null, createdAt,
    }});
  }

  for (const v of createdViolations) {
    const status = v.status === ViolationStatus.PAID ? InvoiceStatus.PAID : pick([InvoiceStatus.PENDING, InvoiceStatus.OVERDUE, InvoiceStatus.PENDING]);
    await prisma.invoice.create({ data: {
      invoiceNumber: `OPS-${new Date().getFullYear()}-${String(inv++).padStart(5,'0')}`,
      unitId: v.unitId, residentId: v.userId, type: InvoiceType.FINE, amount: v.fineAmount,
      dueDate: addDays(v.createdAt, 14), status, paidDate: status === InvoiceStatus.PAID ? addDays(v.createdAt, ri(1, 8)) : null,
      violationId: v.id, createdAt: v.createdAt,
    }});
  }

  for (const r of createdReqs.filter((x) => ([ServiceRequestStatus.RESOLVED, ServiceRequestStatus.CLOSED] as ServiceRequestStatus[]).includes(x.status)).slice(0, 14)) {
    if (!r.unitId) continue;
    const st = pick([InvoiceStatus.PAID, InvoiceStatus.PENDING, InvoiceStatus.OVERDUE]);
    const createdAt = randDate(40);
    await prisma.invoice.create({ data: {
      invoiceNumber: `OPS-${new Date().getFullYear()}-${String(inv++).padStart(5,'0')}`,
      unitId: r.unitId, residentId: r.userId, type: InvoiceType.MAINTENANCE_FEE, amount: String(ri(150, 900)),
      dueDate: addDays(createdAt, 10), status: st, paidDate: st === InvoiceStatus.PAID ? addDays(createdAt, 3) : null,
      serviceRequestId: r.id, createdAt,
    }});
  }

  for (const svc of services) {
    const count = createdReqs.filter((r) => r.id && true).length; // recalculated below for simplicity
    const svcCount = await prisma.serviceRequest.count({ where: { serviceId: svc.id } });
    await prisma.service.update({ where: { id: svc.id }, data: { totalRequests: svcCount } });
  }

  for (let i = 0; i < 55; i++) {
    const u = pick(residents); const createdAt = randDate(18);
    const notif = await prisma.notification.create({ data: {
      title: pick(['Payment Reminder', 'Community Update', 'Maintenance Alert']),
      type: pick([NotificationType.PAYMENT_REMINDER, NotificationType.ANNOUNCEMENT, NotificationType.MAINTENANCE_ALERT]),
      channels: pick([[Channel.IN_APP], [Channel.IN_APP, Channel.PUSH], [Channel.IN_APP, Channel.PUSH, Channel.EMAIL]]) as any,
      status: pick([NotificationStatus.SENT, NotificationStatus.SENT, NotificationStatus.READ]),
      senderId: admin.id, targetAudience: Audience.SPECIFIC_RESIDENCES, audienceMeta: { userIds: [u.id] },
      messageEn: pick([
        'Your payment due date is approaching. Please review your invoices.',
        'Community maintenance update is available for your block.',
        'Security advisory has been posted for residents.',
      ]),
      payload: { route: pick(['/payments','/notifications','/requests']), seeded: true },
      sentAt: createdAt, createdAt, deliveredCount: 2, readCount: maybe(0.45) ? 1 : 0,
    }});
    const channels = (await prisma.notification.findUnique({ where: { id: notif.id }, select: { channels: true } }))?.channels ?? [Channel.IN_APP];
    await prisma.notificationLog.createMany({
      data: channels.map((c) => ({
        notificationId: notif.id,
        channel: c,
        recipient: c === Channel.IN_APP ? u.id : (u.email ?? u.id),
        status: maybe(0.85) ? NotificationLogStatus.DELIVERED : NotificationLogStatus.SENT,
        providerResponse: { seeded: true, channel: c },
        createdAt,
      })),
    });
  }

  const activeBannerCount = await prisma.banner.count({ where: { status: 'ACTIVE' as any, endDate: { gte: new Date() } } });
  if (activeBannerCount < 2) {
    for (const b of [
      ['Security Upgrade Complete', 'New facial recognition system now active.', 'Read Update', 'example.com/security'],
      ['Pool Maintenance Complete', 'Main pool is back in service.', 'Open Facilities', 'example.com/facilities'],
    ] as const) {
      const exists = await prisma.banner.findFirst({ where: { titleEn: b[0] }, select: { id: true } });
      if (exists) continue;
      await prisma.banner.create({ data: {
        titleEn: b[0], description: b[1], ctaText: b[2], ctaUrl: b[3],
        targetAudience: Audience.ALL, startDate: daysAgo(2), endDate: addDays(new Date(), 20),
        status: 'ACTIVE' as any, displayPriority: Priority.HIGH,
      }});
    }
  }
}

async function summary() {
  const [serviceRequests, invoices, complaints, violations, incidents, bookings, qrs, notifications, devices] = await Promise.all([
    prisma.serviceRequest.count(), prisma.invoice.count(), prisma.complaint.count(), prisma.violation.count(),
    prisma.incident.count(), prisma.booking.count(), prisma.accessQRCode.count(), prisma.notification.count(), prisma.smartDevice.count(),
  ]);
  console.log({ serviceRequests, invoices, complaints, violations, incidents, bookings, qrs, notifications, devices });
}

async function run() {
  console.log('Resetting dashboard operational data (preserving accounts + access)...');
  await ensureUnits();
  await cleanupTransactional();
  await ensureServicesAndFacilities();
  await seedLoad();
  await summary();
  console.log('✅ Realistic dashboard data seeded');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});

import {
  AccessStatus,
  Audience,
  BookingStatus,
  Channel,
  ComplaintStatus,
  FacilityType,
  InvoiceStatus,
  InvoiceType,
  NotificationStatus,
  NotificationType,
  PrismaClient,
  Priority,
  QrUsageMode,
  QRType,
  ServiceCategory,
  ServiceFieldType,
  ServiceRequestStatus,
  UnitStatus,
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

if (!process.env.DATABASE_URL) {
  throw new Error(
    'DATABASE_URL is missing. Set it in environment or .env.production/.env.local/.env before running seed.',
  );
}

const prisma = new PrismaClient();

const DEMO_EMAILS = [
  'test@admin.com',
  'ahmed.hassan.owner@alkarma.demo',
  'mostafa.ali.tenant@alkarma.demo',
  'karim.fathy.predelivery@alkarma.demo',
  'nour.hassan.family@alkarma.demo',
  'youssef.mahmoud.authorized@alkarma.demo',
  'mohamed.saber.contractor@alkarma.demo',
];

function plusDays(base: Date, days: number) {
  return new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
}

function minusDays(base: Date, days: number) {
  return plusDays(base, -days);
}

function seq(prefix: string, index: number) {
  return `${prefix}-${String(index).padStart(5, '0')}`;
}

async function cleanupOperationalData() {
  await prisma.notificationLog.deleteMany({});
  await prisma.notification.deleteMany({});
  await prisma.notificationDeviceToken.deleteMany({});
  await prisma.accessQRCode.deleteMany({});
  await prisma.booking.deleteMany({});
  await prisma.serviceRequestFieldValue.deleteMany({});
  await prisma.serviceRequestComment.deleteMany({});
  await prisma.serviceRequest.deleteMany({});
  await prisma.complaintComment.deleteMany({});
  await prisma.complaint.deleteMany({});
  await prisma.violationActionRequest.deleteMany({});
  await prisma.invoice.deleteMany({});
  await prisma.violation.deleteMany({});
  await prisma.discoverPlace.deleteMany({});
  await prisma.helpCenterEntry.deleteMany({});
  await prisma.banner.deleteMany({});
}

async function seedServices() {
  const services = [
    {
      name: 'AC Checkup',
      category: ServiceCategory.MAINTENANCE,
      eligibility: 'DELIVERED_ONLY',
      urgent: false,
      price: '350',
      description: 'Routine AC maintenance and cleaning.',
    },
    {
      name: 'Plumbing Assistance',
      category: ServiceCategory.MAINTENANCE,
      eligibility: 'DELIVERED_ONLY',
      urgent: true,
      price: '250',
      description: 'Leak or drainage issue support.',
    },
    {
      name: 'Electrical Visit',
      category: ServiceCategory.MAINTENANCE,
      eligibility: 'DELIVERED_ONLY',
      urgent: true,
      price: '280',
      description: 'Switches, breakers, or power diagnostics.',
    },
    {
      name: 'Guest Parking Request',
      category: ServiceCategory.REQUESTS,
      eligibility: 'DELIVERED_ONLY',
      urgent: false,
      price: '0',
      description: 'Temporary guest parking permit request.',
    },
    {
      name: 'Move-in / Move-out Permit',
      category: ServiceCategory.REQUESTS,
      eligibility: 'DELIVERED_ONLY',
      urgent: false,
      price: '150',
      description: 'Schedule move permit and gate access.',
    },
    {
      name: 'Car Sticker Request',
      category: ServiceCategory.REQUESTS,
      eligibility: 'ALL',
      urgent: false,
      price: '75',
      description: 'Issue or replace vehicle sticker.',
    },
  ];

  for (const item of services) {
    const existing = await prisma.service.findFirst({
      where: { name: item.name },
      select: { id: true },
    });

    const service = existing
      ? await prisma.service.update({
          where: { id: existing.id },
          data: {
            category: item.category,
            unitEligibility: item.eligibility as any,
            isUrgent: item.urgent,
            startingPrice: item.price,
            description: item.description,
            status: true,
          },
        })
      : await prisma.service.create({
          data: {
            name: item.name,
            category: item.category,
            unitEligibility: item.eligibility as any,
            isUrgent: item.urgent,
            startingPrice: item.price,
            description: item.description,
            status: true,
          },
        });

    await prisma.serviceField.deleteMany({ where: { serviceId: service.id } });
    await prisma.serviceField.createMany({
      data: [
        {
          serviceId: service.id,
          label: 'Preferred Date',
          type: ServiceFieldType.DATE,
          required: true,
          order: 1,
        },
        {
          serviceId: service.id,
          label: 'Phone Number',
          type: ServiceFieldType.TEXT,
          required: true,
          order: 2,
        },
        {
          serviceId: service.id,
          label: 'Details',
          type: ServiceFieldType.TEXTAREA,
          required: true,
          order: 3,
        },
      ],
    });
  }
}

async function seedFacilities() {
  const facilities = [
    { name: 'Main Pool', type: FacilityType.POOL, price: 120 },
    { name: 'Padel Court', type: FacilityType.TENNIS_COURT, price: 220 },
    { name: 'Multipurpose Hall', type: FacilityType.MULTIPURPOSE_HALL, price: 950 },
  ];

  for (const item of facilities) {
    const existing = await prisma.facility.findFirst({ where: { name: item.name }, select: { id: true } });
    const facility = existing
      ? await prisma.facility.update({
          where: { id: existing.id },
          data: {
            type: item.type,
            isActive: true,
            price: item.price,
            capacity: 20,
            maxReservationsPerDay: 6,
            cooldownMinutes: 30,
            isBookable: true,
            requiresPrepayment: true,
          },
        })
      : await prisma.facility.create({
          data: {
            name: item.name,
            type: item.type,
            isActive: true,
            price: item.price,
            capacity: 20,
            maxReservationsPerDay: 6,
            cooldownMinutes: 30,
            isBookable: true,
            requiresPrepayment: true,
          },
        });

    await prisma.facilitySlotConfig.deleteMany({ where: { facilityId: facility.id } });
    await prisma.facilitySlotConfig.createMany({
      data: [0, 1, 2, 3, 4, 6].map((day) => ({
        facilityId: facility.id,
        dayOfWeek: day,
        startTime: '09:00',
        endTime: '21:00',
        slotDurationMinutes: 60,
        slotCapacity: 10,
      })),
    });
  }
}

async function seedDiscoverAndHelp() {
  await prisma.helpCenterEntry.createMany({
    data: [
      { title: 'Main Gate Security', phone: '16500', availability: '24/7', priority: 1, isActive: true },
      { title: 'Maintenance Hotline', phone: '19128', availability: '08:00 - 22:00', priority: 2, isActive: true },
      { title: 'Community Management', phone: '0227001234', availability: '09:00 - 17:00', priority: 3, isActive: true },
    ],
  });

  await prisma.discoverPlace.createMany({
    data: [
      {
        name: 'Vodafone Store - Madinaty',
        category: 'Telecom',
        address: 'Open Air Mall, Madinaty',
        mapLink: 'https://maps.google.com/?q=Vodafone+Madinaty',
        phone: '16888',
        workingHours: '10:00 - 23:00',
      },
      {
        name: 'Seoudi Market',
        category: 'Supermarket',
        address: 'Madinaty South Park',
        mapLink: 'https://maps.google.com/?q=Seoudi+Market+Madinaty',
        phone: '19262',
        workingHours: '09:00 - 00:00',
      },
      {
        name: 'Carrefour Market',
        category: 'Supermarket',
        address: 'Madinaty Strip Mall',
        mapLink: 'https://maps.google.com/?q=Carrefour+Madinaty',
        phone: '16061',
        workingHours: '09:00 - 00:00',
      },
      {
        name: 'El Ezaby Pharmacy',
        category: 'Pharmacy',
        address: 'Madinaty Medical Center',
        mapLink: 'https://maps.google.com/?q=El+Ezaby+Madinaty',
        phone: '19600',
        workingHours: '24/7',
      },
    ],
  });
}

async function seedOperationalDataset() {
  const users = await prisma.user.findMany({
    where: { email: { in: DEMO_EMAILS } },
    select: {
      id: true,
      email: true,
      resident: { select: { id: true } },
      unitAccesses: {
        where: { status: AccessStatus.ACTIVE },
        select: { unitId: true, role: true },
      },
    },
  });

  const admin = users.find((row) => row.email === 'test@admin.com');
  if (!admin) throw new Error('Missing admin demo account test@admin.com');

  const residentUsers = users.filter((row) => row.resident && row.unitAccesses.length > 0);
  if (residentUsers.length === 0) {
    throw new Error('No resident demo users found. Run npm run seed:mobile-personas first.');
  }

  const serviceCatalog = await prisma.service.findMany({ where: { status: true } });
  const facilities = await prisma.facility.findMany({ where: { isActive: true } });

  let complaintSeq = 1;
  let violationSeq = 1;
  let invoiceSeq = 1;

  const now = new Date();

  for (let i = 0; i < 28; i++) {
    const resident = residentUsers[i % residentUsers.length];
    const unitId = resident.unitAccesses[0].unitId;
    const service = serviceCatalog[i % serviceCatalog.length];
    const createdAt = minusDays(now, (i % 16) + 1);
    await prisma.serviceRequest.create({
      data: {
        serviceId: service.id,
        unitId,
        createdById: resident.id,
        status: i % 4 === 0 ? ServiceRequestStatus.RESOLVED : i % 5 === 0 ? ServiceRequestStatus.IN_PROGRESS : ServiceRequestStatus.NEW,
        priority: i % 8 === 0 ? Priority.HIGH : Priority.MEDIUM,
        description: `${service.name} request created from resident app flow.`,
        requestedAt: createdAt,
      },
    });
  }

  for (let i = 0; i < 14; i++) {
    const resident = residentUsers[i % residentUsers.length];
    const unitId = resident.unitAccesses[0].unitId;
    const createdAt = minusDays(now, (i % 10) + 1);
    await prisma.complaint.create({
      data: {
        complaintNumber: seq('CMP', complaintSeq++),
        title: i % 2 === 0 ? 'Street Light Issue' : 'Housekeeping Feedback',
        team: i % 2 === 0 ? 'Maintenance' : 'Community Team',
        category: i % 2 === 0 ? 'Maintenance' : 'Community',
        description: i % 2 === 0 ? 'Street light needs inspection near block entrance.' : 'Housekeeping schedule confirmation needed.',
        reporterId: resident.id,
        unitId,
        priority: i % 4 === 0 ? Priority.HIGH : Priority.MEDIUM,
        status: i % 5 === 0 ? ComplaintStatus.RESOLVED : ComplaintStatus.IN_PROGRESS,
        assignedToId: admin.id,
        createdAt,
      },
    });
  }

  for (let i = 0; i < 6; i++) {
    const resident = residentUsers[i % residentUsers.length];
    const unitId = resident.unitAccesses[0].unitId;
    const createdAt = minusDays(now, (i % 7) + 1);
    const violation = await prisma.violation.create({
      data: {
        violationNumber: seq('VIO', violationSeq++),
        unitId,
        residentId: resident.id,
        issuedById: admin.id,
        type: i % 2 === 0 ? 'Parking Violation' : 'Noise Violation',
        description: i % 2 === 0 ? 'Vehicle parked in a fire lane.' : 'Noise levels exceeded quiet hours.',
        fineAmount: i % 2 === 0 ? '450' : '300',
        status: i < 2 ? 'PAID' as any : 'PENDING' as any,
        createdAt,
      },
    });

    await prisma.invoice.create({
      data: {
        invoiceNumber: seq('INV', invoiceSeq++),
        unitId,
        residentId: resident.id,
        type: InvoiceType.FINE,
        amount: i % 2 === 0 ? '450' : '300',
        dueDate: plusDays(createdAt, 10),
        status: i < 2 ? InvoiceStatus.PAID : InvoiceStatus.PENDING,
        paidDate: i < 2 ? plusDays(createdAt, 3) : null,
        violationId: violation.id,
        createdAt,
      },
    });
  }

  for (let i = 0; i < 24; i++) {
    const resident = residentUsers[i % residentUsers.length];
    const unitId = resident.unitAccesses[0].unitId;
    const createdAt = minusDays(now, i % 18);
    const type = i % 3 === 0 ? InvoiceType.UTILITY : InvoiceType.SERVICE_FEE;
    const status = i % 6 === 0 ? InvoiceStatus.OVERDUE : i % 4 === 0 ? InvoiceStatus.PAID : InvoiceStatus.PENDING;
    await prisma.invoice.create({
      data: {
        invoiceNumber: seq('INV', invoiceSeq++),
        unitId,
        residentId: resident.id,
        type,
        amount: i % 3 === 0 ? '780' : '1250',
        dueDate: plusDays(createdAt, 14),
        status,
        paidDate: status === InvoiceStatus.PAID ? plusDays(createdAt, 5) : null,
        createdAt,
      },
    });
  }

  for (let i = 0; i < 18; i++) {
    const resident = residentUsers[i % residentUsers.length];
    const unitId = resident.unitAccesses[0].unitId;
    const date = plusDays(now, i % 12);
    date.setHours(0, 0, 0, 0);
    const facility = facilities[i % facilities.length];
    const hour = 10 + (i % 8);
    await prisma.booking.create({
      data: {
        facilityId: facility.id,
        date,
        startTime: `${String(hour).padStart(2, '0')}:00`,
        endTime: `${String(hour + 1).padStart(2, '0')}:00`,
        status: i % 5 === 0 ? BookingStatus.PENDING_PAYMENT : i % 6 === 0 ? BookingStatus.PENDING : BookingStatus.APPROVED,
        userId: resident.id,
        residentId: resident.resident!.id,
        unitId,
      },
    });
  }

  for (let i = 0; i < 20; i++) {
    const resident = residentUsers[i % residentUsers.length];
    const unitId = resident.unitAccesses[0].unitId;
    const createdAt = minusDays(now, i % 10);
    await prisma.accessQRCode.create({
      data: {
        qrId: `QR-${Date.now()}-${i}-${resident.id.slice(0, 4)}`,
        type: i % 4 === 0 ? QRType.RIDESHARE : i % 3 === 0 ? QRType.DELIVERY : QRType.VISITOR,
        generatedById: resident.id,
        unitId,
        usageMode: i % 2 === 0 ? QrUsageMode.SINGLE_USE : QrUsageMode.MULTI_USE,
        visitorName: i % 4 === 0 ? 'Uber Driver' : i % 3 === 0 ? 'Delivery Courier' : 'Guest Visitor',
        validFrom: createdAt,
        validTo: plusDays(createdAt, 1),
        gates: ['Main Gate'],
        scans: i % 4,
        status: i % 5 === 0 ? AccessStatus.USED : AccessStatus.ACTIVE,
      },
    });
  }

  for (let i = 0; i < 22; i++) {
    const resident = residentUsers[i % residentUsers.length];
    const createdAt = minusDays(now, i % 9);
    await prisma.notification.create({
      data: {
        title: i % 3 === 0 ? 'Payment Reminder' : i % 2 === 0 ? 'Community Update' : 'Service Update',
        type: i % 3 === 0 ? NotificationType.PAYMENT_REMINDER : NotificationType.ANNOUNCEMENT,
        channels: [Channel.IN_APP],
        status: NotificationStatus.SENT,
        senderId: admin.id,
        targetAudience: Audience.SPECIFIC_RESIDENCES,
        audienceMeta: { userIds: [resident.id] },
        messageEn: i % 3 === 0 ? 'Upcoming payment due date is approaching.' : 'Latest community information has been published.',
        payload: { route: i % 3 === 0 ? '/payments' : '/community-updates' },
        sentAt: createdAt,
        createdAt,
      },
    });
  }
}

async function run() {
  console.log('Resetting operational demo data (keep core refs)...');
  await cleanupOperationalData();
  await seedServices();
  await seedFacilities();
  await seedDiscoverAndHelp();
  await seedOperationalDataset();
  console.log('✅ Professional demo data ready');
}

run()
  .catch((error) => {
    console.error('❌ Professional demo seed failed');
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

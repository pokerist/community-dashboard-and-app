import {
  AccessStatus,
  ComplaintStatus,
  PrismaClient,
  Priority,
  ServiceCategory,
  ServiceRequestStatus,
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

function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function seq(prefix: string, n: number): string {
  return `${prefix}-${String(n).padStart(5, '0')}`;
}

function randomDateWithinDays(days: number): Date {
  const now = Date.now();
  const back = Math.floor(Math.random() * days * 24 * 60 * 60 * 1000);
  return new Date(now - back);
}

async function run() {
  loadDatabaseUrlFromEnvFiles();
  const prisma = new PrismaClient();

  try {
    const [units, users, services, admin] = await Promise.all([
      prisma.unit.findMany({
        where: { isActive: true, deletedAt: null },
        select: { id: true, unitNumber: true },
      }),
      prisma.user.findMany({
        where: { resident: { isNot: null } },
        select: {
          id: true,
          nameEN: true,
          email: true,
          resident: {
            select: {
              residentUnits: {
                select: { unitId: true },
              },
            },
          },
          unitAccesses: {
            where: { status: AccessStatus.ACTIVE },
            select: { unitId: true },
          },
        },
      }),
      prisma.service.findMany({
        where: { status: true },
        select: { id: true, name: true, category: true, isUrgent: true },
      }),
      prisma.user.findFirst({
        where: { admin: { isNot: null } },
        select: { id: true },
      }),
    ]);

    if (!units.length) {
      throw new Error('No active units found. Seed units first.');
    }
    if (!users.length) {
      throw new Error('No resident users found. Seed residents first.');
    }
    if (!services.length) {
      throw new Error('No active services found. Seed services first.');
    }

    const requestServices = services.filter((s) =>
      s.category === ServiceCategory.REQUESTS || s.category === ServiceCategory.ADMIN,
    );
    const nonRequestServices = services.filter((s) =>
      s.category !== ServiceCategory.REQUESTS && s.category !== ServiceCategory.ADMIN,
    );

    const userPool = users.map((u) => {
      const unitIds = Array.from(
        new Set([
          ...u.unitAccesses.map((entry) => entry.unitId),
          ...(u.resident?.residentUnits.map((entry) => entry.unitId) ?? []),
        ]),
      );
      return {
        id: u.id,
        name: u.nameEN ?? u.email ?? u.id,
        unitIds: unitIds.length ? unitIds : [pick(units).id],
      };
    });

    const lastComplaint = await prisma.complaint.findFirst({
      select: { complaintNumber: true },
      orderBy: { createdAt: 'desc' },
    });
    const lastViolation = await prisma.violation.findFirst({
      select: { violationNumber: true },
      orderBy: { createdAt: 'desc' },
    });

    let complaintSeq =
      Number.parseInt(lastComplaint?.complaintNumber.match(/(\d+)$/)?.[1] ?? '0', 10) + 1;
    let violationSeq =
      Number.parseInt(lastViolation?.violationNumber.match(/(\d+)$/)?.[1] ?? '0', 10) + 1;

    const serviceStatuses: ServiceRequestStatus[] = [
      ServiceRequestStatus.NEW,
      ServiceRequestStatus.IN_PROGRESS,
      ServiceRequestStatus.NEW,
      ServiceRequestStatus.IN_PROGRESS,
      ServiceRequestStatus.RESOLVED,
    ];
    const complaintStatuses: ComplaintStatus[] = [
      ComplaintStatus.NEW,
      ComplaintStatus.IN_PROGRESS,
      ComplaintStatus.PENDING_RESIDENT,
      ComplaintStatus.NEW,
    ];
    const violationStatuses: ViolationStatus[] = [
      ViolationStatus.PENDING,
      ViolationStatus.UNDER_REVIEW,
      ViolationStatus.APPEALED,
      ViolationStatus.PENDING,
    ];

    for (let i = 0; i < 14; i++) {
      const user = pick(userPool);
      const shouldBeRequest = i % 2 === 0 && requestServices.length > 0;
      const service = shouldBeRequest
        ? pick(requestServices)
        : pick(nonRequestServices.length ? nonRequestServices : services);

      await prisma.serviceRequest.create({
        data: {
          serviceId: service.id,
          unitId: pick(user.unitIds),
          createdById: user.id,
          status: pick(serviceStatuses),
          priority: pick([Priority.LOW, Priority.MEDIUM, Priority.MEDIUM, Priority.HIGH]),
          description: `${service.name} request submitted from resident app flow.`,
          requestedAt: randomDateWithinDays(10),
        },
      });
    }

    for (let i = 0; i < 10; i++) {
      const user = pick(userPool);
      const createdAt = randomDateWithinDays(10);
      await prisma.complaint.create({
        data: {
          complaintNumber: seq('CMP', complaintSeq++),
          title: `Resident complaint ${i + 1}`,
          team: pick(['Security', 'Parking', 'Maintenance', 'Cleaning']),
          reporterId: user.id,
          unitId: pick(user.unitIds),
          categoryLegacy: pick(['Noise', 'Parking', 'Security', 'Waste']),
          description: 'Seeded complaint for ticket inbox testing and workflow validation.',
          priority: pick([Priority.LOW, Priority.MEDIUM, Priority.HIGH, Priority.CRITICAL]),
          status: pick(complaintStatuses),
          createdAt,
          updatedAt: createdAt,
        },
      });
    }

    for (let i = 0; i < 10; i++) {
      const user = pick(userPool);
      const createdAt = randomDateWithinDays(12);
      const status = pick(violationStatuses);

      await prisma.violation.create({
        data: {
          violationNumber: seq('VIO', violationSeq++),
          unitId: pick(user.unitIds),
          residentId: user.id,
          issuedById: admin?.id ?? null,
          typeLegacy: pick(['Noise Violation', 'Parking Misuse', 'Unauthorized Alteration']),
          description: 'Seeded violation for ticket inbox testing.',
          fineAmount: Number(250 + Math.floor(Math.random() * 2250)),
          status,
          appealStatus: status === ViolationStatus.APPEALED ? 'PENDING' : null,
          appealDeadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          createdAt,
          updatedAt: createdAt,
        },
      });
    }

    const [serviceOpen, complaintOpen, violationOpen] = await Promise.all([
      prisma.serviceRequest.count({
        where: { status: { in: [ServiceRequestStatus.NEW, ServiceRequestStatus.IN_PROGRESS] } },
      }),
      prisma.complaint.count({
        where: {
          status: {
            in: [
              ComplaintStatus.NEW,
              ComplaintStatus.IN_PROGRESS,
              ComplaintStatus.PENDING_RESIDENT,
            ],
          },
        },
      }),
      prisma.violation.count({
        where: {
          status: {
            in: [
              ViolationStatus.PENDING,
              ViolationStatus.UNDER_REVIEW,
              ViolationStatus.APPEALED,
            ],
          },
        },
      }),
    ]);

    console.log('Seeded ticket-related data successfully.');
    console.log({
      serviceOpen,
      complaintOpen,
      violationOpen,
      ticketsTotalActive: serviceOpen + complaintOpen + violationOpen,
    });
  } finally {
    await prisma.$disconnect();
  }
}

run().catch((error) => {
  console.error('Failed to seed ticket-related data:', error);
  process.exit(1);
});

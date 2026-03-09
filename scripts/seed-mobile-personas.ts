import {
  AccessStatus,
  DelegateType,
  MemberStatusEnum,
  PrismaClient,
  RelationshipType,
  UnitStatus,
  UnitType,
  UserStatusEnum,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
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
const DEMO_PASSWORD = 'pass123';
const LEGACY_DEMO_EMAILS = [
  'owner.demo@test.com',
  'tenant.demo@test.com',
  'preowner.demo@test.com',
  'family.demo@test.com',
  'authorized.demo@test.com',
  'contractor.demo@test.com',
  'residentA@test.com',
  'residentB@test.com',
];

type DemoUserConfig = {
  email: string;
  nameEN: string;
  phone: string;
  nationalId: string;
  createResident?: boolean;
  createOwner?: boolean;
  createTenant?: boolean;
  userStatus?: UserStatusEnum;
};

async function ensureCommunityRole(userId: string) {
  const role = await prisma.role.findUnique({
    where: { name: 'COMMUNITY_USER' },
    select: { id: true },
  });
  if (!role) {
    throw new Error('COMMUNITY_USER role not found. Run prisma seed first.');
  }

  const existing = await prisma.userRole.findUnique({
    where: { userId_roleId: { userId, roleId: role.id } },
    select: { userId: true },
  });
  if (!existing) {
    await prisma.userRole.create({
      data: { userId, roleId: role.id },
    });
  }
}

async function ensureDemoUser(config: DemoUserConfig) {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
  const user = await prisma.user.upsert({
    where: { email: config.email },
    update: {
      nameEN: config.nameEN,
      phone: config.phone,
      signupSource: 'mobile_demo',
      passwordHash,
      userStatus: config.userStatus ?? UserStatusEnum.ACTIVE,
    },
    create: {
      email: config.email,
      nameEN: config.nameEN,
      phone: config.phone,
      signupSource: 'mobile_demo',
      passwordHash,
      userStatus: config.userStatus ?? UserStatusEnum.ACTIVE,
    },
  });

  await ensureCommunityRole(user.id);

  if (config.createResident) {
    const resident = await prisma.resident.findUnique({
      where: { userId: user.id },
      select: { id: true, nationalId: true },
    });
    if (!resident) {
      await prisma.resident.create({
        data: {
          userId: user.id,
          nationalId: config.nationalId,
        },
      });
    } else if (!resident.nationalId) {
      await prisma.resident.update({
        where: { userId: user.id },
        data: { nationalId: config.nationalId },
      });
    }
  }

  if (config.createOwner) {
    const owner = await prisma.owner.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    if (!owner) {
      await prisma.owner.create({ data: { userId: user.id } });
    }
  }

  if (config.createTenant) {
    const tenant = await prisma.tenant.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    if (!tenant) {
      await prisma.tenant.create({ data: { userId: user.id } });
    }
  }

  return user;
}

async function ensureUnit(input: {
  projectName: string;
  communityId?: string;
  block: string;
  unitNumber: string;
  type?: UnitType;
  status: UnitStatus;
  isDelivered?: boolean;
  bedrooms?: number;
  bathrooms?: number;
  sizeSqm?: number;
}) {
  const deliveredLikeStatuses: UnitStatus[] = [
    UnitStatus.DELIVERED,
  ];
  const existing = await prisma.unit.findFirst({
    where: {
      projectName: input.projectName,
      block: input.block,
      unitNumber: input.unitNumber,
    },
    select: { id: true },
  });

  if (existing) {
    return prisma.unit.update({
      where: { id: existing.id },
      data: {
        status: input.status,
        communityId: input.communityId,
        isDelivered:
          input.isDelivered ??
          deliveredLikeStatuses.includes(input.status),
        type: input.type ?? UnitType.APARTMENT,
        bedrooms: input.bedrooms ?? 3,
        bathrooms: input.bathrooms ?? 2,
        sizeSqm: input.sizeSqm ?? 140,
      },
    });
  }

  return prisma.unit.create({
    data: {
      projectName: input.projectName,
      communityId: input.communityId,
      block: input.block,
      unitNumber: input.unitNumber,
      type: input.type ?? UnitType.APARTMENT,
      status: input.status,
      isDelivered:
        input.isDelivered ??
        deliveredLikeStatuses.includes(input.status),
      bedrooms: input.bedrooms ?? 3,
      bathrooms: input.bathrooms ?? 2,
      sizeSqm: input.sizeSqm ?? 140,
    },
  });
}

async function ensureCommunity(input: { name: string; code?: string; displayOrder?: number }) {
  return prisma.community.upsert({
    where: { name: input.name },
    update: {
      code: input.code ?? null,
      displayOrder: input.displayOrder ?? 0,
      isActive: true,
    },
    create: {
      name: input.name,
      code: input.code ?? null,
      displayOrder: input.displayOrder ?? 0,
      isActive: true,
    },
  });
}

async function ensureResidentUnitLink(userId: string, unitId: string, isPrimary = false) {
  const resident = await prisma.resident.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!resident) return;

  const existing = await prisma.residentUnit.findFirst({
    where: { residentId: resident.id, unitId },
    select: { id: true },
  });
  if (!existing) {
    await prisma.residentUnit.create({
      data: { residentId: resident.id, unitId, isPrimary },
    });
  } else if (isPrimary) {
    await prisma.residentUnit.update({
      where: { id: existing.id },
      data: { isPrimary: true },
    });
  }
}

async function ensureResidentVehicle(input: {
  userId: string;
  vehicleType: string;
  model: string;
  plateNumber: string;
  color?: string;
  notes?: string;
  isPrimary?: boolean;
}) {
  const resident = await prisma.resident.findUnique({
    where: { userId: input.userId },
    select: { id: true },
  });
  if (!resident) return;

  const normalizedPlate = input.plateNumber
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .replace(/-/g, ' ');

  const existing = await prisma.residentVehicle.findFirst({
    where: {
      residentId: resident.id,
      plateNumberNormalized: normalizedPlate,
    },
    select: { id: true },
  });

  if (input.isPrimary) {
    await prisma.residentVehicle.updateMany({
      where: {
        residentId: resident.id,
        isPrimary: true,
        ...(existing ? { id: { not: existing.id } } : {}),
      },
      data: { isPrimary: false },
    });
  }

  const payload = {
    residentId: resident.id,
    vehicleType: input.vehicleType.trim(),
    model: input.model.trim(),
    plateNumber: input.plateNumber.trim(),
    plateNumberNormalized: normalizedPlate,
    color: input.color?.trim() || null,
    notes: input.notes?.trim() || null,
    isPrimary: input.isPrimary === true,
  };

  if (existing) {
    await prisma.residentVehicle.update({
      where: { id: existing.id },
      data: payload,
    });
    return;
  }

  await prisma.residentVehicle.create({
    data: payload,
  });
}

async function ensureUnitAccess(input: {
  unitId: string;
  userId: string;
  role: 'OWNER' | 'TENANT' | 'FAMILY' | 'DELEGATE';
  grantedBy: string;
  source: string;
  status?: AccessStatus;
  delegateType?: DelegateType;
  canViewFinancials?: boolean;
  canReceiveBilling?: boolean;
  canBookFacilities?: boolean;
  canGenerateQR?: boolean;
  canManageWorkers?: boolean;
  startsAt?: Date;
  endsAt?: Date | null;
}) {
  const status = input.status ?? AccessStatus.ACTIVE;
  const existing = await prisma.unitAccess.findFirst({
    where: {
      unitId: input.unitId,
      userId: input.userId,
      role: input.role as any,
      status,
    },
    select: { id: true },
  });

  const data = {
    unitId: input.unitId,
    userId: input.userId,
    role: input.role as any,
    delegateType: input.delegateType,
    startsAt: input.startsAt ?? new Date(Date.now() - 24 * 60 * 60 * 1000),
    endsAt: input.endsAt ?? null,
    grantedBy: input.grantedBy,
    status,
    source: input.source,
    canViewFinancials: input.canViewFinancials ?? false,
    canReceiveBilling: input.canReceiveBilling ?? false,
    canBookFacilities: input.canBookFacilities ?? true,
    canGenerateQR: input.canGenerateQR ?? false,
    canManageWorkers: input.canManageWorkers ?? false,
  };

  if (existing) {
    return prisma.unitAccess.update({
      where: { id: existing.id },
      data,
    });
  }

  return prisma.unitAccess.create({ data });
}

async function ensureFamilyLink(
  primaryUserId: string,
  familyUserId: string,
  relationship: RelationshipType,
) {
  const [primaryResident, familyResident] = await Promise.all([
    prisma.resident.findUnique({ where: { userId: primaryUserId }, select: { id: true } }),
    prisma.resident.findUnique({ where: { userId: familyUserId }, select: { id: true } }),
  ]);
  if (!primaryResident || !familyResident) {
    throw new Error('Family link users must have resident profiles');
  }

  const existing = await prisma.familyMember.findUnique({
    where: { familyResidentId: familyResident.id },
    select: { id: true },
  });

  if (existing) {
    await prisma.familyMember.update({
      where: { id: existing.id },
      data: {
        primaryResidentId: primaryResident.id,
        relationship,
        status: UserStatusEnum.ACTIVE,
        deactivatedAt: null,
      },
    });
    return;
  }

  await prisma.familyMember.create({
    data: {
      primaryResidentId: primaryResident.id,
      familyResidentId: familyResident.id,
      relationship,
      status: UserStatusEnum.ACTIVE,
      activatedAt: new Date(),
    },
  });
}

async function ensureActiveLease(unitId: string, ownerId: string, tenantId: string) {
  const existing = await prisma.lease.findFirst({
    where: { unitId, tenantId, ownerId, status: 'ACTIVE' as any },
    select: { id: true },
  });
  const startDate = new Date(Date.UTC(2026, 0, 1));
  const endDate = new Date(Date.UTC(2026, 11, 31));
  if (existing) {
    return prisma.lease.update({
      where: { id: existing.id },
      data: {
        startDate,
        endDate,
        monthlyRent: '12500',
        securityDeposit: '25000',
        status: 'ACTIVE' as any,
      },
    });
  }

  return prisma.lease.create({
    data: {
      unitId,
      ownerId,
      tenantId,
      tenantEmail: (await prisma.user.findUnique({ where: { id: tenantId }, select: { email: true } }))?.email ?? undefined,
      startDate,
      endDate,
      monthlyRent: '12500',
      securityDeposit: '25000',
      status: 'ACTIVE' as any,
      source: 'OWNER' as any,
    },
  });
}

async function ensureContractorAndWorker(input: {
  managerUserId: string;
  unitId: string;
  contractorName: string;
  workerName: string;
  workerNationalId: string;
  workerPhone?: string;
}) {
  let contractor = await prisma.contractor.findFirst({
    where: { name: input.contractorName },
    select: { id: true },
  });
  if (!contractor) {
    contractor = await prisma.contractor.create({
      data: { name: input.contractorName, status: 'ACTIVE' as any },
      select: { id: true },
    });
  }

  const member = await prisma.contractorMember.findFirst({
    where: { contractorId: contractor.id, userId: input.managerUserId },
    select: { id: true },
  });
  if (!member) {
    await prisma.contractorMember.create({
      data: {
        contractorId: contractor.id,
        userId: input.managerUserId,
        role: 'ADMIN' as any,
        status: MemberStatusEnum.ACTIVE,
      },
    });
  }

  let accessProfile = await prisma.accessProfile.findFirst({
    where: { nationalId: input.workerNationalId },
    select: { id: true },
  });
  if (!accessProfile) {
    accessProfile = await prisma.accessProfile.create({
      data: {
        fullName: input.workerName,
        nationalId: input.workerNationalId,
        phone: input.workerPhone,
        status: AccessStatus.ACTIVE,
      },
      select: { id: true },
    });
  }

  const worker = await prisma.worker.findFirst({
    where: {
      accessProfileId: accessProfile.id,
      contractorId: contractor.id,
      unitId: input.unitId,
    },
    select: { id: true },
  });
  if (!worker) {
    await prisma.worker.create({
      data: {
        accessProfileId: accessProfile.id,
        contractorId: contractor.id,
        unitId: input.unitId,
        jobType: 'Domestic Staff',
        status: 'ACTIVE' as any,
      },
    });
  }

  return { contractorId: contractor.id };
}

async function cleanupAssistantDemoArtifacts() {
  // Remove assistant-seeded demo banner so only admin-created banners appear on mobile home.
  await prisma.banner.deleteMany({
    where: { titleEn: 'Mobile Demo Banner' },
  });

  // Keep historical integrity for services/facilities: deactivate instead of deleting.
  await prisma.service.updateMany({
    where: { name: 'Demo Home Maintenance' },
    data: { status: false },
  });
  await prisma.facility.updateMany({
    where: { name: 'Demo Club Lounge' },
    data: { isActive: false },
  });

  // Remove assistant-seeded demo invoices by prefix.
  await prisma.invoice.deleteMany({
    where: { invoiceNumber: { startsWith: 'MOBDEMO-' } },
  });
}

async function deactivateLegacyDemoUsers() {
  await prisma.user.updateMany({
    where: {
      email: { in: LEGACY_DEMO_EMAILS },
    },
    data: {
      userStatus: UserStatusEnum.DISABLED,
    },
  });
}

async function run() {
  console.log('Seeding mobile demo personas...');

  const ownerDemo = await ensureDemoUser({
    email: 'ahmed.hassan.owner@alkarma.demo',
    nameEN: 'Ahmed Hassan',
    phone: '+201100000001',
    nationalId: '29901010000001',
    createResident: true,
    createOwner: true,
  });
  const tenantDemo = await ensureDemoUser({
    email: 'mostafa.ali.tenant@alkarma.demo',
    nameEN: 'Mostafa Ali',
    phone: '+201100000002',
    nationalId: '29901010000002',
    createResident: true,
    createTenant: true,
  });
  const preOwnerDemo = await ensureDemoUser({
    email: 'karim.fathy.predelivery@alkarma.demo',
    nameEN: 'Karim Fathy',
    phone: '+201100000003',
    nationalId: '29901010000003',
    createResident: true,
    createOwner: true,
  });
  const familyDemo = await ensureDemoUser({
    email: 'nour.hassan.family@alkarma.demo',
    nameEN: 'Nour Hassan',
    phone: '+201100000004',
    nationalId: '29901010000004',
    createResident: true,
  });
  const authorizedDemo = await ensureDemoUser({
    email: 'youssef.mahmoud.authorized@alkarma.demo',
    nameEN: 'Youssef Mahmoud',
    phone: '+201100000005',
    nationalId: '29901010000005',
    createResident: true,
  });
  const contractorDemo = await ensureDemoUser({
    email: 'mohamed.saber.contractor@alkarma.demo',
    nameEN: 'Mohamed Saber',
    phone: '+201100000006',
    nationalId: '29901010000006',
    createResident: true,
  });

  const communityGates = await ensureCommunity({
    name: 'Alkarma Gates',
    code: 'AKG',
    displayOrder: 1,
  });
  const communityKay = await ensureCommunity({
    name: 'Alkarma Kay',
    code: 'AKK',
    displayOrder: 2,
  });

  const ownerHomeUnit = await ensureUnit({
    projectName: 'Alkarma Gates',
    communityId: communityGates.id,
    block: 'C',
    unitNumber: '301',
    status: UnitStatus.DELIVERED,
    isDelivered: true,
    bedrooms: 3,
    bathrooms: 2,
    sizeSqm: 165,
  });
  const rentedUnit = await ensureUnit({
    projectName: 'Alkarma Gates',
    communityId: communityGates.id,
    block: 'D',
    unitNumber: '412',
    status: UnitStatus.DELIVERED,
    isDelivered: true,
    bedrooms: 2,
    bathrooms: 2,
    sizeSqm: 138,
  });
  const preDeliveryUnit = await ensureUnit({
    projectName: 'Alkarma Kay',
    communityId: communityKay.id,
    block: 'A',
    unitNumber: '0907',
    status: UnitStatus.UNDER_CONSTRUCTION,
    isDelivered: false,
    bedrooms: 3,
    bathrooms: 2,
    sizeSqm: 172,
  });

  await Promise.all([
    ensureResidentUnitLink(ownerDemo.id, ownerHomeUnit.id, true),
    ensureResidentUnitLink(ownerDemo.id, rentedUnit.id, false),
    ensureResidentUnitLink(tenantDemo.id, rentedUnit.id, true),
    ensureResidentUnitLink(preOwnerDemo.id, preDeliveryUnit.id, true),
    ensureResidentUnitLink(familyDemo.id, ownerHomeUnit.id, false),
  ]);

  await ensureUnitAccess({
    unitId: ownerHomeUnit.id,
    userId: ownerDemo.id,
    role: 'OWNER',
    grantedBy: ownerDemo.id,
    source: 'OWNER_DEMO',
    canViewFinancials: true,
    canReceiveBilling: true,
    canBookFacilities: true,
    canGenerateQR: true,
    canManageWorkers: true,
  });
  await ensureUnitAccess({
    unitId: rentedUnit.id,
    userId: ownerDemo.id,
    role: 'OWNER',
    grantedBy: ownerDemo.id,
    source: 'OWNER_DEMO',
    canViewFinancials: true,
    canReceiveBilling: true,
    canBookFacilities: true,
    canGenerateQR: true,
    canManageWorkers: true,
  });
  await ensureUnitAccess({
    unitId: rentedUnit.id,
    userId: tenantDemo.id,
    role: 'TENANT',
    grantedBy: ownerDemo.id,
    source: 'LEASE_DEMO',
    canViewFinancials: true,
    canReceiveBilling: true,
    canBookFacilities: true,
    canGenerateQR: true,
    canManageWorkers: false,
  });
  await ensureUnitAccess({
    unitId: preDeliveryUnit.id,
    userId: preOwnerDemo.id,
    role: 'OWNER',
    grantedBy: preOwnerDemo.id,
    source: 'PRE_DELIVERY_OWNER_DEMO',
    canViewFinancials: false,
    canReceiveBilling: false,
    canBookFacilities: false,
    canGenerateQR: false,
    canManageWorkers: false,
  });
  await ensureUnitAccess({
    unitId: ownerHomeUnit.id,
    userId: familyDemo.id,
    role: 'FAMILY',
    grantedBy: ownerDemo.id,
    source: 'FAMILY_DEMO',
    canViewFinancials: false,
    canReceiveBilling: false,
    canBookFacilities: true,
    canGenerateQR: false,
    canManageWorkers: false,
  });
  await ensureUnitAccess({
    unitId: ownerHomeUnit.id,
    userId: authorizedDemo.id,
    role: 'DELEGATE',
    grantedBy: ownerDemo.id,
    source: 'DELEGATE_DEMO',
    delegateType: DelegateType.FRIEND,
    canViewFinancials: false,
    canReceiveBilling: false,
    canBookFacilities: true,
    canGenerateQR: true,
    canManageWorkers: false,
  });
  await ensureUnitAccess({
    unitId: ownerHomeUnit.id,
    userId: contractorDemo.id,
    role: 'DELEGATE',
    grantedBy: ownerDemo.id,
    source: 'CONTRACTOR_DEMO',
    delegateType: DelegateType.INTERIOR_DESIGNER,
    canViewFinancials: false,
    canReceiveBilling: false,
    canBookFacilities: false,
    canGenerateQR: true,
    canManageWorkers: true,
  });

  await ensureFamilyLink(ownerDemo.id, familyDemo.id, RelationshipType.CHILD);
  await ensureActiveLease(rentedUnit.id, ownerDemo.id, tenantDemo.id);

  await ensureContractorAndWorker({
    managerUserId: contractorDemo.id,
    unitId: ownerHomeUnit.id,
    contractorName: 'Demo Household Staff Co.',
    workerName: 'Nanny Demo',
    workerNationalId: '29901010000999',
    workerPhone: '+201100000099',
  });

  await ensureResidentVehicle({
    userId: ownerDemo.id,
    vehicleType: 'Toyota',
    model: 'Corolla 2024',
    plateNumber: 'ق و 1234',
    color: 'White',
    notes: 'Main family car',
    isPrimary: true,
  });
  await ensureResidentVehicle({
    userId: ownerDemo.id,
    vehicleType: 'Kia',
    model: 'Sportage 2023',
    plateNumber: 'س ب 7721',
    color: 'Gray',
    notes: 'Secondary car',
    isPrimary: false,
  });
  await ensureResidentVehicle({
    userId: tenantDemo.id,
    vehicleType: 'Nissan',
    model: 'Sunny 2022',
    plateNumber: 'ر ل 5566',
    color: 'Silver',
    notes: 'Tenant vehicle',
    isPrimary: true,
  });

  // ── Commercial Entity Personas ──────────────────────────────────────
  const commercialUnit = await ensureUnit({
    projectName: 'Alkarma Gates',
    communityId: communityGates.id,
    block: 'COM',
    unitNumber: 'C-101',
    type: UnitType.COMMERCIAL_UNIT,
    status: UnitStatus.DELIVERED,
    isDelivered: true,
    bedrooms: 0,
    bathrooms: 1,
    sizeSqm: 200,
  });
  // Set category to COMMERCIAL
  await prisma.unit.update({ where: { id: commercialUnit.id }, data: { category: 'COMMERCIAL' as any } });

  const commOwnerDemo = await ensureDemoUser({
    email: 'comm.owner@alkarma.demo',
    nameEN: 'Tarek Nabil',
    phone: '+201100000010',
    nationalId: '29901010000010',
    createResident: true,
  });
  const commTenantDemo = await ensureDemoUser({
    email: 'comm.tenant@alkarma.demo',
    nameEN: 'Sara Ahmed',
    phone: '+201100000011',
    nationalId: '29901010000011',
    createResident: true,
  });
  const commStaffDemo = await ensureDemoUser({
    email: 'comm.staff@alkarma.demo',
    nameEN: 'Hassan Youssef',
    phone: '+201100000012',
    nationalId: '29901010000012',
    createResident: true,
  });

  // Create commercial entity
  let commEntity = await prisma.commercialEntity.findFirst({
    where: { name: 'Demo Pharmacy', communityId: communityGates.id },
  });
  if (!commEntity) {
    commEntity = await prisma.commercialEntity.create({
      data: {
        name: 'Demo Pharmacy',
        description: '24/7 Pharmacy & Healthcare',
        communityId: communityGates.id,
        unitId: commercialUnit.id,
        isActive: true,
      },
    });
  }

  // Add owner member
  const ownerPerms = { can_work_orders: true, can_attendance: true, can_service_requests: true, can_tickets: true, can_photo_upload: true, can_task_reminders: true, can_invoices: true, can_staff_management: true };
  await prisma.commercialEntityMember.upsert({
    where: { entityId_userId: { entityId: commEntity.id, userId: commOwnerDemo.id } },
    update: { role: 'OWNER' as any, permissions: ownerPerms, isActive: true, deletedAt: null },
    create: { entityId: commEntity.id, userId: commOwnerDemo.id, role: 'OWNER' as any, permissions: ownerPerms, isActive: true },
  });

  // Add tenant member
  const tenantPerms = { ...ownerPerms };
  await prisma.commercialEntityMember.upsert({
    where: { entityId_userId: { entityId: commEntity.id, userId: commTenantDemo.id } },
    update: { role: 'TENANT' as any, permissions: tenantPerms, isActive: true, deletedAt: null },
    create: { entityId: commEntity.id, userId: commTenantDemo.id, role: 'TENANT' as any, permissions: tenantPerms, isActive: true },
  });

  // Add staff member
  const staffPerms = { can_work_orders: false, can_attendance: true, can_service_requests: false, can_tickets: false, can_photo_upload: false, can_task_reminders: false, can_invoices: false, can_staff_management: false };
  await prisma.commercialEntityMember.upsert({
    where: { entityId_userId: { entityId: commEntity.id, userId: commStaffDemo.id } },
    update: { role: 'STAFF' as any, permissions: staffPerms, isActive: true, deletedAt: null },
    create: { entityId: commEntity.id, userId: commStaffDemo.id, role: 'STAFF' as any, permissions: staffPerms, isActive: true },
  });

  await cleanupAssistantDemoArtifacts();
  await deactivateLegacyDemoUsers();

  console.log('✅ Mobile demo personas ready');
  console.log('Owner: ahmed.hassan.owner@alkarma.demo / pass123');
  console.log('Tenant: mostafa.ali.tenant@alkarma.demo / pass123');
  console.log('Pre-Delivery Owner: karim.fathy.predelivery@alkarma.demo / pass123');
  console.log('Family Member: nour.hassan.family@alkarma.demo / pass123');
  console.log('Authorized (Delegate): youssef.mahmoud.authorized@alkarma.demo / pass123');
  console.log('Contractor: mohamed.saber.contractor@alkarma.demo / pass123');
  console.log('Commercial Owner: comm.owner@alkarma.demo / pass123');
  console.log('Commercial Tenant: comm.tenant@alkarma.demo / pass123');
  console.log('Commercial Staff: comm.staff@alkarma.demo / pass123');
}

run()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

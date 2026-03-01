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

const prisma = new PrismaClient();
const DEMO_PASSWORD = 'pass123';

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
    UnitStatus.OCCUPIED,
    UnitStatus.LEASED,
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

async function run() {
  console.log('Seeding mobile demo personas...');

  const ownerDemo = await ensureDemoUser({
    email: 'owner.demo@test.com',
    nameEN: 'Owner Demo',
    phone: '+201100000001',
    nationalId: '29901010000001',
    createResident: true,
    createOwner: true,
  });
  const tenantDemo = await ensureDemoUser({
    email: 'tenant.demo@test.com',
    nameEN: 'Tenant Demo',
    phone: '+201100000002',
    nationalId: '29901010000002',
    createResident: true,
    createTenant: true,
  });
  const preOwnerDemo = await ensureDemoUser({
    email: 'preowner.demo@test.com',
    nameEN: 'Pre-Delivery Owner Demo',
    phone: '+201100000003',
    nationalId: '29901010000003',
    createResident: true,
    createOwner: true,
  });
  const familyDemo = await ensureDemoUser({
    email: 'family.demo@test.com',
    nameEN: 'Family Member Demo',
    phone: '+201100000004',
    nationalId: '29901010000004',
    createResident: true,
  });
  const authorizedDemo = await ensureDemoUser({
    email: 'authorized.demo@test.com',
    nameEN: 'Authorized Demo',
    phone: '+201100000005',
    nationalId: '29901010000005',
    createResident: true,
  });
  const contractorDemo = await ensureDemoUser({
    email: 'contractor.demo@test.com',
    nameEN: 'Contractor Demo',
    phone: '+201100000006',
    nationalId: '29901010000006',
    createResident: true,
  });

  const ownerHomeUnit = await ensureUnit({
    projectName: 'Alkarma Gates',
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
    block: 'D',
    unitNumber: '412',
    status: UnitStatus.LEASED,
    isDelivered: true,
    bedrooms: 2,
    bathrooms: 2,
    sizeSqm: 138,
  });
  const preDeliveryUnit = await ensureUnit({
    projectName: 'Alkarma Kay',
    block: 'A',
    unitNumber: '0907',
    status: UnitStatus.NOT_DELIVERED,
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

  await cleanupAssistantDemoArtifacts();

  console.log('✅ Mobile demo personas ready');
  console.log('Owner: owner.demo@test.com / pass123');
  console.log('Tenant: tenant.demo@test.com / pass123');
  console.log('Pre-Delivery Owner: preowner.demo@test.com / pass123');
  console.log('Family Member: family.demo@test.com / pass123');
  console.log('Authorized (Delegate): authorized.demo@test.com / pass123');
  console.log('Contractor: contractor.demo@test.com / pass123');
}

run()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

/* eslint-disable no-console */
const {
  Prisma,
  PrismaClient,
  CommercialEntityMemberRole,
  CompoundStaffPermission,
  CompoundStaffStatus,
  EntityStatus,
  GateAccessRole,
  GateDirection,
  InvoiceType,
} = require('@prisma/client');

const prisma = new PrismaClient();
const DEV_PASSWORD_HASH =
  '$2b$08$exYKLbTecbIb6Aci.BC2WuRjsgZtuE.qBQ.2Tn6oaqBwcCjwf7cze'; // pass123

const PERMISSIONS = [
  'auth.login',
  'auth.refresh',
  'auth.logout',
  'admin.view',
  'admin.update',
  'user.read',
  'unit.view_all',
  'unit.view_own',
  'project.view',
  'complaint.view_all',
  'complaint.view_own',
  'complaint.report',
  'complaint.manage',
  'violation.view_all',
  'violation.issue',
  'violation.update',
  'violation.cancel',
  'facility.view_all',
  'facility.view_own',
  'facility.create',
  'facility.update',
  'booking.view_all',
  'booking.view_own',
  'booking.create',
  'booking.update',
  'booking.approve',
  'booking.reject',
  'booking.cancel',
  'commercial.view_all',
  'commercial.create',
  'commercial.update',
  'compound_staff.view_all',
  'compound_staff.create',
  'compound_staff.update',
  'compound_staff.delete',
  'gate.view_all',
  'gate.create',
  'gate.update',
  'gate.logs.view',
];

const ROLES = {
  SUPER_ADMIN: PERMISSIONS,
  MANAGER: [
    'admin.view',
    'admin.update',
    'user.read',
    'unit.view_all',
    'project.view',
    'complaint.view_all',
    'complaint.manage',
    'violation.view_all',
    'violation.issue',
    'violation.update',
    'facility.view_all',
    'facility.create',
    'facility.update',
    'booking.view_all',
    'booking.approve',
    'booking.reject',
    'booking.cancel',
    'commercial.view_all',
    'commercial.create',
    'commercial.update',
    'compound_staff.view_all',
    'compound_staff.create',
    'compound_staff.update',
    'gate.view_all',
    'gate.create',
    'gate.update',
    'gate.logs.view',
  ],
  COMMUNITY_USER: ['unit.view_own', 'project.view'],
};

const UNIT_STATUSES = ['OFF_PLAN', 'UNDER_CONSTRUCTION', 'DELIVERED'];

const PERSONAS = [
  { key: 'SUPER_ADMIN', name: 'Super Admin', isSystem: true },
  { key: 'ADMIN', name: 'Admin', isSystem: true },
  { key: 'STAFF', name: 'Staff', isSystem: true },
  { key: 'OWNER', name: 'Owner', isSystem: true },
  { key: 'TENANT', name: 'Tenant', isSystem: true },
  { key: 'FAMILY', name: 'Family', isSystem: true },
  { key: 'AUTHORIZED', name: 'Authorized', isSystem: true },
  { key: 'CONTRACTOR', name: 'Contractor', isSystem: true },
  { key: 'PRE_DELIVERY_OWNER', name: 'Pre-Delivery Owner', isSystem: true },
  { key: 'RESIDENT', name: 'Resident', isSystem: true },
  { key: 'COMMERCIAL_OWNER', name: 'Commercial Owner', isSystem: true },
  { key: 'COMMERCIAL_STAFF', name: 'Commercial Staff', isSystem: true },
];

const ROLE_PERSONA_LINKS = {
  SUPER_ADMIN: ['SUPER_ADMIN', 'ADMIN'],
  MANAGER: ['ADMIN', 'STAFF'],
  COMMUNITY_USER: ['RESIDENT'],
};

const ADMIN_SCREEN_DEFS = [
  { key: 'admin-dashboard', title: 'Dashboard', section: 'dashboard', moduleKey: 'dashboard' },
  { key: 'admin-my-account', title: 'My Account', section: 'my-account', moduleKey: 'profile' },
  { key: 'admin-residents', title: 'Residents', section: 'residents', moduleKey: 'users' },
  { key: 'admin-dashboard-users', title: 'Dashboard Users', section: 'dashboard-users', moduleKey: 'users' },
  { key: 'admin-communities', title: 'Communities', section: 'communities', moduleKey: 'communities' },
  { key: 'admin-units', title: 'Units', section: 'units', moduleKey: 'units' },
  { key: 'admin-commercial', title: 'Commercial', section: 'commercial', moduleKey: 'commercial' },
  { key: 'admin-compound-staff', title: 'Compound Staff', section: 'compound-staff', moduleKey: 'users' },
  { key: 'admin-attendance', title: 'Attendance', section: 'attendance', moduleKey: 'users' },
  { key: 'admin-blue-collar', title: 'Blue Collar', section: 'blue-collar', moduleKey: 'users' },
  { key: 'admin-gates', title: 'Gates', section: 'gates', moduleKey: 'gates' },
  { key: 'admin-access', title: 'Access Control', section: 'access', moduleKey: 'gates' },
  { key: 'admin-rental', title: 'Rental', section: 'rental', moduleKey: 'rentals' },
  { key: 'admin-billing', title: 'Billing', section: 'billing', moduleKey: 'payments' },
  { key: 'admin-complaints', title: 'Complaints', section: 'complaints', moduleKey: 'complaints' },
  { key: 'admin-violations', title: 'Violations', section: 'violations', moduleKey: 'violations' },
  { key: 'admin-tickets', title: 'Tickets', section: 'tickets', moduleKey: 'tickets' },
  { key: 'admin-services', title: 'Services', section: 'services', moduleKey: 'services' },
  { key: 'admin-permits', title: 'Permits', section: 'permits', moduleKey: 'permits' },
  { key: 'admin-amenities', title: 'Amenities', section: 'amenities', moduleKey: 'amenities' },
  { key: 'admin-ordering', title: 'Ordering', section: 'ordering', moduleKey: 'services' },
  { key: 'admin-notifications', title: 'Notifications', section: 'notifications', moduleKey: 'news' },
  { key: 'admin-news', title: 'News', section: 'news', moduleKey: 'news' },
  { key: 'admin-marketing', title: 'Marketing', section: 'marketing', moduleKey: 'news' },
  { key: 'admin-surveys', title: 'Surveys', section: 'surveys', moduleKey: 'reports' },
  { key: 'admin-approvals', title: 'Registrations', section: 'approvals', moduleKey: 'users' },
  { key: 'admin-reports', title: 'Reports', section: 'reports', moduleKey: 'reports' },
  { key: 'admin-directory', title: 'Directory', section: 'directory', moduleKey: 'dashboard' },
  { key: 'admin-security', title: 'Security', section: 'security', moduleKey: 'gates' },
  { key: 'admin-settings', title: 'System Settings', section: 'settings', moduleKey: 'dashboard' },
  { key: 'admin-hospitality', title: 'Hospitality', section: 'hospitality', moduleKey: 'services' },
];

const MOBILE_SCREEN_DEFS = [
  { key: 'mobile-home', title: 'Home', section: 'home', moduleKey: 'dashboard' },
  { key: 'mobile-notifications', title: 'Notifications', section: 'notifications', moduleKey: 'news' },
  { key: 'mobile-community-updates', title: 'Community Updates', section: 'community_updates', moduleKey: 'news' },
  { key: 'mobile-services', title: 'Services', section: 'services', moduleKey: 'services' },
  { key: 'mobile-requests', title: 'Requests', section: 'requests', moduleKey: 'services' },
  { key: 'mobile-bookings', title: 'Bookings', section: 'bookings', moduleKey: 'amenities' },
  { key: 'mobile-complaints', title: 'Complaints', section: 'complaints', moduleKey: 'complaints' },
  { key: 'mobile-violations', title: 'Violations', section: 'violations', moduleKey: 'violations' },
  { key: 'mobile-finance', title: 'Finance', section: 'finance', moduleKey: 'payments' },
  { key: 'mobile-qr-access', title: 'QR Access', section: 'qr_access', moduleKey: 'gates' },
  { key: 'mobile-household', title: 'Household', section: 'household', moduleKey: 'users' },
  { key: 'mobile-discover', title: 'Discover', section: 'discover', moduleKey: 'dashboard' },
  { key: 'mobile-help-center', title: 'Help Center', section: 'help_center', moduleKey: 'dashboard' },
  { key: 'mobile-utilities', title: 'Utilities', section: 'utilities', moduleKey: 'payments' },
];

const ADMIN_VISIBILITY = {
  SUPER_ADMIN: ADMIN_SCREEN_DEFS.map((row) => row.section),
  ADMIN: ADMIN_SCREEN_DEFS.map((row) => row.section),
  STAFF: [
    'dashboard',
    'my-account',
    'tickets',
    'services',
    'permits',
    'complaints',
    'violations',
    'gates',
    'access',
    'notifications',
    'reports',
  ],
  OWNER: ['my-account'],
  TENANT: ['my-account'],
  FAMILY: ['my-account'],
  AUTHORIZED: ['my-account'],
  CONTRACTOR: ['my-account'],
  PRE_DELIVERY_OWNER: ['my-account'],
  RESIDENT: ['my-account'],
  COMMERCIAL_OWNER: ['my-account'],
  COMMERCIAL_STAFF: ['my-account'],
};

const MOBILE_VISIBILITY = {
  OWNER: ['home', 'notifications', 'community_updates', 'services', 'requests', 'bookings', 'complaints', 'violations', 'finance', 'qr_access', 'household', 'discover', 'help_center', 'utilities'],
  TENANT: ['home', 'notifications', 'community_updates', 'services', 'requests', 'bookings', 'complaints', 'violations', 'finance', 'qr_access', 'household', 'discover', 'help_center', 'utilities'],
  FAMILY: ['home', 'notifications', 'community_updates', 'services', 'requests', 'bookings', 'complaints', 'violations', 'discover', 'help_center'],
  AUTHORIZED: ['home', 'notifications', 'community_updates', 'services', 'requests', 'bookings', 'complaints', 'violations', 'qr_access', 'household', 'discover', 'help_center'],
  CONTRACTOR: ['home', 'notifications', 'requests', 'qr_access', 'help_center'],
  PRE_DELIVERY_OWNER: ['home', 'notifications', 'community_updates', 'complaints', 'discover', 'help_center'],
  RESIDENT: ['home', 'notifications', 'community_updates', 'services', 'requests', 'bookings', 'complaints', 'violations', 'finance', 'qr_access', 'discover', 'help_center', 'utilities'],
  COMMERCIAL_OWNER: ['home', 'notifications', 'community_updates', 'services', 'requests', 'bookings', 'discover', 'help_center'],
  COMMERCIAL_STAFF: ['home', 'notifications', 'services', 'requests', 'help_center'],
};

const MOBILE_STATUS_BLOCKLIST = {
  OFF_PLAN: ['bookings', 'household', 'utilities'],
  UNDER_CONSTRUCTION: ['bookings'],
  DELIVERED: [],
};

const DEFAULT_INVOICE_CATEGORY_LABELS = {
  RENT: 'Rent',
  SERVICE_FEE: 'Service Fee',
  UTILITY: 'Utility',
  FINE: 'Fine',
  MAINTENANCE_FEE: 'Maintenance Fee',
  BOOKING_FEE: 'Booking Fee',
  SETUP_FEE: 'Setup Fee',
  LATE_FEE: 'Late Fee',
  MISCELLANEOUS: 'Miscellaneous',
  OWNER_EXPENSE: 'Owner Expense',
  MANAGEMENT_FEE: 'Management Fee',
  CREDIT_MEMO: 'Credit Memo',
  DEBIT_MEMO: 'Debit Memo',
};

const DEFAULT_INVOICE_CATEGORY_COLORS = {
  RENT: '#3b82f6',
  SERVICE_FEE: '#10b981',
  UTILITY: '#14b8a6',
  FINE: '#ef4444',
  MAINTENANCE_FEE: '#f59e0b',
  BOOKING_FEE: '#f97316',
  SETUP_FEE: '#8b5cf6',
  LATE_FEE: '#dc2626',
  MISCELLANEOUS: '#64748b',
  OWNER_EXPENSE: '#0ea5e9',
  MANAGEMENT_FEE: '#2563eb',
  CREDIT_MEMO: '#22c55e',
  DEBIT_MEMO: '#f43f5e',
};

async function upsertGateByName(communityId, name, data) {
  const existing = await prisma.gate.findFirst({
    where: { communityId, name, deletedAt: null },
    select: { id: true },
  });
  if (existing) {
    return prisma.gate.update({ where: { id: existing.id }, data });
  }
  return prisma.gate.create({ data: { communityId, name, ...data } });
}

async function upsertUnit(communityId, block, unitNumber, payload) {
  const existing = await prisma.unit.findFirst({
    where: { projectName: 'Alkarma Heights', block, unitNumber, deletedAt: null },
    select: { id: true },
  });

  if (existing) {
    return prisma.unit.update({
      where: { id: existing.id },
      data: {
        communityId,
        ...payload,
        type: 'APARTMENT',
        isActive: true,
        isDelivered: true,
      },
    });
  }

  return prisma.unit.create({
    data: {
      projectName: 'Alkarma Heights',
      communityId,
      block,
      unitNumber,
      type: 'APARTMENT',
      isActive: true,
      isDelivered: true,
      ...payload,
    },
  });
}

async function resetRbacPolicyData() {
  await prisma.$transaction(async (tx) => {
    await tx.userPersonaOverride.deleteMany({});
    await tx.userPermissionOverride.deleteMany({});
    await tx.screenVisibilityRule.deleteMany({});
    await tx.rolePersona.deleteMany({});
    await tx.roleStatusPermission.deleteMany({});
    await tx.roleModuleAccess.deleteMany({});
    await tx.rolePermission.deleteMany({});
    await tx.userRole.deleteMany({});
    await tx.screenDefinition.deleteMany({});
    await tx.persona.deleteMany({});
  });
}

async function seedDynamicGovernance({
  roleIdByName,
  resetRbac,
}) {
  if (resetRbac) {
    await prisma.screenVisibilityRule.deleteMany({});
    await prisma.rolePersona.deleteMany({});
    await prisma.screenDefinition.deleteMany({});
    await prisma.persona.deleteMany({});
  }

  for (const persona of PERSONAS) {
    await prisma.persona.upsert({
      where: { key: persona.key },
      update: {
        name: persona.name,
        description: persona.description ?? null,
        isSystem: persona.isSystem === true,
        isActive: true,
      },
      create: {
        key: persona.key,
        name: persona.name,
        description: persona.description ?? null,
        isSystem: persona.isSystem === true,
        isActive: true,
      },
    });
  }

  const screenUpserts = [
    ...ADMIN_SCREEN_DEFS.map((screen) => ({ ...screen, surface: 'ADMIN_WEB' })),
    ...MOBILE_SCREEN_DEFS.map((screen) => ({ ...screen, surface: 'MOBILE_APP' })),
  ];

  for (const screen of screenUpserts) {
    await prisma.screenDefinition.upsert({
      where: { key: screen.key },
      update: {
        title: screen.title,
        section: screen.section,
        moduleKey: screen.moduleKey ?? null,
        surface: screen.surface,
        isEnabled: true,
      },
      create: {
        key: screen.key,
        title: screen.title,
        section: screen.section,
        moduleKey: screen.moduleKey ?? null,
        surface: screen.surface,
        isEnabled: true,
      },
    });
  }

  const personas = await prisma.persona.findMany({
    where: { key: { in: PERSONAS.map((row) => row.key) } },
    select: { id: true, key: true },
  });
  const personaIdByKey = new Map(personas.map((row) => [row.key, row.id]));

  const rolePersonaRows = [];
  for (const [roleName, personaKeys] of Object.entries(ROLE_PERSONA_LINKS)) {
    const roleId = roleIdByName.get(roleName);
    if (!roleId) continue;
    for (const personaKey of personaKeys) {
      const personaId = personaIdByKey.get(personaKey);
      if (!personaId) continue;
      rolePersonaRows.push({ roleId, personaId });
    }
  }

  if (rolePersonaRows.length > 0) {
    await prisma.rolePersona.createMany({
      data: rolePersonaRows,
      skipDuplicates: true,
    });
  }

  const shouldSeedRules =
    resetRbac === true ||
    process.env.SEED_FORCE_SCREEN_RULES === 'true' ||
    (await prisma.screenVisibilityRule.count()) === 0;

  if (!shouldSeedRules) return;

  await prisma.screenVisibilityRule.deleteMany({});

  const allScreens = await prisma.screenDefinition.findMany({
    where: {
      key: { in: screenUpserts.map((row) => row.key) },
    },
    select: {
      id: true,
      section: true,
      surface: true,
    },
  });

  const adminScreenIdBySection = new Map();
  const mobileScreenIdBySection = new Map();
  for (const row of allScreens) {
    if (row.surface === 'ADMIN_WEB') {
      adminScreenIdBySection.set(row.section, row.id);
    } else if (row.surface === 'MOBILE_APP') {
      mobileScreenIdBySection.set(row.section, row.id);
    }
  }

  const visibilityRows = [];

  for (const [personaKey, sections] of Object.entries(ADMIN_VISIBILITY)) {
    const personaId = personaIdByKey.get(personaKey);
    if (!personaId) continue;
    const allowed = new Set(sections);
    for (const unitStatus of UNIT_STATUSES) {
      for (const [section, screenId] of adminScreenIdBySection.entries()) {
        visibilityRows.push({
          personaId,
          screenId,
          surface: 'ADMIN_WEB',
          unitStatus,
          visible: allowed.has(section),
        });
      }
    }
  }

  for (const [personaKey, sections] of Object.entries(MOBILE_VISIBILITY)) {
    const personaId = personaIdByKey.get(personaKey);
    if (!personaId) continue;
    const allowed = new Set(sections);
    for (const unitStatus of UNIT_STATUSES) {
      const blocked = new Set(MOBILE_STATUS_BLOCKLIST[unitStatus] ?? []);
      for (const [section, screenId] of mobileScreenIdBySection.entries()) {
        visibilityRows.push({
          personaId,
          screenId,
          surface: 'MOBILE_APP',
          unitStatus,
          visible: allowed.has(section) && !blocked.has(section),
        });
      }
    }
  }

  if (visibilityRows.length > 0) {
    await prisma.screenVisibilityRule.createMany({
      data: visibilityRows,
      skipDuplicates: true,
    });
  }
}

async function main() {
  const lockResult = await prisma.$queryRaw`
    SELECT pg_try_advisory_lock(885122009) AS locked
  `;
  const locked = Array.isArray(lockResult) && Boolean(lockResult[0]?.locked);
  if (!locked) {
    throw new Error(
      'Seed lock is already held by another process. Stop other seed runs and try again.',
    );
  }

  try {
    console.log('Fast seed started...');
    const resetRbac = process.env.SEED_RESET_RBAC === 'true';
    if (resetRbac) {
      console.log('RBAC reset mode: clearing role assignments and policy tables...');
      await resetRbacPolicyData();
    }

    await prisma.permission.createMany({
      data: PERMISSIONS.map((key) => ({ key })),
      skipDuplicates: true,
    });

    const roleNames = Object.keys(ROLES);
    await prisma.role.createMany({
      data: roleNames.map((name) => ({ name, isSystem: true })),
      skipDuplicates: true,
    });
    await Promise.all(
      roleNames.map((name) =>
        prisma.role.updateMany({
          where: { name },
          data: { isSystem: true },
        }),
      ),
    );

    const [roleRows, permissionRows] = await Promise.all([
      prisma.role.findMany({
        where: { name: { in: roleNames } },
        select: { id: true, name: true },
      }),
      prisma.permission.findMany({
        where: { key: { in: PERMISSIONS } },
        select: { id: true, key: true },
      }),
    ]);

    const roleIdByName = new Map(roleRows.map((row) => [row.name, row.id]));
    const permissionIdByKey = new Map(permissionRows.map((row) => [row.key, row.id]));

    const rolePermissionRows = [];
    const seen = new Set();
    for (const [roleName, permissionKeys] of Object.entries(ROLES)) {
      const roleId = roleIdByName.get(roleName);
      if (!roleId) throw new Error(`Missing role: ${roleName}`);
      for (const key of permissionKeys) {
        const permissionId = permissionIdByKey.get(key);
        if (!permissionId) throw new Error(`Missing permission: ${key}`);
        const pair = `${roleId}:${permissionId}`;
        if (seen.has(pair)) continue;
        seen.add(pair);
        rolePermissionRows.push({ roleId, permissionId });
      }
    }
    await prisma.rolePermission.createMany({
      data: rolePermissionRows,
      skipDuplicates: true,
    });

    await seedDynamicGovernance({ roleIdByName, resetRbac });

    await prisma.invoiceCategory.createMany({
      data: Object.values(InvoiceType).map((type, index) => ({
        label: DEFAULT_INVOICE_CATEGORY_LABELS[type],
        mappedType: type,
        isSystem: true,
        description: `Default mapping for ${DEFAULT_INVOICE_CATEGORY_LABELS[type]} invoices.`,
        color: DEFAULT_INVOICE_CATEGORY_COLORS[type],
        displayOrder: index,
        isActive: true,
      })),
      skipDuplicates: true,
    });

    const passwordHash = DEV_PASSWORD_HASH;

    const superAdminRoleId = roleIdByName.get('SUPER_ADMIN');
    const managerRoleId = roleIdByName.get('MANAGER');
    const communityRoleId = roleIdByName.get('COMMUNITY_USER');
    if (!superAdminRoleId || !managerRoleId || !communityRoleId) {
      throw new Error('Missing core role IDs');
    }

    const superAdminUser = await prisma.user.upsert({
      where: { email: 'test@admin.com' },
      update: { passwordHash, nameEN: 'Super Admin' },
      create: {
        email: 'test@admin.com',
        passwordHash,
        nameEN: 'Super Admin',
        roles: { create: [{ roleId: superAdminRoleId }] },
        admin: { create: {} },
      },
    });

    const [manager, residentAUser, residentBUser] = await Promise.all([
      prisma.user.upsert({
        where: { email: 'manager@test.com' },
        update: { passwordHash, nameEN: 'Manager One' },
        create: { email: 'manager@test.com', passwordHash, nameEN: 'Manager One' },
      }),
      prisma.user.upsert({
        where: { email: 'residentA@test.com' },
        update: { passwordHash, nameEN: 'Resident A' },
        create: { email: 'residentA@test.com', passwordHash, nameEN: 'Resident A' },
      }),
      prisma.user.upsert({
        where: { email: 'residentB@test.com' },
        update: { passwordHash, nameEN: 'Resident B' },
        create: { email: 'residentB@test.com', passwordHash, nameEN: 'Resident B' },
      }),
    ]);

    await prisma.userRole.createMany({
      data: [
        { userId: superAdminUser.id, roleId: superAdminRoleId },
        { userId: manager.id, roleId: managerRoleId },
        { userId: residentAUser.id, roleId: communityRoleId },
        { userId: residentBUser.id, roleId: communityRoleId },
      ],
      skipDuplicates: true,
    });

    await prisma.admin.upsert({
      where: { userId: manager.id },
      update: {},
      create: { userId: manager.id },
    });

    await Promise.all([
      prisma.resident.upsert({
        where: { userId: residentAUser.id },
        update: {},
        create: { userId: residentAUser.id },
      }),
      prisma.resident.upsert({
        where: { userId: residentBUser.id },
        update: {},
        create: { userId: residentBUser.id },
      }),
    ]);

    const residentA = await prisma.resident.findUniqueOrThrow({
      where: { userId: residentAUser.id },
    });
    const residentB = await prisma.resident.findUniqueOrThrow({
      where: { userId: residentBUser.id },
    });

    const community = await prisma.community.upsert({
      where: { name: 'Alkarma Heights Community' },
      update: { code: 'ALKARMA-HTS', isActive: true, displayOrder: 1 },
      create: {
        name: 'Alkarma Heights Community',
        code: 'ALKARMA-HTS',
        isActive: true,
        displayOrder: 1,
      },
    });

    const northPhase = await prisma.phase.upsert({
      where: {
        communityId_name: {
          communityId: community.id,
          name: 'North Phase',
        },
      },
      update: { displayOrder: 1, isActive: true },
      create: {
        communityId: community.id,
        name: 'North Phase',
        displayOrder: 1,
        isActive: true,
      },
    });

    const retailPhase = await prisma.phase.upsert({
      where: {
        communityId_name: {
          communityId: community.id,
          name: 'Retail Phase',
        },
      },
      update: { displayOrder: 2, isActive: true },
      create: {
        communityId: community.id,
        name: 'Retail Phase',
        displayOrder: 2,
        isActive: true,
      },
    });

    const residentialCluster = await prisma.cluster.upsert({
      where: {
        phaseId_name: {
          phaseId: northPhase.id,
          name: 'Residential Core',
        },
      },
      update: { displayOrder: 1, isActive: true, communityId: community.id },
      create: {
        communityId: community.id,
        phaseId: northPhase.id,
        name: 'Residential Core',
        displayOrder: 1,
        isActive: true,
      },
    });
    const retailCluster = await prisma.cluster.upsert({
      where: {
        phaseId_name: {
          phaseId: retailPhase.id,
          name: 'Retail Strip',
        },
      },
      update: { displayOrder: 1, isActive: true, communityId: community.id },
      create: {
        communityId: community.id,
        phaseId: retailPhase.id,
        name: 'Retail Strip',
        displayOrder: 1,
        isActive: true,
      },
    });

    const [mainGate, serviceGate, towerBGate] = await Promise.all([
      upsertGateByName(community.id, 'Main Gate', {
        code: 'MG-01',
        status: EntityStatus.ACTIVE,
        allowedRoles: [
          GateAccessRole.RESIDENT,
          GateAccessRole.VISITOR,
          GateAccessRole.STAFF,
          GateAccessRole.DELIVERY,
          GateAccessRole.RIDESHARE,
        ],
        etaMinutes: 2,
        isVisitorRequestRequired: true,
      }),
      upsertGateByName(community.id, 'Service Gate', {
        code: 'SG-02',
        status: EntityStatus.ACTIVE,
        allowedRoles: [GateAccessRole.STAFF, GateAccessRole.WORKER, GateAccessRole.DELIVERY],
        etaMinutes: 4,
        isVisitorRequestRequired: false,
      }),
      upsertGateByName(community.id, 'Tower B Gate', {
        code: 'TB-03',
        status: EntityStatus.ACTIVE,
        allowedRoles: [GateAccessRole.RESIDENT, GateAccessRole.VISITOR, GateAccessRole.STAFF],
        etaMinutes: 3,
        isVisitorRequestRequired: true,
      }),
    ]);

    const [unitA, unitB, unitC, unitD] = await Promise.all([
      upsertUnit(community.id, 'A', '101', {
        phaseId: northPhase.id,
        clusterId: residentialCluster.id,
        bedrooms: 2,
        bathrooms: 1,
        sizeSqm: 120,
      }),
      upsertUnit(community.id, 'B', '202', {
        phaseId: northPhase.id, // phase-level unit (no cluster)
        clusterId: null,
        bedrooms: 3,
        bathrooms: 2,
        sizeSqm: 160,
      }),
      upsertUnit(community.id, 'R', '015', {
        phaseId: retailPhase.id,
        clusterId: retailCluster.id,
        bedrooms: 0,
        bathrooms: 1,
        sizeSqm: 95,
      }),
      upsertUnit(community.id, 'C', '303', {
        phaseId: null, // community-level unit (no phase/cluster)
        clusterId: null,
        bedrooms: 2,
        bathrooms: 2,
        sizeSqm: 140,
      }),
    ]);

    await Promise.all([
      prisma.residentUnit.upsert({
        where: { residentId_unitId: { residentId: residentA.id, unitId: unitA.id } },
        update: { isPrimary: true },
        create: { residentId: residentA.id, unitId: unitA.id, isPrimary: true },
      }),
      prisma.residentUnit.upsert({
        where: { residentId_unitId: { residentId: residentB.id, unitId: unitB.id } },
        update: { isPrimary: true },
        create: { residentId: residentB.id, unitId: unitB.id, isPrimary: true },
      }),
    ]);

    await prisma.gateUnitAccess.createMany({
      data: [
        { gateId: mainGate.id, unitId: unitA.id },
        { gateId: mainGate.id, unitId: unitB.id },
        { gateId: mainGate.id, unitId: unitD.id },
        { gateId: serviceGate.id, unitId: unitC.id },
        { gateId: towerBGate.id, unitId: unitB.id },
      ],
      skipDuplicates: true,
    });

    const [commercialOwner, commercialHr, guardUser] = await Promise.all([
      prisma.user.upsert({
        where: { email: 'commercial.owner@test.com' },
        update: { passwordHash, nameEN: 'Commercial Owner', phone: '01020000001' },
        create: {
          email: 'commercial.owner@test.com',
          passwordHash,
          nameEN: 'Commercial Owner',
          phone: '01020000001',
        },
      }),
      prisma.user.upsert({
        where: { email: 'commercial.hr@test.com' },
        update: { passwordHash, nameEN: 'Commercial HR', phone: '01020000002' },
        create: {
          email: 'commercial.hr@test.com',
          passwordHash,
          nameEN: 'Commercial HR',
          phone: '01020000002',
        },
      }),
      prisma.user.upsert({
        where: { email: 'staff.guard@test.com' },
        update: { passwordHash, nameEN: 'Mahmoud Salah', phone: '01020000003' },
        create: {
          email: 'staff.guard@test.com',
          passwordHash,
          nameEN: 'Mahmoud Salah',
          phone: '01020000003',
        },
      }),
      prisma.user.upsert({
        where: { email: 'commercial.staff@test.com' },
        update: { passwordHash, nameEN: 'Commercial Staff', phone: '01020000006' },
        create: {
          email: 'commercial.staff@test.com',
          passwordHash,
          nameEN: 'Commercial Staff',
          phone: '01020000006',
        },
      }),
    ]);

    const existingEntity = await prisma.commercialEntity.findFirst({
      where: {
        communityId: community.id,
        name: 'Alkarma Business Center',
        deletedAt: null,
      },
      select: { id: true },
    });
    const commercialEntity = existingEntity
      ? await prisma.commercialEntity.update({
          where: { id: existingEntity.id },
          data: {
            unitId: unitC.id,
            isActive: true,
            description: 'Mixed-use commercial entity (offices + shops)',
          },
        })
      : await prisma.commercialEntity.create({
          data: {
            communityId: community.id,
            unitId: unitC.id,
            name: 'Alkarma Business Center',
            description: 'Mixed-use commercial entity (offices + shops)',
            isActive: true,
          },
        });

    await prisma.commercialEntityMember.createMany({
      data: [
        {
          entityId: commercialEntity.id,
          userId: commercialOwner.id,
          role: CommercialEntityMemberRole.OWNER,
          permissions: {
            can_work_orders: true,
            can_attendance: true,
            can_service_requests: true,
            can_tickets: true,
            can_photo_upload: true,
            can_task_reminders: true,
          },
          isActive: true,
        },
        {
          entityId: commercialEntity.id,
          userId: commercialHr.id,
          role: CommercialEntityMemberRole.HR,
          permissions: {
            can_work_orders: true,
            can_attendance: true,
            can_service_requests: true,
            can_tickets: true,
            can_photo_upload: true,
            can_task_reminders: true,
          },
          isActive: true,
        },
        {
          entityId: commercialEntity.id,
          userId: guardUser.id,
          role: CommercialEntityMemberRole.STAFF,
          permissions: {
            can_work_orders: true,
            can_attendance: true,
            can_service_requests: false,
            can_tickets: false,
            can_photo_upload: true,
            can_task_reminders: true,
          },
          isActive: true,
        },
      ],
      skipDuplicates: true,
    });

    const now = new Date();
    const contractFrom = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    const expiringSoon = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);
    const expired = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000);

    async function upsertStaff(seed) {
      const existing = await prisma.compoundStaff.findFirst({
        where: { communityId: community.id, nationalId: seed.nationalId },
        select: { id: true },
      });
      const data = {
        communityId: community.id,
        commercialEntityId: commercialEntity.id,
        userId: seed.userId ?? null,
        fullName: seed.fullName,
        phone: seed.phone,
        nationalId: seed.nationalId,
        profession: seed.profession,
        jobTitle: seed.jobTitle,
        status: seed.status,
        isActive: seed.isActive,
        contractFrom,
        contractTo: seed.contractTo,
        workSchedule: seed.workSchedule
          ? seed.workSchedule
          : Prisma.JsonNull,
        deletedAt: seed.isActive ? null : new Date(),
      };
      if (existing) return prisma.compoundStaff.update({ where: { id: existing.id }, data });
      return prisma.compoundStaff.create({ data });
    }

    const [staffActive, staffSuspended, staffInactive] = await Promise.all([
      upsertStaff({
        fullName: 'Mahmoud Salah',
        phone: '01020000003',
        nationalId: '29801011234567',
        profession: 'Security',
        jobTitle: 'Gate Security Officer',
        status: CompoundStaffStatus.ACTIVE,
        isActive: true,
        contractTo: expiringSoon,
        workSchedule: { timezone: 'Africa/Cairo', shifts: ['SUN-THU 08:00-16:00'] },
        userId: guardUser.id,
      }),
      upsertStaff({
        fullName: 'Nadia Youssef',
        phone: '01020000004',
        nationalId: '29202022345678',
        profession: 'Cleaner',
        jobTitle: 'Cleaning Supervisor',
        status: CompoundStaffStatus.SUSPENDED,
        isActive: true,
        contractTo: expired,
        workSchedule: { timezone: 'Africa/Cairo', shifts: ['SUN-THU 09:00-17:00'] },
      }),
      upsertStaff({
        fullName: 'Ibrahim Adel',
        phone: '01020000005',
        nationalId: '29103033456789',
        profession: 'Reception',
        jobTitle: 'Lobby Receptionist',
        status: CompoundStaffStatus.INACTIVE,
        isActive: false,
        contractTo: null,
      }),
    ]);

    await prisma.compoundStaffAccess.createMany({
      data: [
        {
          staffId: staffActive.id,
          permission: CompoundStaffPermission.ENTRY_EXIT,
          isGranted: true,
          grantedById: manager.id,
        },
        {
          staffId: staffActive.id,
          permission: CompoundStaffPermission.ATTENDANCE,
          isGranted: true,
          grantedById: manager.id,
        },
        {
          staffId: staffActive.id,
          permission: CompoundStaffPermission.WORK_ORDERS,
          isGranted: true,
          grantedById: manager.id,
        },
        {
          staffId: staffSuspended.id,
          permission: CompoundStaffPermission.ATTENDANCE,
          isGranted: true,
          grantedById: manager.id,
        },
      ],
      skipDuplicates: true,
    });

    await prisma.compoundStaffSchedule.createMany({
      data: [
        {
          staffId: staffActive.id,
          dayOfWeek: 'SUNDAY',
          startTime: '08:00',
          endTime: '16:00',
          notes: 'Morning shift',
          isActive: true,
        },
        {
          staffId: staffActive.id,
          dayOfWeek: 'MONDAY',
          startTime: '08:00',
          endTime: '16:00',
          notes: 'Morning shift',
          isActive: true,
        },
        {
          staffId: staffSuspended.id,
          dayOfWeek: 'TUESDAY',
          startTime: '09:00',
          endTime: '17:00',
          notes: 'Cleaning rounds',
          isActive: true,
        },
      ],
      skipDuplicates: true,
    });

    await prisma.compoundStaffGateAccess.createMany({
      data: [
        {
          staffId: staffActive.id,
          gateId: mainGate.id,
          directions: [GateDirection.ENTRY, GateDirection.EXIT],
          isActive: true,
          grantedById: manager.id,
        },
        {
          staffId: staffActive.id,
          gateId: serviceGate.id,
          directions: [GateDirection.ENTRY, GateDirection.EXIT],
          isActive: true,
          grantedById: manager.id,
        },
      ],
      skipDuplicates: true,
    });

    await prisma.compoundStaffActivityLog.deleteMany({
      where: { staffId: { in: [staffActive.id, staffSuspended.id, staffInactive.id] } },
    });
    await prisma.compoundStaffActivityLog.createMany({
      data: [
        {
          staffId: staffActive.id,
          actorUserId: manager.id,
          action: 'STAFF_CREATED',
          metadata: { source: 'seed-fast', note: 'Active and expiring soon' },
        },
        {
          staffId: staffSuspended.id,
          actorUserId: manager.id,
          action: 'STATUS_CHANGED_TO_SUSPENDED',
          metadata: { source: 'seed-fast', note: 'Expired contract' },
        },
        {
          staffId: staffInactive.id,
          actorUserId: manager.id,
          action: 'STAFF_ARCHIVED',
          metadata: { source: 'seed-fast', note: 'Inactive staff' },
        },
      ],
    });

    const existingDraftSurvey = await prisma.survey.findFirst({
      where: {
        title: 'Maintenance Feedback Draft',
        createdById: manager.id,
      },
      select: { id: true },
    });
    if (!existingDraftSurvey) {
      await prisma.survey.create({
        data: {
          title: 'Maintenance Feedback Draft',
          description: 'Draft survey for next maintenance cycle.',
          targetType: 'ALL',
          status: 'DRAFT',
          createdById: manager.id,
          questions: {
            create: [
              {
                text: 'What maintenance issue should be prioritized next?',
                type: 'TEXT',
                required: true,
                displayOrder: 0,
              },
            ],
          },
        },
      });
    }

    const existingActiveSurvey = await prisma.survey.findFirst({
      where: {
        title: 'Community Satisfaction Pulse',
        createdById: manager.id,
      },
      select: { id: true },
    });
    if (!existingActiveSurvey) {
      const activeSurvey = await prisma.survey.create({
        data: {
          title: 'Community Satisfaction Pulse',
          description: 'Quarterly pulse check for delivered units.',
          targetType: 'SPECIFIC_UNITS',
          targetMeta: { unitIds: [unitA.id, unitB.id] },
          status: 'ACTIVE',
          publishedAt: new Date(),
          createdById: manager.id,
          questions: {
            create: [
              {
                text: 'How satisfied are you with community cleanliness?',
                type: 'RATING',
                required: true,
                displayOrder: 0,
              },
              {
                text: 'Would you recommend the community to a friend?',
                type: 'YES_NO',
                required: true,
                displayOrder: 1,
              },
              {
                text: 'Which service should improve first?',
                type: 'MULTIPLE_CHOICE',
                options: { choices: ['Security', 'Landscaping', 'Parking'] },
                required: true,
                displayOrder: 2,
              },
              {
                text: 'Any additional comments?',
                type: 'TEXT',
                required: false,
                displayOrder: 3,
              },
            ],
          },
        },
        include: {
          questions: {
            orderBy: { displayOrder: 'asc' },
          },
        },
      });

      const byOrder = activeSurvey.questions;
      await prisma.surveyResponse.create({
        data: {
          surveyId: activeSurvey.id,
          userId: residentAUser.id,
          answers: {
            create: [
              {
                questionId: byOrder[0].id,
                valueNumber: 4,
              },
              {
                questionId: byOrder[1].id,
                valueText: 'YES',
              },
              {
                questionId: byOrder[2].id,
                valueChoice: 'Security',
              },
              {
                questionId: byOrder[3].id,
                valueText: 'Great progress this quarter.',
              },
            ],
          },
        },
      });
    }

    const restaurant = await prisma.restaurant.upsert({
      where: { id: 'seed-restaurant-palm-bites' },
      update: {
        name: 'Palm Bites',
        description: 'Neighborhood favorites delivered fast.',
        category: 'Egyptian',
        isActive: true,
      },
      create: {
        id: 'seed-restaurant-palm-bites',
        name: 'Palm Bites',
        description: 'Neighborhood favorites delivered fast.',
        category: 'Egyptian',
        isActive: true,
        displayOrder: 1,
      },
    });

    const [menuItemA, menuItemB] = await Promise.all([
      prisma.menuItem.upsert({
        where: { id: 'seed-menu-koshari' },
        update: {
          restaurantId: restaurant.id,
          name: 'Koshari Bowl',
          category: 'Mains',
          price: new Prisma.Decimal('85.00'),
          isAvailable: true,
          displayOrder: 1,
        },
        create: {
          id: 'seed-menu-koshari',
          restaurantId: restaurant.id,
          name: 'Koshari Bowl',
          description: 'Classic Egyptian koshari with special sauce.',
          category: 'Mains',
          price: new Prisma.Decimal('85.00'),
          isAvailable: true,
          displayOrder: 1,
        },
      }),
      prisma.menuItem.upsert({
        where: { id: 'seed-menu-wrap' },
        update: {
          restaurantId: restaurant.id,
          name: 'Chicken Shawarma Wrap',
          category: 'Sandwiches',
          price: new Prisma.Decimal('70.00'),
          isAvailable: true,
          displayOrder: 2,
        },
        create: {
          id: 'seed-menu-wrap',
          restaurantId: restaurant.id,
          name: 'Chicken Shawarma Wrap',
          description: 'Grilled chicken with garlic sauce and pickles.',
          category: 'Sandwiches',
          price: new Prisma.Decimal('70.00'),
          isAvailable: true,
          displayOrder: 2,
        },
      }),
    ]);

    const existingOrder = await prisma.order.findUnique({
      where: { orderNumber: 'ORD-SEED-0001' },
      select: { id: true },
    });
    if (!existingOrder) {
      const itemOneSubtotal = new Prisma.Decimal('85.00').mul(2);
      const itemTwoSubtotal = new Prisma.Decimal('70.00').mul(1);
      const totalAmount = itemOneSubtotal.add(itemTwoSubtotal);

      await prisma.order.create({
        data: {
          orderNumber: 'ORD-SEED-0001',
          userId: residentAUser.id,
          unitId: unitA.id,
          restaurantId: restaurant.id,
          status: 'CONFIRMED',
          confirmedAt: new Date(),
          totalAmount,
          notes: 'No onions please',
          items: {
            create: [
              {
                menuItemId: menuItemA.id,
                quantity: 2,
                unitPrice: new Prisma.Decimal('85.00'),
                subtotal: itemOneSubtotal,
              },
              {
                menuItemId: menuItemB.id,
                quantity: 1,
                unitPrice: new Prisma.Decimal('70.00'),
                subtotal: itemTwoSubtotal,
              },
            ],
          },
        },
      });
    }

    console.log('Fast seed complete.');
    console.log('- Super Admin: test@admin.com / pass123');
    console.log('- Manager: manager@test.com / pass123');
    console.log('- Community: Alkarma Heights Community (2 phases, 2 clusters, 3 gates)');
    console.log('- Compound Staff: active expiring soon + suspended expired + inactive');
  } finally {
    await prisma.$queryRaw`SELECT pg_advisory_unlock(885122009)`;
  }
}

main()
  .then(() => {
    process.exitCode = 0;
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await Promise.race([
        prisma.$disconnect(),
        new Promise((resolve) => setTimeout(resolve, 1000)),
      ]);
    } finally {
      process.exit(process.exitCode ?? 0);
    }
  });

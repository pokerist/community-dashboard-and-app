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

    await prisma.permission.createMany({
      data: PERMISSIONS.map((key) => ({ key })),
      skipDuplicates: true,
    });

    const roleNames = Object.keys(ROLES);
    await prisma.role.createMany({
      data: roleNames.map((name) => ({ name })),
      skipDuplicates: true,
    });

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

    const passwordHash = DEV_PASSWORD_HASH;

    const superAdminRoleId = roleIdByName.get('SUPER_ADMIN');
    const managerRoleId = roleIdByName.get('MANAGER');
    const communityRoleId = roleIdByName.get('COMMUNITY_USER');
    if (!superAdminRoleId || !managerRoleId || !communityRoleId) {
      throw new Error('Missing core role IDs');
    }

    await prisma.user.upsert({
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

    const residentialCluster = await prisma.cluster.upsert({
      where: {
        communityId_name: {
          communityId: community.id,
          name: 'Residential Core',
        },
      },
      update: { displayOrder: 1, isActive: true },
      create: {
        communityId: community.id,
        name: 'Residential Core',
        displayOrder: 1,
        isActive: true,
      },
    });
    const retailCluster = await prisma.cluster.upsert({
      where: {
        communityId_name: {
          communityId: community.id,
          name: 'Retail Strip',
        },
      },
      update: { displayOrder: 2, isActive: true },
      create: {
        communityId: community.id,
        name: 'Retail Strip',
        displayOrder: 2,
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

    const [unitA, unitB, unitC] = await Promise.all([
      upsertUnit(community.id, 'A', '101', {
        clusterId: residentialCluster.id,
        bedrooms: 2,
        bathrooms: 1,
        sizeSqm: 120,
      }),
      upsertUnit(community.id, 'B', '202', {
        clusterId: null, // edge case: unit with no cluster
        bedrooms: 3,
        bathrooms: 2,
        sizeSqm: 160,
      }),
      upsertUnit(community.id, 'R', '015', {
        clusterId: retailCluster.id,
        bedrooms: 0,
        bathrooms: 1,
        sizeSqm: 95,
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

    console.log('Fast seed complete.');
    console.log('- Super Admin: test@admin.com / pass123');
    console.log('- Manager: manager@test.com / pass123');
    console.log('- Community: Alkarma Heights Community (3 gates, 2 clusters)');
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

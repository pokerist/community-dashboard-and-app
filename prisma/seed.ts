import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const PERMISSIONS = [
  // Authentication
  'auth.login',
  'auth.refresh',
  'auth.logout',
  'auth.impersonate',

  // Registrations
  'pending_registration.create',
  'pending_registration.view_all',
  'pending_registration.view_own',
  'pending_registration.update',
  'pending_registration.reject',
  'pending_registration.approve',

  // Users
  'user.read',
  'user.update',
  'user.delete',
  'user.create',
  'user.create.direct', // Special permission to create users without going through pending registration

  // Residents
  'resident.view',
  'resident.create',
  'resident.update',
  'resident.delete',

  // Owners
  'owner.create',
  'owner.view',
  'owner.update',
  'owner.delete',

  // Tenants
  'tenant.create',
  'tenant.view',
  'tenant.update',
  'tenant.delete',

  // Admins
  'admin.create',
  'admin.view',
  'admin.update',
  'admin.delete',
  'admin.assign_role',

  // Units
  'unit.view_all',
  'unit.view_own',
  'unit.create',
  'unit.update',
  'unit.delete',
  'unit.assign_resident',
  'unit.remove_resident_from_unit',
  'unit.view_assigned_residents',
  'unit.update_status',
  'unit.view_leases',

  // Projects
  'project.view',
  'project.manage',

  // Invoices
  'invoice.generate',
  'invoice.view_all',
  'invoice.view_own',
  'invoice.create',
  'invoice.update',
  'invoice.mark_paid',
  'invoice.cancel',

  // Fees
  'unit_fee.view_all',
  'unit_fee.view_own',
  'unit_fee.create',
  'unit_fee.update',
  'unit_fee.delete',
  'fee.manage',

  // Services
  'service.create',
  'service.read',
  'service.update',
  'service.delete',

  // Service Fields
  'service_field.create',
  'service_field.read',
  'service_field.update',
  'service_field.delete',

  // Service Requests
  'service_request.view_all',
  'service_request.view_own',
  'service_request.create',
  'service_request.assign',
  'service_request.resolve',
  'service_request.close',

  // Complaints
  'complaint.report',
  'complaint.view_own',
  'complaint.update_own',
  'complaint.delete_own',
  'complaint.view_all',
  'complaint.manage',
  'complaint.delete_all',
  'complaint.assign',
  'complaint.manage_status',

  // Violations
  'violation.issue',
  'violation.view_all',
  'violation.view_own',
  'violation.update',
  'violation.cancel',

  // QR Codes
  'qr.generate',
  'qr.view_all',
  'qr.view_own',
  'qr.cancel',

  // Facilities
  'facility.create',
  'facility.view_all',
  'facility.view_own',
  'facility.update',
  'facility.delete',

  // Bookings
  'booking.view_all',
  'booking.view_own',
  'booking.create',
  'booking.update',
  'booking.view_by_facility',
  'booking.cancel_own',
  'booking.delete',

  // Smart Devices
  'smart_device.manage',
  'smart_device.view_own',

  // Notifications
  'notification.create',
  'notification.view_own',
  'notification.view_all',
  'notification.manage',

  // Banners
  'banner.manage',
  'banner.view',

  // Incidents
  'incidents.create',
  'incidents.view',
  'incidents.resolve',

  // Referrals
  'referral.create',
  'referral.view_all',
];

const ROLES = {
  SUPER_ADMIN: PERMISSIONS,

  MANAGER: [
    // Users / Admins / Residents
    'user.read',
    'user.update',
    'resident.view',
    'resident.create',
    'resident.update',

    'owner.create',
    'owner.view',
    'owner.update',

    'admin.view',
    'admin.update',
    'admin.assign_role',

    // Units / Projects
    'unit.view_all',
    'unit.create',
    'unit.update',
    'unit.assign_resident',
    'unit.remove_resident_from_unit',
    'unit.view_assigned_residents',
    'unit.update_status',
    'unit.view_leases',

    'project.view',
    'project.manage',

    // Invoices / Fees
    'invoice.view_all',
    'invoice.create',
    'invoice.update',
    'invoice.mark_paid',

    'unit_fee.view_all',
    'unit_fee.create',
    'unit_fee.update',
    'unit_fee.delete',
    'fee.manage',

    // Services / Requests
    'service.create',
    'service.read',
    'service.update',
    'service.delete',
    'service_request.view_all',
    'service_request.assign',
    'service_request.resolve',

    // Complaints / Violations
    'complaint.view_all',
    'complaint.manage',
    'complaint.assign',
    'complaint.manage_status',

    'violation.issue',
    'violation.view_all',
    'violation.update',

    // QR Codes / Facilities / Bookings
    'qr.view_all',
    'qr.cancel',

    'facility.create',
    'facility.view_all',
    'facility.update',
    'facility.delete',

    'booking.view_all',

    'banner.manage',

    // Notifications / Incidents / Referrals
    'notification.create',
    'notification.view_all',
    'notification.manage',

    'incidents.view',
    'incidents.resolve',

    'referral.view_all',
  ],

  OPERATOR: [
    // Services / Requests
    'service_request.view_all',
    'service_request.assign',
    'service_request.resolve',

    // Complaints / Violations
    'complaint.view_all',
    'complaint.manage',
    'violation.issue',

    // QR Codes / Bookings
    'qr.view_all',
    'booking.view_all',

    // Incidents
    'incidents.view',
    'incidents.resolve',
  ],

  SUPPORT: [
    // Service Requests / Complaints
    'service_request.view_all',

    'complaint.view_all',
    'complaint.manage',

    // QR Codes / Bookings
    'qr.view_all',

    // Incidents
    'incidents.view',
  ],

  COMMUNITY_USER: [
    // Units / Projects
    'unit.view_own',
    'project.view',

    'banner.view',
    'facility.view_own',

    // Invoices / Services
    'invoice.view_own',
    'service.read',
    'service_field.read',
    'service_request.view_own',
    'service_request.create',

    // Complaints / Violations
    'complaint.view_own',
    'complaint.report',
    'violation.view_own',

    // QR Codes / Bookings
    'qr.generate',
    'qr.view_own',
    'qr.cancel',

    'booking.view_own',
    'booking.create',
    'booking.cancel_own',

    // Smart Devices / Referrals
    'smart_device.view_own',
    'referral.create',

    // Notifications
    'notification.view_own',
  ],
} as const;

async function seed() {
  console.log('🌱 Seeding permissions...');

  for (const key of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key },
      update: {},
      create: { key },
    });
  }

  console.log('🌱 Seeding roles & mappings...');

  for (const [roleName, permissionKeys] of Object.entries(ROLES)) {
    const role = await prisma.role.upsert({
      where: { name: roleName },
      update: {},
      create: { name: roleName },
    });

    for (const key of permissionKeys) {
      const permission = await prisma.permission.findUnique({
        where: { key },
      });

      if (!permission) {
        throw new Error(`Missing permission: ${key}`);
      }

      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: role.id,
            permissionId: permission.id,
          },
        },
        update: {},
        create: {
          roleId: role.id,
          permissionId: permission.id,
        },
      });
    }
  }

  console.log('🌱 Seeding users...');

  const passwordHash = await bcrypt.hash('pass123', 12);

  const superAdminRole = await prisma.role.findUnique({
    where: { name: 'SUPER_ADMIN' },
  });

  const managerRole = await prisma.role.findUnique({
    where: { name: 'MANAGER' },
  });

  const communityRole = await prisma.role.findUnique({
    where: { name: 'COMMUNITY_USER' },
  });

  if (!superAdminRole || !managerRole || !communityRole) {
    throw new Error('Required roles missing');
  }

  // SUPER ADMIN
  const superAdmin = await prisma.user.upsert({
    where: { email: 'test@admin.com' },
    update: {},
    create: {
      email: 'test@admin.com',
      passwordHash,
      nameEN: 'Super Admin',
      roles: {
        create: [{ roleId: superAdminRole.id }],
      },
      admin: { create: {} },
    },
  });

  // MANAGER
  const manager = await prisma.user.create({
    data: {
      email: 'manager@test.com',
      passwordHash,
      nameEN: 'Manager One',
      roles: {
        create: [{ roleId: managerRole.id }],
      },
      admin: { create: {} },
    },
  });

  // RESIDENT A
  const residentAUser = await prisma.user.create({
    data: {
      email: 'residentA@test.com',
      passwordHash,
      nameEN: 'Resident A',
      roles: {
        create: [{ roleId: communityRole.id }],
      },
      resident: { create: {} },
    },
  });

  const residentA = await prisma.resident.findUnique({
    where: { userId: residentAUser.id },
  });

  // RESIDENT B
  const residentBUser = await prisma.user.create({
    data: {
      email: 'residentB@test.com',
      passwordHash,
      nameEN: 'Resident B',
      roles: {
        create: [{ roleId: communityRole.id }],
      },
      resident: { create: {} },
    },
  });

  const residentB = await prisma.resident.findUnique({
    where: { userId: residentBUser.id },
  });

  console.log('🌱 Seeding units...');

  const unitA = await prisma.unit.create({
    data: {
      projectName: 'Alkarma Heights',
      block: 'A',
      unitNumber: '101',
      type: 'APARTMENT',
      bedrooms: 2,
      bathrooms: 1,
      sizeSqm: 120,
    },
  });

  const unitB = await prisma.unit.create({
    data: {
      projectName: 'Alkarma Heights',
      block: 'B',
      unitNumber: '202',
      type: 'APARTMENT',
      bedrooms: 3,
      bathrooms: 2,
      sizeSqm: 160,
    },
  });

  console.log('🌱 Assigning residents to units...');

  if (!residentA || !residentB) {
    throw new Error('Failed to create residents');
  }

  await prisma.residentUnit.create({
    data: {
      residentId: residentA.id,
      unitId: unitA.id,
      isPrimary: true,
    },
  });

  await prisma.residentUnit.create({
    data: {
      residentId: residentB.id,
      unitId: unitB.id,
      isPrimary: true,
    },
  });

  // Create an initial super admin user for testing
  // const adminEmail = 'test@admin.com';
  // const existingAdmin = await prisma.user.findUnique({
  //   where: { email: adminEmail },
  // });

  // if (!existingAdmin) {
  //   const bcrypt = require('bcrypt');
  //   const hashedPassword = await bcrypt.hash('Admin@123', 12);
  //   const superAdminRole = await prisma.role.findUnique({
  //     where: { name: 'SUPER_ADMIN' },
  //   });
  //   const adminUser = await prisma.user.create({
  //     data: {
  //       email: adminEmail,
  //       passwordHash: hashedPassword,
  //       nameEN: 'Super Admin',
  //       roles: {
  //         connect: [{ id: superAdminRole!.id }],
  //       },
  //     },
  //   });

  //   console.log(
  //     `🌱 Created initial super admin user: ${adminEmail} / Admin@123`,
  //   );
  // } else {
  //   console.log(`🌱 Super admin user already exists: ${adminEmail}`);
  // }

  console.log('✅ Seeding complete');
  console.log('✅ Seed summary:');
  console.log('- Super Admin: test@admin.com / pass123');
  console.log('- Manager: manager@test.com / pass123');
  console.log('- Resident A: residentA@test.com / pass123 → Unit A');
  console.log('- Resident B: residentB@test.com / pass123 → Unit B');
}

seed()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

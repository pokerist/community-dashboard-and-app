/**
 * Standalone Permission Seeder Script
 *
 * Seeds all permissions to the database and maps them to roles.
 * Safe to run multiple times — uses upsert logic.
 *
 * Usage:
 *   npx ts-node prisma/seed-permissions.ts
 *   # or
 *   npx tsx prisma/seed-permissions.ts
 */

import { PrismaClient } from '@prisma/client';

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
  'user.create.direct',

  // Residents
  'resident.view',
  'resident.create',
  'resident.update',
  'resident.delete',
  'resident.view_full_profile',
  'resident.update_full_profile',
  'resident.view_documents',
  'resident.view_household_tree',

  // Owners
  'owner.create',
  'owner.view',
  'owner.update',
  'owner.delete',
  'owner.manage_profile',
  'owner.manage_family',

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
  'unit.transfer_ownership',

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

  // Commercial
  'commercial.view_all',
  'commercial.create',
  'commercial.update',
  'commercial.delete',

  // Compound Staff
  'compound_staff.view_all',
  'compound_staff.create',
  'compound_staff.update',
  'compound_staff.delete',

  // Blue Collar
  'blue_collar.view_all',
  'blue_collar.settings.update',
  'blue_collar.request.create',
  'blue_collar.request.review',

  // Gates
  'gate.view_all',
  'gate.create',
  'gate.update',
  'gate.delete',
  'gate.logs.view',

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
  'referral.validate',

  // Dashboard
  'dashboard.view',

  // Reports
  'report.view_all',
  'report.generate',
  'report.manage_schedules',

  // Leases
  'lease.view_all',
  'lease.view_own',
  'lease.create',
  'lease.update',
  'lease.delete',
  'lease.add_tenant',
  'lease.terminate',

  // Delegates
  'delegate.view_all',
  'delegate.view_own',
  'delegate.create',
  'delegate.approve',
  'delegate.revoke',
  'delegate.update',
  'delegate.delete',

  // Clubhouse
  'clubhouse.request',
  'clubhouse.approve',
  'clubhouse.reject',
  'clubhouse.view_all',
  'clubhouse.view_own',

  // Household
  'household.create_request',
  'household.view_own',
  'household.view_all',
  'household.review',

  // Surveys
  'survey.view_all',
  'survey.view_own',
  'survey.create',
  'survey.update',
  'survey.delete',
  'survey.publish',
  'survey.close',
  'survey.respond',

  // Restaurants
  'restaurant.view_all',
  'restaurant.view_own',
  'restaurant.create',
  'restaurant.update',
  'restaurant.delete',

  // Orders
  'order.view_all',
  'order.view_own',
  'order.update_status',
  'order.cancel',

  // Hospitality
  'hospitality.view',

  // Resident Vehicles
  'vehicle.view_own',
  'vehicle.create',
  'vehicle.update',
  'vehicle.delete',

  // Workers
  'worker.view_all',
  'worker.view_own',
  'worker.create',
  'worker.update',
  'worker.generate_qr',

  // Contractors
  'contractor.view_all',
  'contractor.view_own',
  'contractor.create',
];

const ROLE_PERMISSIONS: Record<string, string[]> = {
  SUPER_ADMIN: PERMISSIONS, // All permissions

  MANAGER: [
    'user.read', 'user.update',
    'resident.view', 'resident.create', 'resident.update',
    'resident.view_full_profile', 'resident.update_full_profile',
    'resident.view_documents', 'resident.view_household_tree',
    'owner.create', 'owner.view', 'owner.update',
    'admin.view', 'admin.update', 'admin.assign_role',
    'unit.view_all', 'unit.create', 'unit.update',
    'unit.assign_resident', 'unit.remove_resident_from_unit',
    'unit.view_assigned_residents', 'unit.update_status',
    'unit.view_leases', 'unit.transfer_ownership',
    'project.view', 'project.manage',
    'invoice.view_all', 'invoice.create', 'invoice.update', 'invoice.mark_paid',
    'unit_fee.view_all', 'unit_fee.create', 'unit_fee.update', 'unit_fee.delete', 'fee.manage',
    'service.create', 'service.read', 'service.update', 'service.delete',
    'service_request.view_all', 'service_request.assign', 'service_request.resolve',
    'complaint.view_all', 'complaint.manage', 'complaint.assign', 'complaint.manage_status',
    'violation.issue', 'violation.view_all', 'violation.update',
    'qr.view_all', 'qr.cancel',
    'facility.create', 'facility.view_all', 'facility.update', 'facility.delete',
    'booking.view_all',
    'banner.manage',
    'notification.create', 'notification.view_all', 'notification.manage',
    'commercial.view_all', 'commercial.create', 'commercial.update',
    'compound_staff.view_all', 'compound_staff.create', 'compound_staff.update',
    'blue_collar.view_all', 'blue_collar.settings.update', 'blue_collar.request.create', 'blue_collar.request.review',
    'gate.view_all', 'gate.create', 'gate.update', 'gate.logs.view',
    'incidents.view', 'incidents.resolve',
    'referral.view_all', 'referral.validate',
    'dashboard.view',
    'report.view_all', 'report.generate', 'report.manage_schedules',
    'lease.view_all', 'lease.create', 'lease.update', 'lease.delete', 'lease.add_tenant', 'lease.terminate',
    'delegate.view_all', 'delegate.approve', 'delegate.revoke', 'delegate.update', 'delegate.delete',
    'clubhouse.approve', 'clubhouse.reject', 'clubhouse.view_all',
    'household.view_all', 'household.review',
    'survey.view_all', 'survey.create', 'survey.update', 'survey.delete', 'survey.publish', 'survey.close',
    'restaurant.view_all', 'restaurant.create', 'restaurant.update', 'restaurant.delete',
    'order.view_all', 'order.update_status', 'order.cancel',
    'hospitality.view',
    'worker.view_all', 'worker.create', 'worker.update', 'worker.generate_qr',
    'contractor.view_all', 'contractor.create',
  ],

  OPERATOR: [
    'service_request.view_all', 'service_request.assign', 'service_request.resolve',
    'complaint.view_all', 'complaint.manage',
    'violation.issue',
    'qr.view_all',
    'booking.view_all',
    'incidents.view', 'incidents.resolve',
    'survey.view_all',
    'order.view_all', 'order.update_status',
    'worker.view_all',
    'lease.view_all',
    'household.view_all', 'household.review',
  ],

  SUPPORT: [
    'service_request.view_all',
    'complaint.view_all', 'complaint.manage',
    'qr.view_all',
    'incidents.view',
    'survey.view_all',
    'order.view_all',
  ],

  COMMUNITY_USER: [
    'unit.view_own', 'project.view',
    'banner.view', 'facility.view_own',
    'invoice.view_own',
    'service.read', 'service_field.read',
    'service_request.view_own', 'service_request.create',
    'complaint.view_own', 'complaint.report', 'complaint.delete_own',
    'violation.view_own',
    'qr.generate', 'qr.view_own', 'qr.cancel',
    'booking.view_own', 'booking.create', 'booking.cancel_own',
    'smart_device.view_own',
    'referral.create',
    'notification.view_own',
    'lease.view_own',
    'delegate.create', 'delegate.view_own',
    'clubhouse.request', 'clubhouse.view_own',
    'household.create_request', 'household.view_own',
    'survey.view_own', 'survey.respond',
    'restaurant.view_own',
    'order.view_own',
    'hospitality.view',
    'vehicle.view_own', 'vehicle.create', 'vehicle.update', 'vehicle.delete',
    'worker.view_own', 'worker.create', 'worker.update', 'worker.generate_qr',
    'contractor.view_own', 'contractor.create',
    'owner.manage_profile', 'owner.manage_family',
  ],
};

async function seedPermissions() {
  console.log('Seeding permissions...');

  // 1. Upsert all permissions
  let created = 0;
  let existing = 0;
  for (const key of PERMISSIONS) {
    const result = await prisma.permission.upsert({
      where: { key },
      update: {},
      create: { key },
    });
    if (result) {
      // Check if it was newly created by looking if it was just now
      existing++;
    }
  }
  console.log(`  Processed ${PERMISSIONS.length} permissions`);

  // 2. Build permission key → id map
  const allPermissions = await prisma.permission.findMany();
  const permissionMap = new Map(allPermissions.map((p) => [p.key, p.id]));

  // 3. Upsert roles and assign permissions
  for (const [roleName, rolePermKeys] of Object.entries(ROLE_PERMISSIONS)) {
    // Upsert the role
    const role = await prisma.role.upsert({
      where: { name: roleName },
      update: {},
      create: { name: roleName },
    });

    // Resolve permission IDs for this role
    const permissionIds: string[] = [];
    for (const key of rolePermKeys) {
      const id = permissionMap.get(key);
      if (!id) {
        console.warn(`  WARNING: Permission "${key}" for role "${roleName}" not found in DB`);
        continue;
      }
      permissionIds.push(id);
    }

    // Clear existing role-permission mappings and re-create
    await prisma.rolePermission.deleteMany({
      where: { roleId: role.id },
    });

    if (permissionIds.length > 0) {
      await prisma.rolePermission.createMany({
        data: permissionIds.map((permissionId) => ({
          roleId: role.id,
          permissionId,
        })),
        skipDuplicates: true,
      });
    }

    console.log(`  Role "${roleName}": ${permissionIds.length} permissions assigned`);
  }

  // 4. Summary
  const totalPermissions = await prisma.permission.count();
  const totalRoles = await prisma.role.count();
  const totalMappings = await prisma.rolePermission.count();

  console.log('\nSeed complete:');
  console.log(`  Total permissions: ${totalPermissions}`);
  console.log(`  Total roles: ${totalRoles}`);
  console.log(`  Total role-permission mappings: ${totalMappings}`);
}

seedPermissions()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

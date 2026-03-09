import {
  CommercialEntityMemberRole,
  CompoundStaffPermission,
  CompoundStaffStatus,
  EntityStatus,
  GateAccessRole,
  GateDirection,
  InvoiceType,
  PermitCategory,
  Prisma,
  PrismaClient,
  ServiceFieldType,
} from '@prisma/client';
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
  'resident.view_full_profile',
  'resident.update_full_profile',
  'resident.view_documents',
  'resident.view_household_tree',

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

  // Owner Self-Service
  'owner.manage_profile',
  'owner.manage_family',
];

const DEFAULT_INVOICE_CATEGORY_LABELS: Record<InvoiceType, string> = {
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

const DEFAULT_INVOICE_CATEGORY_COLORS: Record<InvoiceType, string> = {
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

const ROLES = {
  SUPER_ADMIN: PERMISSIONS,

  MANAGER: [
    // Users / Admins / Residents
    'user.read',
    'user.update',
    'resident.view',
    'resident.create',
    'resident.update',
    'resident.view_full_profile',
    'resident.update_full_profile',
    'resident.view_documents',
    'resident.view_household_tree',

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
    'unit.transfer_ownership',

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

    // Commercial
    'commercial.view_all',
    'commercial.create',
    'commercial.update',

    // Compound Staff
    'compound_staff.view_all',
    'compound_staff.create',
    'compound_staff.update',

    // Blue Collar
    'blue_collar.view_all',
    'blue_collar.settings.update',
    'blue_collar.request.create',
    'blue_collar.request.review',

    // Gates
    'gate.view_all',
    'gate.create',
    'gate.update',
    'gate.logs.view',

    'incidents.view',
    'incidents.resolve',

    'referral.view_all',
    'referral.validate',

    // Dashboard / Reports
    'dashboard.view',
    'report.view_all',
    'report.generate',
    'report.manage_schedules',

    // Leases
    'lease.view_all',
    'lease.create',
    'lease.update',
    'lease.delete',
    'lease.add_tenant',
    'lease.terminate',

    // Delegates
    'delegate.view_all',
    'delegate.approve',
    'delegate.revoke',
    'delegate.update',
    'delegate.delete',

    // Clubhouse
    'clubhouse.approve',
    'clubhouse.reject',
    'clubhouse.view_all',

    // Household
    'household.view_all',
    'household.review',

    // Surveys
    'survey.view_all',
    'survey.create',
    'survey.update',
    'survey.delete',
    'survey.publish',
    'survey.close',

    // Restaurants / Orders
    'restaurant.view_all',
    'restaurant.create',
    'restaurant.update',
    'restaurant.delete',
    'order.view_all',
    'order.update_status',
    'order.cancel',

    // Hospitality
    'hospitality.view',

    // Workers / Contractors
    'worker.view_all',
    'worker.create',
    'worker.update',
    'worker.generate_qr',
    'contractor.view_all',
    'contractor.create',
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

    // Surveys (view only)
    'survey.view_all',

    // Orders (view + update status)
    'order.view_all',
    'order.update_status',

    // Workers
    'worker.view_all',

    // Leases (view)
    'lease.view_all',

    // Household
    'household.view_all',
    'household.review',
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

    // Surveys (view only)
    'survey.view_all',

    // Orders (view only)
    'order.view_all',
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
    'complaint.delete_own',
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

    // Leases (view own)
    'lease.view_own',

    // Delegates (create/view own)
    'delegate.create',
    'delegate.view_own',

    // Clubhouse (request/view own)
    'clubhouse.request',
    'clubhouse.view_own',

    // Household (create/view own)
    'household.create_request',
    'household.view_own',

    // Surveys (view/respond)
    'survey.view_own',
    'survey.respond',

    // Restaurants/Orders (view own)
    'restaurant.view_own',
    'order.view_own',

    // Hospitality
    'hospitality.view',

    // Vehicles (self-service)
    'vehicle.view_own',
    'vehicle.create',
    'vehicle.update',
    'vehicle.delete',

    // Workers (delegate creates workers for their units)
    'worker.view_own',
    'worker.create',
    'worker.update',
    'worker.generate_qr',
    'contractor.view_own',
    'contractor.create',

    // Owner self-service
    'owner.manage_profile',
    'owner.manage_family',
  ],
} as const;

const FAST_SEED_ENABLED = process.env.SEED_FAST !== 'false';

interface SeedCoreRoles {
  superAdminRoleId: string;
  managerRoleId: string;
  communityRoleId: string;
}

type PermitSeedField = {
  label: string;
  type: ServiceFieldType;
  required: boolean;
  placeholder?: string;
};

type PermitSeedType = {
  name: string;
  slug: string;
  category: PermitCategory;
  description?: string;
  fields: PermitSeedField[];
};

const PERMIT_TYPE_SEEDS: PermitSeedType[] = [
  {
    name: 'Update Account Info',
    slug: 'update-account-info',
    category: PermitCategory.ACCOUNT_INFO,
    fields: [
      { label: 'Field to Update', type: ServiceFieldType.TEXT, required: true },
      { label: 'New Value', type: ServiceFieldType.TEXT, required: true },
      {
        label: 'Supporting Document',
        type: ServiceFieldType.FILE,
        required: false,
      },
    ],
  },
  {
    name: 'Unit Cancellation',
    slug: 'unit-cancellation',
    category: PermitCategory.LEGAL_OWNERSHIP,
    fields: [
      {
        label: 'Reason for Cancellation',
        type: ServiceFieldType.TEXTAREA,
        required: true,
      },
      { label: 'Contract Copy', type: ServiceFieldType.FILE, required: true },
    ],
  },
  {
    name: 'Ownership Transfer',
    slug: 'ownership-transfer',
    category: PermitCategory.LEGAL_OWNERSHIP,
    fields: [
      {
        label: 'Transfer To (Full Name)',
        type: ServiceFieldType.TEXT,
        required: true,
      },
      {
        label: 'Transfer To (National ID)',
        type: ServiceFieldType.TEXT,
        required: true,
      },
      {
        label: 'Transfer Document',
        type: ServiceFieldType.FILE,
        required: true,
      },
      { label: 'Transfer Date', type: ServiceFieldType.DATE, required: true },
    ],
  },
  {
    name: 'Electricity Meter',
    slug: 'electricity-meter',
    category: PermitCategory.UTILITIES_SERVICES,
    fields: [
      { label: 'Meter Number', type: ServiceFieldType.TEXT, required: false },
      {
        label: 'Service Provider',
        type: ServiceFieldType.TEXT,
        required: true,
      },
    ],
  },
  {
    name: 'Gas Request',
    slug: 'gas-request',
    category: PermitCategory.UTILITIES_SERVICES,
    fields: [
      { label: 'Preferred Date', type: ServiceFieldType.DATE, required: true },
      { label: 'Notes', type: ServiceFieldType.TEXTAREA, required: false },
    ],
  },
  {
    name: 'Triple Play',
    slug: 'triple-play',
    category: PermitCategory.UTILITIES_SERVICES,
    fields: [
      {
        label: 'Provider Preference',
        type: ServiceFieldType.TEXT,
        required: false,
      },
      {
        label: 'Preferred Installation Date',
        type: ServiceFieldType.DATE,
        required: true,
      },
    ],
  },
  {
    name: 'Clubhouse Event',
    slug: 'clubhouse-event',
    category: PermitCategory.COMMUNITY_ACTIVITIES,
    fields: [
      { label: 'Event Name', type: ServiceFieldType.TEXT, required: true },
      { label: 'Event Date', type: ServiceFieldType.DATE, required: true },
      {
        label: 'Expected Attendees',
        type: ServiceFieldType.NUMBER,
        required: true,
      },
      {
        label: 'Event Description',
        type: ServiceFieldType.TEXTAREA,
        required: false,
      },
    ],
  },
  {
    name: 'Furniture Move',
    slug: 'furniture-move',
    category: PermitCategory.OPERATIONAL,
    fields: [
      { label: 'Move Date', type: ServiceFieldType.DATE, required: true },
      {
        label: 'Move Direction',
        type: ServiceFieldType.TEXT,
        required: true,
        placeholder: 'Moving in / Moving out',
      },
      {
        label: 'Truck Plate Number',
        type: ServiceFieldType.TEXT,
        required: false,
      },
    ],
  },
  {
    name: 'Worker Permit',
    slug: 'worker-permit',
    category: PermitCategory.OPERATIONAL,
    fields: [
      { label: 'Worker Name', type: ServiceFieldType.TEXT, required: true },
      {
        label: 'Worker National ID',
        type: ServiceFieldType.TEXT,
        required: true,
      },
      { label: 'Work Type', type: ServiceFieldType.TEXT, required: true },
      { label: 'Start Date', type: ServiceFieldType.DATE, required: true },
      { label: 'End Date', type: ServiceFieldType.DATE, required: true },
      {
        label: 'Worker ID Photo',
        type: ServiceFieldType.FILE,
        required: true,
      },
    ],
  },
  {
    name: 'Parking Sticker',
    slug: 'parking-sticker',
    category: PermitCategory.OPERATIONAL,
    fields: [
      {
        label: 'Vehicle Plate Number',
        type: ServiceFieldType.TEXT,
        required: true,
      },
      { label: 'Vehicle Model', type: ServiceFieldType.TEXT, required: true },
      { label: 'Vehicle Color', type: ServiceFieldType.TEXT, required: true },
    ],
  },
];

async function seedPermitCatalog(): Promise<void> {
  for (const [index, permitType] of PERMIT_TYPE_SEEDS.entries()) {
    const type = await prisma.permitType.upsert({
      where: { slug: permitType.slug },
      update: {
        name: permitType.name,
        category: permitType.category,
        description: permitType.description ?? null,
        isActive: true,
        displayOrder: index + 1,
      },
      create: {
        name: permitType.name,
        slug: permitType.slug,
        category: permitType.category,
        description: permitType.description ?? null,
        isActive: true,
        displayOrder: index + 1,
      },
    });

    await prisma.permitField.deleteMany({ where: { permitTypeId: type.id } });

    await prisma.permitField.createMany({
      data: permitType.fields.map((field, fieldIndex) => ({
        permitTypeId: type.id,
        label: field.label,
        type: field.type,
        placeholder: field.placeholder ?? null,
        required: field.required,
        displayOrder: fieldIndex + 1,
      })),
      skipDuplicates: false,
    });
  }
}

async function seedFastPath(params: {
  passwordHash: string;
  roles: SeedCoreRoles;
}): Promise<void> {
  const { passwordHash, roles } = params;

  await prisma.user.upsert({
    where: { email: 'test@admin.com' },
    update: {
      passwordHash,
      nameEN: 'Super Admin',
    },
    create: {
      email: 'test@admin.com',
      passwordHash,
      nameEN: 'Super Admin',
      roles: { create: [{ roleId: roles.superAdminRoleId }] },
      admin: { create: {} },
    },
  });

  const manager = await prisma.user.upsert({
    where: { email: 'manager@test.com' },
    update: {
      passwordHash,
      nameEN: 'Manager One',
    },
    create: {
      email: 'manager@test.com',
      passwordHash,
      nameEN: 'Manager One',
    },
  });

  const residentAUser = await prisma.user.upsert({
    where: { email: 'residentA@test.com' },
    update: {
      passwordHash,
      nameEN: 'Resident A',
    },
    create: {
      email: 'residentA@test.com',
      passwordHash,
      nameEN: 'Resident A',
    },
  });

  const residentBUser = await prisma.user.upsert({
    where: { email: 'residentB@test.com' },
    update: {
      passwordHash,
      nameEN: 'Resident B',
    },
    create: {
      email: 'residentB@test.com',
      passwordHash,
      nameEN: 'Resident B',
    },
  });

  await prisma.userRole.createMany({
    data: [
      { userId: manager.id, roleId: roles.managerRoleId },
      { userId: residentAUser.id, roleId: roles.communityRoleId },
      { userId: residentBUser.id, roleId: roles.communityRoleId },
    ],
    skipDuplicates: true,
  });

  await prisma.admin.upsert({
    where: { userId: manager.id },
    update: {},
    create: { userId: manager.id },
  });

  await prisma.resident.upsert({
    where: { userId: residentAUser.id },
    update: {},
    create: { userId: residentAUser.id },
  });
  await prisma.resident.upsert({
    where: { userId: residentBUser.id },
    update: {},
    create: { userId: residentBUser.id },
  });

  const residentA = await prisma.resident.findUniqueOrThrow({
    where: { userId: residentAUser.id },
  });
  const residentB = await prisma.resident.findUniqueOrThrow({
    where: { userId: residentBUser.id },
  });

  const community = await prisma.community.upsert({
    where: { name: 'Alkarma Heights Community' },
    update: {
      code: 'ALKARMA-HTS',
      isActive: true,
      displayOrder: 1,
    },
    create: {
      name: 'Alkarma Heights Community',
      code: 'ALKARMA-HTS',
      isActive: true,
      displayOrder: 1,
    },
  });

  const defaultPhase = await prisma.phase.upsert({
    where: {
      communityId_name: {
        communityId: community.id,
        name: 'Default Phase',
      },
    },
    update: { displayOrder: 1, isActive: true },
    create: {
      communityId: community.id,
      name: 'Default Phase',
      displayOrder: 1,
      isActive: true,
    },
  });

  const residentialCluster = await prisma.cluster.upsert({
    where: {
      phaseId_name: {
        phaseId: defaultPhase.id,
        name: 'Residential Core',
      },
    },
    update: { displayOrder: 1, isActive: true, communityId: community.id, phaseId: defaultPhase.id },
    create: {
      communityId: community.id,
      phaseId: defaultPhase.id,
      name: 'Residential Core',
      displayOrder: 1,
      isActive: true,
    },
  });

  const retailCluster = await prisma.cluster.upsert({
    where: {
      phaseId_name: {
        phaseId: defaultPhase.id,
        name: 'Retail Strip',
      },
    },
    update: { displayOrder: 2, isActive: true, communityId: community.id, phaseId: defaultPhase.id },
    create: {
      communityId: community.id,
      phaseId: defaultPhase.id,
      name: 'Retail Strip',
      displayOrder: 2,
      isActive: true,
    },
  });

  async function upsertGateByName(
    name: string,
    data: {
      code: string;
      status: EntityStatus;
      allowedRoles: GateAccessRole[];
      etaMinutes: number;
      isVisitorRequestRequired: boolean;
    },
  ) {
    const existing = await prisma.gate.findFirst({
      where: { communityId: community.id, name, deletedAt: null },
      select: { id: true },
    });
    if (existing) {
      return prisma.gate.update({ where: { id: existing.id }, data });
    }
    return prisma.gate.create({
      data: { communityId: community.id, name, ...data },
    });
  }

  const mainGate = await upsertGateByName('Main Gate', {
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
  });
  const serviceGate = await upsertGateByName('Service Gate', {
    code: 'SG-02',
    status: EntityStatus.ACTIVE,
    allowedRoles: [
      GateAccessRole.STAFF,
      GateAccessRole.WORKER,
      GateAccessRole.DELIVERY,
    ],
    etaMinutes: 4,
    isVisitorRequestRequired: false,
  });
  const towerBGate = await upsertGateByName('Tower B Gate', {
    code: 'TB-03',
    status: EntityStatus.ACTIVE,
    allowedRoles: [
      GateAccessRole.RESIDENT,
      GateAccessRole.VISITOR,
      GateAccessRole.STAFF,
    ],
    etaMinutes: 3,
    isVisitorRequestRequired: true,
  });

  async function upsertUnit(
    block: string,
    unitNumber: string,
    data: {
      bedrooms: number;
      bathrooms: number;
      sizeSqm: number;
      phaseId: string | null;
      clusterId: string | null;
    },
  ) {
    const existing = await prisma.unit.findFirst({
      where: {
        projectName: 'Alkarma Heights',
        block,
        unitNumber,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (existing) {
      return prisma.unit.update({
        where: { id: existing.id },
        data: {
          communityId: community.id,
          phaseId: data.phaseId,
          clusterId: data.clusterId,
          type: 'APARTMENT',
          bedrooms: data.bedrooms,
          bathrooms: data.bathrooms,
          sizeSqm: data.sizeSqm,
          isActive: true,
          isDelivered: true,
        },
      });
    }
    return prisma.unit.create({
      data: {
        projectName: 'Alkarma Heights',
        communityId: community.id,
        phaseId: data.phaseId,
        clusterId: data.clusterId,
        block,
        unitNumber,
        type: 'APARTMENT',
        bedrooms: data.bedrooms,
        bathrooms: data.bathrooms,
        sizeSqm: data.sizeSqm,
        isActive: true,
        isDelivered: true,
      },
    });
  }

  const unitA = await upsertUnit('A', '101', {
    bedrooms: 2,
    bathrooms: 1,
    sizeSqm: 120,
    phaseId: defaultPhase.id,
    clusterId: residentialCluster.id,
  });
  const unitB = await upsertUnit('B', '202', {
    bedrooms: 3,
    bathrooms: 2,
    sizeSqm: 160,
    phaseId: defaultPhase.id,
    clusterId: null, // edge case: no cluster
  });
  const unitC = await upsertUnit('R', '015', {
    bedrooms: 0,
    bathrooms: 1,
    sizeSqm: 95,
    phaseId: defaultPhase.id,
    clusterId: retailCluster.id,
  });

  await prisma.residentUnit.upsert({
    where: {
      residentId_unitId: { residentId: residentA.id, unitId: unitA.id },
    },
    update: { isPrimary: true },
    create: { residentId: residentA.id, unitId: unitA.id, isPrimary: true },
  });
  await prisma.residentUnit.upsert({
    where: {
      residentId_unitId: { residentId: residentB.id, unitId: unitB.id },
    },
    update: { isPrimary: true },
    create: { residentId: residentB.id, unitId: unitB.id, isPrimary: true },
  });

  await prisma.gateUnitAccess.createMany({
    data: [
      { gateId: mainGate.id, unitId: unitA.id },
      { gateId: mainGate.id, unitId: unitB.id },
      { gateId: serviceGate.id, unitId: unitC.id },
      { gateId: towerBGate.id, unitId: unitB.id },
    ],
    skipDuplicates: true,
  });

  const commercialOwner = await prisma.user.upsert({
    where: { email: 'commercial.owner@test.com' },
    update: { nameEN: 'Commercial Owner', phone: '01020000001', passwordHash },
    create: {
      email: 'commercial.owner@test.com',
      nameEN: 'Commercial Owner',
      phone: '01020000001',
      passwordHash,
    },
  });
  const commercialHr = await prisma.user.upsert({
    where: { email: 'commercial.hr@test.com' },
    update: { nameEN: 'Commercial HR', phone: '01020000002', passwordHash },
    create: {
      email: 'commercial.hr@test.com',
      nameEN: 'Commercial HR',
      phone: '01020000002',
      passwordHash,
    },
  });
  const guardUser = await prisma.user.upsert({
    where: { email: 'staff.guard@test.com' },
    update: { nameEN: 'Mahmoud Salah', phone: '01020000003', passwordHash },
    create: {
      email: 'staff.guard@test.com',
      nameEN: 'Mahmoud Salah',
      phone: '01020000003',
      passwordHash,
    },
  });

  const commercialEntity = await prisma.commercialEntity.upsert({
    where: {
      id:
        (
          await prisma.commercialEntity.findFirst({
            where: {
              communityId: community.id,
              name: 'Alkarma Business Center',
              deletedAt: null,
            },
            select: { id: true },
          })
        )?.id ?? '__new__',
    },
    update: {
      unitId: unitC.id,
      isActive: true,
      description: 'Mixed-use commercial entity (offices + shops)',
    },
    create: {
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

  async function upsertStaff(seed: {
    fullName: string;
    phone: string;
    nationalId: string;
    profession: string;
    jobTitle: string;
    status: CompoundStaffStatus;
    isActive: boolean;
    contractTo: Date | null;
    workSchedule?: Record<string, unknown>;
    userId?: string;
  }) {
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
        ? (seed.workSchedule as Prisma.InputJsonValue)
        : Prisma.JsonNull,
      deletedAt: seed.isActive ? null : new Date(),
    };
    if (existing) {
      return prisma.compoundStaff.update({ where: { id: existing.id }, data });
    }
    return prisma.compoundStaff.create({ data });
  }

  const staffActive = await upsertStaff({
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
  });
  const staffSuspended = await upsertStaff({
    fullName: 'Nadia Youssef',
    phone: '01020000004',
    nationalId: '29202022345678',
    profession: 'Cleaner',
    jobTitle: 'Cleaning Supervisor',
    status: CompoundStaffStatus.SUSPENDED,
    isActive: true,
    contractTo: expired,
    workSchedule: { timezone: 'Africa/Cairo', shifts: ['SUN-THU 09:00-17:00'] },
  });
  const staffInactive = await upsertStaff({
    fullName: 'Ibrahim Adel',
    phone: '01020000005',
    nationalId: '29103033456789',
    profession: 'Reception',
    jobTitle: 'Lobby Receptionist',
    status: CompoundStaffStatus.INACTIVE,
    isActive: false,
    contractTo: null,
  });

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
    where: {
      staffId: { in: [staffActive.id, staffSuspended.id, staffInactive.id] },
    },
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

  console.log('Seeding permit catalog...');
  await seedPermitCatalog();

  console.log('Fast seed complete');
  console.log('- Super Admin: test@admin.com / pass123');
  console.log('- Manager: manager@test.com / pass123');
  console.log('- Community: Alkarma Heights Community (3 gates, 2 clusters)');
  console.log(
    '- Compound Staff: active expiring soon + suspended expired + inactive',
  );
  console.log('- For full legacy seed, run with SEED_FAST=false');
}

async function seed() {
  console.log('Seeding permissions...');
  await prisma.permission.createMany({
    data: PERMISSIONS.map((key) => ({ key })),
    skipDuplicates: true,
  });

  console.log('Seeding roles and role-permission mappings...');
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

  const roleIdByName = new Map<string, string>(
    roleRows.map((row) => [row.name, row.id]),
  );
  const permissionIdByKey = new Map<string, string>(
    permissionRows.map((row) => [row.key, row.id]),
  );

  const rolePermissionRows: Array<{ roleId: string; permissionId: string }> =
    [];
  const seenRolePermissionPairs = new Set<string>();

  for (const [roleName, permissionKeys] of Object.entries(ROLES)) {
    const roleId = roleIdByName.get(roleName);
    if (!roleId) {
      throw new Error(`Missing role: ${roleName}`);
    }

    for (const permissionKey of permissionKeys) {
      const permissionId = permissionIdByKey.get(permissionKey);
      if (!permissionId) {
        throw new Error(`Missing permission: ${permissionKey}`);
      }

      const pairKey = `${roleId}:${permissionId}`;
      if (seenRolePermissionPairs.has(pairKey)) {
        continue;
      }
      seenRolePermissionPairs.add(pairKey);
      rolePermissionRows.push({ roleId, permissionId });
    }
  }

  await prisma.rolePermission.createMany({
    data: rolePermissionRows,
    skipDuplicates: true,
  });

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

  console.log('Seeding users...');

  const rawRounds = Number(process.env.SEED_BCRYPT_ROUNDS ?? '8');
  const bcryptRounds =
    Number.isFinite(rawRounds) && rawRounds >= 4 && rawRounds <= 12
      ? Math.floor(rawRounds)
      : 8;
  const passwordHash = await bcrypt.hash('pass123', bcryptRounds);
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

  if (FAST_SEED_ENABLED) {
    await seedFastPath({
      passwordHash,
      roles: {
        superAdminRoleId: superAdminRole.id,
        managerRoleId: managerRole.id,
        communityRoleId: communityRole.id,
      },
    });
    return;
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
  const manager = await prisma.user.upsert({
    where: { email: 'manager@test.com' },
    update: {
      passwordHash,
      nameEN: 'Manager One',
    },
    create: {
      email: 'manager@test.com',
      passwordHash,
      nameEN: 'Manager One',
    },
  });

  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: manager.id,
        roleId: managerRole.id,
      },
    },
    update: {},
    create: {
      userId: manager.id,
      roleId: managerRole.id,
    },
  });

  await prisma.admin.upsert({
    where: { userId: manager.id },
    update: {},
    create: { userId: manager.id },
  });

  // RESIDENT A
  const residentAUser = await prisma.user.upsert({
    where: { email: 'residentA@test.com' },
    update: {
      passwordHash,
      nameEN: 'Resident A',
    },
    create: {
      email: 'residentA@test.com',
      passwordHash,
      nameEN: 'Resident A',
    },
  });

  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: residentAUser.id,
        roleId: communityRole.id,
      },
    },
    update: {},
    create: {
      userId: residentAUser.id,
      roleId: communityRole.id,
    },
  });

  await prisma.resident.upsert({
    where: { userId: residentAUser.id },
    update: {},
    create: { userId: residentAUser.id },
  });

  const residentA = await prisma.resident.findUnique({
    where: { userId: residentAUser.id },
  });

  // RESIDENT B
  const residentBUser = await prisma.user.upsert({
    where: { email: 'residentB@test.com' },
    update: {
      passwordHash,
      nameEN: 'Resident B',
    },
    create: {
      email: 'residentB@test.com',
      passwordHash,
      nameEN: 'Resident B',
    },
  });

  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: residentBUser.id,
        roleId: communityRole.id,
      },
    },
    update: {},
    create: {
      userId: residentBUser.id,
      roleId: communityRole.id,
    },
  });

  await prisma.resident.upsert({
    where: { userId: residentBUser.id },
    update: {},
    create: { userId: residentBUser.id },
  });

  const residentB = await prisma.resident.findUnique({
    where: { userId: residentBUser.id },
  });

  console.log('🌱 Seeding units...');

  const existingUnitA = await prisma.unit.findFirst({
    where: {
      projectName: 'Alkarma Heights',
      block: 'A',
      unitNumber: '101',
      deletedAt: null,
    },
  });

  const unitA =
    existingUnitA ??
    (await prisma.unit.create({
      data: {
        projectName: 'Alkarma Heights',
        block: 'A',
        unitNumber: '101',
        type: 'APARTMENT',
        bedrooms: 2,
        bathrooms: 1,
        sizeSqm: 120,
      },
    }));

  const existingUnitB = await prisma.unit.findFirst({
    where: {
      projectName: 'Alkarma Heights',
      block: 'B',
      unitNumber: '202',
      deletedAt: null,
    },
  });

  const unitB =
    existingUnitB ??
    (await prisma.unit.create({
      data: {
        projectName: 'Alkarma Heights',
        block: 'B',
        unitNumber: '202',
        type: 'APARTMENT',
        bedrooms: 3,
        bathrooms: 2,
        sizeSqm: 160,
      },
    }));

  console.log('🌱 Assigning residents to units...');

  if (!residentA || !residentB) {
    throw new Error('Failed to create residents');
  }

  await prisma.residentUnit.upsert({
    where: {
      residentId_unitId: {
        residentId: residentA.id,
        unitId: unitA.id,
      },
    },
    update: {
      isPrimary: true,
    },
    create: {
      residentId: residentA.id,
      unitId: unitA.id,
      isPrimary: true,
    },
  });

  await prisma.residentUnit.upsert({
    where: {
      residentId_unitId: {
        residentId: residentB.id,
        unitId: unitB.id,
      },
    },
    update: {
      isPrimary: true,
    },
    create: {
      residentId: residentB.id,
      unitId: unitB.id,
      isPrimary: true,
    },
  });

  console.log(
    'Seeding community, clusters, gates, commercial entities, and compound staff...',
  );

  const community = await prisma.community.upsert({
    where: { name: 'Alkarma Heights Community' },
    update: {
      code: 'ALKARMA-HTS',
      isActive: true,
      displayOrder: 1,
    },
    create: {
      name: 'Alkarma Heights Community',
      code: 'ALKARMA-HTS',
      isActive: true,
      displayOrder: 1,
    },
  });

  const defaultPhase = await prisma.phase.upsert({
    where: {
      communityId_name: {
        communityId: community.id,
        name: 'Default Phase',
      },
    },
    update: {
      displayOrder: 1,
      isActive: true,
    },
    create: {
      communityId: community.id,
      name: 'Default Phase',
      displayOrder: 1,
      isActive: true,
    },
  });

  const residentialCluster = await prisma.cluster.upsert({
    where: {
      phaseId_name: {
        phaseId: defaultPhase.id,
        name: 'Residential Core',
      },
    },
    update: {
      displayOrder: 1,
      description: 'Primary residential buildings',
      phaseId: defaultPhase.id,
      communityId: community.id,
      isActive: true,
    },
    create: {
      communityId: community.id,
      phaseId: defaultPhase.id,
      name: 'Residential Core',
      displayOrder: 1,
      description: 'Primary residential buildings',
      isActive: true,
    },
  });

  const retailCluster = await prisma.cluster.upsert({
    where: {
      phaseId_name: {
        phaseId: defaultPhase.id,
        name: 'Retail Strip',
      },
    },
    update: {
      displayOrder: 2,
      description: 'Commercial and retail units',
      phaseId: defaultPhase.id,
      communityId: community.id,
      isActive: true,
    },
    create: {
      communityId: community.id,
      phaseId: defaultPhase.id,
      name: 'Retail Strip',
      displayOrder: 2,
      description: 'Commercial and retail units',
      isActive: true,
    },
  });

  await prisma.unit.update({
    where: { id: unitA.id },
    data: {
      communityId: community.id,
      phaseId: defaultPhase.id,
      clusterId: residentialCluster.id,
      isActive: true,
      isDelivered: true,
      deliveryDate: unitA.deliveryDate ?? new Date('2026-01-01T00:00:00.000Z'),
    },
  });

  await prisma.unit.update({
    where: { id: unitB.id },
    data: {
      communityId: community.id,
      phaseId: defaultPhase.id,
      clusterId: null, // edge case: unit with no cluster
      isActive: true,
      isDelivered: true,
      deliveryDate: unitB.deliveryDate ?? new Date('2026-01-15T00:00:00.000Z'),
    },
  });

  const existingUnitC = await prisma.unit.findFirst({
    where: {
      projectName: 'Alkarma Heights',
      block: 'R',
      unitNumber: '015',
      deletedAt: null,
    },
  });

  const unitC =
    existingUnitC ??
    (await prisma.unit.create({
      data: {
        projectName: 'Alkarma Heights',
        communityId: community.id,
        phaseId: defaultPhase.id,
        clusterId: retailCluster.id,
        block: 'R',
        unitNumber: '015',
        type: 'APARTMENT',
        bedrooms: 0,
        bathrooms: 1,
        sizeSqm: 95,
        isActive: true,
        isDelivered: true,
        deliveryDate: new Date('2026-02-01T00:00:00.000Z'),
      },
    }));

  async function upsertGateByName(
    name: string,
    data: {
      code: string;
      status: EntityStatus;
      allowedRoles: GateAccessRole[];
      etaMinutes: number;
      isVisitorRequestRequired: boolean;
    },
  ) {
    const existing = await prisma.gate.findFirst({
      where: {
        communityId: community.id,
        name,
        deletedAt: null,
      },
    });

    if (existing) {
      return prisma.gate.update({
        where: { id: existing.id },
        data,
      });
    }

    return prisma.gate.create({
      data: {
        communityId: community.id,
        name,
        ...data,
      },
    });
  }

  const mainGate = await upsertGateByName('Main Gate', {
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
  });

  const serviceGate = await upsertGateByName('Service Gate', {
    code: 'SG-02',
    status: EntityStatus.ACTIVE,
    allowedRoles: [
      GateAccessRole.STAFF,
      GateAccessRole.WORKER,
      GateAccessRole.DELIVERY,
    ],
    etaMinutes: 4,
    isVisitorRequestRequired: false,
  });

  const towerBGate = await upsertGateByName('Tower B Gate', {
    code: 'TB-03',
    status: EntityStatus.ACTIVE,
    allowedRoles: [
      GateAccessRole.RESIDENT,
      GateAccessRole.VISITOR,
      GateAccessRole.STAFF,
    ],
    etaMinutes: 3,
    isVisitorRequestRequired: true,
  });

  const gateUnitPairs: Array<{ gateId: string; unitId: string }> = [
    { gateId: mainGate.id, unitId: unitA.id },
    { gateId: mainGate.id, unitId: unitB.id },
    { gateId: serviceGate.id, unitId: unitC.id },
    { gateId: towerBGate.id, unitId: unitB.id },
  ];

  for (const pair of gateUnitPairs) {
    await prisma.gateUnitAccess.upsert({
      where: {
        gateId_unitId: {
          gateId: pair.gateId,
          unitId: pair.unitId,
        },
      },
      update: {
        deletedAt: null,
      },
      create: {
        gateId: pair.gateId,
        unitId: pair.unitId,
      },
    });
  }

  const commercialOwner = await prisma.user.upsert({
    where: { email: 'commercial.owner@test.com' },
    update: {
      nameEN: 'Commercial Owner',
      phone: '01020000001',
      passwordHash,
    },
    create: {
      email: 'commercial.owner@test.com',
      passwordHash,
      nameEN: 'Commercial Owner',
      phone: '01020000001',
    },
  });

  const commercialHr = await prisma.user.upsert({
    where: { email: 'commercial.hr@test.com' },
    update: {
      nameEN: 'Commercial HR',
      phone: '01020000002',
      passwordHash,
    },
    create: {
      email: 'commercial.hr@test.com',
      passwordHash,
      nameEN: 'Commercial HR',
      phone: '01020000002',
    },
  });

  const commercialEntityExisting = await prisma.commercialEntity.findFirst({
    where: {
      communityId: community.id,
      name: 'Alkarma Business Center',
      deletedAt: null,
    },
  });

  const commercialEntity = commercialEntityExisting
    ? await prisma.commercialEntity.update({
        where: { id: commercialEntityExisting.id },
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

  await prisma.commercialEntityMember.upsert({
    where: {
      entityId_userId: {
        entityId: commercialEntity.id,
        userId: commercialOwner.id,
      },
    },
    update: {
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
      deletedAt: null,
    },
    create: {
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
  });

  await prisma.commercialEntityMember.upsert({
    where: {
      entityId_userId: {
        entityId: commercialEntity.id,
        userId: commercialHr.id,
      },
    },
    update: {
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
      deletedAt: null,
    },
    create: {
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
  });

  const guardUser = await prisma.user.upsert({
    where: { email: 'staff.guard@test.com' },
    update: {
      nameEN: 'Mahmoud Salah',
      phone: '01020000003',
      passwordHash,
    },
    create: {
      email: 'staff.guard@test.com',
      passwordHash,
      nameEN: 'Mahmoud Salah',
      phone: '01020000003',
    },
  });

  const today = new Date();
  const contractFrom = new Date(today.getTime() - 365 * 24 * 60 * 60 * 1000);
  const contractExpiringSoon = new Date(
    today.getTime() + 5 * 24 * 60 * 60 * 1000,
  );
  const contractExpired = new Date(today.getTime() - 15 * 24 * 60 * 60 * 1000);

  async function upsertCompoundStaffByNationalId(data: {
    fullName: string;
    phone: string;
    nationalId: string;
    profession: string;
    jobTitle?: string;
    workSchedule?: Record<string, unknown>;
    contractTo?: Date;
    status: CompoundStaffStatus;
    isActive: boolean;
    userId?: string;
  }) {
    const existing = await prisma.compoundStaff.findFirst({
      where: {
        communityId: community.id,
        nationalId: data.nationalId,
      },
    });

    const payload = {
      communityId: community.id,
      commercialEntityId: commercialEntity.id,
      userId: data.userId ?? null,
      fullName: data.fullName,
      phone: data.phone,
      nationalId: data.nationalId,
      profession: data.profession,
      jobTitle: data.jobTitle ?? null,
      workSchedule:
        data.workSchedule === undefined
          ? Prisma.JsonNull
          : (data.workSchedule as Prisma.InputJsonValue),
      contractFrom,
      contractTo: data.contractTo ?? null,
      status: data.status,
      isActive: data.isActive,
      deletedAt: data.isActive ? null : new Date(),
    };

    if (existing) {
      return prisma.compoundStaff.update({
        where: { id: existing.id },
        data: payload,
      });
    }

    return prisma.compoundStaff.create({
      data: payload,
    });
  }

  const staffExpiringSoon = await upsertCompoundStaffByNationalId({
    fullName: 'Mahmoud Salah',
    phone: '01020000003',
    nationalId: '29801011234567',
    profession: 'Security',
    jobTitle: 'Gate Security Officer',
    workSchedule: { timezone: 'Africa/Cairo', shifts: ['SUN-THU 08:00-16:00'] },
    contractTo: contractExpiringSoon,
    status: CompoundStaffStatus.ACTIVE,
    isActive: true,
    userId: guardUser.id,
  });

  const staffExpired = await upsertCompoundStaffByNationalId({
    fullName: 'Nadia Youssef',
    phone: '01020000004',
    nationalId: '29202022345678',
    profession: 'Cleaner',
    jobTitle: 'Cleaning Supervisor',
    workSchedule: { timezone: 'Africa/Cairo', shifts: ['SUN-THU 09:00-17:00'] },
    contractTo: contractExpired,
    status: CompoundStaffStatus.SUSPENDED,
    isActive: true,
  });

  const staffInactive = await upsertCompoundStaffByNationalId({
    fullName: 'Ibrahim Adel',
    phone: '01020000005',
    nationalId: '29103033456789',
    profession: 'Reception',
    jobTitle: 'Lobby Receptionist',
    status: CompoundStaffStatus.INACTIVE,
    isActive: false,
  });

  const permissionPairs: Array<{
    staffId: string;
    permission: CompoundStaffPermission;
  }> = [
    {
      staffId: staffExpiringSoon.id,
      permission: CompoundStaffPermission.ENTRY_EXIT,
    },
    {
      staffId: staffExpiringSoon.id,
      permission: CompoundStaffPermission.ATTENDANCE,
    },
    {
      staffId: staffExpiringSoon.id,
      permission: CompoundStaffPermission.WORK_ORDERS,
    },
    {
      staffId: staffExpired.id,
      permission: CompoundStaffPermission.ATTENDANCE,
    },
  ];

  for (const pair of permissionPairs) {
    await prisma.compoundStaffAccess.upsert({
      where: {
        staffId_permission: {
          staffId: pair.staffId,
          permission: pair.permission,
        },
      },
      update: {
        isGranted: true,
        grantedById: manager.id,
        deletedAt: null,
      },
      create: {
        staffId: pair.staffId,
        permission: pair.permission,
        isGranted: true,
        grantedById: manager.id,
      },
    });
  }

  const scheduleRows = [
    {
      staffId: staffExpiringSoon.id,
      dayOfWeek: 'SUNDAY' as const,
      startTime: '08:00',
      endTime: '16:00',
      notes: 'Morning shift',
    },
    {
      staffId: staffExpiringSoon.id,
      dayOfWeek: 'MONDAY' as const,
      startTime: '08:00',
      endTime: '16:00',
      notes: 'Morning shift',
    },
    {
      staffId: staffExpired.id,
      dayOfWeek: 'TUESDAY' as const,
      startTime: '09:00',
      endTime: '17:00',
      notes: 'Cleaning rounds',
    },
  ];

  for (const row of scheduleRows) {
    await prisma.compoundStaffSchedule.upsert({
      where: {
        staffId_dayOfWeek: {
          staffId: row.staffId,
          dayOfWeek: row.dayOfWeek,
        },
      },
      update: {
        startTime: row.startTime,
        endTime: row.endTime,
        notes: row.notes,
        isActive: true,
      },
      create: {
        staffId: row.staffId,
        dayOfWeek: row.dayOfWeek,
        startTime: row.startTime,
        endTime: row.endTime,
        notes: row.notes,
        isActive: true,
      },
    });
  }

  const staffGateRows: Array<{
    staffId: string;
    gateId: string;
    directions: GateDirection[];
  }> = [
    {
      staffId: staffExpiringSoon.id,
      gateId: mainGate.id,
      directions: [GateDirection.ENTRY, GateDirection.EXIT],
    },
    {
      staffId: staffExpiringSoon.id,
      gateId: serviceGate.id,
      directions: [GateDirection.ENTRY, GateDirection.EXIT],
    },
  ];

  for (const row of staffGateRows) {
    await prisma.compoundStaffGateAccess.upsert({
      where: {
        staffId_gateId: {
          staffId: row.staffId,
          gateId: row.gateId,
        },
      },
      update: {
        directions: row.directions,
        isActive: true,
        grantedById: manager.id,
      },
      create: {
        staffId: row.staffId,
        gateId: row.gateId,
        directions: row.directions,
        isActive: true,
        grantedById: manager.id,
      },
    });
  }

  const activities: Array<{
    staffId: string;
    action: string;
    metadata: Record<string, string>;
  }> = [
    {
      staffId: staffExpiringSoon.id,
      action: 'STAFF_CREATED',
      metadata: { source: 'seed', note: 'Seeded active staff expiring soon' },
    },
    {
      staffId: staffExpired.id,
      action: 'STATUS_CHANGED_TO_SUSPENDED',
      metadata: { source: 'seed', note: 'Seeded expired contract staff' },
    },
    {
      staffId: staffInactive.id,
      action: 'STAFF_ARCHIVED',
      metadata: { source: 'seed', note: 'Seeded inactive staff' },
    },
  ];

  for (const row of activities) {
    const existing = await prisma.compoundStaffActivityLog.findFirst({
      where: {
        staffId: row.staffId,
        action: row.action,
      },
    });
    if (!existing) {
      await prisma.compoundStaffActivityLog.create({
        data: {
          staffId: row.staffId,
          actorUserId: manager.id,
          action: row.action,
          metadata: row.metadata,
        },
      });
    }
  }

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

  console.log('Seeding permit catalog...');
  await seedPermitCatalog();

  console.log('Seeding complete');
  console.log('Seed summary:');
  console.log('- Super Admin: test@admin.com / pass123');
  console.log('- Manager: manager@test.com / pass123');
  console.log('- Resident A: residentA@test.com / pass123 -> Unit A');
  console.log('- Resident B: residentB@test.com / pass123 -> Unit B');
  console.log('- Community: Alkarma Heights Community (3 gates, 2 clusters)');
  console.log(
    '- Commercial Entity: Alkarma Business Center (owner + HR member)',
  );
  console.log(
    '- Compound Staff: active expiring soon + suspended expired + inactive archived',
  );
}

seed()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

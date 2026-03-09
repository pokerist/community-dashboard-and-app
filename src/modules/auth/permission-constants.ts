/**
 * Central permission constants — seeded into the `Permission` table on app startup.
 * Format: module.action  or  module.action (with status-specific variants handled via RoleStatusPermission).
 *
 * Every key listed here will be created as a real DB row.
 */

export const PERMISSION_KEYS = [
  // ── Admin ─────────────────────────────────────
  'admin.view',
  'admin.create',
  'admin.update',
  'admin.delete',

  // ── Users ─────────────────────────────────────
  'user.create',
  'user.read',
  'user.update',
  'user.delete',

  // ── Residents ─────────────────────────────────
  'resident.create',
  'resident.read',
  'resident.update',
  'resident.delete',

  // ── Units ─────────────────────────────────────
  'units.view',
  'units.create',
  'units.update',
  'units.delete',
  'units.assign_resident',
  'units.transfer_ownership',

  // ── Amenities ─────────────────────────────────
  'amenities.view',
  'amenities.create',
  'amenities.update',
  'amenities.delete',
  'amenities.book',

  // ── Bookings ──────────────────────────────────
  'bookings.view',
  'bookings.create',
  'bookings.update',
  'bookings.cancel',

  // ── Payments / Billing ────────────────────────
  'payments.view',
  'payments.create',
  'payments.update',
  'billing.create_invoice',
  'billing.view_invoices',
  'billing.manage_categories',

  // ── Complaints ────────────────────────────────
  'complaints.view',
  'complaints.create',
  'complaints.update',
  'complaints.delete',

  // ── Violations ────────────────────────────────
  'violations.view',
  'violations.create',
  'violations.update',
  'violations.delete',

  // ── Services ──────────────────────────────────
  'services.view',
  'services.create',
  'services.update',
  'services.delete',

  // ── Communities ───────────────────────────────
  'communities.view',
  'communities.create',
  'communities.update',
  'communities.delete',

  // ── Gates ─────────────────────────────────────
  'gates.view',
  'gates.create',
  'gates.update',
  'gates.delete',

  // ── Permits ───────────────────────────────────
  'permits.view',
  'permits.create',
  'permits.update',
  'permits.delete',

  // ── Rentals ───────────────────────────────────
  'rentals.view',
  'rentals.create',
  'rentals.update',
  'rentals.delete',

  // ── Commercial ────────────────────────────────
  'commercial.view',
  'commercial.create',
  'commercial.update',
  'commercial.delete',

  // ── Reports ───────────────────────────────────
  'reports.view',
  'reports.generate',

  // ── News / Announcements ──────────────────────
  'news.view',
  'news.create',
  'news.update',
  'news.delete',

  // ── Tickets ───────────────────────────────────
  'tickets.view',
  'tickets.create',
  'tickets.update',
  'tickets.delete',

  // ── Dashboard ─────────────────────────────────
  'dashboard.view',

  // ── Profile ───────────────────────────────────
  'profile.view',
  'profile.update',

  // ── App Pages (mobile) ────────────────────────
  'app.page.profile',
  'app.page.dashboard',
  'app.page.complaints',
  'app.page.violations',
  'app.page.services',
  'app.page.amenities',
  'app.page.payments',
  'app.page.visitors',
  'app.page.announcements',
  'app.page.directory',
  'app.page.maintenance',
  'app.page.parking',
  'app.page.deliveries',
  'app.page.emergency',
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

/**
 * Module keys used for RoleModuleAccess (controls which dashboard
 * pages/sections a role can access).
 */
export const MODULE_KEYS = [
  'dashboard',
  'units',
  'communities',
  'amenities',
  'bookings',
  'payments',
  'complaints',
  'violations',
  'services',
  'gates',
  'permits',
  'rentals',
  'commercial',
  'reports',
  'news',
  'tickets',
  'profile',
  'users',
] as const;

export type ModuleKey = (typeof MODULE_KEYS)[number];

/** Human-readable labels for module keys */
export const MODULE_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  units: 'Units',
  communities: 'Communities',
  amenities: 'Amenities',
  bookings: 'Bookings',
  payments: 'Payments',
  complaints: 'Complaints',
  violations: 'Violations',
  services: 'Services',
  gates: 'Gates',
  permits: 'Permits',
  rentals: 'Rentals',
  commercial: 'Commercial',
  reports: 'Reports',
  news: 'News & Announcements',
  tickets: 'Tickets',
  profile: 'Profile',
  users: 'User Management',
};

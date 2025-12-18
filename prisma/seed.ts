import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

const PERMISSIONS = [
  "auth.login",
  "auth.refresh",
  "auth.logout",
  "auth.impersonate",

  "user.read",
  "user.update",
  "user.suspend",
  "user.invite",
  "user.assign_role",
  "user.view_activity",

  "resident.view",
  "resident.create",
  "resident.update",
  "resident.assign_unit",
  "resident.remove_unit",

  "unit.view",
  "unit.create",
  "unit.update",
  "unit.assign_resident",
  "unit.remove_resident",

  "project.manage",

  "invoice.view_all",
  "invoice.view_own",
  "invoice.create",
  "invoice.update",
  "invoice.mark_paid",
  "invoice.cancel",

  "fee.manage",

  "service_request.view_all",
  "service_request.view_own",
  "service_request.create",
  "service_request.assign",
  "service_request.resolve",
  "service_request.close",

  "complaint.view_all",
  "complaint.view_own",
  "complaint.report",
  "complaint.assign",
  "complaint.resolve",
  "complaint.close",

  "violation.issue",
  "violation.view_all",
  "violation.view_own",
  "violation.update",
  "violation.cancel",

  "qr.generate",
  "qr.view_all",
  "qr.view_own",
  "qr.cancel",

  "facility.manage",

  "booking.view_all",
  "booking.view_own",
  "booking.create",
  "booking.cancel",

  "smart_device.manage",
  "smart_device.view_own",

  "notification.send",
  "notification.schedule",
  "notification.view",

  "banner.manage",

  "referral.create",
  "referral.view_all",
]

async function main() {
  await prisma.permission.createMany({
    data: PERMISSIONS.map((key) => ({ key })),
    skipDuplicates: true,
  })

  console.log("✅ Permissions seeded")
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())

# Run Demo (Reset + Seed + Smoke Checklist)

This runbook prepares a presentation-ready environment with:
- demo personas
- realistic operational dashboard data
- live admin + backend + mobile flows

## 1) Reset/Prepare Database (optional)

If using a fresh local DB:
```bash
npx prisma migrate deploy
npx prisma db seed
```

## 2) Seed Demo Personas

```bash
npm run seed:mobile-personas
```

Creates owner/tenant/family/authorized/contractor demo users and unit access mappings.

## 3) Seed Realistic Dashboard Load Data

```bash
npm run seed:dashboard-load
```

Seeds:
- service requests
- invoices
- complaints
- violations
- incidents
- bookings
- access QRs
- notifications
- smart devices

## 4) Start Backend + Admin

Backend:
```bash
npm run start:dev
```

Admin:
```bash
cd apps/admin-web
npm run dev
```

## 5) Start Mobile (Expo)

```bash
cd apps/community-mobile-native
npx expo start -c
```

Ensure `EXPO_PUBLIC_API_BASE_URL` points to the correct backend URL.

## 6) Pre-Demo Smoke Checklist (Manual)

### Admin
- [ ] Login works
- [ ] Dashboard cards show realistic non-empty data
- [ ] Notification Center can send personal/community update notifications
- [ ] Service Management shows service/request templates and ticket inbox
- [ ] Complaints & Violations page can open complaint and reply

### Mobile
- [ ] Login works (resident + at least one persona demo)
- [ ] Unit switcher works
- [ ] Home shows banner/community updates/payables
- [ ] Services and Requests are separated
- [ ] Submit request/ticket and view ticket details
- [ ] Complaint create + details + comments
- [ ] QR create + popup + share + revoke
- [ ] Finance payables + demo payment simulation
- [ ] Bell notifications open personal notifications (not community updates)
- [ ] Community Updates page opens via Home `View All`

### Notification / Deep-link sanity
- [ ] Admin sends community update with `Open In App`
- [ ] Mobile opens target screen from update
- [ ] Complaint reply/status update sends resident notification
- [ ] `Open in App` opens complaint details

## 7) Optional Smoke Scripts

Windows/PowerShell:
```bash
npm run smoke:mobile-personas
```

Linux/server (PM2 stack):
```bash
npm run smoke:admin-stack:linux
```

## 8) Demo Accounts (Quick Reference)

Admin:
- `test@admin.com / pass123`

Manager:
- `manager@test.com / pass123`

Resident:
- `residentA@test.com / pass123`
- `residentB@test.com / pass123`

Personas:
- `owner.demo@test.com / pass123`
- `tenant.demo@test.com / pass123`
- `preowner.demo@test.com / pass123`
- `family.demo@test.com / pass123`
- `authorized.demo@test.com / pass123`
- `contractor.demo@test.com / pass123`

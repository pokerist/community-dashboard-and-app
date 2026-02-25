# Admin Demo Audit Matrix

This matrix tracks visible admin pages/actions and whether each item is functional with real backend behavior.

Status values:
- `done` = functional (real API/navigation/download/save behavior)
- `partial` = partially functional, some visible actions still blocked or placeholder
- `blocked-backend` = UI can be wired but backend feature/bug/policy blocks functionality
- `missing-backend` = no backend module/endpoints exist yet
- `todo` = not implemented yet

## Pages

| Page | Data | Primary Actions | Status | Notes |
|---|---|---|---|---|
| Dashboard | Live | Quick actions + cards | `done` | QuickActions navigate to real sections |
| Residents | Live | list/create/suspend/deactivate | `done` | create user + resident + optional unit assignment wired |
| Units | Live | list/create/delete | `done` | live-only mode |
| Services | Live | create/edit/delete/toggle/form fields | `done` | wired to `/services` + `/service-fields` |
| Access Control | Live list | generate/revoke QR | `done` | admin generate/revoke verified after backend admin override path |
| Lease Management | Live list | create lease | `done` | multipart+fileId lease creation verified end-to-end (unit -> owner -> lease) |
| Complaints & Violations | Live list | create complaint/violation | `done` | admin complaint create-on-behalf + violation create working |
| Billing & Payments | Live | create invoice | `done` | invoice create/list working |
| Banner Management | Live | CRUD banners | `done` | backend `banners` module added + admin page wired (create/edit/status/delete/filter) |
| Notifications | Live | send/filter/resend/logs | `partial` | backend supports EMAIL/SMS/PUSH + device tokens; page shows provider readiness (Live/Mock/Not Configured) and resend handles failed logs |
| Security & Emergency | Live | create incident | `done` | incident cards/list/create are live; non-functional CCTV map placeholder removed |
| Amenities | Live | create facility + bookings list | `done` | calendar tab now renders live booking summary from `/bookings`; unsaved open/close form fields removed |
| Smart Home | Deferred page | none (intentionally disabled) | `todo` | intentionally deferred by request until smart device registry backend exists |
| Reports & Analytics | Live + backend-generated exports | generate/download/history/schedules | `done` | backend exports support CSV/JSON/XLSX/PDF + schedule create/list/pause/run-now; demo scheduling supports DAILY/WEEKLY/MONTHLY |
| System Settings | Live | save/test/backup/restore | `done` | backend `system-settings` module added (section patch endpoints + CRM test + backup snapshots/history/restore) |

## Shared UI / Shell

| Area | Element | Current | Target | Status |
|---|---|---|---|---|
| App shell footer | Documentation link | dialog with real local resources/links | open real docs route/resource | `done` |
| App shell footer | Support link | dialog with support info/log paths | real support screen/mailto/help page | `done` |
| App shell footer | Privacy link | dialog with local demo privacy notice | real privacy content page | `done` |
| Dashboard | QuickActions: Generate Report | navigates to Reports page | open reports page / generate real report | `done` |
| Dashboard | QuickActions: Create Announcement | navigates to Notifications | navigate notifications | `done` |
| Dashboard | QuickActions: View Alerts | navigates to Security | navigate security | `done` |
| Sidebar footer | Admin user card | reads auth user/email from local storage | reflect logged-in user | `done` |

## Backend Feature Gaps / Bugs (Confirmed)

| Area | Type | Status | Details |
|---|---|---|---|
| Notifications | SMS/PUSH delivery | `done` | Twilio/FCM provider paths added with dev mock fallback + retry support |
| Notifications | Device token registry | `done` | Prisma model + register/list/revoke endpoints added |
| Violations create | bug | `done` | fixed by tx-aware invoice generation inside violation transaction |
| Complaints admin create | policy gap | `done` | added admin create-on-behalf endpoint (`POST /complaints/admin/create`) |
| Access QR admin create | policy gap | `done` | admin override path implemented in access control service |
| Banners | module | `done` | backend module + Prisma audienceMeta + CRUD/status endpoints implemented |
| Reports | module | `done` | `generate/history/download/schedule` + `run-now/run-due` endpoints + scheduler executor active; formats CSV/JSON/XLSX/PDF and schedule frequencies limited to DAILY/WEEKLY/MONTHLY for demo |
| System Settings | module | `done` | CRUD-like section endpoints + CRM test + backup create/history/restore/import implemented |
| Smart device registry | module | `missing-backend` | no admin registry endpoints |

## Exit Criteria for Demo

- No visible placeholder/fake action remains in displayed pages.
- All visible buttons trigger real behavior or are removed from the UI.
- All sidebar pages load live data or use backend modules implemented for the demo.
- Notifications support `IN_APP + EMAIL + SMS + PUSH` with provider logs visible.

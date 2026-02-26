# Mobile Personas (Source Design -> Backend Mapping)

This document explains how personas shown in the mobile UX map to backend roles/access.

## Summary

Mobile persona behavior is not hardcoded only from frontend labels. It is derived from:
- `/auth/me` bootstrap response
- unit access capabilities
- resolved persona flags returned by backend

## Persona Mapping

### 1) Owner
Backend mapping:
- `COMMUNITY_USER`
- `OWNER` unit access (with owner profile)

Expected capabilities:
- household (family + delegates + contractors/workers depending capabilities)
- QR codes
- services/requests
- complaints
- finance
- bookings (if delivered + eligible)

### 2) Tenant
Backend mapping:
- `COMMUNITY_USER`
- `TENANT` unit access (often from active lease)

Expected capabilities:
- QR codes
- services/requests
- complaints
- finance
- bookings
- some household operations depending authority rules

### 3) Pre-Delivery Owner (`PRE_DELIVERY_OWNER`)
Backend mapping:
- owner access on unit(s) not delivered

Expected behavior:
- restricted feature set
- no broken CTAs
- role/feature gating in home/drawer

### 4) Family
Backend mapping:
- `COMMUNITY_USER`
- `FAMILY` unit access

Expected behavior:
- feature visibility depends on `featureAvailability` and unit capabilities

### 5) Authorized
Backend mapping:
- Delegate (backend `delegates` flow) + scoped permissions

Mobile label can remain “Authorized” for user-friendliness.

### 6) Contractor
Backend mapping:
- delegate-style access with worker-management capabilities (`canManageWorkers`)
- contractor/workers module relationships

Mobile UX currently places contractors under `Authorized` flow (not `Staff`) and workers under `Staff`.

## `/auth/me` Fields Used by Mobile

The backend returns persona hints used by mobile routing/gating, including:
- `resolvedPersona`
- `isOwner`
- `isTenant`
- `isFamily`
- `isDelegate`
- `isPreDeliveryOwner`
- `canManageWorkers`
- `featureAvailability`
- unit access list/capabilities

## Feature Availability (Conceptual)

`featureAvailability` is used to decide visibility of:
- services
- requests
- complaints
- QR
- bookings
- finance
- community updates
- household

If a feature is not allowed:
- hide or gate it in UI
- avoid surfacing CTAs that produce `403` where possible

## Demo Personas (Seeded)

Created by:
```bash
npm run seed:mobile-personas
```

Accounts:
- `owner.demo@test.com / pass123`
- `tenant.demo@test.com / pass123`
- `preowner.demo@test.com / pass123`
- `family.demo@test.com / pass123`
- `authorized.demo@test.com / pass123`
- `contractor.demo@test.com / pass123`

## QA Persona Checklist

For each persona:
- login works
- drawer items are appropriate
- home quick actions are appropriate
- no unexpected `403` on visible actions
- notifications open correct screens/details

# White-Label Branding (Admin -> Backend -> Mobile)

## Summary

The platform supports white-label branding for the resident mobile app.
Brand values are managed in the admin dashboard and consumed by the mobile app on startup.

## Current Flow

### Admin authoring
In Admin Dashboard:
- `System Settings` -> `Brand` tab

Admin can configure:
- company name
- app display name
- primary/secondary colors (and optional accent)
- tagline
- brand logo (file upload)

### Backend storage + APIs
Brand values are stored in system settings (JSON section-based storage).

Relevant endpoints:
- `PATCH /system-settings/brand` (admin)
- `GET /mobile/app-config` (public, mobile-safe config)
- `POST /files/upload/brand-logo` (admin upload)
- `GET /files/public/brand-logo/:fileId` (public stream)

### Mobile consumption
On app launch, the mobile app fetches:
- `GET /mobile/app-config`

It then:
- caches branding config
- applies brand colors / names / logo in key screens
- falls back to default branding if request fails

## Public Mobile Config Shape (Conceptual)

```json
{
  "brand": {
    "companyName": "SSS Community",
    "appDisplayName": "SSS Community",
    "primaryColor": "#2A3E35",
    "secondaryColor": "#C9A961",
    "accentColor": "#0F766E",
    "logoUrl": "https://community-api.example.com/files/public/brand-logo/<fileId>",
    "tagline": "Smart Living"
  },
  "meta": {
    "version": 1,
    "updatedAt": "2026-02-25T12:34:56.000Z"
  }
}
```

## Operational Notes

1. Use the **API domain** in `logoUrl`, not the admin domain.
2. Ensure file storage credentials are configured in production:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
3. If branding does not appear on mobile:
- verify `GET /mobile/app-config`
- verify public logo route returns image content type
- restart/reload Expo app after changing branding

## Recommended QA Checks

1. Change brand name/colors/logo in admin
2. Open mobile app again (or reload)
3. Confirm updates in:
- onboarding
- login
- home header/drawer
- bottom tabs/basic themed surfaces
4. Kill network / break endpoint and verify fallback defaults still render (no crash)

## Future Enhancements (Optional)

- brand presets (save/load)
- multiple tenants/brands by domain
- admin preview for mobile theme variants
- typography/font customization
- white-label package IDs and app icons for native release builds

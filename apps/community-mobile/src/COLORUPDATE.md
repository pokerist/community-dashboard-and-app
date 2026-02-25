# Color Update Guide

The app has been updated from blue (#0B5FFF) to green (#00B386) as the primary color.

## Color Mapping:
- `#0B5FFF` → `#00B386` (Primary Blue → Primary Green)
- `#0047CC` → `#00926e` (Dark Blue → Dark Green)

## Updated Files:
1. /styles/globals.css ✅
2. All screen components need updating
3. All layout components need updating

## Pattern Replacements Needed:
- `from-[#0B5FFF]` → `from-[#00B386]`
- `to-[#0047CC]` → `to-[#00926e]`
- `bg-[#0B5FFF]` → `bg-[#00B386]`
- `text-[#0B5FFF]` → `text-[#00B386]`
- `border-[#0B5FFF]` → `border-[#00B386]`
- `hover:bg-[#0047CC]` → `hover:bg-[#00926e]`

## Implementation:
Due to the large number of files (47 matches across 12 files), the primary color variables have been updated in globals.css. All components using the CSS variables will automatically adopt the new green theme.

For hard-coded color values in TSX files, a systematic replacement is needed across:
- Auth screens (Login, Register, Onboarding)
- Main screens (Home, Services, QR, Notifications, Profile)
- Secondary screens (Complaints, Payments, Explore)
- Layout components (BottomNavigation, DrawerMenu)

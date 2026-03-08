import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppSidebar } from "./components/AppSidebar";
import type { SidebarBadgeCounts } from "./components/AppSidebar";
import { DashboardOverview } from "./components/pages/DashboardOverview";
import { ResidentManagement } from "./components/pages/ResidentManagement";
import { DashboardUsersPage } from "./components/pages/DashboardUsersPage";
import { UsersHubPage } from "./components/pages/UsersHubPage";
import { ResidentCreatePage } from "./components/pages/ResidentCreatePage";
import { UnitsManagement } from "./components/pages/UnitsManagement";
import { CommunitiesManagement } from "./components/pages/CommunitiesManagement";
import { CommercialManagement } from "./components/pages/CommercialManagement";
import { CompoundStaffManagement } from "./components/pages/CompoundStaffManagement";
import { AttendanceSchedules } from "./components/pages/AttendanceSchedules";
import { BlueCollarManagement } from "./components/pages/BlueCollarManagement";
import { ServiceManagement } from "./components/pages/ServiceManagement";
import { PermitsManagement } from "./components/pages/PermitsManagement";
import { TicketsInbox } from "./components/pages/TicketsInbox";
import { AccessControl } from "./components/pages/AccessControl";
import { RentalManagement } from "./components/pages/RentalManagement";
import { ComplaintsViolations } from "./components/pages/ComplaintsViolations";
import { ViolationsManagement } from "./components/pages/ViolationsManagement";
import { BillingPayments } from "./components/pages/BillingPayments";
import { MarketingCenter } from "./components/pages/MarketingCenter";
import { NotificationCenter } from "./components/pages/NotificationCenter";
import { OrderingManagement } from "./components/pages/OrderingManagement";
import { SurveysManagement } from "./components/pages/SurveysManagement";
import { SecurityEmergency } from "./components/pages/SecurityEmergency";
import { GateLiveFeed } from "./components/pages/GateLiveFeed";
import { GatesManagement } from "./components/pages/GatesManagement";
import { AmenitiesManagement } from "./components/pages/AmenitiesManagement";
import { ReportsAnalytics } from "./components/pages/ReportsAnalytics";
import { SystemSettings } from "./components/pages/SystemSettings";
import { CommunityDirectory } from "./components/pages/CommunityDirectory";
import { ApprovalsCenter } from "./components/pages/ApprovalsCenter";
import { HospitalityPage } from "./components/pages/HospitalityPage";
import { Toaster } from "./components/ui/sonner";
import { toast } from "sonner";
import apiClient, { isAuthenticated, removeAuthToken } from "./lib/api-client";
import notificationsService from "./lib/notificationsService";
import { AdminLoginPage } from "./components/auth/AdminLoginPage";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./components/ui/dialog";
import "./styles/design-overrides.css";

type FooterPanel = "documentation" | "support" | "privacy" | null;

const VALID_SECTIONS = new Set([
  "dashboard",
  "residents",
  "users",
  "dashboard-users",
  "residents-create",
  "units",
  "communities",
  "commercial",
  "compound-staff",
  "attendance",
  "blue-collar",
  "services",
  "permits",
  "tickets",
  "access",
  "lease",
  "rental",
  "complaints",
  "violations",
  "billing",
  "banners",
  "marketing",
  "notifications",
  "ordering",
  "surveys",
  "security",
  "gates",
  "gate-live",
  "amenities",
  "reports",
  "settings",
  "directory",
  "approvals",
  "hospitality",
]);

function normalizeSection(value?: string | null): string {
  const section = String(value ?? "")
    .replace(/^#/, "")
    .trim()
    .toLowerCase();
  return VALID_SECTIONS.has(section) ? section : "dashboard";
}

function getSectionFromLocation(): string {
  if (typeof window === "undefined") return "dashboard";
  if (window.location.hash) {
    return normalizeSection(window.location.hash);
  }
  const pathSegments = window.location.pathname.split("/").filter(Boolean);
  const pathSection = pathSegments[pathSegments.length - 1] ?? "";
  return normalizeSection(pathSection);
}

type LooseRow = Record<string, unknown>;

function toRows(value: unknown): LooseRow[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (entry): entry is LooseRow => Boolean(entry) && typeof entry === "object",
  );
}

function extractRows(payload: unknown): LooseRow[] {
  if (Array.isArray(payload)) return toRows(payload);
  if (payload && typeof payload === "object" && "data" in payload) {
    return toRows((payload as { data?: unknown }).data);
  }
  return [];
}

function mapNotificationRouteToSection(routeRaw?: string | null): string | null {
  const route = String(routeRaw ?? "").trim().toLowerCase();
  if (!route) return null;
  if (route.startsWith("#")) {
    const direct = normalizeSection(route);
    return direct === "dashboard" ? null : direct;
  }
  if (route.includes("gate-live")) return "gate-live";
  if (route.includes("services")) return "services";
  if (route.includes("permits")) return "permits";
  if (route.includes("commercial")) return "commercial";
  if (route.includes("compound-staff") || route.includes("compound_staff")) return "compound-staff";
  if (route.includes("attendance")) return "attendance";
  if (route.includes("blue-collar") || route.includes("blue_collar")) return "blue-collar";
  if (route.includes("complaints")) return "complaints";
  if (route.includes("violations")) return "violations";
  if (route.includes("tickets")) return "tickets";
  if (route.includes("access") || route.includes("qr")) return "access";
  if (route.includes("billing") || route.includes("payment") || route.includes("invoice")) return "billing";
  if (route.includes("security")) return "security";
  if (route.includes("hospitality")) return "hospitality";
  if (route.includes("gates")) return "gates";
  if (route.includes("gate")) return "gate-live";
  return null;
}

type PendingFocusEntity = {
  section: string;
  entityType?: string | null;
  entityId?: string | null;
  serviceCategory?: string | null;
};

/* ── Section label map ──────────────────────────────────────── */
const SECTION_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  residents: "Residents & Users",
  "residents-create": "New Resident",
  units: "Units",
  communities: "Communities",
  commercial: "Commercial",
  "compound-staff": "Compound Staff",
  attendance: "Attendance & Schedules",
  "blue-collar": "Blue Collar Workers",
  services: "Services",
  permits: "Permits & Requests",
  tickets: "Tickets Inbox",
  access: "Access Control",
  rental: "Rental & Lease",
  complaints: "Complaints",
  violations: "Violations",
  billing: "Payments & Invoices",
  marketing: "Marketing",
  notifications: "Notifications",
  ordering: "Ordering",
  surveys: "Surveys",
  security: "Emergency & Safety",
  gates: "Gates",
  "gate-live": "Gate Live Feed",
  amenities: "Amenities",
  reports: "Reports & Analytics",
  settings: "System Settings",
  directory: "Community Directory",
  approvals: "Registrations & Approvals",
  hospitality: "Hospitality",
};

export default function App() {
  const [activeSection, setActiveSection] = useState<string>(() => getSectionFromLocation());
  const [authenticated, setAuthenticated] = useState<boolean>(() => isAuthenticated());
  const [footerPanel, setFooterPanel] = useState<FooterPanel>(null);
  const [unseenAdminNotifications, setUnseenAdminNotifications] = useState(0);
  const seenNotificationIdsRef = useRef<Set<string>>(new Set());
  const [sidebarBadges, setSidebarBadges] = useState<SidebarBadgeCounts>({
    violations: 0, permits: 0, rental: 0, amenities: 0, approvals: 0,
  });

  const navigateToSection = useCallback((section: string) => {
    const next = normalizeSection(section);
    setActiveSection((prev) => (prev === next ? prev : next));
    if (typeof window !== "undefined") {
      const nextHash = `#${next}`;
      if (window.location.hash !== nextHash) {
        window.location.hash = nextHash;
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const syncFromHash = () => {
      const next = getSectionFromLocation();
      setActiveSection((prev) => (prev === next ? prev : next));
    };
    if (!window.location.hash) {
      const initialSection = getSectionFromLocation();
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${window.location.search}#${initialSection}`,
      );
    }
    syncFromHash();
    window.addEventListener("hashchange", syncFromHash);
    return () => window.removeEventListener("hashchange", syncFromHash);
  }, []);

  useEffect(() => {
    const onUnauthorized = () => {
      setAuthenticated(false);
      toast.error("Session expired", { description: "Please sign in again." });
    };
    window.addEventListener("auth:unauthorized", onUnauthorized as EventListener);
    return () => window.removeEventListener("auth:unauthorized", onUnauthorized as EventListener);
  }, []);

  useEffect(() => {
    if (!authenticated) {
      seenNotificationIdsRef.current = new Set();
      setUnseenAdminNotifications(0);
      return;
    }

    let mounted = true;

    const pollNotifications = async (isInitial = false) => {
      try {
        const response = await notificationsService.listLegacyAdmin({ page: 1, limit: 25 });
        if (!mounted) return;
        const rows = extractRows(response.data);
        const nextIds = new Set<string>();
        const newlyArrived: LooseRow[] = [];

        for (const row of rows) {
          const id = String(row?.id ?? "").trim();
          if (!id) continue;
          nextIds.add(id);
          if (!isInitial && !seenNotificationIdsRef.current.has(id)) {
            newlyArrived.push(row);
          }
        }

        seenNotificationIdsRef.current = nextIds;

        if (newlyArrived.length > 0) {
          setUnseenAdminNotifications((prev) => prev + newlyArrived.length);
          newlyArrived.slice(0, 2).forEach((row) => {
            const section =
              mapNotificationRouteToSection(String(row?.payload?.webRoute ?? "")) ||
              mapNotificationRouteToSection(String(row?.payload?.route ?? ""));
            const title = String(row?.title ?? "New dashboard notification");
            const description = section
              ? `New item routed to ${section}.`
              : "Open Notifications for details.";
            toast.message(title, section ? {
              description,
              action: {
                label: "Open",
                onClick: () => {
                  try {
                    const focusEntity: PendingFocusEntity = {
                      section,
                      entityType: String(row?.payload?.entityType ?? "").trim() || null,
                      entityId: String(row?.payload?.entityId ?? "").trim() || null,
                      serviceCategory: String(row?.payload?.serviceCategory ?? "").trim() || null,
                    };
                    if (focusEntity.entityId) {
                      window.sessionStorage.setItem("admin.focusEntity", JSON.stringify(focusEntity));
                    }
                  } catch { /* ignore */ }
                  navigateToSection(section);
                },
              },
            } : { description });
          });
        }
      } catch { /* Keep silent; notification poll should not break dashboard UX. */ }
    };

    void pollNotifications(true);
    const timer = window.setInterval(() => void pollNotifications(false), 15000);
    return () => { mounted = false; window.clearInterval(timer); };
  }, [authenticated, navigateToSection]);

  /* ── Sidebar badge counts polling ─────────────────────────── */
  useEffect(() => {
    if (!authenticated) {
      setSidebarBadges({ violations: 0, permits: 0, rental: 0, amenities: 0, approvals: 0 });
      return;
    }

    let mounted = true;

    const fetchBadgeCounts = async () => {
      try {
        const [violationsRes, permitsRes, rentalRes, amenitiesRes, approvalsRes] = await Promise.allSettled([
          apiClient.get("/violations/stats"),
          apiClient.get("/permits/stats"),
          apiClient.get("/rental/stats"),
          apiClient.get("/facilities/stats"),
          apiClient.get("/approvals/stats"),
        ]);

        if (!mounted) return;

        const val = (res: PromiseSettledResult<{ data: Record<string, unknown> }>, key: string): number => {
          if (res.status !== "fulfilled") return 0;
          const v = Number(res.value?.data?.[key]);
          return Number.isFinite(v) ? Math.max(0, Math.round(v)) : 0;
        };

        const rentalPending = val(rentalRes, "pendingRentRequests");
        const rentalExpiring = val(rentalRes, "expiringThisMonth");

        setSidebarBadges({
          violations: val(violationsRes, "pending"),
          permits: val(permitsRes, "pendingRequests"),
          rental: rentalPending + rentalExpiring,
          amenities: val(amenitiesRes, "pendingApprovals"),
          approvals: val(approvalsRes, "totalPending"),
        });
      } catch { /* Keep silent — badge polling should not break dashboard UX. */ }
    };

    void fetchBadgeCounts();
    const timer = window.setInterval(fetchBadgeCounts, 45_000);
    return () => { mounted = false; window.clearInterval(timer); };
  }, [authenticated]);

  useEffect(() => {
    if (activeSection === "notifications") setUnseenAdminNotifications(0);
  }, [activeSection]);

  useEffect(() => {
    if (!authenticated || typeof document === "undefined") return;

    const computeReadableTextColor = (hex: string) => {
      const safe = hex.replace("#", "");
      const r = parseInt(safe.slice(0, 2), 16);
      const g = parseInt(safe.slice(2, 4), 16);
      const b = parseInt(safe.slice(4, 6), 16);
      const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
      return luminance > 0.6 ? "#0F172A" : "#FFFFFF";
    };

    const applyBrandPrimary = (hex: string) => {
      const color = String(hex || "").trim();
      if (!/^#[0-9a-fA-F]{6}$/.test(color)) return;
      document.documentElement.style.setProperty("--primary", color);
      document.documentElement.style.setProperty("--color-primary", color);
      document.documentElement.style.setProperty("--primary-foreground", computeReadableTextColor(color));
    };

    const loadBranding = async () => {
      try {
        const response = await apiClient.get("/mobile/app-config");
        applyBrandPrimary(response.data?.brand?.primaryColor ?? "");
      } catch { /* Keep defaults if branding is unavailable. */ }
    };

    void loadBranding();
  }, [authenticated]);

  const handleLogout = () => {
    removeAuthToken();
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("auth_user_id");
    localStorage.removeItem("auth_email");
    setAuthenticated(false);
    navigateToSection("dashboard");
    toast.message("Signed out — see you next time.");
  };

  const currentAdminEmail = localStorage.getItem("auth_email") || "Admin";
  const currentAdminName = localStorage.getItem("auth_name") || currentAdminEmail.split("@")[0] || "Admin";
  const adminInitials = currentAdminName.split(/[ ._-]+/).filter(Boolean).map((p: string) => p[0]).join("").slice(0, 2).toUpperCase() || "AD";

  const sectionLabel = SECTION_LABELS[activeSection] ?? activeSection;

  const renderContent = () => {
    switch (activeSection) {
      case "dashboard":       return <DashboardOverview onNavigate={navigateToSection} />;
      case "residents":       return <ResidentManagement onNavigateToCreate={() => navigateToSection("residents-create")} />;
      case "users":           return <UsersHubPage />;
      case "dashboard-users": return <DashboardUsersPage />;
      case "residents-create":return <ResidentCreatePage onBack={() => navigateToSection("residents")} onCreated={() => navigateToSection("residents")} />;
      case "units":           return <UnitsManagement />;
      case "communities":     return <CommunitiesManagement />;
      case "commercial":      return <CommercialManagement />;
      case "compound-staff":  return <CompoundStaffManagement />;
      case "attendance":      return <AttendanceSchedules />;
      case "blue-collar":     return <BlueCollarManagement />;
      case "services":        return <ServiceManagement />;
      case "permits":         return <PermitsManagement />;
      case "tickets":         return <TicketsInbox />;
      case "access":          return <AccessControl />;
      case "lease":
      case "rental":          return <RentalManagement />;
      case "complaints":      return <ComplaintsViolations />;
      case "violations":      return <ViolationsManagement />;
      case "billing":         return <BillingPayments />;
      case "banners":
      case "marketing":       return <MarketingCenter />;
      case "notifications":   return <NotificationCenter />;
      case "ordering":        return <OrderingManagement />;
      case "surveys":         return <SurveysManagement />;
      case "security":        return <SecurityEmergency />;
      case "gates":           return <GatesManagement />;
      case "gate-live":       return <GateLiveFeed />;
      case "amenities":       return <AmenitiesManagement />;
      case "reports":         return <ReportsAnalytics />;
      case "settings":        return <SystemSettings />;
      case "directory":       return <CommunityDirectory />;
      case "approvals":       return <ApprovalsCenter />;
      case "hospitality":     return <HospitalityPage />;
      default:                return <DashboardOverview onNavigate={navigateToSection} />;
    }
  };

  if (!authenticated) {
    return (
      <>
        <AdminLoginPage onLoginSuccess={() => setAuthenticated(true)} />
        <Toaster />
      </>
    );
  }

  return (
    <>
      {/* ── Outer shell ───────────────────────────────────────────── */}
      <div className="flex overflow-hidden" style={{ height: "100vh", width: "100%" }}>

            {/* Dark sidebar */}
            <AppSidebar
              onNavigate={navigateToSection}
              activeSection={activeSection}
              unseenNotifications={unseenAdminNotifications}
              badgeCounts={sidebarBadges}
            />

            {/* Content column */}
            <div className="flex flex-1 flex-col overflow-hidden" style={{ background: "#F1F3F5" }}>

            {/* ── Top bar ────────────────────────────────────── */}
            <header className="h-16 bg-white border-b border-[#E5E7EB] flex items-center justify-between px-6 sticky top-0 z-50 flex-shrink-0">
              {/* Breadcrumb */}
              <div className="flex items-center gap-2">
                <span className="text-[13px] text-[#6B7280] font-medium">MG</span>
                <span className="mx-1.5 text-[#D1D5DB]">/</span>
                <span className="text-[13px] text-[#111827] font-semibold">{sectionLabel}</span>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2.5">
                {/* Bell */}
                <button
                  type="button"
                  onClick={() => { setUnseenAdminNotifications(0); navigateToSection("notifications"); }}
                  className="relative flex h-8 w-8 items-center justify-center rounded-[6px] text-[#9CA3AF] transition-colors hover:bg-[#F1F3F5] hover:text-[#374151]"
                  aria-label="Notifications"
                >
                  <svg className="h-[17px] w-[17px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                      d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  {unseenAdminNotifications > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 h-[7px] w-[7px] rounded-full bg-[#2563EB]" />
                  )}
                </button>

                <div className="h-5 w-px bg-[#E5E7EB]" />

                {/* User info */}
                <div className="hidden sm:block text-right">
                  <p className="text-[11.5px] font-semibold text-[#111827] leading-none"
                    style={{ fontFamily: "'Work Sans', sans-serif" }}>{currentAdminName}</p>
                  <p className="mt-[2px] text-[10.5px] leading-none text-[#9CA3AF]">{currentAdminEmail}</p>
                </div>

                {/* Avatar */}
                <div className="relative">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#2563EB] text-[11px] font-bold text-white">
                    {adminInitials}
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-[#22C55E] border-2 border-white" />
                </div>

                <div className="h-5 w-px bg-[#E5E7EB]" />

                {/* Sign out */}
                <button
                  type="button"
                  onClick={handleLogout}
                  className="text-[13px] font-medium text-[#374151] border border-[#E5E7EB] rounded px-3 py-1.5 hover:bg-[#F9FAFB] transition-colors"
                >
                  Sign out
                </button>
              </div>
            </header>

            {/* ── Page content ─────────────────────────────────── */}
            <main className="flex-1 overflow-y-auto">
              <div className="page-enter" key={activeSection}>
                {/* Dashboard manages its own full-bleed padding; other pages get a p-6 wrapper */}
                {activeSection === "dashboard"
                  ? renderContent()
                  : <div className="p-6">{renderContent()}</div>
                }
              </div>

              {/* Footer */}
              <footer className="border-t border-[#E5E7EB] px-6 py-4 mt-4" style={{ background: "#F1F3F5" }}>
                <div className="flex items-center justify-between">
                  <p className="text-[11px] text-[#B0ADA7]" style={{ fontFamily: "'Work Sans', sans-serif" }}>
                    MG Developments — Admin Dashboard © 2025 · Powered by Smart Station Solutions
                  </p>
                  <div className="flex items-center gap-4">
                    {(["documentation", "support", "privacy"] as FooterPanel[]).map((panel) => (
                      <button
                        key={panel}
                        type="button"
                        onClick={() => setFooterPanel(panel)}
                        className="text-[11px] text-[#B0ADA7] capitalize transition-colors hover:text-[#2563EB]"
                        style={{ fontFamily: "'Work Sans', sans-serif" }}
                      >
                        {panel}
                      </button>
                    ))}
                  </div>
                </div>
              </footer>
            </main>
            </div>{/* end content column */}
      </div>{/* end outer shell */}

      {/* Footer dialogs */}
      <Dialog open={footerPanel !== null} onOpenChange={(open) => !open && setFooterPanel(null)}>
        <DialogContent className="max-w-2xl">
          {footerPanel === "documentation" && (
            <>
              <DialogHeader>
                <DialogTitle>Documentation</DialogTitle>
                <DialogDescription>This demo uses the local backend and admin web in the same workspace.</DialogDescription>
              </DialogHeader>
              <div className="space-y-3 text-sm text-[#334155]">
                <p>Backend API docs (Swagger):{" "}
                  <a className="text-[#2563EB] underline" href="http://127.0.0.1:3001/api" target="_blank" rel="noreferrer">
                    http://127.0.0.1:3001/api
                  </a>
                </p>
                <p>Project documentation index: <code>documentation/README.md</code></p>
                <p>Admin demo audit matrix: <code>documentation/admin-demo-audit-matrix.md</code></p>
              </div>
            </>
          )}
          {footerPanel === "support" && (
            <>
              <DialogHeader>
                <DialogTitle>Support</DialogTitle>
                <DialogDescription>Operational support and demo troubleshooting contacts.</DialogDescription>
              </DialogHeader>
              <div className="space-y-3 text-sm text-[#334155]">
                <p>Primary support email: <a className="text-[#2563EB] underline" href="mailto:support@mg.com">support@mg.com</a></p>
                <p>Backend log file: <code>.local/backend-dev.log</code></p>
                <p>Frontend log file: <code>.local/admin-web-dev.log</code></p>
                <p>If login fails, verify backend is reachable at <code>http://127.0.0.1:3001</code>.</p>
              </div>
            </>
          )}
          {footerPanel === "privacy" && (
            <>
              <DialogHeader>
                <DialogTitle>Privacy Notice (Demo)</DialogTitle>
                <DialogDescription>Local development/demo usage only.</DialogDescription>
              </DialogHeader>
              <div className="space-y-3 text-sm text-[#334155]">
                <p>This environment is intended for development and demonstrations on a local machine.</p>
                <p>Seed/demo data may be generated and is not production customer data.</p>
                <p>External providers (SMTP/Firebase/FCM) should use sandbox/test credentials during demos.</p>
                <p>Do not reuse demo credentials in production environments.</p>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
      <Toaster />
    </>
  );
}

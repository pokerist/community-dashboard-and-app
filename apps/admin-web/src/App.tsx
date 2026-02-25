import { useCallback, useEffect, useMemo, useState } from "react";
import { SidebarProvider, SidebarInset } from "./components/ui/sidebar";
import { AppSidebar } from "./components/AppSidebar";
import { DashboardOverview } from "./components/pages/DashboardOverview";
import { ResidentManagement } from "./components/pages/ResidentManagement";
import { UnitsManagement } from "./components/pages/UnitsManagement";
import { ServiceManagement } from "./components/pages/ServiceManagement";
import { AccessControl } from "./components/pages/AccessControl";
import { LeaseManagement } from "./components/pages/LeaseManagement";
import { ComplaintsViolations } from "./components/pages/ComplaintsViolations";
import { BillingPayments } from "./components/pages/BillingPayments";
import { BannerManagement } from "./components/pages/BannerManagement";
import { NotificationCenter } from "./components/pages/NotificationCenter";
import { SecurityEmergency } from "./components/pages/SecurityEmergency";
import { AmenitiesManagement } from "./components/pages/AmenitiesManagement";
import { SmartHomeIntegration } from "./components/pages/SmartHomeIntegration";
import { ReportsAnalytics } from "./components/pages/ReportsAnalytics";
import { SystemSettings } from "./components/pages/SystemSettings";
import { Toaster } from "./components/ui/sonner";
import { toast } from "sonner";
import { isAuthenticated, removeAuthToken } from "./lib/api-client";
import { AdminLoginPage } from "./components/auth/AdminLoginPage";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./components/ui/dialog";

type FooterPanel = "documentation" | "support" | "privacy" | null;

const VALID_SECTIONS = new Set([
  "dashboard",
  "residents",
  "units",
  "services",
  "access",
  "lease",
  "complaints",
  "billing",
  "banners",
  "notifications",
  "security",
  "amenities",
  "smarthome",
  "reports",
  "settings",
]);

function normalizeSection(value?: string | null): string {
  const section = String(value ?? "")
    .replace(/^#/, "")
    .trim()
    .toLowerCase();
  return VALID_SECTIONS.has(section) ? section : "dashboard";
}

function getSectionFromHash(): string {
  if (typeof window === "undefined") return "dashboard";
  return normalizeSection(window.location.hash);
}

export default function App() {
  const [activeSection, setActiveSection] = useState<string>(() => getSectionFromHash());
  const [authenticated, setAuthenticated] = useState<boolean>(() => isAuthenticated());
  const [footerPanel, setFooterPanel] = useState<FooterPanel>(null);

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
      const next = getSectionFromHash();
      setActiveSection((prev) => (prev === next ? prev : next));
    };

    // Ensure a stable hash exists for refresh/deep-linking.
    if (!window.location.hash) {
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#dashboard`);
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
    return () =>
      window.removeEventListener("auth:unauthorized", onUnauthorized as EventListener);
  }, []);

  const currentDateLabel = useMemo(() => {
    try {
      return new Intl.DateTimeFormat(undefined, {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }).format(new Date());
    } catch {
      return new Date().toLocaleString();
    }
  }, [authenticated]);

  const currentAdminEmail = localStorage.getItem("auth_email") || "Admin";

  const handleLogout = () => {
    removeAuthToken();
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("auth_user_id");
    localStorage.removeItem("auth_email");
    setAuthenticated(false);
    navigateToSection("dashboard");
    toast.message("Signed out");
  };

  const renderContent = () => {
    switch (activeSection) {
      case "dashboard":
        return <DashboardOverview onNavigate={navigateToSection} />;
      case "residents":
        return <ResidentManagement />;
      case "units":
        return <UnitsManagement />;
      case "services":
        return <ServiceManagement />;
      case "access":
        return <AccessControl />;
      case "lease":
        return <LeaseManagement />;
      case "complaints":
        return <ComplaintsViolations />;
      case "billing":
        return <BillingPayments />;
      case "banners":
        return <BannerManagement />;
      case "notifications":
        return <NotificationCenter />;
      case "security":
        return <SecurityEmergency />;
      case "amenities":
        return <AmenitiesManagement />;
      case "smarthome":
        return <SmartHomeIntegration />;
      case "reports":
        return <ReportsAnalytics />;
      case "settings":
        return <SystemSettings />;
      default:
        return <DashboardOverview onNavigate={navigateToSection} />;
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
    <SidebarProvider>
      <div className="flex h-screen w-full bg-[#F9FAFB]">
        <AppSidebar onNavigate={navigateToSection} activeSection={activeSection} />
        <SidebarInset className="flex-1 overflow-hidden">
          <div className="h-full overflow-y-auto">
            {/* Header */}
            <header className="sticky top-0 z-10 bg-white border-b border-[#E5E7EB] px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-sm text-[#64748B]">
                    {currentDateLabel}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="hidden text-right sm:block">
                    <p className="text-xs text-[#64748B]">Signed in as</p>
                    <p className="text-sm font-medium text-[#0F172A]">{currentAdminEmail}</p>
                  </div>
                  <div className="relative">
                    <div 
                      className="w-8 h-8 rounded-full bg-[#F3F4F6] flex items-center justify-center cursor-pointer hover:bg-[#E5E7EB] transition-colors"
                      onClick={() => navigateToSection("notifications")}
                    >
                      <svg
                        className="w-5 h-5 text-[#64748B]"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                        />
                      </svg>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="inline-flex items-center justify-center rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-xs font-medium text-[#334155] transition hover:border-[#CBD5E1] hover:bg-[#F8FAFC]"
                  >
                    Logout
                  </button>
                </div>
              </div>
            </header>

            {/* Main Content */}
            <main className="p-6">{renderContent()}</main>

            {/* Footer */}
            <footer className="border-t border-[#E5E7EB] bg-white px-6 py-4 mt-12">
              <div className="flex items-center justify-between text-xs text-[#64748B]">
                <p>Al Karma Developments — Admin Dashboard © 2025 | Powered by Smart Station Solutions (SSS)</p>
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => setFooterPanel("documentation")}
                    className="hover:text-[#00B386] transition-colors"
                  >
                    Documentation
                  </button>
                  <button
                    type="button"
                    onClick={() => setFooterPanel("support")}
                    className="hover:text-[#00B386] transition-colors"
                  >
                    Support
                  </button>
                  <button
                    type="button"
                    onClick={() => setFooterPanel("privacy")}
                    className="hover:text-[#00B386] transition-colors"
                  >
                    Privacy
                  </button>
                </div>
              </div>
            </footer>
          </div>
        </SidebarInset>
      </div>
      <Dialog open={footerPanel !== null} onOpenChange={(open) => !open && setFooterPanel(null)}>
        <DialogContent className="max-w-2xl">
          {footerPanel === "documentation" ? (
            <>
              <DialogHeader>
                <DialogTitle>Documentation</DialogTitle>
                <DialogDescription>
                  This demo uses the local backend and admin web in the same workspace.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 text-sm text-[#334155]">
                <p>
                  Backend API docs (Swagger):{" "}
                  <a
                    className="text-[#0B5FFF] underline"
                    href="http://127.0.0.1:3001/api"
                    target="_blank"
                    rel="noreferrer"
                  >
                    http://127.0.0.1:3001/api
                  </a>
                </p>
                <p>Project documentation index: <code>documentation/README.md</code></p>
                <p>Admin demo audit matrix: <code>documentation/admin-demo-audit-matrix.md</code></p>
              </div>
            </>
          ) : null}

          {footerPanel === "support" ? (
            <>
              <DialogHeader>
                <DialogTitle>Support</DialogTitle>
                <DialogDescription>Operational support and demo troubleshooting contacts.</DialogDescription>
              </DialogHeader>
              <div className="space-y-3 text-sm text-[#334155]">
                <p>Primary support email: <a className="text-[#0B5FFF] underline" href="mailto:support@alkarma.com">support@alkarma.com</a></p>
                <p>Backend log file: <code>.local/backend-dev.log</code></p>
                <p>Frontend log file: <code>.local/admin-web-dev.log</code></p>
                <p>If login fails, verify backend is reachable at <code>http://127.0.0.1:3001</code>.</p>
              </div>
            </>
          ) : null}

          {footerPanel === "privacy" ? (
            <>
              <DialogHeader>
                <DialogTitle>Privacy Notice (Demo)</DialogTitle>
                <DialogDescription>Local development/demo usage only.</DialogDescription>
              </DialogHeader>
              <div className="space-y-3 text-sm text-[#334155]">
                <p>This environment is intended for development and demonstrations on a local machine.</p>
                <p>Seed/demo data may be generated and is not production customer data.</p>
                <p>External providers (SMTP/Twilio/FCM) should use sandbox/test credentials during demos.</p>
                <p>Do not reuse demo credentials in production environments.</p>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
      <Toaster />
    </SidebarProvider>
  );
}

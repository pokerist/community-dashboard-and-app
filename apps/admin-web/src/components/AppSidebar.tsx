import {
  LayoutDashboard,
  Users,
  Building,
  Building2,
  Wrench,
  ClipboardList,
  FileText,
  MessageSquare,
  AlertTriangle,
  CreditCard,
  Megaphone,
  Bell,
  DoorOpen,
  Dumbbell,
  Settings,
  BarChart3,
  ClipboardCheck,
  ScanSearch,
  Hotel,
  ChevronDown,
  ShoppingCart,
  BookOpen,
  Shield,
  Ticket,
} from "lucide-react";
import { cn } from "./ui/utils";
import alkarmaLogo from "figma:asset/0c7a0cd1f45864e0108618f40b9f2a75ac95e9dc.png";
import type { ComponentType } from "react";

type NavItem = {
  title: string;
  icon: ComponentType<{ className?: string }>;
  section: string;
  match?: string[];
  soon?: boolean;
};

type NavSection = {
  group: string;
  items: NavItem[];
};

const menuSections: NavSection[] = [
  {
    group: "Overview",
    items: [
      { title: "Dashboard", icon: LayoutDashboard, section: "dashboard" },
    ],
  },
  {
    group: "Property",
    items: [
      { title: "Communities", icon: Building, section: "communities" },
      { title: "Units", icon: Building2, section: "units" },
      { title: "Commercial", icon: Building2, section: "commercial" },
    ],
  },
  {
    group: "People",
    items: [
      { title: "Residents & Users", icon: Users, section: "residents", match: ["residents", "residents-create", "users"] },
      { title: "Registrations", icon: ClipboardCheck, section: "approvals" },
      { title: "Compound Staff", icon: Users, section: "compound-staff" },
      { title: "Blue Collar", icon: Wrench, section: "blue-collar" },
    ],
  },
  {
    group: "Access",
    items: [
      { title: "Gates", icon: DoorOpen, section: "gates", match: ["gates", "gate-live"] },
      { title: "Access Control", icon: ScanSearch, section: "access" },
    ],
  },
  {
    group: "Financials",
    items: [
      { title: "Rental & Lease", icon: FileText, section: "rental" },
      { title: "Payments & Invoices", icon: CreditCard, section: "billing" },
    ],
  },
  {
    group: "Operations",
    items: [
      { title: "Complaints", icon: MessageSquare, section: "complaints" },
      { title: "Violations", icon: AlertTriangle, section: "violations" },
      { title: "Tickets Inbox", icon: Ticket, section: "tickets" },
      { title: "Services", icon: Wrench, section: "services" },
      { title: "Permits & Requests", icon: ClipboardCheck, section: "permits" },
      { title: "Amenities", icon: Dumbbell, section: "amenities" },
      { title: "Ordering", icon: ShoppingCart, section: "ordering" },
    ],
  },
  {
    group: "Engagement",
    items: [
      { title: "Notifications", icon: Bell, section: "notifications" },
      { title: "Marketing", icon: Megaphone, section: "marketing" },
      { title: "Surveys", icon: BarChart3, section: "surveys" },
    ],
  },
  {
    group: "Insights",
    items: [
      { title: "Reports & Analytics", icon: BarChart3, section: "reports" },
      { title: "Community Directory", icon: BookOpen, section: "directory" },
    ],
  },
  {
    group: "System",
    items: [
      { title: "Security", icon: Shield, section: "security" },
      { title: "System Settings", icon: Settings, section: "settings" },
      { title: "Hospitality", icon: Hotel, section: "hospitality", soon: true },
    ],
  },
];

interface AppSidebarProps {
  onNavigate: (section: string) => void;
  activeSection: string;
  unseenNotifications?: number;
}

export function AppSidebar({
  onNavigate,
  activeSection,
  unseenNotifications = 0,
}: AppSidebarProps) {
  const authEmail =
    (typeof window !== "undefined" ? localStorage.getItem("auth_email") : null) ||
    "admin@mg.com";
  const authName =
    (typeof window !== "undefined" ? localStorage.getItem("auth_name") : null) ||
    authEmail.split("@")[0] ||
    "Admin";
  const initials = authName
    .split(/[ ._-]+/)
    .filter(Boolean)
    .map((p: string) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "AD";

  return (
    <div
      className="flex flex-shrink-0 flex-col overflow-hidden"
      style={{
        width: "240px",
        height: "100%",
        background: "#FAFAF9",
        borderRight: "1px solid #F0EEE9",
      }}
    >
      {/* ── Logo zone ─────────────────────────────────────────── */}
      <div
        className="flex items-center gap-3 px-4 flex-shrink-0 border-b border-[#F0EEE9]"
        style={{ height: "57px" }}
      >
        <img src={alkarmaLogo} alt="MG" className="h-8 w-auto flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p
            className="text-[13.5px] font-bold text-[#111827] leading-none truncate"
            style={{ fontFamily: "'Work Sans', sans-serif", letterSpacing: "-0.01em" }}
          >
            MG Community
          </p>
          <p className="mt-[3px] text-[10.5px] text-[#9CA3AF] leading-none font-medium">
            Admin Console
          </p>
        </div>
        <ChevronDown className="h-3.5 w-3.5 flex-shrink-0 text-[#C4C2BE]" />
      </div>

      {/* ── Navigation ────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-3 py-3">
        {menuSections.map((section, sIdx) => (
          <div key={section.group} style={{ marginBottom: sIdx < menuSections.length - 1 ? "8px" : "0" }}>
            {/* Section group label */}
            <p
              className="text-[10px] font-semibold uppercase tracking-[0.09em] text-[#C4C2BE] px-2 mb-1"
              style={{
                fontFamily: "'Work Sans', sans-serif",
                marginTop: sIdx === 0 ? "4px" : "16px",
              }}
            >
              {section.group}
            </p>

            {/* Items with tree structure lines */}
            <div className="relative">
              {/* Vertical tree line connecting items */}
              {section.items.length > 1 && (
                <div
                  className="absolute bg-[#ECEAE7] pointer-events-none"
                  style={{
                    left: "18px",
                    top: "18px",
                    bottom: "18px",
                    width: "1px",
                  }}
                />
              )}

              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive =
                  activeSection === item.section ||
                  (item.match?.includes(activeSection) ?? false);
                const hasBadge =
                  item.section === "notifications" && unseenNotifications > 0;

                return (
                  <div key={item.section} className="relative">
                    {/* Horizontal stub from tree line */}
                    {section.items.length > 1 && (
                      <div
                        className="absolute bg-[#ECEAE7] pointer-events-none"
                        style={{
                          left: "18px",
                          top: "50%",
                          width: "8px",
                          height: "1px",
                          transform: "translateY(-50%)",
                        }}
                      />
                    )}

                    <button
                      type="button"
                      onClick={() => onNavigate(item.section)}
                      className={cn(
                        "relative flex w-full items-center gap-2 rounded-[5px] py-[5px] text-left transition-all duration-150",
                        section.items.length > 1 ? "pl-7 pr-2" : "px-2",
                        isActive
                          ? "text-[#111827]"
                          : "text-[#7A7875] hover:text-[#111827]",
                      )}
                      style={{ fontFamily: "'Work Sans', sans-serif" }}
                    >
                      {/* Icon — filled background when active */}
                      <div
                        className={cn(
                          "flex h-[22px] w-[22px] flex-shrink-0 items-center justify-center rounded-[5px] transition-all duration-150",
                          isActive ? "bg-[#2563EB]" : "bg-transparent",
                        )}
                      >
                        <Icon
                          className={cn(
                            "h-3.5 w-3.5",
                            isActive ? "text-white" : "text-[#B0ADA7]",
                          )}
                        />
                      </div>

                      {/* Label */}
                      <span
                        className={cn(
                          "flex-1 truncate text-[12.5px]",
                          isActive ? "font-semibold" : "font-medium",
                        )}
                      >
                        {item.title}
                      </span>

                      {/* Badges */}
                      {hasBadge && (
                        <span className="ml-auto flex h-4 min-w-[16px] items-center justify-center rounded-[4px] bg-[#2563EB] px-1 text-[9px] font-bold text-white tabular-nums">
                          {unseenNotifications > 99 ? "99+" : unseenNotifications}
                        </span>
                      )}
                      {item.soon && (
                        <span className="ml-auto text-[9px] font-bold uppercase tracking-[0.06em] text-[#C4C2BE]">
                          Soon
                        </span>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* ── User zone ─────────────────────────────────────────── */}
      <div className="flex-shrink-0 border-t border-[#F0EEE9] p-3">
        <div className="flex items-center gap-2.5 rounded-[6px] px-2 py-2 transition-colors hover:bg-[#F0EEE9] cursor-pointer">
          <div className="relative flex-shrink-0">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#2563EB] text-[10px] font-bold text-white">
              {initials}
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-[#22C55E] border-2 border-[#FAFAF9]" />
          </div>
          <div className="flex-1 min-w-0">
            <p
              className="text-[12px] font-semibold text-[#111827] truncate leading-none"
              style={{ fontFamily: "'Work Sans', sans-serif" }}
            >
              {authName}
            </p>
            <p className="mt-[3px] text-[10px] text-[#9CA3AF] truncate leading-none">
              {authEmail}
            </p>
          </div>
          <ChevronDown className="h-3 w-3 text-[#C4C2BE] flex-shrink-0" />
        </div>
      </div>
    </div>
  );
}

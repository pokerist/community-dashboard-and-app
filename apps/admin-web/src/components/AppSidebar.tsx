import {
  LayoutDashboard,
  Users,
  Building,
  Building2,
  Wrench,
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
  Clock,
  ScanSearch,
  Hotel,
  ChevronDown,
  ShoppingCart,
  BookOpen,
  Shield,
  Ticket,
} from "lucide-react";
import logo from "../assets/0c7a0cd1f45864e0108618f40b9f2a75ac95e9dc.png";
import type { ComponentType } from "react";

type NavItem = {
  title: string;
  icon: ComponentType<{ style?: React.CSSProperties; className?: string }>;
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
      { title: "Attendance & Schedules", icon: Clock, section: "attendance" },
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
      { title: "Emergency & Safety", icon: Shield, section: "security" },
      { title: "System Settings", icon: Settings, section: "settings" },
      { title: "Hospitality", icon: Hotel, section: "hospitality", soon: true },
    ],
  },
];

export type SidebarBadgeCounts = {
  violations: number;
  permits: number;
  rental: number;
  amenities: number;
  approvals: number;
};

interface AppSidebarProps {
  onNavigate: (section: string) => void;
  activeSection: string;
  unseenNotifications?: number;
  badgeCounts?: SidebarBadgeCounts;
}

export function AppSidebar({ onNavigate, activeSection, unseenNotifications = 0, badgeCounts }: AppSidebarProps) {
  const authEmail =
    (typeof window !== "undefined" ? localStorage.getItem("auth_email") : null) || "admin@mg.com";
  const authName =
    (typeof window !== "undefined" ? localStorage.getItem("auth_name") : null) ||
    authEmail.split("@")[0] || "Admin";
  const initials = authName
    .split(/[ ._-]+/).filter(Boolean)
    .map((p: string) => p[0]).join("").slice(0, 2).toUpperCase() || "AD";

  return (
    <div style={{
      width: "240px", height: "100%",
      background: "#FAFAFA",
      borderRight: "1px solid #EBEBEB",
      display: "flex", flexDirection: "column",
      flexShrink: 0, overflow: "hidden",
      fontFamily: "'Work Sans', sans-serif",
    }}>

      {/* ── Logo zone ──────────────────────────────────────────── */}
      <div style={{
        height: "60px", padding: "0 14px",
        display: "flex", alignItems: "center", gap: "10px",
        borderBottom: "1px solid #EBEBEB", flexShrink: 0,
        paddingTop: "8px",
        paddingBottom: "8px",
      }}>

        {/* Circle logo — dark bg, white logo, Codename-style */}
        <div style={{
          width: "40px", height: "40px",
          borderRadius: "50%",
          background: "#111827",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0, overflow: "hidden",
          boxShadow: "0 2px 6px rgba(0,0,0,0.20)",
        }}>
          <img
            src={logo}
            alt="MG"
            style={{
              width: "100px", height: "100px",
              objectFit: "contain",
              // Forces logo to render white on the dark circle
              filter: "brightness(0) invert(1)",
              display: "block",
            }}
          />
        </div>

        {/* Brand name + chevron */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <p style={{
              fontSize: "13.5px", fontWeight: 700,
              color: "#111827", lineHeight: 1,
              letterSpacing: "-0.015em",
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            }}>
              MG Developments
            </p>
            <ChevronDown style={{ width: "13px", height: "13px", color: "#C4C4C4", flexShrink: 0, marginTop: "1px" }} />
          </div>
          <p style={{
            marginTop: "3px", fontSize: "10.5px",
            color: "#9CA3AF", lineHeight: 1, fontWeight: 500,
          }}>
            Admin Console
          </p>
        </div>
      </div>

      {/* ── Navigation ─────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: "auto", padding: "8px", scrollbarWidth: "none" }}>
        {menuSections.map((section, sIdx) => (
          <div key={section.group} style={{ marginBottom: "2px" }}>

            {/* Group label */}
            <p style={{
              fontSize: "10px", fontWeight: 600,
              textTransform: "uppercase", letterSpacing: "0.08em",
              color: "#C4C4C4",
              padding: "0 8px",
              marginTop: sIdx === 0 ? "4px" : "20px",
              marginBottom: "4px",
            }}>
              {section.group}
            </p>

            {/* Items */}
            <div style={{ display: "flex", flexDirection: "column", gap: "1px" }}>
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeSection === item.section || (item.match?.includes(activeSection) ?? false);

                // Determine badge count for this nav item
                let badgeCount = 0;
                if (item.section === "notifications" && unseenNotifications > 0) {
                  badgeCount = unseenNotifications;
                } else if (badgeCounts) {
                  const key = item.section as keyof SidebarBadgeCounts;
                  if (key in badgeCounts && badgeCounts[key] > 0) {
                    badgeCount = badgeCounts[key];
                  }
                }
                const hasBadge = badgeCount > 0;

                return (
                  <button
                    key={item.section}
                    type="button"
                    onClick={() => onNavigate(item.section)}
                    style={{
                      display: "flex", alignItems: "center", gap: "8px",
                      width: "100%", padding: "6px 8px",
                      borderRadius: "6px", border: "none",
                      cursor: "pointer", textAlign: "left",
                      background: isActive ? "#EFEFEF" : "transparent",
                      transition: "background 120ms ease",
                      fontFamily: "'Work Sans', sans-serif",
                    }}
                    onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = "#F5F5F5"; }}
                    onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
                  >
                    {/* Icon */}
                    <div style={{
                      width: "20px", height: "20px", flexShrink: 0,
                      borderRadius: "4px",
                      background: isActive ? "#111827" : "transparent",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      transition: "background 120ms ease",
                    }}>
                      <Icon style={{ width: "12px", height: "12px", color: isActive ? "#ffffff" : "#9CA3AF" }} />
                    </div>

                    {/* Label */}
                    <span style={{
                      flex: 1, fontSize: "13px",
                      fontWeight: isActive ? 600 : 400,
                      color: isActive ? "#111827" : "#6B7280",
                      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                      letterSpacing: "-0.005em",
                    }}>
                      {item.title}
                    </span>

                    {/* Count badge */}
                    {hasBadge && (
                      <span style={{
                        marginLeft: "auto",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        minWidth: "18px", height: "18px", borderRadius: "9px",
                        background: "#EF4444", color: "#fff",
                        fontSize: "9px", fontWeight: 700, padding: "0 4px",
                        fontFamily: "'DM Mono', monospace",
                      }}>
                        {badgeCount > 99 ? "99+" : badgeCount}
                      </span>
                    )}

                    {/* Soon badge */}
                    {item.soon && (
                      <span style={{
                        marginLeft: "auto", fontSize: "9px", fontWeight: 700,
                        textTransform: "uppercase", letterSpacing: "0.06em", color: "#D1D5DB",
                      }}>
                        Soon
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* ── User zone ──────────────────────────────────────────── */}
      <div style={{ flexShrink: 0, padding: "8px", borderTop: "1px solid #EBEBEB" }}>
        <div
          style={{
            display: "flex", alignItems: "center", gap: "10px",
            padding: "8px", borderRadius: "8px",
            cursor: "pointer", transition: "background 120ms ease",
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = "#F5F5F5"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}
        >
          {/* Avatar — circular dark, mirrors logo language */}
          <div style={{ position: "relative", flexShrink: 0 }}>
            <div style={{
              width: "30px", height: "30px", borderRadius: "50%",
              background: "#111827",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "10.5px", fontWeight: 700, color: "#fff",
              letterSpacing: "0.02em", fontFamily: "'Work Sans', sans-serif",
            }}>
              {initials}
            </div>
            <span style={{
              position: "absolute", bottom: "0", right: "0",
              width: "8px", height: "8px", borderRadius: "50%",
              background: "#22C55E", border: "2px solid #FAFAFA",
            }} />
          </div>

          {/* Info */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{
              fontSize: "12px", fontWeight: 600, color: "#111827", lineHeight: 1,
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            }}>
              {authName}
            </p>
            <p style={{
              marginTop: "3px", fontSize: "10px", color: "#9CA3AF", lineHeight: 1,
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            }}>
              {authEmail}
            </p>
          </div>

          <ChevronDown style={{ width: "12px", height: "12px", color: "#D1D5DB", flexShrink: 0 }} />
        </div>
      </div>

    </div>
  );
}
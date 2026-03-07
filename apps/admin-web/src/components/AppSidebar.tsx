import {
  LayoutDashboard,
  Users,
  Building2,
  Building,
  Wrench,
  ClipboardList,
  Inbox,
  QrCode,
  FileText,
  MessageSquare,
  AlertTriangle,
  CreditCard,
  Megaphone,
  Bell,
  Shield,
  DoorOpen,
  Dumbbell,
  Settings,
  BarChart3,
  ClipboardCheck,
  MapPin,
  ScanSearch,
  ChevronRight,
  Hotel,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "./ui/sidebar";
import alkarmaLogo from "figma:asset/0c7a0cd1f45864e0108618f40b9f2a75ac95e9dc.png";

interface MenuSection {
  group: string;
  items: Array<{
    title: string;
    icon: any;
    url: string;
    soon?: boolean;
  }>;
}

const menuSections: MenuSection[] = [
  {
    group: "OVERVIEW",
    items: [
      {
        title: "Dashboard & Statistics",
        icon: LayoutDashboard,
        url: "#dashboard",
      },
    ],
  },
  {
    group: "PROPERTY",
    items: [
      {
        title: "Communities",
        icon: Building,
        url: "#communities",
      },
      {
        title: "Units",
        icon: Building2,
        url: "#units",
      },
    ],
  },
  {
    group: "PEOPLE",
    items: [
      {
        title: "Residents & Users",
        icon: Users,
        url: "#residents",
      },
      {
        title: "Registrations & Approvals",
        icon: ClipboardCheck,
        url: "#approvals",
      },
      {
        title: "Commercial",
        icon: Building2,
        url: "#commercial",
      },
      {
        title: "Compound Staff",
        icon: Users,
        url: "#compound-staff",
      },
    ],
  },
  {
    group: "ACCESS CONTROL",
    items: [
      {
        title: "Gates",
        icon: DoorOpen,
        url: "#gates",
      },
      {
        title: "Blue Collar Workers",
        icon: ClipboardList,
        url: "#blue-collar",
      },
    ],
  },
  {
    group: "FINANCIALS",
    items: [
      {
        title: "Rental & Lease",
        icon: FileText,
        url: "#rental",
      },
      {
        title: "Payments & Invoices",
        icon: CreditCard,
        url: "#billing",
      },
    ],
  },
  {
    group: "OPERATIONS",
    items: [
      {
        title: "Permits & Requests",
        icon: ClipboardCheck,
        url: "#permits",
      },
      {
        title: "Services",
        icon: Wrench,
        url: "#services",
      },
      {
        title: "Complaints",
        icon: MessageSquare,
        url: "#complaints",
      },
      {
        title: "Violations",
        icon: AlertTriangle,
        url: "#violations",
      },
      {
        title: "Amenities",
        icon: Dumbbell,
        url: "#amenities",
      },
      {
        title: "Ordering",
        icon: ClipboardList,
        url: "#ordering",
      },
      {
        title: "Emergency (Gates Live Feed)",
        icon: ScanSearch,
        url: "#gate-live",
      },
    ],
  },
  {
    group: "ENGAGEMENT",
    items: [
      {
        title: "Notifications",
        icon: Bell,
        url: "#notifications",
      },
      {
        title: "Marketing",
        icon: Megaphone,
        url: "#marketing",
      },
      {
        title: "Surveys",
        icon: BarChart3,
        url: "#surveys",
      },
    ],
  },
  {
    group: "INSIGHTS",
    items: [
      {
        title: "Reports & Analytics",
        icon: BarChart3,
        url: "#reports",
      },
    ],
  },
  {
    group: "SYSTEM",
    items: [
      {
        title: "System Settings",
        icon: Settings,
        url: "#settings",
      },
      {
        title: "Hospitality (Coming Soon)",
        icon: Hotel,
        url: "#hospitality",
        soon: true,
      },
    ],
  },
];

interface AppSidebarProps {
  onNavigate: (section: string) => void;
  activeSection: string;
}

export function AppSidebar({ onNavigate, activeSection }: AppSidebarProps) {
  const authEmail =
    (typeof window !== "undefined" ? localStorage.getItem("auth_email") : null) ||
    "admin@alkarma.com";
  const authName =
    (typeof window !== "undefined" ? localStorage.getItem("auth_name") : null) ||
    authEmail.split("@")[0] ||
    "Admin";
  const initials = authName
    .split(/[ ._-]+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "AD";

  return (
    <Sidebar className="border-r border-[#E5E7EB]">
      <SidebarHeader className="p-6 border-b border-[#E5E7EB]">
        <div className="flex items-center gap-3">
          <img src={alkarmaLogo} alt="Al Karma" className="h-8" />
        </div>
        <p className="text-xs text-[#64748B] mt-2">Admin Dashboard</p>
      </SidebarHeader>
      
      <SidebarContent className="px-3">
        {menuSections.map((section) => (
          <SidebarGroup key={section.group}>
            <SidebarGroupLabel className="text-xs text-[#64748B] px-3 mb-2">
              {section.group}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    {(() => {
                      const sectionKey = item.url.replace("#", "");
                      const isActive =
                        activeSection === sectionKey ||
                        (sectionKey === "residents" && activeSection === "residents-create");
                      return (
                        <SidebarMenuButton
                          onClick={() => onNavigate(sectionKey)}
                          isActive={isActive}
                          className={`rounded-lg transition-all ${
                            isActive
                              ? "bg-[#00B386]/10 text-[#00B386] border-l-4 border-[#00B386] pl-3"
                              : "hover:bg-[#F9FAFB]"
                          }`}
                        >
                          <item.icon className="w-4 h-4" />
                          <span>{item.title}</span>
                          {item.soon ? (
                            <span className="ml-auto text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-1.5 py-0.5 rounded-full">
                              Soon
                            </span>
                          ) : null}
                        </SidebarMenuButton>
                      );
                    })()}
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-[#E5E7EB]">
        <div className="flex items-center gap-3 p-3 rounded-lg bg-[#F9FAFB] cursor-pointer hover:bg-[#F3F4F6] transition-colors">
          <div className="w-10 h-10 rounded-full bg-[#00B386] flex items-center justify-center text-white">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-[#1E293B] truncate">{authName}</p>
            <p className="text-xs text-[#64748B] truncate">{authEmail}</p>
          </div>
          <ChevronRight className="w-4 h-4 text-[#64748B]" />
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

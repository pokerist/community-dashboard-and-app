import {
  LayoutDashboard,
  Users,
  Building2,
  Wrench,
  ClipboardList,
  Inbox,
  QrCode,
  FileText,
  MessageSquare,
  CreditCard,
  Image,
  Bell,
  Shield,
  Dumbbell,
  Settings,
  BarChart3,
  ClipboardCheck,
  MapPin,
  ScanSearch,
  ChevronRight,
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

const menuItems = [
  {
    title: "Dashboard",
    icon: LayoutDashboard,
    url: "#dashboard",
    active: true,
  },
  {
    title: "Residents",
    icon: Users,
    url: "#residents",
  },
  {
    title: "Dashboard Users",
    icon: Users,
    url: "#dashboard-users",
  },
  {
    title: "Units",
    icon: Building2,
    url: "#units",
  },
  {
    title: "Services",
    icon: Wrench,
    url: "#services",
  },
  {
    title: "Requests",
    icon: ClipboardList,
    url: "#requests",
  },
  {
    title: "Tickets Inbox",
    icon: Inbox,
    url: "#tickets",
  },
  {
    title: "Access Control",
    icon: QrCode,
    url: "#access",
  },
  {
    title: "Lease Management",
    icon: FileText,
    url: "#lease",
  },
];

const secondaryItems = [
  {
    title: "Complaints & Violations",
    icon: MessageSquare,
    url: "#complaints",
  },
  {
    title: "Billing & Payments",
    icon: CreditCard,
    url: "#billing",
  },
  {
    title: "Banner Management",
    icon: Image,
    url: "#banners",
  },
  {
    title: "Notifications",
    icon: Bell,
    url: "#notifications",
  },
  {
    title: "Security",
    icon: Shield,
    url: "#security",
  },
  {
    title: "Gate Live Feed",
    icon: ScanSearch,
    url: "#gate-live",
  },
  {
    title: "Amenities",
    icon: Dumbbell,
    url: "#amenities",
  },
];

const bottomItems = [
  {
    title: "Reports & Analytics",
    icon: BarChart3,
    url: "#reports",
  },
  {
    title: "Help & Discover",
    icon: MapPin,
    url: "#directory",
  },
  {
    title: "Approvals Center",
    icon: ClipboardCheck,
    url: "#approvals",
  },
  {
    title: "System Settings",
    icon: Settings,
    url: "#settings",
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
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs text-[#64748B] px-3 mb-2">
            Main Menu
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  {(() => {
                    const section = item.url.replace("#", "");
                    const isActive =
                      activeSection === section ||
                      (section === "residents" && activeSection === "residents-create");
                    return (
                  <SidebarMenuButton
                    onClick={() => onNavigate(section)}
                    isActive={isActive}
                    className={`rounded-lg transition-all ${
                      isActive
                        ? "bg-[#00B386]/10 text-[#00B386] border-l-4 border-[#00B386] pl-3"
                        : "hover:bg-[#F9FAFB]"
                    }`}
                  >
                    <item.icon className="w-4 h-4" />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                    );
                  })()}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="text-xs text-[#64748B] px-3 mb-2">
            Management
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {secondaryItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    onClick={() => onNavigate(item.url.replace("#", ""))}
                    isActive={activeSection === item.url.replace("#", "")}
                    className={`rounded-lg transition-all ${
                      activeSection === item.url.replace("#", "")
                        ? "bg-[#00B386]/10 text-[#00B386] border-l-4 border-[#00B386] pl-3"
                        : "hover:bg-[#F9FAFB]"
                    }`}
                  >
                    <item.icon className="w-4 h-4" />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {bottomItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    onClick={() => onNavigate(item.url.replace("#", ""))}
                    isActive={activeSection === item.url.replace("#", "")}
                    className={`rounded-lg transition-all ${
                      activeSection === item.url.replace("#", "")
                        ? "bg-[#00B386]/10 text-[#00B386] border-l-4 border-[#00B386] pl-3"
                        : "hover:bg-[#F9FAFB]"
                    }`}
                  >
                    <item.icon className="w-4 h-4" />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
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

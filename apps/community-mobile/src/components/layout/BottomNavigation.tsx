import { Home, QrCode, User } from "lucide-react";

interface BottomNavigationProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  user?: any;
}

export function BottomNavigation({ activeTab, onTabChange, user }: BottomNavigationProps) {
  const isPreConstruction = user?.unitStatus === "Not Delivered" || user?.accountType === "Not Delivered Owner";
  
  // Simple 3-tab navigation
  const tabs = [
    { id: "home", icon: Home, label: "Home" },
    { id: "qr", icon: QrCode, label: "QR Codes" },
    { id: "profile", icon: User, label: "Profile" }
  ];

  // Hide QR Codes for pre-construction owners
  const visibleTabs = isPreConstruction 
    ? tabs.filter(tab => tab.id !== "qr")
    : tabs;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#E2E8F0] shadow-lg z-50">
      <div className="flex items-center justify-around h-20 max-w-lg mx-auto px-4">
        {visibleTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className="flex flex-col items-center justify-center flex-1 h-full relative transition-colors"
            >
              <div className="relative">
                <Icon
                  className={`w-6 h-6 transition-colors ${
                    isActive ? "text-[#2a3e35]" : "text-[#64748B]"
                  }`}
                />
              </div>
              <span
                className={`text-xs mt-1 transition-colors ${
                  isActive ? "text-[#2a3e35]" : "text-[#64748B]"
                }`}
              >
                {tab.label}
              </span>
              {isActive && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-12 h-1 bg-[#2a3e35] rounded-b-full" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

import { motion, AnimatePresence } from "motion/react";
import {
  Home,
  CreditCard,
  AlertCircle,
  MapPin,
  Phone,
  HelpCircle,
  LogOut,
  X,
  User,
  QrCode,
  FileText,
  Briefcase,
  Flag,
  Smartphone,
  MapPinned,
  Users,
  Building2,
  ChevronRight
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";

interface DrawerMenuProps {
  isOpen: boolean;
  onClose: () => void;
  user: any;
  currentUnit?: any;
  onNavigate: (screen: string) => void;
  onLogout: () => void;
  onUnitChange?: (unitId: string) => void;
}

export function DrawerMenu({ isOpen, onClose, user, currentUnit, onNavigate, onLogout, onUnitChange }: DrawerMenuProps) {
  const hasMultipleUnits = user?.units && user.units.length > 1;
  const isPreConstruction = user?.unitStatus === "Not Delivered" || user?.accountType === "Not Delivered Owner";
  const isContractor = user?.accountType === "Contractor";
  
  // New menu structure
  const menuItems = [
    { icon: User, label: "Profile", action: () => onNavigate("profile"), showForAll: true },
    { icon: QrCode, label: "QR Codes", action: () => onNavigate("qr"), hideForPreConstruction: true },
    { icon: FileText, label: "Requests", action: () => onNavigate("requests"), hideForPreConstruction: true },
    { icon: Briefcase, label: "Services", action: () => onNavigate("services"), hideForPreConstruction: true },
    { icon: AlertCircle, label: "Complaints", action: () => onNavigate("complaints"), showForAll: true },
    { icon: Flag, label: "Violations", action: () => onNavigate("violations"), hideForPreConstruction: true },
    { icon: CreditCard, label: "Payments", action: () => onNavigate("payments"), showForAll: true },
    { icon: Smartphone, label: "Smart Home", action: () => onNavigate("smarthome"), hideForPreConstruction: true },
    { icon: MapPinned, label: "Discover", action: () => onNavigate("explore"), hideForPreConstruction: true },
    { icon: Users, label: "Manage Household", action: () => onNavigate("family"), hideForPreConstruction: true },
    { icon: HelpCircle, label: "Help", action: () => onNavigate("chat"), showForAll: true },
  ];

  // Filter menu items based on user type
  const visibleMenuItems = isPreConstruction 
    ? menuItems.filter(item => item.showForAll || !item.hideForPreConstruction)
    : menuItems;

  const handleItemClick = (action: () => void) => {
    action();
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 z-40"
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: -320 }}
            animate={{ x: 0 }}
            exit={{ x: -320 }}
            transition={{ type: "spring", damping: 25 }}
            className="fixed left-0 top-0 bottom-0 w-80 bg-white z-50 shadow-2xl"
          >
            <div className="flex flex-col h-full">
              {/* Header */}
              <div className="bg-gradient-to-br from-[#2a3e35] to-[#1f2e27] p-6 text-white">
                <button
                  onClick={onClose}
                  className="absolute top-4 right-4 text-white/80 hover:text-white"
                >
                  <X className="w-6 h-6" />
                </button>
                
                <div className="flex items-center space-x-4 mt-8">
                  <Avatar className="w-16 h-16 border-2 border-[#c9a961]">
                    <AvatarImage src={user?.avatar} />
                    <AvatarFallback className="bg-[#c9a961] text-white">{user?.name?.charAt(0) || "U"}</AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="text-white">{user?.name}</h3>
                    <p className="text-[#c9a961] text-sm tracking-wide">{user?.unit}</p>
                    <p className="text-white/60 text-sm">{user?.compound}</p>
                  </div>
                </div>
              </div>

              {/* Units Section - Only if multiple units */}
              {hasMultipleUnits && (
                <div className="border-b border-[#E2E8F0] p-4">
                  <p className="text-xs text-[#64748B] mb-3 px-2">MY PROPERTIES</p>
                  {user.units.map((unit: any) => (
                    <button
                      key={unit.id}
                      onClick={() => {
                        onUnitChange?.(unit.id);
                        onClose();
                      }}
                      className={`w-full p-3 mb-2 rounded-xl text-left transition-colors ${
                        currentUnit?.id === unit.id
                          ? 'bg-[#2a3e35]/5 border border-[#2a3e35]'
                          : 'hover:bg-[#F9FAFB]'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-[#1E293B]">{unit.number}</p>
                        {currentUnit?.id === unit.id && (
                          <div className="w-2 h-2 bg-[#2a3e35] rounded-full" />
                        )}
                      </div>
                      <p className="text-xs text-[#64748B]">{unit.compound} • {unit.type}</p>
                      {unit.isRented && (
                        <p className="text-xs text-[#10B981] mt-1">🏠 Rented to {unit.tenantName}</p>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {/* Menu Items */}
              <div className="flex-1 overflow-y-auto py-4">
                {visibleMenuItems.map((item, index) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={index}
                      onClick={() => handleItemClick(item.action)}
                      className="w-full flex items-center justify-between px-6 py-4 hover:bg-[#F9FAFB] transition-colors group"
                    >
                      <div className="flex items-center space-x-4">
                        <Icon className="w-5 h-5 text-[#64748B] group-hover:text-[#2a3e35] transition-colors" />
                        <span className="text-[#1E293B]">{item.label}</span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-[#64748B] opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                  );
                })}
              </div>

              {/* Logout */}
              <div className="border-t border-[#E2E8F0] p-4">
                <button
                  onClick={() => {
                    onLogout();
                    onClose();
                  }}
                  className="w-full flex items-center justify-center space-x-2 px-6 py-4 text-[#EF4444] hover:bg-[#FEF2F2] rounded-2xl transition-colors"
                >
                  <LogOut className="w-5 h-5" />
                  <span>Logout</span>
                </button>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 text-center text-xs text-[#64748B]">
                Al Karma Developments © 2025<br />
                Powered by Smart Station Solutions (SSS)
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

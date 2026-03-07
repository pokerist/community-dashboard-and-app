import {
  Bell,
  ArrowRight,
  ClipboardPlus,
  FileText,
  ShieldAlert,
  UserRoundPlus,
  Zap,
} from "lucide-react";
import type { ComponentType } from "react";

interface QuickActionsProps {
  onNavigate?: (section: string) => void;
}

type ActionItem = {
  id: string;
  label: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  targetSection: string;
  iconBg: string;
  iconFg: string;
};

const actions: ActionItem[] = [
  {
    id: "new-complaint",
    label: "New Complaint",
    description: "Log a resident complaint",
    icon: ClipboardPlus,
    targetSection: "complaints",
    iconBg: "bg-blue-50",
    iconFg: "text-blue-600",
  },
  {
    id: "new-service-request",
    label: "Service Request",
    description: "Create a service ticket",
    icon: FileText,
    targetSection: "services",
    iconBg: "bg-emerald-50",
    iconFg: "text-emerald-700",
  },
  {
    id: "new-violation",
    label: "New Violation",
    description: "Report a community violation",
    icon: ShieldAlert,
    targetSection: "violations",
    iconBg: "bg-amber-50",
    iconFg: "text-amber-600",
  },
  {
    id: "send-notification",
    label: "Send Notification",
    description: "Broadcast to residents",
    icon: Bell,
    targetSection: "notifications",
    iconBg: "bg-violet-50",
    iconFg: "text-violet-600",
  },
  {
    id: "add-resident",
    label: "Add Resident",
    description: "Register a new resident",
    icon: UserRoundPlus,
    targetSection: "residents-create",
    iconBg: "bg-teal-50",
    iconFg: "text-teal-700",
  },
];

export function QuickActions({ onNavigate }: QuickActionsProps) {
  return (
    <div
      className="flex flex-col bg-white rounded-[6px] overflow-hidden"
      style={{ border: "1px solid #EBEBEB", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}
    >
      {/* Panel header */}
      <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-[#F3F4F6]">
        <div className="flex h-7 w-7 items-center justify-center rounded-[5px] bg-[#F5F4F1] border border-[#E5E7EB]">
          <Zap className="h-3.5 w-3.5 text-[#6B7280]" />
        </div>
        <div>
          <h3
            className="text-[13px] font-bold text-[#111827] leading-none"
            style={{ fontFamily: "'Work Sans', sans-serif" }}
          >
            Quick Actions
          </h3>
          <p className="text-[10.5px] text-[#9CA3AF] mt-0.5">Common tasks at a click</p>
        </div>
      </div>

      {/* 2-column action card grid */}
      <div className="grid grid-cols-2 gap-3 p-4">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.id}
              type="button"
              onClick={() => onNavigate?.(action.targetSection)}
              className="bg-white border border-[#EBEBEB] rounded-[6px] p-4 cursor-pointer hover:bg-[#EFF6FF] hover:border-[#2563EB] transition-all duration-150 group text-left flex flex-col gap-3"
            >
              {/* Icon + arrow row */}
              <div className="flex items-start justify-between">
                <div className="w-9 h-9 bg-[#EFF6FF] rounded flex items-center justify-center text-[#2563EB]">
                  <Icon className="h-4 w-4" />
                </div>
                <ArrowRight className="ml-auto text-[#9CA3AF] group-hover:text-[#2563EB] group-hover:translate-x-1 transition-all h-3.5 w-3.5" />
              </div>

              {/* Text */}
              <div>
                <p className="text-[14px] font-semibold text-[#111827] mb-0.5">
                  {action.label}
                </p>
                <p className="text-[12px] text-[#6B7280]">
                  {action.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

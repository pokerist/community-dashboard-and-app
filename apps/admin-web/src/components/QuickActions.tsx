import {
  Bell,
  ClipboardPlus,
  FileText,
  ShieldAlert,
  UserRoundPlus,
} from "lucide-react";
import type { ComponentType } from "react";
import { Button } from "./ui/button";
import { Card } from "./ui/card";

interface QuickActionsProps {
  onNavigate?: (section: string) => void;
}

type ActionItem = {
  id: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  targetSection: string;
};

const actions: ActionItem[] = [
  {
    id: "new-complaint",
    label: "New Complaint",
    icon: ClipboardPlus,
    targetSection: "complaints",
  },
  {
    id: "new-service-request",
    label: "New Service Request",
    icon: FileText,
    targetSection: "requests",
  },
  {
    id: "new-violation",
    label: "New Violation",
    icon: ShieldAlert,
    targetSection: "complaints",
  },
  {
    id: "send-notification",
    label: "Send Notification",
    icon: Bell,
    targetSection: "notifications",
  },
  {
    id: "add-resident",
    label: "Add Resident",
    icon: UserRoundPlus,
    targetSection: "residents-create",
  },
];

export function QuickActions({ onNavigate }: QuickActionsProps) {
  return (
    <Card className="rounded-lg border border-[#E2E8F0] p-4 shadow-[0_10px_22px_-20px_rgba(15,23,42,0.8)]">
      <h3 className="text-[#1E293B]">Quick Actions</h3>
      <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-5">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <Button
              key={action.id}
              variant="outline"
              className="h-11 justify-start gap-2 rounded-md border-[#D9E2EC] bg-white"
              onClick={() => onNavigate?.(action.targetSection)}
            >
              <Icon className="h-4 w-4" />
              {action.label}
            </Button>
          );
        })}
      </div>
    </Card>
  );
}

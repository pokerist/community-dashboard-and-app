import {
  Bell,
  ClipboardPlus,
  FileText,
  ShieldAlert,
  UserRoundPlus,
  Zap,
} from "lucide-react";
import { useState } from "react";
import type { ComponentType } from "react";

interface QuickActionsProps {
  onNavigate?: (section: string) => void;
}

type ActionItem = {
  id: string;
  label: string;
  description: string;
  icon: ComponentType<{ style?: React.CSSProperties }>;
  targetSection: string;
  iconBg: string;
  iconColor: string;
  hoverBorder: string;
  hoverBg: string;
};

const actions: ActionItem[] = [
  {
    id: "new-complaint",
    label: "New Complaint",
    description: "Log a resident complaint",
    icon: ClipboardPlus,
    targetSection: "complaints",
    iconBg: "#EFF6FF",
    iconColor: "#2563EB",
    hoverBorder: "#BFDBFE",
    hoverBg: "#F5F9FF",
  },
  {
    id: "new-service-request",
    label: "Service Request",
    description: "Create a service ticket",
    icon: FileText,
    targetSection: "services",
    iconBg: "#ECFDF5",
    iconColor: "#059669",
    hoverBorder: "#A7F3D0",
    hoverBg: "#F0FDF9",
  },
  {
    id: "new-violation",
    label: "New Violation",
    description: "Report a community violation",
    icon: ShieldAlert,
    targetSection: "violations",
    iconBg: "#FFFBEB",
    iconColor: "#D97706",
    hoverBorder: "#FDE68A",
    hoverBg: "#FFFDF0",
  },
  {
    id: "send-notification",
    label: "Send Notification",
    description: "Broadcast to residents",
    icon: Bell,
    targetSection: "notifications",
    iconBg: "#F5F3FF",
    iconColor: "#7C3AED",
    hoverBorder: "#DDD6FE",
    hoverBg: "#FAF8FF",
  },
  {
    id: "add-resident",
    label: "Add Resident",
    description: "Register a new resident",
    icon: UserRoundPlus,
    targetSection: "residents-create",
    iconBg: "#ECFDF5",
    iconColor: "#0891B2",
    hoverBorder: "#A5F3FC",
    hoverBg: "#F0FFFE",
  },
];

// ─── Single action card ───────────────────────────────────────
function ActionCard({ action, onNavigate }: { action: ActionItem; onNavigate?: (s: string) => void }) {
  const [hovered, setHovered] = useState(false);
  const Icon = action.icon;

  return (
    <button
      type="button"
      onClick={() => onNavigate?.(action.targetSection)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        padding: "14px",
        background: hovered ? action.hoverBg : "#FFFFFF",
        border: `1px solid ${hovered ? action.hoverBorder : "#EBEBEB"}`,
        borderRadius: "8px",
        cursor: "pointer",
        textAlign: "left",
        transition: "background 150ms ease, border-color 150ms ease, box-shadow 150ms ease",
        boxShadow: hovered ? "0 2px 8px rgba(0,0,0,0.06)" : "none",
        fontFamily: "'Work Sans', sans-serif",
      }}
    >
      {/* Icon + arrow row */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div style={{
          width: "32px", height: "32px",
          borderRadius: "7px",
          background: action.iconBg,
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
          transition: "transform 150ms ease",
          transform: hovered ? "scale(1.08)" : "scale(1)",
        }}>
          <Icon style={{ width: "14px", height: "14px", color: action.iconColor }} />
        </div>

        {/* Arrow */}
        <svg
          width="14" height="14" viewBox="0 0 24 24"
          fill="none" stroke={hovered ? action.iconColor : "#D1D5DB"}
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          style={{ transition: "stroke 150ms ease, transform 150ms ease", transform: hovered ? "translateX(2px)" : "translateX(0)", flexShrink: 0 }}
        >
          <line x1="5" y1="12" x2="19" y2="12" />
          <polyline points="12 5 19 12 12 19" />
        </svg>
      </div>

      {/* Text */}
      <div>
        <p style={{
          fontSize: "13px", fontWeight: 700,
          color: "#111827", lineHeight: 1.2,
          letterSpacing: "-0.01em", marginBottom: "3px",
        }}>
          {action.label}
        </p>
        <p style={{ fontSize: "11.5px", color: "#9CA3AF", lineHeight: 1.4 }}>
          {action.description}
        </p>
      </div>
    </button>
  );
}

// ─── Panel ────────────────────────────────────────────────────
export function QuickActions({ onNavigate }: QuickActionsProps) {
  return (
    <div style={{
      background: "#FFFFFF",
      borderRadius: "10px",
      border: "1px solid #EBEBEB",
      boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
      overflow: "hidden",
      fontFamily: "'Work Sans', sans-serif",
    }}>
      {/* Panel header */}
      <div style={{
        display: "flex", alignItems: "center", gap: "10px",
        padding: "14px 16px",
        borderBottom: "1px solid #F3F4F6",
      }}>
        <div style={{
          width: "28px", height: "28px", borderRadius: "7px",
          background: "#F5F5F5", border: "1px solid #EBEBEB",
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}>
          <Zap style={{ width: "13px", height: "13px", color: "#6B7280" }} />
        </div>
        <div>
          <h3 style={{ fontSize: "13px", fontWeight: 700, color: "#111827", lineHeight: 1, letterSpacing: "-0.01em" }}>
            Quick Actions
          </h3>
          <p style={{ marginTop: "3px", fontSize: "10.5px", color: "#9CA3AF", lineHeight: 1 }}>
            Common tasks at a click
          </p>
        </div>
      </div>

      {/* 2-col grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "8px",
        padding: "12px",
      }}>
        {actions.map((action) => (
          <ActionCard key={action.id} action={action} onNavigate={onNavigate} />
        ))}
      </div>
    </div>
  );
}
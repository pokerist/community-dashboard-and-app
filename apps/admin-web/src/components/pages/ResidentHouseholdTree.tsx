import { useState } from "react";
import { Users, ChevronDown, ChevronRight, Home, User } from "lucide-react";
import { humanizeEnum } from "../../lib/live-data";
import { StatusBadge } from "../StatusBadge";
import type { ResidentOverview } from "./resident-360.types";

type ResidentHouseholdTreeProps = {
  household: ResidentOverview["household"];
};

const ACCENTS = ["#0D9488", "#2563EB", "#BE185D"];

const SECTION_META = {
  family:     { label: "Family Members",    accent: "#2563EB", icon: <Users style={{ width: "12px", height: "12px" }} /> },
  authorized: { label: "Authorized",        accent: "#0D9488", icon: <User  style={{ width: "12px", height: "12px" }} /> },
  homeStaff:  { label: "Home Staff",        accent: "#BE185D", icon: <User  style={{ width: "12px", height: "12px" }} /> },
} as const;

// ─── Unit pill ────────────────────────────────────────────────
function UnitPill({ unit }: { unit?: any }) {
  if (!unit) return null;
  const text = [unit.projectName, unit.block ? `B${unit.block}` : null, unit.unitNumber ? `U${unit.unitNumber}` : null].filter(Boolean).join(" · ");
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "2px 7px", borderRadius: "4px", background: "#F3F4F6", fontSize: "10.5px", fontWeight: 600, color: "#6B7280" }}>
      <Home style={{ width: "9px", height: "9px" }} />{text || unit.id}
    </span>
  );
}

// ─── Member row ───────────────────────────────────────────────
function MemberRow({ row, accent }: { row: any; accent: string }) {
  const name = row.fullName || row.activatedUser?.nameEN || "Unknown";
  const initials = name.split(" ").slice(0, 2).map((w: string) => w[0] ?? "").join("").toUpperCase();

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "9px 12px", borderRadius: "8px", border: "1px solid #EBEBEB", background: "#FAFAFA" }}>
      {/* Avatar */}
      <div style={{ width: "28px", height: "28px", borderRadius: "50%", background: `${accent}15`, border: `1px solid ${accent}25`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <span style={{ fontSize: "9.5px", fontWeight: 800, color: accent }}>{initials || "?"}</span>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap", marginBottom: "3px" }}>
          <p style={{ fontSize: "12.5px", fontWeight: 700, color: "#111827", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</p>
          <StatusBadge value={row.status || "PENDING"} />
          {row.relationship && (
            <span style={{ fontSize: "10px", fontWeight: 700, padding: "1px 6px", borderRadius: "4px", background: `${accent}12`, color: accent, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              {humanizeEnum(row.relationship)}
            </span>
          )}
          <UnitPill unit={row.unit} />
        </div>
        <p style={{ fontSize: "11px", color: "#9CA3AF", margin: 0 }}>
          {[row.email, row.phone].filter(Boolean).join(" · ") || "No contact info"}
        </p>
      </div>
    </div>
  );
}

// ─── Collapsible section ──────────────────────────────────────
function HouseholdSection({ sectionKey, rows }: { sectionKey: keyof typeof SECTION_META; rows: any[] }) {
  const [open, setOpen] = useState(true);
  const meta = SECTION_META[sectionKey];

  return (
    <div style={{ borderRadius: "9px", border: "1px solid #EBEBEB", overflow: "hidden", background: "#FFF" }}>
      {/* Header */}
      <button type="button" onClick={() => setOpen((p) => !p)}
        style={{ width: "100%", padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", background: open ? `${meta.accent}05` : "#FAFAFA", border: "none", cursor: "pointer", borderBottom: open ? `1px solid ${meta.accent}15` : "none", transition: "background 120ms ease" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
          <span style={{ color: meta.accent }}>{meta.icon}</span>
          <span style={{ fontSize: "12.5px", fontWeight: 700, color: "#111827", fontFamily: "'Work Sans', sans-serif" }}>{meta.label}</span>
          <span style={{ fontSize: "10.5px", fontWeight: 700, padding: "1px 6px", borderRadius: "5px", background: `${meta.accent}15`, color: meta.accent, fontFamily: "'DM Mono', monospace" }}>{rows.length}</span>
        </div>
        <span style={{ color: "#9CA3AF" }}>
          {open ? <ChevronDown style={{ width: "14px", height: "14px" }} /> : <ChevronRight style={{ width: "14px", height: "14px" }} />}
        </span>
      </button>

      {/* Body */}
      {open && (
        <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: "6px" }}>
          {rows.length === 0 ? (
            <p style={{ fontSize: "12px", color: "#9CA3AF", padding: "8px 4px", fontFamily: "'Work Sans', sans-serif" }}>No records in this group.</p>
          ) : (
            rows.map((row: any) => <MemberRow key={row.id} row={row} accent={meta.accent} />)
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────
export function ResidentHouseholdTree({ household }: ResidentHouseholdTreeProps) {
  const root = household?.root;

  if (!root) {
    return (
      <div style={{ padding: "32px", borderRadius: "9px", border: "1px dashed #E5E7EB", textAlign: "center", fontFamily: "'Work Sans', sans-serif" }}>
        <Users style={{ width: "22px", height: "22px", color: "#D1D5DB", margin: "0 auto 8px" }} />
        <p style={{ fontSize: "13px", color: "#9CA3AF" }}>No household data available.</p>
      </div>
    );
  }

  const rootInitials = (root.user.nameEN || "R").split(" ").slice(0, 2).map((w: string) => w[0] ?? "").join("").toUpperCase();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px", fontFamily: "'Work Sans', sans-serif" }}>
      {/* Root resident card */}
      <div style={{ borderRadius: "9px", border: "2px solid #111827", background: "#FFF", overflow: "hidden" }}>
        <div style={{ height: "3px", background: "linear-gradient(90deg, #0D9488, #2563EB, #BE185D)" }} />
        <div style={{ padding: "12px 14px", display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: "#111827", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <span style={{ fontSize: "12px", fontWeight: 800, color: "#FFF" }}>{rootInitials}</span>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "7px", flexWrap: "wrap", marginBottom: "4px" }}>
              <p style={{ fontSize: "14px", fontWeight: 800, color: "#111827", margin: 0, letterSpacing: "-0.02em" }}>{root.user.nameEN || "Resident"}</p>
              <span style={{ fontSize: "10px", fontWeight: 700, padding: "1px 7px", borderRadius: "4px", background: "#111827", color: "#FFF", letterSpacing: "0.04em" }}>HEAD OF HOUSEHOLD</span>
            </div>
            <p style={{ fontSize: "11.5px", color: "#9CA3AF", margin: 0 }}>
              {[root.user.email, root.user.phone].filter(Boolean).join(" · ") || "No contact info"}
            </p>
            {(root.units ?? []).length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginTop: "8px" }}>
                {(root.units ?? []).map((u: any) => <UnitPill key={u.unitId} unit={u.unit} />)}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Connector line visual hint */}
      <div style={{ display: "flex", justifyContent: "center" }}>
        <div style={{ width: "2px", height: "12px", background: "#E5E7EB", borderRadius: "1px" }} />
      </div>

      {/* Sections */}
      {(["family", "authorized", "homeStaff"] as const).map((key) => (
        <HouseholdSection key={key} sectionKey={key} rows={household.children?.[key] ?? []} />
      ))}
    </div>
  );
}
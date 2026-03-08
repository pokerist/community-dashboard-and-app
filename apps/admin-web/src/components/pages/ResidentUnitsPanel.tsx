import { useState } from "react";
import { toast } from "sonner";
import { Home, Star, ArrowRightLeft, X, Plus } from "lucide-react";
import apiClient from "../../lib/api-client";
import { errorMessage, humanizeEnum } from "../../lib/live-data";
import { StatusBadge } from "../StatusBadge";
import type { ResidentOverview } from "./resident-360.types";
import { AssignUnitDialog } from "./AssignUnitDialog";
import { TransferOwnershipDialog } from "./TransferOwnershipDialog";

type UnitOption         = { id: string; label: string };
type ResidentUserOption = { id: string; label: string };

type ResidentUnitsPanelProps = {
  overview:        ResidentOverview;
  unitOptions:     UnitOption[];
  residentOptions: ResidentUserOption[];
  onRefresh:       () => Promise<void> | void;
};

const ACCENTS = ["#0D9488", "#2563EB", "#BE185D"];

// ─── Role chip ────────────────────────────────────────────────
function RoleChip({ role, status }: { role: string; status: string }) {
  const active = status.toUpperCase() === "ACTIVE";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "2px 8px", borderRadius: "5px", fontSize: "10.5px", fontWeight: 700, background: active ? "#EFF6FF" : "#F3F4F6", color: active ? "#1D4ED8" : "#6B7280" }}>
      {humanizeEnum(role)}
      <span style={{ fontSize: "9px", opacity: 0.75 }}>· {humanizeEnum(status)}</span>
    </span>
  );
}

export function ResidentUnitsPanel({ overview, unitOptions, residentOptions, onRefresh }: ResidentUnitsPanelProps) {
  const [removing, setRemoving] = useState<string | null>(null);

  const removeUnit = async (unitId: string) => {
    setRemoving(unitId);
    try {
      await apiClient.delete(`/admin/users/residents/${overview.resident.user.id}/units/${unitId}`);
      toast.success("Unit removed from resident");
      await onRefresh();
    } catch (e) { toast.error("Failed to remove unit", { description: errorMessage(e) }); }
    finally { setRemoving(null); }
  };

  const residentUnits = overview.units.residentUnits ?? [];
  const unitAccesses  = overview.units.unitAccesses  ?? [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px", fontFamily: "'Work Sans', sans-serif" }}>
      {/* Assign unit action */}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <AssignUnitDialog residentUserId={overview.resident.user.id} unitOptions={unitOptions} onAssigned={onRefresh} />
      </div>

      {residentUnits.length === 0 ? (
        <div style={{ padding: "28px", borderRadius: "9px", border: "1px dashed #E5E7EB", textAlign: "center" }}>
          <Home style={{ width: "20px", height: "20px", color: "#D1D5DB", margin: "0 auto 8px" }} />
          <p style={{ fontSize: "13px", color: "#9CA3AF" }}>No units assigned to this resident.</p>
        </div>
      ) : (
        residentUnits.map((row, idx) => {
          const accent     = ACCENTS[idx % ACCENTS.length];
          const unitLabel  = [row.unit.projectName, row.unit.block ? `Block ${row.unit.block}` : null, row.unit.unitNumber ? `Unit ${row.unit.unitNumber}` : null].filter(Boolean).join(" – ") || row.unit.id;
          const accesses   = unitAccesses.filter((a) => a.unitId === row.unitId);
          const ownerAccess = accesses.find((a) => a.role === "OWNER" && a.status === "ACTIVE");

          return (
            <div key={row.id} style={{ borderRadius: "9px", border: `1px solid ${accent}25`, background: `${accent}04`, overflow: "hidden" }}>
              {/* Accent top bar */}
              <div style={{ height: "3px", background: accent }} />

              <div style={{ padding: "12px 14px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
                {/* Left: unit info */}
                <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", minWidth: 0 }}>
                  <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: `${accent}15`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: accent, marginTop: "1px" }}>
                    <Home style={{ width: "14px", height: "14px" }} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap", marginBottom: "5px" }}>
                      <p style={{ fontSize: "13.5px", fontWeight: 700, color: "#111827", margin: 0 }}>{unitLabel}</p>
                      {row.isPrimary && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "3px", padding: "1px 7px", borderRadius: "5px", background: "#FFF7ED", color: "#C2410C", fontSize: "10px", fontWeight: 700 }}>
                          <Star style={{ width: "9px", height: "9px" }} /> Primary
                        </span>
                      )}
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
                      <StatusBadge value={row.unit.status || "UNKNOWN"} />
                      {accesses.map((a) => <RoleChip key={a.id} role={a.role} status={a.status} />)}
                    </div>
                  </div>
                </div>

                {/* Right: actions */}
                <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
                  {ownerAccess && (
                    <TransferOwnershipDialog unitId={row.unitId} fromUserId={overview.resident.user.id} residentOptions={residentOptions} onTransferred={onRefresh} />
                  )}
                  <button type="button" disabled={removing === row.unitId} onClick={() => void removeUnit(row.unitId)}
                    style={{ display: "flex", alignItems: "center", gap: "4px", padding: "5px 10px", borderRadius: "6px", border: "1px solid #FECACA", background: removing === row.unitId ? "#FEF2F2" : "#FFF", color: "#DC2626", cursor: removing === row.unitId ? "not-allowed" : "pointer", fontSize: "11.5px", fontWeight: 600, opacity: removing === row.unitId ? 0.7 : 1, transition: "background 120ms ease" }}>
                    <X style={{ width: "11px", height: "11px" }} />
                    {removing === row.unitId ? "Removing…" : "Remove"}
                  </button>
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
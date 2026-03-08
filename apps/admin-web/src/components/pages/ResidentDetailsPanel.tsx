import { useState } from "react";
import { API_BASE_URL } from "../../lib/api-client";
import { formatDateTime, humanizeEnum, toInitials } from "../../lib/live-data";
import type { ResidentOverview } from "./resident-360.types";
import { EditResidentDialog } from "./EditResidentDialog";
import { ResidentUnitsPanel } from "./ResidentUnitsPanel";
import { ResidentDocumentsPanel } from "./ResidentDocumentsPanel";
import { ResidentHouseholdTree } from "./ResidentHouseholdTree";
import { StatusBadge } from "../StatusBadge";
import {
  Home, Users, FileText, CreditCard,
  Phone, Mail, Fingerprint, Calendar, BadgeCheck,
  Building2, Banknote, Archive,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────
type UnitOption         = { id: string; label: string };
type ResidentUserOption = { id: string; label: string };

type ResidentDetailsPanelProps = {
  overview:         ResidentOverview;
  unitOptions:      UnitOption[];
  residentOptions:  ResidentUserOption[];
  onRefresh:        () => Promise<void> | void;
};

// ─── Tabs config ──────────────────────────────────────────────
type TabId = "units" | "household" | "documents";

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: "units",     label: "Units & Ownership", icon: <Home     style={{ width: "12px", height: "12px" }} /> },
  { id: "household", label: "Household",          icon: <Users    style={{ width: "12px", height: "12px" }} /> },
  { id: "documents", label: "Documents",          icon: <FileText style={{ width: "12px", height: "12px" }} /> },
];

// ─── Accent cycling ───────────────────────────────────────────
const ACCENTS = ["#0D9488", "#2563EB", "#BE185D"];

// ─── Info row primitive ───────────────────────────────────────
function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
      <span style={{ color: "#9CA3AF", flexShrink: 0 }}>{icon}</span>
      <span style={{ fontSize: "11px", color: "#9CA3AF", width: "80px", flexShrink: 0, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</span>
      <span style={{ fontSize: "13px", color: "#111827", fontWeight: 500, minWidth: 0 }}>{value || "—"}</span>
    </div>
  );
}

// ─── Contract card ────────────────────────────────────────────
function ContractCard({ contract, idx }: { contract: ResidentOverview["ownership"][number]; idx: number }) {
  const accent   = ACCENTS[idx % ACCENTS.length];
  const archived = Boolean(contract.archivedAt);
  const unitLabel = [contract.unit.projectName, contract.unit.block ? `Block ${contract.unit.block}` : null, contract.unit.unitNumber ? `Unit ${contract.unit.unitNumber}` : null].filter(Boolean).join(" – ") || contract.unit.id;

  return (
    <div style={{ borderRadius: "9px", border: `1px solid ${archived ? "#E5E7EB" : accent + "30"}`, background: archived ? "#FAFAFA" : `${accent}05`, overflow: "hidden", opacity: archived ? 0.75 : 1 }}>
      {/* Accent bar */}
      <div style={{ height: "3px", background: archived ? "#E5E7EB" : accent }} />

      <div style={{ padding: "12px 14px" }}>
        {/* Header row */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "8px", marginBottom: "8px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div style={{ width: "28px", height: "28px", borderRadius: "7px", background: archived ? "#F3F4F6" : `${accent}15`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: archived ? "#9CA3AF" : accent }}>
              <Building2 style={{ width: "13px", height: "13px" }} />
            </div>
            <div>
              <p style={{ fontSize: "13px", fontWeight: 700, color: "#111827", lineHeight: 1.2 }}>{unitLabel}</p>
              <p style={{ fontSize: "11px", color: "#9CA3AF", marginTop: "2px" }}>
                {contract.ownerUser.nameEN || "—"} · {contract.ownerUser.email || contract.ownerUser.phone || "—"}
              </p>
            </div>
          </div>
          <div style={{ display: "flex", gap: "5px", flexShrink: 0 }}>
            <span style={{ fontSize: "10.5px", fontWeight: 700, padding: "2px 8px", borderRadius: "5px", background: archived ? "#F3F4F6" : "#ECFDF5", color: archived ? "#6B7280" : "#065F46" }}>
              {archived ? "Archived" : "Active"}
            </span>
            <span style={{ fontSize: "10.5px", fontWeight: 700, padding: "2px 8px", borderRadius: "5px", background: `${accent}12`, color: accent }}>
              {humanizeEnum(contract.paymentMode)}
            </span>
          </div>
        </div>

        {/* Installments summary */}
        {contract.installments.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: "6px", padding: "7px 10px", borderRadius: "6px", background: "#F9FAFB", border: "1px solid #F3F4F6" }}>
            <Banknote style={{ width: "12px", height: "12px", color: "#9CA3AF" }} />
            <span style={{ fontSize: "11.5px", color: "#6B7280" }}>
              <strong style={{ color: "#111827", fontFamily: "'DM Mono', monospace" }}>{contract.installments.length}</strong> installment{contract.installments.length !== 1 ? "s" : ""}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────
export function ResidentDetailsPanel({ overview, unitOptions, residentOptions, onRefresh }: ResidentDetailsPanelProps) {
  const [activeTab, setActiveTab] = useState<TabId>("units");

  const user            = overview.resident.user;
  const profileImageUrl = user.profilePhotoId ? `${API_BASE_URL}/files/public/profile-photo/${user.profilePhotoId}` : undefined;
  const rolesLabel      = (user.roles ?? []).map((r) => r.role.name).join(", ");
  const initials        = toInitials(user.nameEN || "Resident");

  return (
    <div style={{ fontFamily: "'Work Sans', sans-serif", display: "flex", flexDirection: "column", gap: "16px" }}>

      {/* ── Profile card ──────────────────────────────────── */}
      <div style={{ borderRadius: "10px", border: "1px solid #EBEBEB", background: "#FFF", overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
        {/* Top accent strip */}
        <div style={{ height: "4px", background: "linear-gradient(90deg, #0D9488, #2563EB, #BE185D)" }} />

        <div style={{ padding: "16px 20px", display: "flex", alignItems: "flex-start", gap: "16px", flexWrap: "wrap" }}>
          {/* Avatar */}
          <div style={{ position: "relative", flexShrink: 0 }}>
            {profileImageUrl ? (
              <img src={profileImageUrl} alt={initials} style={{ width: "56px", height: "56px", borderRadius: "50%", objectFit: "cover", border: "2px solid #EBEBEB" }} />
            ) : (
              <div style={{ width: "56px", height: "56px", borderRadius: "50%", background: "#111827", display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid #EBEBEB" }}>
                <span style={{ fontSize: "16px", fontWeight: 800, color: "#FFF", letterSpacing: "-0.02em", fontFamily: "'Work Sans', sans-serif" }}>{initials}</span>
              </div>
            )}
            {/* Online / status dot */}
            <span style={{ position: "absolute", bottom: "2px", right: "2px", width: "11px", height: "11px", borderRadius: "50%", background: user.userStatus === "ACTIVE" ? "#10B981" : "#9CA3AF", border: "2px solid #FFF" }} />
          </div>

          {/* Identity */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginBottom: "4px" }}>
              <h2 style={{ fontSize: "16px", fontWeight: 800, color: "#111827", letterSpacing: "-0.02em", margin: 0 }}>{user.nameEN || "Resident"}</h2>
              <StatusBadge value={user.userStatus} />
              {rolesLabel && (
                <span style={{ fontSize: "10.5px", fontWeight: 700, padding: "2px 8px", borderRadius: "5px", background: "#F3F4F6", color: "#6B7280" }}>{rolesLabel}</span>
              )}
            </div>
            {user.nameAR && (
              <p style={{ fontSize: "13px", color: "#9CA3AF", marginBottom: "10px", direction: "rtl", textAlign: "left" }}>{user.nameAR}</p>
            )}

            {/* Info grid */}
            <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
              <InfoRow icon={<Phone style={{ width: "11px", height: "11px" }} />}      label="Phone"  value={user.phone} />
              <InfoRow icon={<Mail style={{ width: "11px", height: "11px" }} />}       label="Email"  value={user.email} />
              <InfoRow icon={<Fingerprint style={{ width: "11px", height: "11px" }} />} label="Nat. ID" value={<span style={{ fontFamily: "'DM Mono', monospace" }}>{overview.resident.nationalId || "—"}</span>} />
              <InfoRow icon={<Calendar style={{ width: "11px", height: "11px" }} />}   label="DOB"    value={overview.resident.dateOfBirth ? formatDateTime(overview.resident.dateOfBirth) : "—"} />
            </div>
          </div>

          {/* Edit button */}
          <div style={{ flexShrink: 0 }}>
            <EditResidentDialog overview={overview} onUpdated={onRefresh} />
          </div>
        </div>
      </div>

      {/* ── Tabs ──────────────────────────────────────────── */}
      <div style={{ borderRadius: "10px", border: "1px solid #EBEBEB", background: "#FFF", overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
        {/* Tab bar */}
        <div style={{ display: "flex", borderBottom: "1px solid #F3F4F6", padding: "0 4px" }}>
          {TABS.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: "flex", alignItems: "center", gap: "6px",
                  padding: "11px 16px", fontSize: "12.5px", fontWeight: active ? 700 : 500,
                  color: active ? "#111827" : "#9CA3AF",
                  background: "transparent", border: "none", cursor: "pointer",
                  borderBottom: active ? "2px solid #111827" : "2px solid transparent",
                  marginBottom: "-1px", transition: "all 120ms ease",
                  fontFamily: "'Work Sans', sans-serif",
                }}
              >
                <span style={{ color: active ? "#111827" : "#D1D5DB", transition: "color 120ms" }}>{tab.icon}</span>
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        <div style={{ padding: "20px" }}>

          {/* Units & Ownership */}
          {activeTab === "units" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              <ResidentUnitsPanel
                overview={overview}
                unitOptions={unitOptions}
                residentOptions={residentOptions}
                onRefresh={onRefresh}
              />

              {/* Ownership contracts */}
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                  <CreditCard style={{ width: "13px", height: "13px", color: "#6B7280" }} />
                  <p style={{ fontSize: "13px", fontWeight: 700, color: "#111827", margin: 0 }}>Ownership Contracts & Installments</p>
                  <span style={{ fontSize: "10.5px", fontWeight: 700, padding: "1px 6px", borderRadius: "5px", background: "#F3F4F6", color: "#6B7280", fontFamily: "'DM Mono', monospace" }}>
                    {overview.ownership.length}
                  </span>
                </div>

                {overview.ownership.length === 0 ? (
                  <div style={{ padding: "24px", borderRadius: "8px", border: "1px dashed #E5E7EB", textAlign: "center" }}>
                    <p style={{ fontSize: "13px", color: "#9CA3AF" }}>No ownership contracts found for this resident.</p>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    {overview.ownership.map((contract, i) => (
                      <ContractCard key={contract.id} contract={contract} idx={i} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Household */}
          {activeTab === "household" && (
            <ResidentHouseholdTree household={overview.household} />
          )}

          {/* Documents */}
          {activeTab === "documents" && (
            <ResidentDocumentsPanel documents={overview.documents.documents ?? []} />
          )}
        </div>
      </div>
    </div>
  );
}
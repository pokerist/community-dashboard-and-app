import { Card } from "../ui/card";
import { Badge } from "../ui/badge";
import { humanizeEnum } from "../../lib/live-data";
import type { ResidentOverview } from "./resident-360.types";

type ResidentHouseholdTreeProps = {
  household: ResidentOverview["household"];
};

function UnitPill({ unit }: { unit?: any }) {
  if (!unit) return null;
  const text = [unit.projectName, unit.block ? `B ${unit.block}` : null, unit.unitNumber ? `U ${unit.unitNumber}` : null]
    .filter(Boolean)
    .join(" • ");
  return (
    <Badge variant="secondary" className="bg-[#F1F5F9] text-[#334155]">
      {text || unit.id}
    </Badge>
  );
}

export function ResidentHouseholdTree({ household }: ResidentHouseholdTreeProps) {
  const root = household?.root;
  if (!root) {
    return (
      <Card className="p-4 rounded-xl">
        <p className="text-sm text-[#64748B]">No household data available.</p>
      </Card>
    );
  }

  const sections = [
    { key: "family", label: "Family", rows: household.children?.family ?? [] },
    { key: "authorized", label: "Authorized", rows: household.children?.authorized ?? [] },
    { key: "homeStaff", label: "Home Staff", rows: household.children?.homeStaff ?? [] },
  ] as const;

  return (
    <div className="space-y-4">
      <Card className="p-4 rounded-xl border-[#CBD5E1]">
        <div className="text-sm font-semibold text-[#0F172A]">{root.user.nameEN || "Resident"}</div>
        <div className="text-xs text-[#64748B] mt-1">
          {root.user.email || "—"} • {root.user.phone || "—"}
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          {(root.units ?? []).map((u) => (
            <UnitPill key={u.unitId} unit={u.unit} />
          ))}
        </div>
      </Card>

      {sections.map((section) => (
        <details key={section.key} open className="rounded-xl border border-[#E2E8F0] bg-white p-4">
          <summary className="cursor-pointer list-none flex items-center justify-between">
            <span className="text-sm font-semibold text-[#0F172A]">{section.label}</span>
            <Badge variant="secondary" className="bg-[#F8FAFC] text-[#475569]">
              {section.rows.length}
            </Badge>
          </summary>
          <div className="mt-3 space-y-2">
            {section.rows.length === 0 ? (
              <p className="text-xs text-[#64748B]">No records.</p>
            ) : (
              section.rows.map((row: any) => (
                <div key={row.id} className="rounded-lg border border-[#E2E8F0] p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-[#1E293B]">{row.fullName || row.activatedUser?.nameEN || "Unknown"}</span>
                    <Badge className="bg-[#EEF2FF] text-[#3730A3]">{humanizeEnum(row.status || "PENDING")}</Badge>
                    {row.relationship ? (
                      <Badge variant="secondary" className="bg-[#F1F5F9] text-[#334155]">
                        {humanizeEnum(row.relationship)}
                      </Badge>
                    ) : null}
                    <UnitPill unit={row.unit} />
                  </div>
                  <div className="text-xs text-[#64748B] mt-1">
                    {row.email || "—"} • {row.phone || "—"}
                  </div>
                </div>
              ))
            )}
          </div>
        </details>
      ))}
    </div>
  );
}


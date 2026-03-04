import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Badge } from "../ui/badge";
import { toast } from "sonner";
import apiClient from "../../lib/api-client";
import { errorMessage, humanizeEnum } from "../../lib/live-data";
import type { ResidentOverview } from "./resident-360.types";
import { AssignUnitDialog } from "./AssignUnitDialog";
import { TransferOwnershipDialog } from "./TransferOwnershipDialog";

type UnitOption = { id: string; label: string };
type ResidentUserOption = { id: string; label: string };

type ResidentUnitsPanelProps = {
  overview: ResidentOverview;
  unitOptions: UnitOption[];
  residentOptions: ResidentUserOption[];
  onRefresh: () => Promise<void> | void;
};

export function ResidentUnitsPanel({
  overview,
  unitOptions,
  residentOptions,
  onRefresh,
}: ResidentUnitsPanelProps) {
  const removeUnit = async (unitId: string) => {
    try {
      await apiClient.delete(`/admin/users/residents/${overview.resident.user.id}/units/${unitId}`);
      toast.success("Unit removed from resident");
      await onRefresh();
    } catch (error) {
      toast.error("Failed to remove unit", { description: errorMessage(error) });
    }
  };

  const residentUnits = overview.units.residentUnits ?? [];
  const unitAccesses = overview.units.unitAccesses ?? [];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <AssignUnitDialog
          residentUserId={overview.resident.user.id}
          unitOptions={unitOptions}
          onAssigned={onRefresh}
        />
      </div>

      {residentUnits.length === 0 ? (
        <Card className="p-4 rounded-xl">
          <p className="text-sm text-[#64748B]">No units assigned to this resident.</p>
        </Card>
      ) : (
        residentUnits.map((row) => {
          const unitLabel =
            [row.unit.projectName, row.unit.block ? `Block ${row.unit.block}` : null, row.unit.unitNumber ? `Unit ${row.unit.unitNumber}` : null]
              .filter(Boolean)
              .join(" - ") || row.unit.id;
          const accessForUnit = unitAccesses.filter((access) => access.unitId === row.unitId);
          const ownerAccess = accessForUnit.find((access) => access.role === "OWNER" && access.status === "ACTIVE");
          return (
            <Card key={row.id} className="p-4 rounded-xl">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="space-y-2">
                  <div className="text-sm font-semibold text-[#0F172A]">{unitLabel}</div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary" className="bg-[#F1F5F9] text-[#334155]">
                      Status: {humanizeEnum(row.unit.status || "UNKNOWN")}
                    </Badge>
                    {row.isPrimary ? (
                      <Badge className="bg-[#DCFCE7] text-[#166534]">Primary</Badge>
                    ) : null}
                    {accessForUnit.map((access) => (
                      <Badge key={access.id} className="bg-[#EEF2FF] text-[#3730A3]">
                        {humanizeEnum(access.role)} • {humanizeEnum(access.status)}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {ownerAccess ? (
                    <TransferOwnershipDialog
                      unitId={row.unitId}
                      fromUserId={overview.resident.user.id}
                      residentOptions={residentOptions}
                      onTransferred={onRefresh}
                    />
                  ) : null}
                  <Button variant="outline" size="sm" onClick={() => void removeUnit(row.unitId)}>
                    Remove Unit
                  </Button>
                </div>
              </div>
            </Card>
          );
        })
      )}
    </div>
  );
}


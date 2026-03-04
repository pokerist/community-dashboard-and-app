import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { Badge } from "../ui/badge";
import { Card } from "../ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { API_BASE_URL } from "../../lib/api-client";
import { formatDateTime, humanizeEnum, toInitials } from "../../lib/live-data";
import type { ResidentOverview } from "./resident-360.types";
import { EditResidentDialog } from "./EditResidentDialog";
import { ResidentUnitsPanel } from "./ResidentUnitsPanel";
import { ResidentDocumentsPanel } from "./ResidentDocumentsPanel";
import { ResidentHouseholdTree } from "./ResidentHouseholdTree";

type UnitOption = { id: string; label: string };
type ResidentUserOption = { id: string; label: string };

type ResidentDetailsPanelProps = {
  overview: ResidentOverview;
  unitOptions: UnitOption[];
  residentOptions: ResidentUserOption[];
  onRefresh: () => Promise<void> | void;
};

const tabTriggerClass =
  "gap-2 border border-transparent text-[#475569] data-[state=active]:border-[#0F172A] data-[state=active]:bg-[#0F172A] data-[state=active]:text-white";

export function ResidentDetailsPanel({
  overview,
  unitOptions,
  residentOptions,
  onRefresh,
}: ResidentDetailsPanelProps) {
  const user = overview.resident.user;
  const profileImageUrl = user.profilePhotoId
    ? `${API_BASE_URL}/files/public/profile-photo/${user.profilePhotoId}`
    : undefined;
  const rolesLabel = (user.roles ?? []).map((r) => r.role.name).join(", ");

  return (
    <div className="space-y-4">
      <Card className="p-4 rounded-xl">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="h-14 w-14">
              <AvatarImage src={profileImageUrl} />
              <AvatarFallback className="bg-[#0B5FFF] text-white">{toInitials(user.nameEN || "Resident")}</AvatarFallback>
            </Avatar>
            <div>
              <div className="text-base font-semibold text-[#0F172A]">{user.nameEN || "Resident"}</div>
              <div className="text-xs text-[#64748B]">{user.email || "—"} • {user.phone || "—"}</div>
              <div className="text-xs text-[#64748B] mt-1">
                National ID: {overview.resident.nationalId || "—"} • DOB:{" "}
                {overview.resident.dateOfBirth ? formatDateTime(overview.resident.dateOfBirth) : "—"}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge className="bg-[#EEF2FF] text-[#3730A3]">{humanizeEnum(user.userStatus)}</Badge>
            {rolesLabel ? (
              <Badge variant="secondary" className="bg-[#F1F5F9] text-[#334155]">
                {rolesLabel}
              </Badge>
            ) : null}
            <EditResidentDialog overview={overview} onUpdated={onRefresh} />
          </div>
        </div>
      </Card>

      <Tabs defaultValue="units" className="w-full">
        <TabsList className="w-full justify-start border rounded-lg p-1 bg-white overflow-x-auto">
          <TabsTrigger value="units" className={tabTriggerClass}>Units & Ownership</TabsTrigger>
          <TabsTrigger value="household" className={tabTriggerClass}>Household Tree</TabsTrigger>
          <TabsTrigger value="documents" className={tabTriggerClass}>Documents</TabsTrigger>
        </TabsList>

        <TabsContent value="units" className="mt-4">
          <div className="space-y-4">
            <ResidentUnitsPanel
              overview={overview}
              unitOptions={unitOptions}
              residentOptions={residentOptions}
              onRefresh={onRefresh}
            />
            <Card className="p-4 rounded-xl">
              <h4 className="text-sm font-semibold text-[#0F172A]">Ownership Contracts & Installments</h4>
              <div className="mt-3 space-y-3">
                {overview.ownership.length === 0 ? (
                  <p className="text-sm text-[#64748B]">No ownership contracts found for this resident scope.</p>
                ) : (
                  overview.ownership.map((contract) => (
                    <div key={contract.id} className="rounded-lg border border-[#E2E8F0] p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-[#1E293B]">
                          {[contract.unit.projectName, contract.unit.block ? `Block ${contract.unit.block}` : null, contract.unit.unitNumber ? `Unit ${contract.unit.unitNumber}` : null]
                            .filter(Boolean)
                            .join(" - ") || contract.unit.id}
                        </span>
                        <Badge variant="secondary" className="bg-[#F1F5F9] text-[#334155]">
                          {humanizeEnum(contract.paymentMode)}
                        </Badge>
                        {contract.archivedAt ? (
                          <Badge className="bg-[#FEF3C7] text-[#92400E]">Archived</Badge>
                        ) : (
                          <Badge className="bg-[#DCFCE7] text-[#166534]">Active</Badge>
                        )}
                      </div>
                      <div className="text-xs text-[#64748B] mt-1">
                        Owner: {contract.ownerUser.nameEN || "—"} • {contract.ownerUser.email || contract.ownerUser.phone || "—"}
                      </div>
                      <div className="text-xs text-[#64748B] mt-1">
                        Installments: {contract.installments.length}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="household" className="mt-4">
          <ResidentHouseholdTree household={overview.household} />
        </TabsContent>

        <TabsContent value="documents" className="mt-4">
          <ResidentDocumentsPanel documents={overview.documents.documents ?? []} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

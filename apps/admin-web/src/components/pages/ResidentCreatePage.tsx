import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, UserPlus } from "lucide-react";
import { toast } from "sonner";
import apiClient from "../../lib/api-client";
import { errorMessage } from "../../lib/live-data";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";

type UnitOption = {
  id: string;
  label: string;
};

type OwnerPaymentMode = "CASH" | "INSTALLMENT";

type OwnerInstallmentDraft = {
  dueDate: string;
  amount: string;
  referencePageIndex: string;
  referenceFile: File | null;
};

type OwnerUnitDraft = {
  unitId: string;
  paymentMode: OwnerPaymentMode;
  contractSignedAt: string;
  contractFile: File | null;
  notes: string;
  installments: OwnerInstallmentDraft[];
};

type CreateOwnerForm = {
  nameEN: string;
  nameAR: string;
  email: string;
  phone: string;
  nationalId: string;
  nationalIdPhotoFile: File | null;
  units: OwnerUnitDraft[];
};

const createDefaultInstallmentDraft = (): OwnerInstallmentDraft => ({
  dueDate: "",
  amount: "",
  referencePageIndex: "",
  referenceFile: null,
});

const createDefaultOwnerUnitDraft = (): OwnerUnitDraft => ({
  unitId: "",
  paymentMode: "CASH",
  contractSignedAt: "",
  contractFile: null,
  notes: "",
  installments: [],
});

const defaultCreateOwnerForm: CreateOwnerForm = {
  nameEN: "",
  nameAR: "",
  email: "",
  phone: "",
  nationalId: "",
  nationalIdPhotoFile: null,
  units: [createDefaultOwnerUnitDraft()],
};

type ResidentCreatePageProps = {
  onBack: () => void;
  onCreated?: () => void;
};

export function ResidentCreatePage({ onBack, onCreated }: ResidentCreatePageProps) {
  const [unitOptions, setUnitOptions] = useState<UnitOption[]>([]);
  const [isLoadingUnits, setIsLoadingUnits] = useState(false);
  const [isCreatingResident, setIsCreatingResident] = useState(false);
  const [createOwnerForm, setCreateOwnerForm] = useState<CreateOwnerForm>(
    defaultCreateOwnerForm,
  );

  const loadUnits = useCallback(async () => {
    setIsLoadingUnits(true);
    try {
      const unitsResponse = await apiClient.get("/units", {
        params: { page: 1, limit: 200 },
      });
      const rawUnits = Array.isArray(unitsResponse.data?.data)
        ? unitsResponse.data.data
        : Array.isArray(unitsResponse.data)
          ? unitsResponse.data
          : [];
      setUnitOptions(
        rawUnits
          .map((unit: any) => ({
            id: String(unit.id),
            label:
              [
                unit.projectName,
                unit.block ? `Block ${unit.block}` : null,
                unit.unitNumber ? `Unit ${unit.unitNumber}` : null,
              ]
                .filter(Boolean)
                .join(" - ") || String(unit.id),
          }))
          .filter((unit: UnitOption) => !!unit.id),
      );
    } catch (error) {
      toast.error("Failed to load units", { description: errorMessage(error) });
    } finally {
      setIsLoadingUnits(false);
    }
  }, []);

  useEffect(() => {
    void loadUnits();
  }, [loadUnits]);

  const uploadFile = useCallback(async (endpoint: string, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    const response = await apiClient.post(endpoint, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    const fileId = response.data?.id as string | undefined;
    if (!fileId) throw new Error("Upload did not return file id");
    return fileId;
  }, []);

  const updateOwnerUnit = useCallback(
    (index: number, updater: (prev: OwnerUnitDraft) => OwnerUnitDraft) => {
      setCreateOwnerForm((prev) => ({
        ...prev,
        units: prev.units.map((unit, unitIndex) =>
          unitIndex === index ? updater(unit) : unit,
        ),
      }));
    },
    [],
  );

  const handleCreateResident = async () => {
    if (!createOwnerForm.nameEN.trim()) {
      toast.error("Resident English name is required");
      return;
    }
    if (!createOwnerForm.phone.trim()) {
      toast.error("Resident phone is required");
      return;
    }
    if (!createOwnerForm.nationalIdPhotoFile) {
      toast.error("National ID image is required");
      return;
    }
    if (!createOwnerForm.units.length || !createOwnerForm.units[0].unitId) {
      toast.error("At least one unit assignment is required");
      return;
    }

    setIsCreatingResident(true);
    try {
      const nationalIdPhotoId = await uploadFile(
        "/files/upload/national-id",
        createOwnerForm.nationalIdPhotoFile,
      );

      const mappedUnits = [];
      for (let index = 0; index < createOwnerForm.units.length; index++) {
        const unitDraft = createOwnerForm.units[index];
        if (!unitDraft.unitId) {
          throw new Error(`Unit is required in assignment #${index + 1}`);
        }
        if (
          unitDraft.paymentMode === "INSTALLMENT" &&
          unitDraft.installments.length === 0
        ) {
          throw new Error(
            `Installments are required for installment mode (assignment #${index + 1})`,
          );
        }

        const contractFileId = unitDraft.contractFile
          ? await uploadFile("/files/upload/contract", unitDraft.contractFile)
          : undefined;

        const installments = [];
        for (
          let installmentIndex = 0;
          installmentIndex < unitDraft.installments.length;
          installmentIndex++
        ) {
          const installment = unitDraft.installments[installmentIndex];
          if (!installment.dueDate) {
            throw new Error(
              `Due date is required for installment #${installmentIndex + 1} in assignment #${index + 1}`,
            );
          }
          const amountNumber = Number(installment.amount);
          if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
            throw new Error(
              `Amount is invalid for installment #${installmentIndex + 1} in assignment #${index + 1}`,
            );
          }

          const referenceFileId = installment.referenceFile
            ? await uploadFile("/files/upload/contract", installment.referenceFile)
            : undefined;

          installments.push({
            dueDate: new Date(installment.dueDate).toISOString(),
            amount: amountNumber,
            referenceFileId,
            referencePageIndex: installment.referencePageIndex
              ? Number(installment.referencePageIndex)
              : undefined,
          });
        }

        mappedUnits.push({
          unitId: unitDraft.unitId,
          paymentMode: unitDraft.paymentMode,
          contractSignedAt: unitDraft.contractSignedAt
            ? new Date(unitDraft.contractSignedAt).toISOString()
            : undefined,
          contractFileId,
          notes: unitDraft.notes.trim() || undefined,
          installments,
        });
      }

      const response = await apiClient.post("/owners/create-with-unit", {
        nameEN: createOwnerForm.nameEN.trim(),
        nameAR: createOwnerForm.nameAR.trim() || undefined,
        email: createOwnerForm.email.trim() || undefined,
        phone: createOwnerForm.phone.trim(),
        nationalId: createOwnerForm.nationalId.trim() || undefined,
        nationalIdPhotoId,
        units: mappedUnits,
      });

      toast.success("Resident created", {
        description: response.data?.userEmail
          ? "Resident account and unit payment plans were created. Login credentials email was queued."
          : "Resident account and unit payment plans were created.",
      });
      setCreateOwnerForm(defaultCreateOwnerForm);
      onCreated?.();
      onBack();
    } catch (error) {
      toast.error("Failed to create resident", { description: errorMessage(error) });
    } finally {
      setIsCreatingResident(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-[#1E293B]">Add Resident</h1>
          <p className="text-[#64748B] mt-1">
            Full resident onboarding with multi-unit assignment and payment plan setup.
          </p>
        </div>
        <Button variant="outline" className="gap-2 text-[#0F172A]" onClick={onBack}>
          <ArrowLeft className="w-4 h-4" />
          Back To Residents
        </Button>
      </div>

      <Card className="p-5 rounded-xl border border-[#E2E8F0]">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Resident Name (EN)</Label>
            <Input
              value={createOwnerForm.nameEN}
              onChange={(e) => setCreateOwnerForm((prev) => ({ ...prev, nameEN: e.target.value }))}
              placeholder="Ahmed Hassan Mohamed"
            />
          </div>
          <div className="space-y-2">
            <Label>Resident Name (AR)</Label>
            <Input
              value={createOwnerForm.nameAR}
              onChange={(e) => setCreateOwnerForm((prev) => ({ ...prev, nameAR: e.target.value }))}
              placeholder="أحمد حسن محمد"
            />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input
              type="email"
              value={createOwnerForm.email}
              onChange={(e) => setCreateOwnerForm((prev) => ({ ...prev, email: e.target.value }))}
              placeholder="resident@example.com"
            />
          </div>
          <div className="space-y-2">
            <Label>Phone</Label>
            <Input
              value={createOwnerForm.phone}
              onChange={(e) => setCreateOwnerForm((prev) => ({ ...prev, phone: e.target.value }))}
              placeholder="+2010xxxxxxxx"
            />
          </div>
          <div className="space-y-2">
            <Label>National ID</Label>
            <Input
              value={createOwnerForm.nationalId}
              onChange={(e) => setCreateOwnerForm((prev) => ({ ...prev, nationalId: e.target.value }))}
              placeholder="2980***********"
            />
          </div>
          <div className="space-y-2">
            <Label>National ID Photo (Required)</Label>
            <Input
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) =>
                setCreateOwnerForm((prev) => ({
                  ...prev,
                  nationalIdPhotoFile: e.target.files?.[0] ?? null,
                }))
              }
            />
            <p className="text-xs text-[#64748B]">
              {createOwnerForm.nationalIdPhotoFile?.name ?? "No file selected"}
            </p>
          </div>
        </div>

        <div className="space-y-4 mt-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[#0F172A]">Unit Assignments & Payment Plans</h3>
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                setCreateOwnerForm((prev) => ({
                  ...prev,
                  units: [...prev.units, createDefaultOwnerUnitDraft()],
                }))
              }
            >
              Add Unit
            </Button>
          </div>
          {createOwnerForm.units.map((unitDraft, unitIndex) => (
            <Card key={`owner-unit-${unitIndex}`} className="p-4 border border-[#E2E8F0]">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-medium text-[#0F172A]">Assignment #{unitIndex + 1}</h4>
                {createOwnerForm.units.length > 1 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setCreateOwnerForm((prev) => ({
                        ...prev,
                        units: prev.units.filter((_, idx) => idx !== unitIndex),
                      }))
                    }
                  >
                    Remove
                  </Button>
                ) : null}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Unit</Label>
                  <Select
                    value={unitDraft.unitId || "none"}
                    onValueChange={(value) =>
                      updateOwnerUnit(unitIndex, (prev) => ({
                        ...prev,
                        unitId: value === "none" ? "" : value,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={isLoadingUnits ? "Loading units..." : "Select unit"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Select unit</SelectItem>
                      {unitOptions.map((unit) => (
                        <SelectItem key={unit.id} value={unit.id}>
                          {unit.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Payment Mode</Label>
                  <Select
                    value={unitDraft.paymentMode}
                    onValueChange={(value) =>
                      updateOwnerUnit(unitIndex, (prev) => ({
                        ...prev,
                        paymentMode: value as OwnerPaymentMode,
                        installments:
                          value === "INSTALLMENT" && prev.installments.length === 0
                            ? [createDefaultInstallmentDraft()]
                            : value === "CASH"
                              ? []
                              : prev.installments,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CASH">Cash</SelectItem>
                      <SelectItem value="INSTALLMENT">Installment</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Contract Signed Date</Label>
                  <Input
                    type="date"
                    value={unitDraft.contractSignedAt}
                    onChange={(e) =>
                      updateOwnerUnit(unitIndex, (prev) => ({
                        ...prev,
                        contractSignedAt: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Contract File (Image/PDF)</Label>
                  <Input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={(e) =>
                      updateOwnerUnit(unitIndex, (prev) => ({
                        ...prev,
                        contractFile: e.target.files?.[0] ?? null,
                      }))
                    }
                  />
                  <p className="text-xs text-[#64748B]">
                    {unitDraft.contractFile?.name ?? "No contract file selected"}
                  </p>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Notes (Optional)</Label>
                  <Input
                    value={unitDraft.notes}
                    onChange={(e) =>
                      updateOwnerUnit(unitIndex, (prev) => ({ ...prev, notes: e.target.value }))
                    }
                    placeholder="Payment plan notes..."
                  />
                </div>
              </div>

              {unitDraft.paymentMode === "INSTALLMENT" ? (
                <div className="mt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h5 className="text-xs font-semibold text-[#334155]">Installments / Checks</h5>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        updateOwnerUnit(unitIndex, (prev) => ({
                          ...prev,
                          installments: [...prev.installments, createDefaultInstallmentDraft()],
                        }))
                      }
                    >
                      Add Installment
                    </Button>
                  </div>
                  {unitDraft.installments.map((installment, installmentIndex) => (
                    <div
                      key={`inst-${unitIndex}-${installmentIndex}`}
                      className="grid grid-cols-1 md:grid-cols-4 gap-2 border border-[#E2E8F0] rounded-lg p-3"
                    >
                      <div className="space-y-1">
                        <Label>Due Date</Label>
                        <Input
                          type="date"
                          value={installment.dueDate}
                          onChange={(e) =>
                            updateOwnerUnit(unitIndex, (prev) => ({
                              ...prev,
                              installments: prev.installments.map((item, idx) =>
                                idx === installmentIndex ? { ...item, dueDate: e.target.value } : item,
                              ),
                            }))
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Amount</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={installment.amount}
                          onChange={(e) =>
                            updateOwnerUnit(unitIndex, (prev) => ({
                              ...prev,
                              installments: prev.installments.map((item, idx) =>
                                idx === installmentIndex ? { ...item, amount: e.target.value } : item,
                              ),
                            }))
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Page Index (Optional)</Label>
                        <Input
                          type="number"
                          min={1}
                          value={installment.referencePageIndex}
                          onChange={(e) =>
                            updateOwnerUnit(unitIndex, (prev) => ({
                              ...prev,
                              installments: prev.installments.map((item, idx) =>
                                idx === installmentIndex
                                  ? { ...item, referencePageIndex: e.target.value }
                                  : item,
                              ),
                            }))
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Check Image/PDF</Label>
                        <Input
                          type="file"
                          accept="image/*,application/pdf"
                          onChange={(e) =>
                            updateOwnerUnit(unitIndex, (prev) => ({
                              ...prev,
                              installments: prev.installments.map((item, idx) =>
                                idx === installmentIndex
                                  ? { ...item, referenceFile: e.target.files?.[0] ?? null }
                                  : item,
                              ),
                            }))
                          }
                        />
                      </div>
                      <div className="md:col-span-4 flex justify-end">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            updateOwnerUnit(unitIndex, (prev) => ({
                              ...prev,
                              installments: prev.installments.filter((_, idx) => idx !== installmentIndex),
                            }))
                          }
                        >
                          Remove installment
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </Card>
          ))}
        </div>

        <div className="flex justify-end mt-6">
          <Button
            className="gap-2 bg-[#0F172A] hover:bg-[#0F172A]/90 text-white"
            onClick={() => void handleCreateResident()}
            disabled={isCreatingResident}
          >
            <UserPlus className="w-4 h-4" />
            {isCreatingResident ? "Creating Resident..." : "Create Resident"}
          </Button>
        </div>
      </Card>
    </div>
  );
}

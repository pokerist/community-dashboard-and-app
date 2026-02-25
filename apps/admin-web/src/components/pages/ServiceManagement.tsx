import { useCallback, useEffect, useMemo, useState } from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import { Search, Plus, Trash2, Edit, GripVertical, X } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "../ui/dialog";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Switch } from "../ui/switch";
import apiClient from "../../lib/api-client";
import { errorMessage, getStatusColorClass, humanizeEnum } from "../../lib/live-data";

type FieldType = "text" | "number" | "date" | "householdMember" | "yesNo" | "fileUpload" | "textarea";

interface FormField {
  id: string;
  label: string;
  type: FieldType;
  required: boolean;
  placeholder?: string;
  order: number;
  persisted?: boolean;
}

interface BackendService {
  id: string;
  name: string;
  category: string;
  unitEligibility: string;
  processingTime?: number | null;
  description?: string | null;
  status: boolean;
  startingPrice?: string | number | null;
  totalRequests?: number | null;
  createdAt?: string;
  formFields?: Array<{
    id: string;
    label: string;
    type: string;
    required: boolean;
    placeholder?: string | null;
    order?: number | null;
  }>;
}

const SERVICE_CATEGORIES = [
  "MAINTENANCE",
  "RECREATION",
  "FITNESS",
  "SECURITY",
  "REQUESTS",
  "FACILITIES",
  "OTHER",
] as const;

function normalizeServiceCategoryForUi(value?: string | null) {
  const normalized = String(value ?? "").toUpperCase();
  if (normalized === "ADMIN") return "REQUESTS";
  return normalized;
}

function normalizeServiceCategoryForApi(value?: string | null) {
  const normalized = String(value ?? "").toUpperCase();
  if (normalized === "REQUESTS" || normalized === "ADMIN") return "REQUESTS";
  return normalized;
}

function serviceCategoryLabel(value?: string | null) {
  const normalized = normalizeServiceCategoryForUi(value);
  if (normalized === "REQUESTS") return "Requests";
  return humanizeEnum(normalized || "OTHER");
}

const ELIGIBILITY_OPTIONS = [
  { ui: "all", api: "ALL", label: "All Units" },
  { ui: "delivered", api: "DELIVERED_ONLY", label: "Delivered Units Only" },
  { ui: "not-delivered", api: "NON_DELIVERED_ONLY", label: "Non-Delivered Units" },
] as const;

function toUiFieldType(apiType: string): FieldType {
  switch (String(apiType).toUpperCase()) {
    case "TEXT":
      return "text";
    case "TEXTAREA":
      return "textarea";
    case "NUMBER":
      return "number";
    case "DATE":
      return "date";
    case "MEMBER_SELECTOR":
      return "householdMember";
    case "BOOLEAN":
      return "yesNo";
    case "FILE":
      return "fileUpload";
    default:
      return "text";
  }
}

function toApiFieldType(type: FieldType): string {
  switch (type) {
    case "text":
      return "TEXT";
    case "textarea":
      return "TEXTAREA";
    case "number":
      return "NUMBER";
    case "date":
      return "DATE";
    case "householdMember":
      return "MEMBER_SELECTOR";
    case "yesNo":
      return "BOOLEAN";
    case "fileUpload":
      return "FILE";
    default:
      return "TEXT";
  }
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export function ServiceManagement() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [servicesData, setServicesData] = useState<BackendService[]>([]);
  const [serviceRequestsData, setServiceRequestsData] = useState<any[]>([]);
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);

  const [serviceName, setServiceName] = useState("");
  const [serviceCategory, setServiceCategory] = useState<string>("");
  const [unitEligibility, setUnitEligibility] = useState<"delivered" | "not-delivered" | "all">("all");
  const [processingTime, setProcessingTime] = useState("");
  const [startingPrice, setStartingPrice] = useState("");
  const [description, setDescription] = useState("");
  const [serviceIsActive, setServiceIsActive] = useState(true);
  const [formFields, setFormFields] = useState<FormField[]>([]);

  const [newFieldLabel, setNewFieldLabel] = useState("");
  const [newFieldType, setNewFieldType] = useState<FieldType>("text");
  const [newFieldRequired, setNewFieldRequired] = useState(false);
  const [newFieldPlaceholder, setNewFieldPlaceholder] = useState("");

  const loadServices = useCallback(async () => {
    setIsLoading(true);
    try {
      const [servicesRes, requestsRes] = await Promise.all([
        apiClient.get("/services", { params: { status: "all" } }),
        apiClient.get("/service-requests"),
      ]);
      setServicesData(Array.isArray(servicesRes.data) ? servicesRes.data : []);
      setServiceRequestsData(Array.isArray(requestsRes.data) ? requestsRes.data : []);
    } catch (error) {
      toast.error("Failed to load services", { description: errorMessage(error) });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadServices();
  }, [loadServices]);

  const requestCountsByServiceId = useMemo(() => {
    const map = new Map<string, number>();
    for (const req of serviceRequestsData) {
      const serviceId = req.serviceId ?? req.service?.id;
      if (!serviceId) continue;
      map.set(serviceId, (map.get(serviceId) ?? 0) + 1);
    }
    return map;
  }, [serviceRequestsData]);

  const totalRequests = useMemo(() => serviceRequestsData.length, [serviceRequestsData]);

  const mostRequested = useMemo(() => {
    if (servicesData.length === 0) return null;
    const ranked = servicesData
      .map((s) => ({
        id: s.id,
        name: s.name,
        count: requestCountsByServiceId.get(s.id) ?? Number(s.totalRequests ?? 0),
      }))
      .sort((a, b) => b.count - a.count);
    return ranked[0] ?? null;
  }, [servicesData, requestCountsByServiceId]);

  const handleAddField = () => {
    if (!newFieldLabel.trim()) {
      toast.error("Please enter a field label");
      return;
    }

    const newField: FormField = {
      id: `local-${Date.now()}`,
      label: newFieldLabel.trim(),
      type: newFieldType,
      required: newFieldRequired,
      placeholder: newFieldPlaceholder || undefined,
      order: formFields.length,
      persisted: false,
    };

    setFormFields((prev) => [...prev, newField].map((f, index) => ({ ...f, order: index })));
    setNewFieldLabel("");
    setNewFieldType("text");
    setNewFieldRequired(false);
    setNewFieldPlaceholder("");
  };

  const handleRemoveField = (fieldId: string) => {
    setFormFields((prev) => prev.filter((f) => f.id !== fieldId).map((f, index) => ({ ...f, order: index })));
  };

  const resetForm = () => {
    setServiceName("");
    setServiceCategory("");
    setUnitEligibility("all");
    setProcessingTime("");
    setStartingPrice("");
    setDescription("");
    setServiceIsActive(true);
    setFormFields([]);
    setEditingServiceId(null);
    setNewFieldLabel("");
    setNewFieldType("text");
    setNewFieldRequired(false);
    setNewFieldPlaceholder("");
  };

  const handleCloseDialog = () => {
    setIsCreateDialogOpen(false);
    resetForm();
  };

  const fillFormForEdit = (service: BackendService) => {
    setEditingServiceId(service.id);
    setServiceName(service.name);
    setServiceCategory(normalizeServiceCategoryForUi(service.category));
    const eligibilityUi =
      ELIGIBILITY_OPTIONS.find((e) => e.api === String(service.unitEligibility).toUpperCase())?.ui ?? "all";
    setUnitEligibility(eligibilityUi);
    setProcessingTime(service.processingTime != null ? String(service.processingTime) : "");
    setStartingPrice(service.startingPrice != null ? String(service.startingPrice) : "");
    setDescription(service.description ?? "");
    setServiceIsActive(Boolean(service.status));
    setFormFields(
      (service.formFields ?? [])
        .slice()
        .sort((a, b) => Number(a.order ?? 0) - Number(b.order ?? 0))
        .map((field, index) => ({
          id: field.id,
          label: field.label,
          type: toUiFieldType(field.type),
          required: Boolean(field.required),
          placeholder: field.placeholder ?? undefined,
          order: Number(field.order ?? index),
          persisted: true,
        })),
    );
    setIsCreateDialogOpen(true);
  };

  const syncServiceFields = async (serviceId: string, nextFields: FormField[]) => {
    const existingService = servicesData.find((s) => s.id === serviceId);
    const existingFields = existingService?.formFields ?? [];
    const existingIds = new Set(existingFields.map((f) => f.id));
    const nextPersistedIds = new Set(nextFields.filter((f) => isUuid(f.id)).map((f) => f.id));

    const deletedIds = Array.from(existingIds).filter((id) => !nextPersistedIds.has(id));

    for (const id of deletedIds) {
      await apiClient.delete(`/service-fields/${id}`);
    }

    for (let index = 0; index < nextFields.length; index += 1) {
      const field = nextFields[index];
      const payload = {
        serviceId,
        label: field.label,
        type: toApiFieldType(field.type),
        placeholder: field.placeholder || undefined,
        required: Boolean(field.required),
        order: index,
      };

      if (isUuid(field.id)) {
        await apiClient.patch(`/service-fields/${field.id}`, payload);
      } else {
        await apiClient.post("/service-fields", payload);
      }
    }
  };

  const handleCreateOrUpdateService = async () => {
    if (!serviceName.trim() || !serviceCategory) {
      toast.error("Please fill in service name and category");
      return;
    }
    if (formFields.length === 0) {
      toast.error("Please add at least one form field");
      return;
    }

    const eligibilityApi =
      ELIGIBILITY_OPTIONS.find((e) => e.ui === unitEligibility)?.api ?? "ALL";

    const servicePayload = {
      name: serviceName.trim(),
      category: normalizeServiceCategoryForApi(serviceCategory),
      unitEligibility: eligibilityApi,
      processingTime: processingTime ? Number(processingTime) : undefined,
      description: description || undefined,
      status: serviceIsActive,
      startingPrice: startingPrice ? String(startingPrice) : undefined,
    };

    if (processingTime && Number.isNaN(Number(processingTime))) {
      toast.error("Processing time must be a number (hours)");
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingServiceId) {
        await apiClient.patch(`/services/${editingServiceId}`, servicePayload);
        await syncServiceFields(editingServiceId, formFields);
        toast.success("Service template updated");
      } else {
        const created = await apiClient.post("/services", servicePayload);
        const serviceId = created.data?.id;
        if (!serviceId) {
          throw new Error("Service created but no ID returned");
        }
        await syncServiceFields(serviceId, formFields);
        toast.success("Service template created");
      }

      handleCloseDialog();
      await loadServices();
    } catch (error) {
      toast.error("Failed to save service", { description: errorMessage(error) });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteService = async (id: string, name: string) => {
    try {
      await apiClient.delete(`/services/${id}`);
      toast.success("Service deleted", { description: `${name} has been removed.` });
      await loadServices();
    } catch (error) {
      toast.error("Failed to delete service", { description: errorMessage(error) });
    }
  };

  const handleToggleActive = async (service: BackendService) => {
    try {
      await apiClient.patch(`/services/${service.id}`, { status: !service.status });
      toast.success(`Service ${service.status ? "deactivated" : "activated"}`);
      await loadServices();
    } catch (error) {
      toast.error("Failed to update service status", { description: errorMessage(error) });
    }
  };

  const filteredServices = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return servicesData.filter((service) => {
      if (!q) return true;
      return (
        service.name.toLowerCase().includes(q) ||
        String(service.category).toLowerCase().includes(q) ||
        (service.description ?? "").toLowerCase().includes(q)
      );
    });
  }, [servicesData, searchTerm]);

  const activeServicesCount = servicesData.filter((s) => s.status).length;

  const getEligibilityBadge = (eligibility: string) => {
    const normalized = String(eligibility || "").toUpperCase();
    switch (normalized) {
      case "DELIVERED_ONLY":
        return <Badge className="bg-[#10B981]/10 text-[#10B981]">Delivered Units Only</Badge>;
      case "NON_DELIVERED_ONLY":
        return <Badge className="bg-[#F59E0B]/10 text-[#F59E0B]">Non-Delivered Units</Badge>;
      case "ALL":
      default:
        return <Badge className="bg-[#3B82F6]/10 text-[#3B82F6]">All Units</Badge>;
    }
  };

  const getFieldTypeLabel = (type: FieldType) => {
    const labels: Record<FieldType, string> = {
      text: "Text Input",
      number: "Number Input",
      date: "Date Picker",
      householdMember: "Household Member Selector",
      yesNo: "Yes/No Toggle",
      fileUpload: "File Upload",
      textarea: "Text Area",
    };
    return labels[type];
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[#1E293B]">Service Management</h1>
          <p className="text-[#64748B] mt-1">Manage service catalog and dynamic request forms (live backend)</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => void loadServices()} disabled={isLoading}>
            {isLoading ? "Refreshing..." : "Refresh"}
          </Button>
          <Dialog
            open={isCreateDialogOpen}
            onOpenChange={(open) => {
              if (!open) handleCloseDialog();
              else setIsCreateDialogOpen(true);
            }}
          >
            <DialogTrigger asChild>
              <Button className="bg-[#00B386] hover:bg-[#00B386]/90 text-white rounded-lg gap-2">
                <Plus className="w-4 h-4" />
                Create Service Template
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingServiceId ? "Edit Service Template" : "Create New Service Template"}</DialogTitle>
                <DialogDescription>
                  {editingServiceId
                    ? "Update service metadata and dynamic fields"
                    : "Create a new service and its dynamic request form"}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6 py-4">
                <div className="space-y-4">
                  <h3 className="text-[#1E293B]">Basic Information</h3>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="serviceName">Service Name *</Label>
                      <Input
                        id="serviceName"
                        placeholder="e.g., Pool Access Card"
                        value={serviceName}
                        onChange={(e) => setServiceName(e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="category">Category *</Label>
                      <Select value={serviceCategory} onValueChange={setServiceCategory}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          {SERVICE_CATEGORIES.map((cat) => (
                            <SelectItem key={cat} value={cat}>
                              {humanizeEnum(cat)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="eligibility">Unit Eligibility *</Label>
                      <Select value={unitEligibility} onValueChange={(value: any) => setUnitEligibility(value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select eligibility" />
                        </SelectTrigger>
                        <SelectContent>
                          {ELIGIBILITY_OPTIONS.map((opt) => (
                            <SelectItem key={opt.api} value={opt.ui}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="processingTime">Processing Time (hours)</Label>
                      <Input
                        id="processingTime"
                        type="number"
                        min={0}
                        placeholder="24"
                        value={processingTime}
                        onChange={(e) => setProcessingTime(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="startingPrice">Starting Price (optional)</Label>
                      <Input
                        id="startingPrice"
                        type="number"
                        min={0}
                        step="0.01"
                        placeholder="0.00"
                        value={startingPrice}
                        onChange={(e) => setStartingPrice(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="serviceActive">Visibility</Label>
                      <div className="flex items-center gap-3 h-9">
                        <Switch id="serviceActive" checked={serviceIsActive} onCheckedChange={setServiceIsActive} />
                        <span className="text-sm text-[#64748B]">{serviceIsActive ? "Active (visible)" : "Inactive (hidden)"}</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      placeholder="Describe what this service is for..."
                      rows={2}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-4 border-t border-[#E5E7EB] pt-6">
                  <h3 className="text-[#1E293B]">Form Fields</h3>
                  <p className="text-sm text-[#64748B]">
                    Add custom fields residents will fill when creating a service request.
                  </p>

                  {formFields.length > 0 && (
                    <div className="space-y-2 bg-[#F9FAFB] p-4 rounded-lg">
                      <p className="text-sm text-[#64748B] mb-2">Current Fields ({formFields.length})</p>
                      {formFields.map((field, index) => (
                        <div key={field.id} className="flex items-center gap-3 bg-white p-3 rounded-lg border border-[#E5E7EB]">
                          <GripVertical className="w-4 h-4 text-[#64748B]" />
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-[#1E293B]">{field.label}</span>
                              {field.required && (
                                <Badge variant="secondary" className="bg-[#EF4444]/10 text-[#EF4444] text-xs">
                                  Required
                                </Badge>
                              )}
                              <Badge variant="secondary" className="bg-[#E2E8F0] text-[#475569] text-xs">
                                #{index + 1}
                              </Badge>
                            </div>
                            <span className="text-xs text-[#64748B]">{getFieldTypeLabel(field.type)}</span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveField(field.id)}
                            className="text-[#EF4444] hover:text-[#EF4444] hover:bg-[#EF4444]/10"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  <Card className="p-4 bg-[#F9FAFB] border-dashed">
                    <p className="text-sm text-[#1E293B] mb-3">Add New Field</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label htmlFor="fieldLabel" className="text-xs">Field Label</Label>
                        <Input
                          id="fieldLabel"
                          placeholder="e.g., Preferred Date"
                          value={newFieldLabel}
                          onChange={(e) => setNewFieldLabel(e.target.value)}
                          className="bg-white"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="fieldType" className="text-xs">Field Type</Label>
                        <Select value={newFieldType} onValueChange={(value: FieldType) => setNewFieldType(value)}>
                          <SelectTrigger className="bg-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="text">Text Input</SelectItem>
                            <SelectItem value="textarea">Text Area</SelectItem>
                            <SelectItem value="number">Number Input</SelectItem>
                            <SelectItem value="date">Date Picker</SelectItem>
                            <SelectItem value="householdMember">Household Member Selector</SelectItem>
                            <SelectItem value="yesNo">Yes/No Toggle</SelectItem>
                            <SelectItem value="fileUpload">File Upload</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="fieldPlaceholder" className="text-xs">Placeholder (Optional)</Label>
                        <Input
                          id="fieldPlaceholder"
                          placeholder="Help text for user..."
                          value={newFieldPlaceholder}
                          onChange={(e) => setNewFieldPlaceholder(e.target.value)}
                          className="bg-white"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="fieldRequired" className="text-xs">Required Field</Label>
                        <div className="flex items-center gap-2 h-10">
                          <Switch id="fieldRequired" checked={newFieldRequired} onCheckedChange={setNewFieldRequired} />
                          <span className="text-sm text-[#64748B]">{newFieldRequired ? "Required" : "Optional"}</span>
                        </div>
                      </div>
                    </div>

                    <Button
                      onClick={handleAddField}
                      variant="outline"
                      className="w-full mt-3 border-[#00B386] text-[#00B386] hover:bg-[#00B386]/10"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Field
                    </Button>
                  </Card>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={handleCloseDialog}>Cancel</Button>
                <Button
                  className="bg-[#00B386] hover:bg-[#00B386]/90 text-white"
                  onClick={() => void handleCreateOrUpdateService()}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Saving..." : editingServiceId ? "Update Service Template" : "Create Service Template"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="p-6 shadow-card rounded-xl">
          <p className="text-[#64748B] mb-2">Total Services</p>
          <h3 className="text-[#1E293B] mb-1">{servicesData.length}</h3>
          <p className="text-xs text-[#64748B]">Live count</p>
        </Card>
        <Card className="p-6 shadow-card rounded-xl">
          <p className="text-[#64748B] mb-2">Active Services</p>
          <h3 className="text-[#1E293B] mb-1">{activeServicesCount}</h3>
          <p className="text-xs text-[#64748B]">Visible to residents</p>
        </Card>
        <Card className="p-6 shadow-card rounded-xl">
          <p className="text-[#64748B] mb-2">Total Requests</p>
          <h3 className="text-[#1E293B] mb-1">{totalRequests}</h3>
          <p className="text-xs text-[#64748B]">From `/service-requests`</p>
        </Card>
        <Card className="p-6 shadow-card rounded-xl">
          <p className="text-[#64748B] mb-2">Most Requested</p>
          <h3 className="text-[#1E293B] mb-1">{mostRequested?.name ?? "—"}</h3>
          <p className="text-xs text-[#64748B]">{mostRequested ? `${mostRequested.count} requests` : "No requests yet"}</p>
        </Card>
      </div>

      <Card className="p-4 shadow-card rounded-xl">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748B]" />
          <Input
            placeholder="Search services by name or category..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 rounded-lg"
          />
        </div>
      </Card>

      <Card className="shadow-card rounded-xl overflow-hidden">
        <div className="p-4 border-b border-[#E5E7EB]">
          <h3 className="text-[#1E293B]">Service Templates</h3>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="bg-[#F9FAFB]">
              <TableHead>Service Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Unit Eligibility</TableHead>
              <TableHead>Form Fields</TableHead>
              <TableHead>Processing Time</TableHead>
              <TableHead>Total Requests</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredServices.map((service) => {
              const requestCount = requestCountsByServiceId.get(service.id) ?? Number(service.totalRequests ?? 0);
              return (
                <TableRow key={service.id} className="hover:bg-[#F9FAFB]">
                  <TableCell className="font-medium text-[#1E293B]">{service.name}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="bg-[#F3F4F6] text-[#1E293B]">
                      {serviceCategoryLabel(service.category)}
                    </Badge>
                  </TableCell>
                  <TableCell>{getEligibilityBadge(service.unitEligibility)}</TableCell>
                  <TableCell className="text-[#64748B]">{service.formFields?.length ?? 0} fields</TableCell>
                  <TableCell className="text-[#64748B]">
                    {service.processingTime != null ? `${service.processingTime}h` : "—"}
                  </TableCell>
                  <TableCell className="text-[#1E293B]">{requestCount}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch checked={Boolean(service.status)} onCheckedChange={() => void handleToggleActive(service)} />
                      <Badge className={getStatusColorClass(service.status ? "ACTIVE" : "DISABLED")}>
                        {service.status ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => fillFormForEdit(service)}
                        className="text-[#00B386] hover:text-[#00B386] hover:bg-[#00B386]/10"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => void handleDeleteService(service.id, service.name)}
                        className="text-[#EF4444] hover:text-[#EF4444] hover:bg-[#EF4444]/10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {!isLoading && filteredServices.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-10 text-[#64748B]">
                  No services found. Create the first service template.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

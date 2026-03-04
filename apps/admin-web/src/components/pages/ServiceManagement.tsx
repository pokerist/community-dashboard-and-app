import { useCallback, useEffect, useMemo, useState, type ComponentType } from "react";
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
import { Search, Plus, Trash2, Edit, GripVertical, X, Eye, Send, RefreshCw, ArrowUp, ArrowDown } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
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
import { IconPicker } from "../ui/icon-picker";
import apiClient from "../../lib/api-client";
import * as IoIcons from "react-icons/io5";
import {
  errorMessage,
  formatDateTime,
  getPriorityColorClass,
  getStatusColorClass,
  humanizeEnum,
} from "../../lib/live-data";
import { adminPriorityLabel, adminTicketStatusLabel } from "../../lib/status-labels";

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
  displayOrder?: number | null;
  unitEligibility: string;
  isUrgent?: boolean;
  processingTime?: number | null;
  description?: string | null;
  status: boolean;
  startingPrice?: string | number | null;
  totalRequests?: number | null;
  iconName?: string | null;
  iconTone?: string | null;
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

interface ServiceRequestListRow {
  id: string;
  serviceId?: string | null;
  unitId?: string | null;
  status?: string | null;
  priority?: string | null;
  description?: string | null;
  requestedAt?: string | null;
  updatedAt?: string | null;
  assignedToId?: string | null;
  service?: { id?: string; name?: string | null; category?: string | null } | null;
  unit?: { id?: string; unitNumber?: string | null; block?: string | null } | null;
  createdBy?: { id?: string; nameEN?: string | null; email?: string | null; phone?: string | null } | null;
}

interface ServiceRequestCommentRow {
  id: string;
  body: string;
  isInternal?: boolean;
  createdAt?: string | null;
  createdById?: string | null;
  createdBy?: { id?: string; nameEN?: string | null; email?: string | null } | null;
}

interface ServiceRequestDetailRow extends ServiceRequestListRow {
  attachments?: Array<{ id?: string; fileId?: string; file?: { originalName?: string | null } | null }>;
  fieldValues?: Array<{
    id?: string;
    valueText?: string | null;
    valueNumber?: number | null;
    valueBool?: boolean | null;
    valueDate?: string | null;
    fileAttachmentId?: string | null;
    field?: { id?: string; label?: string | null; type?: string | null } | null;
  }>;
  comments?: ServiceRequestCommentRow[];
}

type PendingFocusEntity = {
  section?: string;
  entityType?: string | null;
  entityId?: string | null;
  serviceCategory?: string | null;
};

type TicketPreset = "all" | "pending" | "overdue" | "closed";

const SERVICE_REQUEST_STATUSES = ["NEW", "IN_PROGRESS", "RESOLVED", "CLOSED", "CANCELLED"] as const;

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

function kebabToPascalIconKey(iconName: string): string {
  return `Io${iconName
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("")}`;
}

function resolveServiceIcon(iconName?: string | null) {
  if (!iconName) return null;
  const key = kebabToPascalIconKey(iconName);
  const icon = (IoIcons as Record<string, ComponentType<{ className?: string }>>)[key];
  return icon ?? null;
}

type ServiceManagementProps = {
  mode?: "services" | "requests";
};

export function ServiceManagement({ mode = "services" }: ServiceManagementProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [servicesData, setServicesData] = useState<BackendService[]>([]);
  const [serviceRequestsData, setServiceRequestsData] = useState<ServiceRequestListRow[]>([]);
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [ticketSearchTerm, setTicketSearchTerm] = useState("");
  const [ticketStatusFilter, setTicketStatusFilter] = useState<string>("all");
  const [ticketPreset, setTicketPreset] = useState<TicketPreset>("all");
  const [isTicketDialogOpen, setIsTicketDialogOpen] = useState(false);
  const [activeTicketId, setActiveTicketId] = useState<string | null>(null);
  const [activeTicket, setActiveTicket] = useState<ServiceRequestDetailRow | null>(null);
  const [ticketComments, setTicketComments] = useState<ServiceRequestCommentRow[]>([]);
  const [ticketLoading, setTicketLoading] = useState(false);
  const [ticketReplyText, setTicketReplyText] = useState("");
  const [ticketReplyInternal, setTicketReplyInternal] = useState(false);
  const [ticketReplySubmitting, setTicketReplySubmitting] = useState(false);
  const [ticketStatusDraft, setTicketStatusDraft] = useState<string>("");
  const [ticketStatusUpdating, setTicketStatusUpdating] = useState(false);

  const [serviceName, setServiceName] = useState("");
  const [serviceCategory, setServiceCategory] = useState<string>("");
  const [unitEligibility, setUnitEligibility] = useState<"delivered" | "not-delivered" | "all">("all");
  const [processingTime, setProcessingTime] = useState("");
  const [startingPrice, setStartingPrice] = useState("");
  const [description, setDescription] = useState("");
  const [serviceIsActive, setServiceIsActive] = useState(true);
  const [serviceIsUrgent, setServiceIsUrgent] = useState(false);
  const [serviceIconName, setServiceIconName] = useState<string | null>(null);
  const [serviceIconTone, setServiceIconTone] = useState<
    "auto" | "blue" | "orange" | "purple" | "green" | "pink" | "teal"
  >("auto");
  const [formFields, setFormFields] = useState<FormField[]>([]);

  const [newFieldLabel, setNewFieldLabel] = useState("");
  const [newFieldType, setNewFieldType] = useState<FieldType>("text");
  const [newFieldRequired, setNewFieldRequired] = useState(false);
  const [newFieldPlaceholder, setNewFieldPlaceholder] = useState("");

  const ticketFiltersStorageKey = useMemo(
    () => `admin.serviceManagement.ticketFilters.${mode}`,
    [mode],
  );

  const resetTicketFilters = useCallback(() => {
    setTicketSearchTerm("");
    setTicketStatusFilter("all");
    setTicketPreset("all");
    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(ticketFiltersStorageKey);
      } catch {
        // ignore storage failures
      }
    }
  }, [ticketFiltersStorageKey]);

  const loadServices = useCallback(async () => {
    setIsLoading(true);
    try {
      const kind = mode === "requests" ? "requests" : "services";
      const [servicesRes, requestsRes] = await Promise.all([
        apiClient.get("/services", { params: { status: "all", kind } }),
        apiClient.get("/service-requests", { params: { kind } }),
      ]);
      setServicesData(Array.isArray(servicesRes.data) ? servicesRes.data : []);
      setServiceRequestsData(Array.isArray(requestsRes.data) ? requestsRes.data : []);
    } catch (error) {
      toast.error("Failed to load services", { description: errorMessage(error) });
    } finally {
      setIsLoading(false);
    }
  }, [mode]);

  useEffect(() => {
    void loadServices();
  }, [loadServices]);

  useEffect(() => {
    if (mode === "requests" && !editingServiceId && !serviceCategory) {
      setServiceCategory("REQUESTS");
    }
  }, [editingServiceId, mode, serviceCategory]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(ticketFiltersStorageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        search?: string;
        status?: string;
        preset?: TicketPreset;
      };
      setTicketSearchTerm(String(parsed.search ?? ""));
      setTicketStatusFilter(String(parsed.status ?? "all"));
      setTicketPreset(
        parsed.preset === "pending" ||
          parsed.preset === "overdue" ||
          parsed.preset === "closed"
          ? parsed.preset
          : "all",
      );
    } catch {
      // ignore malformed local cache
    }
  }, [ticketFiltersStorageKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        ticketFiltersStorageKey,
        JSON.stringify({
          search: ticketSearchTerm,
          status: ticketStatusFilter,
          preset: ticketPreset,
        }),
      );
    } catch {
      // ignore storage failures
    }
  }, [ticketFiltersStorageKey, ticketPreset, ticketSearchTerm, ticketStatusFilter]);

  const loadTicketDetail = useCallback(async (ticketId: string) => {
    setTicketLoading(true);
    try {
      const [detailRes, commentsRes] = await Promise.all([
        apiClient.get(`/service-requests/${ticketId}`),
        apiClient.get(`/service-requests/${ticketId}/comments`),
      ]);
      const detail = detailRes.data as ServiceRequestDetailRow;
      const comments = Array.isArray(commentsRes.data)
        ? (commentsRes.data as ServiceRequestCommentRow[])
        : [];
      setActiveTicket(detail);
      setTicketComments(comments);
      setTicketStatusDraft(String(detail.status ?? "NEW").toUpperCase());
    } catch (error) {
      toast.error("Failed to load ticket details", { description: errorMessage(error) });
      setActiveTicket(null);
      setTicketComments([]);
    } finally {
      setTicketLoading(false);
    }
  }, []);

  const openTicketDialog = useCallback(async (ticket: ServiceRequestListRow) => {
    setIsTicketDialogOpen(true);
    setActiveTicketId(ticket.id);
    setActiveTicket(ticket as ServiceRequestDetailRow);
    setTicketComments([]);
    setTicketReplyText("");
    setTicketReplyInternal(false);
    setTicketStatusDraft(String(ticket.status ?? "NEW").toUpperCase());
    await loadTicketDetail(ticket.id);
  }, [loadTicketDetail]);

  useEffect(() => {
    if (typeof window === "undefined" || serviceRequestsData.length === 0) return;

    let parsed: PendingFocusEntity | null = null;
    try {
      const raw = window.sessionStorage.getItem("admin.focusEntity");
      if (!raw) return;
      parsed = JSON.parse(raw) as PendingFocusEntity;
    } catch {
      return;
    }

    const targetSection = mode === "requests" ? "requests" : "services";
    const targetId = String(parsed?.entityId ?? "").trim();
    const targetEntityType = String(parsed?.entityType ?? "").trim().toUpperCase();

    if (!targetId || targetEntityType !== "SERVICE_REQUEST") return;
    if (String(parsed?.section ?? "").trim().toLowerCase() !== targetSection) return;

    const ticket = serviceRequestsData.find((row) => {
      if (String(row.id) !== targetId) return false;
      const category = String(row.service?.category ?? "").toUpperCase();
      const isRequestTicket = category === "REQUESTS" || category === "ADMIN";
      return mode === "requests" ? isRequestTicket : !isRequestTicket;
    });

    if (!ticket) return;
    window.sessionStorage.removeItem("admin.focusEntity");
    void openTicketDialog(ticket);
  }, [mode, openTicketDialog, serviceRequestsData]);

  const closeTicketDialog = useCallback(() => {
    setIsTicketDialogOpen(false);
    setActiveTicketId(null);
    setActiveTicket(null);
    setTicketComments([]);
    setTicketReplyText("");
    setTicketReplyInternal(false);
    setTicketStatusDraft("");
  }, []);

  const refreshActiveTicket = useCallback(async () => {
    if (!activeTicketId) return;
    await loadTicketDetail(activeTicketId);
  }, [activeTicketId, loadTicketDetail]);

  const submitTicketReply = useCallback(async () => {
    if (!activeTicketId) return;
    const body = ticketReplyText.trim();
    if (!body) {
      toast.error("Reply message is required");
      return;
    }
    setTicketReplySubmitting(true);
    try {
      const res = await apiClient.post(`/service-requests/${activeTicketId}/comments`, {
        body,
        isInternal: ticketReplyInternal,
      });
      const created = res.data as ServiceRequestCommentRow;
      setTicketComments((prev) => [...prev, created]);
      setTicketReplyText("");
      setTicketReplyInternal(false);
      toast.success("Reply posted");
      await loadServices();
      await refreshActiveTicket();
    } catch (error) {
      toast.error("Failed to post reply", { description: errorMessage(error) });
    } finally {
      setTicketReplySubmitting(false);
    }
  }, [
    activeTicketId,
    ticketReplyInternal,
    ticketReplyText,
    loadServices,
    refreshActiveTicket,
  ]);

  const applyTicketStatus = useCallback(async () => {
    if (!activeTicketId || !ticketStatusDraft) return;
    setTicketStatusUpdating(true);
    try {
      await apiClient.patch(`/service-requests/${activeTicketId}`, {
        status: ticketStatusDraft,
      });
      toast.success("Ticket status updated");
      await loadServices();
      await refreshActiveTicket();
    } catch (error) {
      toast.error("Failed to update status", { description: errorMessage(error) });
    } finally {
      setTicketStatusUpdating(false);
    }
  }, [activeTicketId, ticketStatusDraft, loadServices, refreshActiveTicket]);

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
    setServiceIsUrgent(false);
    setServiceIconName(null);
    setServiceIconTone("auto");
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
    setServiceIsUrgent(Boolean(service.isUrgent));
    setServiceIconName(service.iconName ?? null);
    setServiceIconTone(
      (["auto", "blue", "orange", "purple", "green", "pink", "teal"].includes(String(service.iconTone))
        ? service.iconTone
        : "auto") as "auto" | "blue" | "orange" | "purple" | "green" | "pink" | "teal",
    );
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

    const servicePayload: Record<string, unknown> = {
      name: serviceName.trim(),
      category: normalizeServiceCategoryForApi(serviceCategory),
      unitEligibility: eligibilityApi,
      processingTime: processingTime ? Number(processingTime) : undefined,
      description: description || undefined,
      status: serviceIsActive,
      isUrgent: serviceIsUrgent,
      startingPrice: startingPrice ? String(startingPrice) : undefined,
      iconTone: serviceIconTone,
    };

    if (editingServiceId) {
      servicePayload.iconName = serviceIconName ?? null;
    } else if (serviceIconName) {
      servicePayload.iconName = serviceIconName;
    }

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

  const modeServices = useMemo(() => {
    return servicesData.filter((service) => {
      const isRequestCatalog =
        String(service.category ?? "").toUpperCase() === "REQUESTS" ||
        String(service.category ?? "").toUpperCase() === "ADMIN";
      return mode === "requests" ? isRequestCatalog : !isRequestCatalog;
    });
  }, [mode, servicesData]);

  const reorderCatalog = useCallback(
    async (serviceId: string, direction: "up" | "down") => {
      const ids = modeServices.map((s) => s.id);
      const index = ids.indexOf(serviceId);
      if (index < 0) return;
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= ids.length) return;
      const next = [...ids];
      const [moved] = next.splice(index, 1);
      next.splice(targetIndex, 0, moved);
      try {
        await apiClient.patch("/services/reorder", { ids: next });
        await loadServices();
      } catch (error) {
        toast.error("Failed to reorder catalog", { description: errorMessage(error) });
      }
    },
    [loadServices, modeServices],
  );

  const filteredServices = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return servicesData.filter((service) => {
      const isRequestCatalog =
        String(service.category ?? "").toUpperCase() === "REQUESTS" ||
        String(service.category ?? "").toUpperCase() === "ADMIN";
      if (mode === "services" && isRequestCatalog) return false;
      if (mode === "requests" && !isRequestCatalog) return false;
      if (!q) return true;
      return (
        service.name.toLowerCase().includes(q) ||
        String(service.category).toLowerCase().includes(q) ||
        (service.description ?? "").toLowerCase().includes(q)
      );
    });
  }, [mode, servicesData, searchTerm]);

  const filteredTickets = useMemo(() => {
    const q = ticketSearchTerm.trim().toLowerCase();
    const now = Date.now();
    const overdueThresholdMs = 24 * 60 * 60 * 1000;
    return serviceRequestsData.filter((ticket) => {
      const category = String(ticket.service?.category ?? "").toUpperCase();
      const isRequestTicket = category === "REQUESTS" || category === "ADMIN";
      if (mode === "services" && isRequestTicket) return false;
      if (mode === "requests" && !isRequestTicket) return false;
      const status = String(ticket.status ?? "").toUpperCase();
      if (ticketStatusFilter !== "all" && status !== ticketStatusFilter) return false;
      if (ticketPreset === "pending" && !(status === "NEW" || status === "IN_PROGRESS")) {
        return false;
      }
      if (
        ticketPreset === "closed" &&
        !(status === "RESOLVED" || status === "CLOSED" || status === "CANCELLED")
      ) {
        return false;
      }
      if (ticketPreset === "overdue") {
        if (!(status === "NEW" || status === "IN_PROGRESS")) return false;
        const createdAt = ticket.requestedAt ?? ticket.updatedAt;
        const createdTs = createdAt ? new Date(createdAt).getTime() : NaN;
        if (!Number.isFinite(createdTs) || now - createdTs < overdueThresholdMs) {
          return false;
        }
      }
      if (!q) return true;
      const haystack = [
        ticket.service?.name,
        ticket.createdBy?.nameEN,
        ticket.createdBy?.email,
        ticket.createdBy?.phone,
        ticket.unit?.unitNumber,
        ticket.description,
        ticket.id,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [mode, serviceRequestsData, ticketPreset, ticketSearchTerm, ticketStatusFilter]);

  const openTicketsCount = useMemo(() => filteredTickets.filter((r) =>
    ["NEW", "IN_PROGRESS"].includes(String(r.status ?? "").toUpperCase()),
  ).length, [filteredTickets]);

  const ticketVisualMetrics = useMemo(() => {
    const OVERDUE_MS = 24 * 60 * 60 * 1000;
    const now = Date.now();
    let pending = 0;
    let closed = 0;
    let overdue = 0;

    for (const ticket of filteredTickets) {
      const status = String(ticket.status ?? "").toUpperCase();
      const isPending = status === "NEW" || status === "IN_PROGRESS";
      const isClosed = status === "RESOLVED" || status === "CLOSED" || status === "CANCELLED";

      if (isPending) {
        pending += 1;
        const createdAt = ticket.requestedAt ?? ticket.updatedAt;
        const createdTs = createdAt ? new Date(createdAt).getTime() : NaN;
        if (Number.isFinite(createdTs) && now - createdTs > OVERDUE_MS) {
          overdue += 1;
        }
      }
      if (isClosed) closed += 1;
    }

    return { pending, closed, overdue };
  }, [filteredTickets]);

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
          <h1 className="text-[#1E293B]">
            {mode === "requests" ? "Requests Management" : "Service Management"}
          </h1>
          <p className="text-[#64748B] mt-1">
            {mode === "requests"
              ? "Manage request templates and submitted request tickets."
              : "Manage service catalog and submitted service tickets."}
          </p>
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
                {mode === "requests" ? "Add Request Template" : "Create Service Template"}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingServiceId
                    ? mode === "requests"
                      ? "Edit Request Template"
                      : "Edit Service Template"
                    : mode === "requests"
                      ? "Create New Request Template"
                      : "Create New Service Template"}
                </DialogTitle>
                <DialogDescription>
                  {editingServiceId
                    ? "Update service metadata and dynamic fields"
                    : "Create a new service and its dynamic request form"}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6 py-4">
                <div className="space-y-4">
                  <h3 className="text-[#1E293B]">Basic Information</h3>

                  <div className="grid grid-cols-3 gap-4">
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
                          {(mode === "requests"
                            ? SERVICE_CATEGORIES.filter((cat) => cat === "REQUESTS")
                            : SERVICE_CATEGORIES.filter((cat) => cat !== "REQUESTS")
                          ).map((cat) => (
                            <SelectItem key={cat} value={cat}>
                              {humanizeEnum(cat)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Service Icon</Label>
                    <IconPicker
                      value={serviceIconName}
                      tone={serviceIconTone}
                      onChange={setServiceIconName}
                      onToneChange={setServiceIconTone}
                    />
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
                    <div className="space-y-2">
                      <Label htmlFor="serviceUrgent">Urgent Service</Label>
                      <div className="flex items-center gap-3 h-9">
                        <Switch id="serviceUrgent" checked={serviceIsUrgent} onCheckedChange={setServiceIsUrgent} />
                        <span className="text-sm text-[#64748B]">
                          {serviceIsUrgent ? "Yes (urgent lane)" : "No"}
                        </span>
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

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-6">
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
        <Card className="p-6 shadow-card rounded-xl">
          <p className="text-[#64748B] mb-2">Open Tickets</p>
          <h3 className="text-[#1E293B] mb-1">{openTicketsCount}</h3>
          <p className="text-xs text-[#64748B]">NEW + IN_PROGRESS</p>
        </Card>
      </div>

      <Tabs defaultValue="submitted" className="space-y-4">
        <TabsList className="grid w-full max-w-[380px] grid-cols-2">
          <TabsTrigger value="submitted">Submitted Tickets</TabsTrigger>
          <TabsTrigger value="catalog">{mode === "requests" ? "Request Catalog" : "Service Catalog"}</TabsTrigger>
        </TabsList>

        <TabsContent value="submitted">
          <Card className="shadow-card rounded-xl overflow-hidden">
            <div className="p-4 border-b border-[#E5E7EB] flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h3 className="text-[#1E293B]">
                  {mode === "requests" ? "Submitted Request Tickets" : "Submitted Service Tickets"}
                </h3>
                <p className="text-sm text-[#64748B] mt-1">
                  Review resident requests, update status, and reply to ticket conversations.
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Badge className="bg-[#FEF3C7] text-[#92400E]">
                    Pending: {ticketVisualMetrics.pending}
                  </Badge>
                  <Badge className="bg-[#DCFCE7] text-[#166534]">
                    Closed: {ticketVisualMetrics.closed}
                  </Badge>
                  <Badge className="bg-[#FEE2E2] text-[#B91C1C]">
                    Overdue: {ticketVisualMetrics.overdue}
                  </Badge>
                </div>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    variant={ticketPreset === "all" ? "default" : "outline"}
                    className={ticketPreset === "all" ? "bg-[#0B5FFF] hover:bg-[#0B5FFF]/90 text-white" : ""}
                    onClick={() => setTicketPreset("all")}
                  >
                    All
                  </Button>
                  <Button
                    size="sm"
                    variant={ticketPreset === "pending" ? "default" : "outline"}
                    className={ticketPreset === "pending" ? "bg-[#F59E0B] hover:bg-[#D97706] text-white" : ""}
                    onClick={() => {
                      setTicketPreset("pending");
                      setTicketStatusFilter("all");
                    }}
                  >
                    Pending
                  </Button>
                  <Button
                    size="sm"
                    variant={ticketPreset === "overdue" ? "default" : "outline"}
                    className={ticketPreset === "overdue" ? "bg-[#DC2626] hover:bg-[#B91C1C] text-white" : ""}
                    onClick={() => {
                      setTicketPreset("overdue");
                      setTicketStatusFilter("all");
                    }}
                  >
                    Overdue
                  </Button>
                  <Button
                    size="sm"
                    variant={ticketPreset === "closed" ? "default" : "outline"}
                    className={ticketPreset === "closed" ? "bg-[#10B981] hover:bg-[#059669] text-white" : ""}
                    onClick={() => {
                      setTicketPreset("closed");
                      setTicketStatusFilter("all");
                    }}
                  >
                    Closed
                  </Button>
                </div>
                <div className="relative min-w-[220px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748B]" />
                  <Input
                    placeholder="Search tickets..."
                    value={ticketSearchTerm}
                    onChange={(e) => setTicketSearchTerm(e.target.value)}
                    className="pl-10 rounded-lg"
                  />
                </div>
                <Select value={ticketStatusFilter} onValueChange={setTicketStatusFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    {SERVICE_REQUEST_STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>
                        {adminTicketStatusLabel("SERVICE", status)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="outline" onClick={() => void loadServices()} disabled={isLoading}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Refresh
                </Button>
                <Button variant="outline" onClick={resetTicketFilters}>
                  <X className="w-4 h-4 mr-2" />
                  Reset Filters
                </Button>
              </div>
            </div>

            <Table>
              <TableHeader>
                <TableRow className="bg-[#F9FAFB]">
                  <TableHead>Ticket</TableHead>
                  <TableHead>Resident</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTickets.map((ticket) => (
                  <TableRow key={ticket.id} className="hover:bg-[#F9FAFB]">
                    <TableCell>
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-[#1E293B]">
                          {ticket.service?.name ?? "Service Request"}
                        </p>
                        <p className="text-xs text-[#64748B]">
                          {ticket.id.slice(0, 8)} • {String(ticket.service?.category ?? "").toUpperCase() === "REQUESTS" || String(ticket.service?.category ?? "").toUpperCase() === "ADMIN" ? "Request" : "Service"}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <p className="text-sm text-[#1E293B]">{ticket.createdBy?.nameEN || "—"}</p>
                        <p className="text-xs text-[#64748B]">{ticket.createdBy?.email || ticket.createdBy?.phone || "—"}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-[#64748B]">
                      {ticket.unit?.block ? `${ticket.unit.block} • ` : ""}
                      {ticket.unit?.unitNumber ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge className={getPriorityColorClass(ticket.priority || "MEDIUM")}>
                        {adminPriorityLabel(ticket.priority || "MEDIUM")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusColorClass(ticket.status)}>
                        {adminTicketStatusLabel("SERVICE", ticket.status || "NEW")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-[#64748B]">{formatDateTime(ticket.updatedAt || ticket.requestedAt)}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => void openTicketDialog(ticket)}>
                        <Eye className="w-4 h-4 mr-1" />
                        Open
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {!isLoading && filteredTickets.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-10 text-[#64748B]">
                      No tickets match the current filters.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="catalog" className="space-y-4">
          <Card className="p-4 shadow-card rounded-xl">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748B]" />
              <Input
                placeholder={mode === "requests" ? "Search requests catalog..." : "Search services by name or category..."}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 rounded-lg"
              />
            </div>
          </Card>

          <Card className="shadow-card rounded-xl overflow-hidden">
            <div className="p-4 border-b border-[#E5E7EB]">
              <h3 className="text-[#1E293B]">{mode === "requests" ? "Request Templates" : "Service Templates"}</h3>
            </div>
            <Table>
              <TableHeader>
                <TableRow className="bg-[#F9FAFB]">
                  <TableHead>Service Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Unit Eligibility</TableHead>
                  <TableHead>Form Fields</TableHead>
                  <TableHead>Processing Time</TableHead>
                  <TableHead>Urgent</TableHead>
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
                      <TableCell className="font-medium text-[#1E293B]">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-[#F1F5F9] text-[#334155]">
                            {(() => {
                              const IconComponent = resolveServiceIcon(service.iconName);
                              return IconComponent ? <IconComponent className="h-4 w-4" /> : <Eye className="h-4 w-4" />;
                            })()}
                          </span>
                          <span>{service.name}</span>
                        </div>
                      </TableCell>
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
                      <TableCell>
                        <Badge className={service.isUrgent ? "bg-[#FEE2E2] text-[#B91C1C]" : "bg-[#F1F5F9] text-[#475569]"}>
                          {service.isUrgent ? "Yes" : "No"}
                        </Badge>
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
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => void reorderCatalog(service.id, "up")}
                            title="Move up"
                          >
                            <ArrowUp className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => void reorderCatalog(service.id, "down")}
                            title="Move down"
                          >
                            <ArrowDown className="w-4 h-4" />
                          </Button>
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
                    <TableCell colSpan={9} className="text-center py-10 text-[#64748B]">
                      No services found. Create the first service template.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog
        open={isTicketDialogOpen}
        onOpenChange={(open) => {
          if (!open) closeTicketDialog();
          else setIsTicketDialogOpen(true);
        }}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Ticket Details</DialogTitle>
            <DialogDescription>
              Review request details, update workflow status, and reply to the resident.
            </DialogDescription>
          </DialogHeader>

          {ticketLoading ? (
            <div className="py-10 flex items-center justify-center">
              <span className="text-sm text-[#64748B]">Loading ticket...</span>
            </div>
          ) : activeTicket ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <Card className="p-4 lg:col-span-2">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h4 className="text-[#1E293B]">{activeTicket.service?.name ?? "Service Request"}</h4>
                      <p className="text-xs text-[#64748B] mt-1">Ticket ID: {activeTicket.id}</p>
                    </div>
                    <Badge className={getStatusColorClass(activeTicket.status)}>
                      {adminTicketStatusLabel("SERVICE", activeTicket.status || "NEW")}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4 text-sm">
                    <div>
                      <p className="text-[#64748B]">Resident</p>
                      <p className="text-[#1E293B]">{activeTicket.createdBy?.nameEN || "—"}</p>
                      <p className="text-xs text-[#64748B]">{activeTicket.createdBy?.email || activeTicket.createdBy?.phone || "—"}</p>
                    </div>
                    <div>
                      <p className="text-[#64748B]">Unit</p>
                      <p className="text-[#1E293B]">
                        {activeTicket.unit?.block ? `${activeTicket.unit.block} • ` : ""}
                        {activeTicket.unit?.unitNumber ?? "—"}
                      </p>
                      <p className="text-xs text-[#64748B]">
                        Priority: {adminPriorityLabel(activeTicket.priority || "MEDIUM")}
                      </p>
                    </div>
                    <div>
                      <p className="text-[#64748B]">Submitted</p>
                      <p className="text-[#1E293B]">{formatDateTime(activeTicket.requestedAt)}</p>
                    </div>
                    <div>
                      <p className="text-[#64748B]">Last Updated</p>
                      <p className="text-[#1E293B]">{formatDateTime(activeTicket.updatedAt)}</p>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-[#E5E7EB] space-y-2">
                    <p className="text-[#64748B] text-sm">Resident Summary</p>
                    <p className="text-sm text-[#1E293B] whitespace-pre-wrap break-words">
                      {activeTicket.description || "—"}
                    </p>
                  </div>

                  {Array.isArray(activeTicket.fieldValues) && activeTicket.fieldValues.length > 0 ? (
                    <div className="mt-4 pt-4 border-t border-[#E5E7EB]">
                      <p className="text-[#64748B] text-sm mb-2">Submitted Details</p>
                      <div className="space-y-2">
                        {activeTicket.fieldValues.map((fv, idx) => {
                          const value =
                            fv.valueText ??
                            (fv.valueNumber != null ? String(fv.valueNumber) : null) ??
                            (fv.valueBool != null ? (fv.valueBool ? "Yes" : "No") : null) ??
                            (fv.valueDate ? formatDateTime(fv.valueDate) : null) ??
                            (fv.fileAttachmentId ? "File attached" : null) ??
                            "—";
                          return (
                            <div key={fv.id || `${fv.field?.id || "field"}-${idx}`} className="grid grid-cols-[180px_1fr] gap-3 text-sm">
                              <span className="text-[#64748B]">{fv.field?.label || "Field"}</span>
                              <span className="text-[#1E293B] break-words">{value}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                </Card>

                <Card className="p-4 space-y-4">
                  <div>
                    <Label className="mb-2 block">Update Status</Label>
                    <Select value={ticketStatusDraft} onValueChange={setTicketStatusDraft}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose status" />
                      </SelectTrigger>
                      <SelectContent>
                        {SERVICE_REQUEST_STATUSES.map((status) => (
                          <SelectItem key={status} value={status}>
                            {adminTicketStatusLabel("SERVICE", status)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      className="w-full mt-3 bg-[#00B386] hover:bg-[#00B386]/90 text-white"
                      onClick={() => void applyTicketStatus()}
                      disabled={ticketStatusUpdating || !ticketStatusDraft || ticketStatusDraft === String(activeTicket.status || "").toUpperCase()}
                    >
                      {ticketStatusUpdating ? "Updating..." : "Apply Status"}
                    </Button>
                  </div>

                  <div className="pt-4 border-t border-[#E5E7EB] space-y-2">
                    <p className="text-sm text-[#64748B]">Quick Actions</p>
                    <div className="grid grid-cols-2 gap-2">
                      <Button variant="outline" size="sm" onClick={() => setTicketStatusDraft("IN_PROGRESS")}>In Progress</Button>
                      <Button variant="outline" size="sm" onClick={() => setTicketStatusDraft("RESOLVED")}>Resolved</Button>
                      <Button variant="outline" size="sm" onClick={() => setTicketStatusDraft("CLOSED")}>Close</Button>
                      <Button variant="outline" size="sm" onClick={() => setTicketStatusDraft("CANCELLED")}>Cancel</Button>
                    </div>
                  </div>
                </Card>
              </div>

              <Card className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-[#1E293B]">Conversation</h4>
                    <p className="text-sm text-[#64748B]">
                      Public replies are visible to the resident. Internal notes remain staff-only.
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => void refreshActiveTicket()}>
                    Refresh Thread
                  </Button>
                </div>

                <div className="space-y-3 max-h-[340px] overflow-y-auto pr-1">
                  {ticketComments.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-[#CBD5E1] p-4 text-sm text-[#64748B]">
                      No comments yet on this ticket.
                    </div>
                  ) : (
                    ticketComments.map((comment) => (
                      <div
                        key={comment.id}
                        className={`rounded-xl border p-3 ${
                          comment.isInternal
                            ? "border-[#F59E0B]/20 bg-[#FFFBEB]"
                            : "border-[#E5E7EB] bg-white"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-[#1E293B]">
                              {comment.createdBy?.nameEN || comment.createdBy?.email || "User"}
                            </p>
                            {comment.isInternal ? (
                              <Badge className="bg-[#F59E0B]/10 text-[#F59E0B]">Internal</Badge>
                            ) : (
                              <Badge className="bg-[#10B981]/10 text-[#10B981]">Public</Badge>
                            )}
                          </div>
                          <span className="text-xs text-[#64748B]">{formatDateTime(comment.createdAt)}</span>
                        </div>
                        <p className="text-sm text-[#334155] whitespace-pre-wrap mt-2">{comment.body}</p>
                      </div>
                    ))
                  )}
                </div>

                <div className="space-y-3 border-t border-[#E5E7EB] pt-4">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="ticketReply">Reply / Note</Label>
                    <div className="flex items-center gap-2">
                      <Switch id="ticketReplyInternal" checked={ticketReplyInternal} onCheckedChange={setTicketReplyInternal} />
                      <span className="text-sm text-[#64748B]">Internal note</span>
                    </div>
                  </div>
                  <Textarea
                    id="ticketReply"
                    rows={4}
                    placeholder={ticketReplyInternal ? "Visible to staff only..." : "Reply to the resident..."}
                    value={ticketReplyText}
                    onChange={(e) => setTicketReplyText(e.target.value)}
                  />
                  <div className="flex justify-end">
                    <Button
                      className="bg-[#0B5FFF] hover:bg-[#0B5FFF]/90 text-white"
                      onClick={() => void submitTicketReply()}
                      disabled={ticketReplySubmitting || !ticketReplyText.trim()}
                    >
                      <Send className="w-4 h-4 mr-2" />
                      {ticketReplySubmitting ? "Sending..." : "Post Reply"}
                    </Button>
                  </div>
                </div>
              </Card>
            </div>
          ) : (
            <div className="py-8 text-sm text-[#64748B]">Select a ticket to view details.</div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Textarea } from "../ui/textarea";
import { DataTable, DataTableColumn } from "../DataTable";
import { DrawerForm } from "../DrawerForm";
import { EmptyState } from "../EmptyState";
import { PageHeader } from "../PageHeader";
import { SkeletonTable } from "../SkeletonTable";
import { StatCard } from "../StatCard";
import { StatusBadge } from "../StatusBadge";
import approvalsService, {
  ApprovalBaseItem,
  ApprovalStats,
  DelegateApprovalItem,
  DelegateFeeMode,
  FamilyApprovalItem,
  FamilyRelationship,
  HomeStaffApprovalItem,
  HomeStaffType,
  OwnerApprovalItem,
  OwnerOption,
  TenantApprovalItem,
  UnitOption,
} from "../../lib/approvals-service";
import {
  errorMessage,
  formatCurrencyEGP,
  formatDate,
  formatDateTime,
  humanizeEnum,
  toInitials,
} from "../../lib/live-data";

type TabKey = "owners" | "family" | "delegates" | "home-staff" | "tenants";
type StatusFilter = "PENDING" | "PROCESSING" | "ALL";
type PreRegistrationMode = "OWNER" | "FAMILY";
type PreRegistrationStep = 1 | 2;

type SelectedItem =
  | { tab: "owners"; item: OwnerApprovalItem }
  | { tab: "family"; item: FamilyApprovalItem }
  | { tab: "delegates"; item: DelegateApprovalItem }
  | { tab: "home-staff"; item: HomeStaffApprovalItem }
  | { tab: "tenants"; item: TenantApprovalItem };

type PreviewState = {
  loading: boolean;
  objectUrl: string | null;
  mimeType: string | null;
  error: string | null;
};

function buildUnitLabel(projectName: string, unitNumber: string | null): string {
  return unitNumber ? `${projectName} - ${unitNumber}` : projectName;
}

function collectDocumentUrls(item: ApprovalBaseItem | null): string[] {
  if (!item) return [];
  const urls: string[] = [];
  if (item.documents.photo) urls.push(item.documents.photo);
  if (item.documents.nationalId) urls.push(item.documents.nationalId);
  if (item.documents.passport) urls.push(item.documents.passport);
  item.documents.other.forEach((row) => urls.push(row.url));
  return urls;
}

const RELATIONSHIP_OPTIONS: FamilyRelationship[] = ["SON_DAUGHTER", "MOTHER_FATHER", "SPOUSE"];
const HOME_STAFF_TYPES: HomeStaffType[] = ["DRIVER", "NANNY", "SERVANT", "GARDENER", "OTHER"];
const DELEGATE_FEE_MODES: DelegateFeeMode[] = ["NO_FEE", "FEE_REQUIRED"];

export function ApprovalsCenter() {
  const [activeTab, setActiveTab] = useState<TabKey>("owners");
  const [stats, setStats] = useState<ApprovalStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  const [owners, setOwners] = useState<OwnerApprovalItem[]>([]);
  const [family, setFamily] = useState<FamilyApprovalItem[]>([]);
  const [delegates, setDelegates] = useState<DelegateApprovalItem[]>([]);
  const [homeStaff, setHomeStaff] = useState<HomeStaffApprovalItem[]>([]);
  const [tenants, setTenants] = useState<TenantApprovalItem[]>([]);
  const [tenantsTotal, setTenantsTotal] = useState(0);

  const [ownersLoading, setOwnersLoading] = useState(false);
  const [familyLoading, setFamilyLoading] = useState(false);
  const [delegatesLoading, setDelegatesLoading] = useState(false);
  const [homeStaffLoading, setHomeStaffLoading] = useState(false);
  const [tenantsLoading, setTenantsLoading] = useState(false);

  const [ownerStatus, setOwnerStatus] = useState<StatusFilter>("ALL");
  const [ownerSearch, setOwnerSearch] = useState("");
  const [ownerDateFrom, setOwnerDateFrom] = useState("");
  const [ownerDateTo, setOwnerDateTo] = useState("");
  const [ownerRegistrationType, setOwnerRegistrationType] = useState<"ALL" | "SELF" | "PRE_REG">("ALL");

  const [familyStatus, setFamilyStatus] = useState<StatusFilter>("PENDING");
  const [familySearch, setFamilySearch] = useState("");
  const [familyDateFrom, setFamilyDateFrom] = useState("");
  const [familyDateTo, setFamilyDateTo] = useState("");
  const [familyRelationship, setFamilyRelationship] = useState<"ALL" | FamilyRelationship>("ALL");

  const [delegateStatus, setDelegateStatus] = useState<StatusFilter>("PENDING");
  const [delegateSearch, setDelegateSearch] = useState("");
  const [delegateDateFrom, setDelegateDateFrom] = useState("");
  const [delegateDateTo, setDelegateDateTo] = useState("");
  const [delegateFeeMode, setDelegateFeeMode] = useState<"ALL" | DelegateFeeMode>("ALL");

  const [homeStaffStatus, setHomeStaffStatus] = useState<StatusFilter>("PENDING");
  const [homeStaffSearch, setHomeStaffSearch] = useState("");
  const [homeStaffDateFrom, setHomeStaffDateFrom] = useState("");
  const [homeStaffDateTo, setHomeStaffDateTo] = useState("");
  const [homeStaffType, setHomeStaffType] = useState<"ALL" | HomeStaffType>("ALL");

  const [tenantStatus, setTenantStatus] = useState<"PENDING" | "APPROVED" | "REJECTED" | "ALL">("PENDING");
  const [tenantSearch, setTenantSearch] = useState("");

  const [selectedItem, setSelectedItem] = useState<SelectedItem | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [rejectMode, setRejectMode] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const [preRegisterOpen, setPreRegisterOpen] = useState(false);
  const [preRegisterMode, setPreRegisterMode] = useState<PreRegistrationMode>("OWNER");
  const [preRegisterStep, setPreRegisterStep] = useState<PreRegistrationStep>(1);
  const [preRegisterBusy, setPreRegisterBusy] = useState(false);

  const [ownerForm, setOwnerForm] = useState({
    nameEN: "",
    email: "",
    phone: "",
    nationalId: "",
    unitId: "",
    notes: "",
  });

  const [familyForm, setFamilyForm] = useState({
    ownerUserId: "",
    unitId: "",
    fullName: "",
    phone: "",
    relationship: "SON_DAUGHTER" as FamilyRelationship,
    email: "",
    nationalIdOrPassport: "",
    notes: "",
  });

  const [ownerOptions, setOwnerOptions] = useState<OwnerOption[]>([]);
  const [unitOptions, setUnitOptions] = useState<UnitOption[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(false);

  const [previewByUrl, setPreviewByUrl] = useState<Record<string, PreviewState>>({});
  const previewByUrlRef = useRef<Record<string, PreviewState>>({});
  const createdObjectUrls = useRef<string[]>([]);

  useEffect(() => {
    previewByUrlRef.current = previewByUrl;
  }, [previewByUrl]);

  useEffect(() => {
    return () => {
      createdObjectUrls.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const response = await approvalsService.getStats();
      setStats(response);
    } catch (error) {
      toast.error("Failed to load approval stats", { description: errorMessage(error) });
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const loadOwners = useCallback(async () => {
    setOwnersLoading(true);
    try {
      const rows = await approvalsService.listOwners({
        search: ownerSearch || undefined,
        status: ownerStatus,
        dateFrom: ownerDateFrom || undefined,
        dateTo: ownerDateTo || undefined,
        registrationType: ownerRegistrationType === "ALL" ? undefined : ownerRegistrationType,
      });
      setOwners(rows);
    } catch (error) {
      toast.error("Failed to load owners approvals", { description: errorMessage(error) });
    } finally {
      setOwnersLoading(false);
    }
  }, [ownerDateFrom, ownerDateTo, ownerRegistrationType, ownerSearch, ownerStatus]);

  const loadFamily = useCallback(async () => {
    setFamilyLoading(true);
    try {
      const rows = await approvalsService.listFamilyMembers({
        search: familySearch || undefined,
        status: familyStatus === "ALL" || familyStatus === "PROCESSING" ? undefined : familyStatus,
        dateFrom: familyDateFrom || undefined,
        dateTo: familyDateTo || undefined,
        relationship: familyRelationship === "ALL" ? undefined : familyRelationship,
      });
      setFamily(rows);
    } catch (error) {
      toast.error("Failed to load family approvals", { description: errorMessage(error) });
    } finally {
      setFamilyLoading(false);
    }
  }, [familyDateFrom, familyDateTo, familyRelationship, familySearch, familyStatus]);

  const loadDelegates = useCallback(async () => {
    setDelegatesLoading(true);
    try {
      const rows = await approvalsService.listDelegates({
        search: delegateSearch || undefined,
        status: delegateStatus === "ALL" || delegateStatus === "PROCESSING" ? undefined : delegateStatus,
        dateFrom: delegateDateFrom || undefined,
        dateTo: delegateDateTo || undefined,
        feeMode: delegateFeeMode === "ALL" ? undefined : delegateFeeMode,
      });
      setDelegates(rows);
    } catch (error) {
      toast.error("Failed to load delegates approvals", { description: errorMessage(error) });
    } finally {
      setDelegatesLoading(false);
    }
  }, [delegateDateFrom, delegateDateTo, delegateFeeMode, delegateSearch, delegateStatus]);

  const loadHomeStaff = useCallback(async () => {
    setHomeStaffLoading(true);
    try {
      const rows = await approvalsService.listHomeStaff({
        search: homeStaffSearch || undefined,
        status: homeStaffStatus === "ALL" || homeStaffStatus === "PROCESSING" ? undefined : homeStaffStatus,
        dateFrom: homeStaffDateFrom || undefined,
        dateTo: homeStaffDateTo || undefined,
        staffType: homeStaffType === "ALL" ? undefined : homeStaffType,
      });
      setHomeStaff(rows);
    } catch (error) {
      toast.error("Failed to load home staff approvals", { description: errorMessage(error) });
    } finally {
      setHomeStaffLoading(false);
    }
  }, [homeStaffDateFrom, homeStaffDateTo, homeStaffSearch, homeStaffStatus, homeStaffType]);

  const loadTenants = useCallback(async () => {
    setTenantsLoading(true);
    try {
      const result = await approvalsService.listTenants({
        search: tenantSearch || undefined,
        status: tenantStatus === "ALL" ? undefined : tenantStatus,
        limit: 100,
      });
      setTenants(result.data);
      setTenantsTotal(result.total);
    } catch (error) {
      toast.error("Failed to load tenant approvals", { description: errorMessage(error) });
    } finally {
      setTenantsLoading(false);
    }
  }, [tenantSearch, tenantStatus]);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  useEffect(() => {
    if (activeTab === "owners") void loadOwners();
    if (activeTab === "family") void loadFamily();
    if (activeTab === "delegates") void loadDelegates();
    if (activeTab === "home-staff") void loadHomeStaff();
    if (activeTab === "tenants") void loadTenants();
  }, [activeTab, loadDelegates, loadFamily, loadHomeStaff, loadOwners, loadTenants]);

  useEffect(() => {
    if (!preRegisterOpen) return;
    setOptionsLoading(true);
    Promise.all([approvalsService.listOwnerOptions(), approvalsService.listUnitOptions()])
      .then(([ownerRows, unitRows]) => {
        setOwnerOptions(ownerRows);
        setUnitOptions(unitRows);
      })
      .catch((error) => {
        toast.error("Failed to load pre-registration options", { description: errorMessage(error) });
      })
      .finally(() => setOptionsLoading(false));
  }, [preRegisterOpen]);

  const selectedBaseItem = selectedItem?.item ?? null;

  const ensurePreview = useCallback(async (url: string) => {
    if (!url) return;
    const current = previewByUrlRef.current[url];
    if (current?.loading || current?.objectUrl || current?.error) return;

    setPreviewByUrl((prev) => {
      const existing = prev[url];
      if (existing?.loading || existing?.objectUrl || existing?.error) return prev;
      const next = {
        ...prev,
        [url]: { loading: true, objectUrl: null, mimeType: null, error: null },
      };
      previewByUrlRef.current = next;
      return next;
    });

    try {
      const blob = await approvalsService.fetchDocumentBlob(url);
      const objectUrl = URL.createObjectURL(blob);
      createdObjectUrls.current.push(objectUrl);
      setPreviewByUrl((prev) => {
        const next = {
          ...prev,
          [url]: {
            loading: false,
            objectUrl,
            mimeType: blob.type || null,
            error: null,
          },
        };
        previewByUrlRef.current = next;
        return next;
      });
    } catch (error) {
      setPreviewByUrl((prev) => {
        const next = {
          ...prev,
          [url]: {
            loading: false,
            objectUrl: null,
            mimeType: null,
            error: errorMessage(error),
          },
        };
        previewByUrlRef.current = next;
        return next;
      });
    }
  }, []);

  useEffect(() => {
    collectDocumentUrls(selectedBaseItem).forEach((url) => {
      void ensurePreview(url);
    });
  }, [ensurePreview, selectedBaseItem]);

  const openDocument = useCallback(async (url: string) => {
    const preview = previewByUrl[url];
    if (preview?.objectUrl) {
      window.open(preview.objectUrl, "_blank", "noopener,noreferrer");
      return;
    }

    try {
      const blob = await approvalsService.fetchDocumentBlob(url);
      const objectUrl = URL.createObjectURL(blob);
      createdObjectUrls.current.push(objectUrl);
      window.open(objectUrl, "_blank", "noopener,noreferrer");
    } catch (error) {
      toast.error("Failed to open document", { description: errorMessage(error) });
    }
  }, [previewByUrl]);

  const removeOptimistically = useCallback((tab: TabKey, id: string) => {
    let ownerRow: OwnerApprovalItem | null = null;
    let familyRow: FamilyApprovalItem | null = null;
    let delegateRow: DelegateApprovalItem | null = null;
    let staffRow: HomeStaffApprovalItem | null = null;
    let tenantRow: TenantApprovalItem | null = null;

    if (tab === "owners") setOwners((prev) => { ownerRow = prev.find((row) => row.id === id) ?? null; return prev.filter((row) => row.id !== id); });
    if (tab === "family") setFamily((prev) => { familyRow = prev.find((row) => row.id === id) ?? null; return prev.filter((row) => row.id !== id); });
    if (tab === "delegates") setDelegates((prev) => { delegateRow = prev.find((row) => row.id === id) ?? null; return prev.filter((row) => row.id !== id); });
    if (tab === "home-staff") setHomeStaff((prev) => { staffRow = prev.find((row) => row.id === id) ?? null; return prev.filter((row) => row.id !== id); });
    if (tab === "tenants") setTenants((prev) => { tenantRow = prev.find((row) => row.id === id) ?? null; return prev.filter((row) => row.id !== id); });

    setStats((prev) => {
      if (!prev) return prev;
      if (tab === "owners") return { ...prev, pendingOwners: Math.max(0, prev.pendingOwners - 1), totalPending: Math.max(0, prev.totalPending - 1) };
      if (tab === "family") return { ...prev, pendingFamilyMembers: Math.max(0, prev.pendingFamilyMembers - 1), totalPending: Math.max(0, prev.totalPending - 1) };
      if (tab === "delegates") return { ...prev, pendingDelegates: Math.max(0, prev.pendingDelegates - 1), totalPending: Math.max(0, prev.totalPending - 1) };
      if (tab === "tenants") return { ...prev, pendingTenants: Math.max(0, (prev.pendingTenants ?? 0) - 1), totalPending: Math.max(0, prev.totalPending - 1) };
      return { ...prev, pendingHomeStaff: Math.max(0, prev.pendingHomeStaff - 1), totalPending: Math.max(0, prev.totalPending - 1) };
    });

    return () => {
      if (tab === "owners" && ownerRow) setOwners((prev) => [ownerRow as OwnerApprovalItem, ...prev]);
      if (tab === "family" && familyRow) setFamily((prev) => [familyRow as FamilyApprovalItem, ...prev]);
      if (tab === "delegates" && delegateRow) setDelegates((prev) => [delegateRow as DelegateApprovalItem, ...prev]);
      if (tab === "home-staff" && staffRow) setHomeStaff((prev) => [staffRow as HomeStaffApprovalItem, ...prev]);
      if (tab === "tenants" && tenantRow) setTenants((prev) => [tenantRow as TenantApprovalItem, ...prev]);

      setStats((prev) => {
        if (!prev) return prev;
        if (tab === "owners") return { ...prev, pendingOwners: prev.pendingOwners + 1, totalPending: prev.totalPending + 1 };
        if (tab === "family") return { ...prev, pendingFamilyMembers: prev.pendingFamilyMembers + 1, totalPending: prev.totalPending + 1 };
        if (tab === "delegates") return { ...prev, pendingDelegates: prev.pendingDelegates + 1, totalPending: prev.totalPending + 1 };
        if (tab === "tenants") return { ...prev, pendingTenants: (prev.pendingTenants ?? 0) + 1, totalPending: prev.totalPending + 1 };
        return { ...prev, pendingHomeStaff: prev.pendingHomeStaff + 1, totalPending: prev.totalPending + 1 };
      });
    };
  }, []);

  const handleApprove = useCallback(async () => {
    if (!selectedItem) return;
    if (!window.confirm("Approve and send credentials?")) return;

    setActionBusy(true);
    const rollback = removeOptimistically(selectedItem.tab, selectedItem.item.id);
    try {
      if (selectedItem.tab === "owners") await approvalsService.approveOwner(selectedItem.item.id);
      if (selectedItem.tab === "family") await approvalsService.approveFamilyMember(selectedItem.item.id);
      if (selectedItem.tab === "delegates") await approvalsService.approveDelegate(selectedItem.item.id);
      if (selectedItem.tab === "home-staff") await approvalsService.approveHomeStaff(selectedItem.item.id);
      if (selectedItem.tab === "tenants") await approvalsService.approveTenant(selectedItem.item.id);
      toast.success("Approval completed");
      setDrawerOpen(false);
      setSelectedItem(null);
      setRejectMode(false);
      setRejectReason("");
    } catch (error) {
      rollback();
      toast.error("Approval failed", { description: errorMessage(error) });
    } finally {
      setActionBusy(false);
    }
  }, [removeOptimistically, selectedItem]);

  const handleReject = useCallback(async () => {
    if (!selectedItem) return;
    if (!rejectReason.trim()) {
      toast.error("Rejection reason is required");
      return;
    }

    setActionBusy(true);
    const rollback = removeOptimistically(selectedItem.tab, selectedItem.item.id);
    try {
      if (selectedItem.tab === "owners") await approvalsService.rejectOwner(selectedItem.item.id, rejectReason.trim());
      if (selectedItem.tab === "family") await approvalsService.rejectFamilyMember(selectedItem.item.id, rejectReason.trim());
      if (selectedItem.tab === "delegates") await approvalsService.rejectDelegate(selectedItem.item.id, rejectReason.trim());
      if (selectedItem.tab === "home-staff") await approvalsService.rejectHomeStaff(selectedItem.item.id, rejectReason.trim());
      if (selectedItem.tab === "tenants") await approvalsService.rejectTenant(selectedItem.item.id, rejectReason.trim());
      toast.success("Request rejected");
      setDrawerOpen(false);
      setSelectedItem(null);
      setRejectMode(false);
      setRejectReason("");
    } catch (error) {
      rollback();
      toast.error("Rejection failed", { description: errorMessage(error) });
    } finally {
      setActionBusy(false);
    }
  }, [rejectReason, removeOptimistically, selectedItem]);

  const openReview = useCallback((item: SelectedItem) => {
    setSelectedItem(item);
    setDrawerOpen(true);
    setRejectMode(false);
    setRejectReason("");
  }, []);

  const ownerColumns = useMemo<DataTableColumn<OwnerApprovalItem>[]>(() => [
    { key: "name", header: "Name", render: (row) => row.name || "Unknown" },
    { key: "phone", header: "Phone", render: (row) => row.phone },
    { key: "nationalId", header: "National ID", render: (row) => row.nationalId },
    { key: "submitted", header: "Submitted", render: (row) => formatDateTime(row.submittedAt) },
    { key: "type", header: "Type", render: (row) => <Badge>{row.isPreRegistration ? "Pre-reg" : "Self"}</Badge> },
    { key: "status", header: "Status", render: (row) => <StatusBadge value={row.status} /> },
    { key: "actions", header: "Actions", render: (row) => <Button size="sm" onClick={() => openReview({ tab: "owners", item: row })}>Review</Button> },
  ], [openReview]);

  const familyColumns = useMemo<DataTableColumn<FamilyApprovalItem>[]>(() => [
    { key: "name", header: "Name", render: (row) => row.fullName },
    { key: "phone", header: "Phone", render: (row) => row.phone },
    { key: "relationship", header: "Relationship", render: (row) => <Badge>{humanizeEnum(row.relationship)}</Badge> },
    { key: "owner", header: "Owner", render: (row) => row.ownerName },
    { key: "unit", header: "Unit", render: (row) => buildUnitLabel(row.projectName, row.unitNumber) },
    { key: "submitted", header: "Submitted", render: (row) => formatDateTime(row.submittedAt) },
    { key: "status", header: "Status", render: (row) => <StatusBadge value={row.status} /> },
    { key: "actions", header: "Actions", render: (row) => <Button size="sm" onClick={() => openReview({ tab: "family", item: row })}>Review</Button> },
  ], [openReview]);

  const delegateColumns = useMemo<DataTableColumn<DelegateApprovalItem>[]>(() => [
    { key: "name", header: "Name", render: (row) => row.fullName },
    { key: "phone", header: "Phone", render: (row) => row.phone },
    { key: "owner", header: "Owner", render: (row) => row.ownerName },
    { key: "unit", header: "Unit", render: (row) => buildUnitLabel(row.projectName, row.unitNumber) },
    { key: "period", header: "Valid Period", render: (row) => `${formatDate(row.validFrom)} - ${formatDate(row.validTo)}` },
    { key: "fee", header: "Fee Mode", render: (row) => <Badge>{humanizeEnum(row.feeMode)}</Badge> },
    { key: "status", header: "Status", render: (row) => <StatusBadge value={row.status} /> },
    { key: "actions", header: "Actions", render: (row) => <Button size="sm" onClick={() => openReview({ tab: "delegates", item: row })}>Review</Button> },
  ], [openReview]);

  const homeStaffColumns = useMemo<DataTableColumn<HomeStaffApprovalItem>[]>(() => [
    { key: "name", header: "Name", render: (row) => row.fullName },
    { key: "type", header: "Staff Type", render: (row) => <Badge>{humanizeEnum(row.staffType)}</Badge> },
    { key: "phone", header: "Phone", render: (row) => row.phone },
    { key: "owner", header: "Owner", render: (row) => row.ownerName },
    { key: "unit", header: "Unit", render: (row) => buildUnitLabel(row.projectName, row.unitNumber) },
    { key: "period", header: "Access Period", render: (row) => `${formatDate(row.accessValidFrom)} - ${formatDate(row.accessValidTo)}` },
    { key: "liveIn", header: "Live-In", render: (row) => <Badge>{row.isLiveIn ? "Live-In" : "Non Live-In"}</Badge> },
    { key: "status", header: "Status", render: (row) => <StatusBadge value={row.status} /> },
    { key: "actions", header: "Actions", render: (row) => <Button size="sm" onClick={() => openReview({ tab: "home-staff", item: row })}>Review</Button> },
  ], [openReview]);

  const tenantColumns = useMemo<DataTableColumn<TenantApprovalItem>[]>(() => [
    { key: "tenant", header: "Tenant", render: (row) => (
      <div>
        <p className="font-medium text-[#1E293B]">{row.tenantName}</p>
        <p className="text-xs text-[#64748B]">{row.tenantEmail}</p>
      </div>
    )},
    { key: "phone", header: "Phone", render: (row) => row.tenantPhone },
    { key: "nationality", header: "Nationality", render: (row) => row.tenantNationality || "—" },
    { key: "unit", header: "Unit", render: (row) => row.unitNumber || row.unitId.slice(0, 8) },
    { key: "owner", header: "Owner", render: (row) => row.ownerName || "—" },
    { key: "requested", header: "Requested", render: (row) => formatDateTime(row.requestedAt) },
    { key: "status", header: "Status", render: (row) => <StatusBadge value={row.status} /> },
    { key: "actions", header: "Actions", render: (row) => (
      row.status === "PENDING"
        ? <Button size="sm" onClick={() => openReview({ tab: "tenants", item: row })}>Review</Button>
        : <Button size="sm" variant="outline" onClick={() => openReview({ tab: "tenants", item: row })}>View</Button>
    )},
  ], [openReview]);

  const preRegisterNext = () => {
    if (preRegisterMode === "OWNER") {
      if (!ownerForm.nameEN || !ownerForm.email || !ownerForm.phone || !ownerForm.nationalId) {
        toast.error("Owner pre-registration form is incomplete");
        return;
      }
    }
    if (preRegisterMode === "FAMILY") {
      if (!familyForm.ownerUserId || !familyForm.unitId || !familyForm.fullName || !familyForm.phone) {
        toast.error("Family pre-registration form is incomplete");
        return;
      }
    }
    setPreRegisterStep(2);
  };

  const confirmPreRegistration = async () => {
    setPreRegisterBusy(true);
    try {
      if (preRegisterMode === "OWNER") {
        await approvalsService.preRegisterOwner({
          nameEN: ownerForm.nameEN,
          email: ownerForm.email,
          phone: ownerForm.phone,
          nationalId: ownerForm.nationalId,
          unitId: ownerForm.unitId || undefined,
          notes: ownerForm.notes || undefined,
        });
      } else {
        await approvalsService.preRegisterFamilyMember({
          ownerUserId: familyForm.ownerUserId,
          unitId: familyForm.unitId,
          fullName: familyForm.fullName,
          phone: familyForm.phone,
          relationship: familyForm.relationship,
          email: familyForm.email || undefined,
          nationalIdOrPassport: familyForm.nationalIdOrPassport || undefined,
          notes: familyForm.notes || undefined,
        });
      }
      toast.success("Pre-registration completed");
      setPreRegisterOpen(false);
      setPreRegisterStep(1);
      await loadStats();
      if (activeTab === "owners") await loadOwners();
      if (activeTab === "family") await loadFamily();
    } catch (error) {
      toast.error("Pre-registration failed", { description: errorMessage(error) });
    } finally {
      setPreRegisterBusy(false);
    }
  };

  const renderDocumentCard = (label: string, url: string | null) => {
    const preview = url ? previewByUrl[url] : null;
    const isImage = Boolean(preview?.mimeType?.startsWith("image/"));

    return (
      <div key={`${label}-${url ?? "none"}`} className="rounded-lg border border-[#E2E8F0] p-3">
        <p className="mb-2 text-xs text-[#64748B]">{label}</p>
        {!url ? (
          <p className="text-sm text-[#94A3B8]">Not provided</p>
        ) : preview?.loading ? (
          <p className="text-sm text-[#64748B]">Loading preview...</p>
        ) : preview?.objectUrl && isImage ? (
          <button type="button" className="w-full" onClick={() => void openDocument(url)}>
            <img src={preview.objectUrl} alt={label} className="h-28 w-full rounded-md object-cover" />
          </button>
        ) : (
          <Button size="sm" variant="outline" onClick={() => void openDocument(url)}>
            Open Document
          </Button>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Approvals"
        description="Unified queue for owner registrations, family members, delegates, home staff, and tenants."
        actions={<Button onClick={() => setPreRegisterOpen(true)}>Pre-Register</Button>}
      />

      <div className="grid gap-3 md:grid-cols-5">
        <StatCard title="Pending Owners" value={statsLoading ? "..." : String(stats?.pendingOwners ?? 0)} icon="active-users" onClick={() => setActiveTab("owners")} />
        <StatCard title="Family Members" value={statsLoading ? "..." : String(stats?.pendingFamilyMembers ?? 0)} icon="visitors" onClick={() => setActiveTab("family")} />
        <StatCard title="Delegates" value={statsLoading ? "..." : String(stats?.pendingDelegates ?? 0)} icon="tickets" onClick={() => setActiveTab("delegates")} />
        <StatCard title="Home Staff" value={statsLoading ? "..." : String(stats?.pendingHomeStaff ?? 0)} icon="workers" onClick={() => setActiveTab("home-staff")} />
        <StatCard title="Tenants" value={statsLoading ? "..." : String(stats?.pendingTenants ?? 0)} icon="tickets" onClick={() => setActiveTab("tenants")} />
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as TabKey)}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="owners">Owners</TabsTrigger>
          <TabsTrigger value="family">Family Members</TabsTrigger>
          <TabsTrigger value="delegates">Delegates</TabsTrigger>
          <TabsTrigger value="home-staff">Home Staff</TabsTrigger>
          <TabsTrigger value="tenants">Tenants</TabsTrigger>
        </TabsList>

        <TabsContent value="owners" className="space-y-3">
          <div className="grid gap-3 rounded-xl border border-[#E2E8F0] bg-white p-3 md:grid-cols-5">
            <Input placeholder="Search name or phone" value={ownerSearch} onChange={(event) => setOwnerSearch(event.target.value)} />
            <Input type="date" value={ownerDateFrom} onChange={(event) => setOwnerDateFrom(event.target.value)} />
            <Input type="date" value={ownerDateTo} onChange={(event) => setOwnerDateTo(event.target.value)} />
            <select className="h-10 rounded-md border border-[#CBD5E1] px-3" value={ownerStatus} onChange={(event) => setOwnerStatus(event.target.value as StatusFilter)}>
              <option value="PENDING">Pending</option>
              <option value="PROCESSING">Processing</option>
              <option value="ALL">All</option>
            </select>
            <select className="h-10 rounded-md border border-[#CBD5E1] px-3" value={ownerRegistrationType} onChange={(event) => setOwnerRegistrationType(event.target.value as "ALL" | "SELF" | "PRE_REG")}>
              <option value="ALL">All Types</option>
              <option value="SELF">Self</option>
              <option value="PRE_REG">Pre-reg</option>
            </select>
          </div>
          {ownersLoading ? <SkeletonTable columns={7} /> : <DataTable columns={ownerColumns} rows={owners} rowKey={(row) => row.id} emptyTitle="No owner approvals" emptyDescription="No owner registration matches current filters." />}
        </TabsContent>

        <TabsContent value="family" className="space-y-3">
          <div className="grid gap-3 rounded-xl border border-[#E2E8F0] bg-white p-3 md:grid-cols-5">
            <Input placeholder="Search name or phone" value={familySearch} onChange={(event) => setFamilySearch(event.target.value)} />
            <Input type="date" value={familyDateFrom} onChange={(event) => setFamilyDateFrom(event.target.value)} />
            <Input type="date" value={familyDateTo} onChange={(event) => setFamilyDateTo(event.target.value)} />
            <select className="h-10 rounded-md border border-[#CBD5E1] px-3" value={familyStatus} onChange={(event) => setFamilyStatus(event.target.value as StatusFilter)}>
              <option value="PENDING">Pending</option>
              <option value="PROCESSING">Processing</option>
              <option value="ALL">All</option>
            </select>
            <select className="h-10 rounded-md border border-[#CBD5E1] px-3" value={familyRelationship} onChange={(event) => setFamilyRelationship(event.target.value as "ALL" | FamilyRelationship)}>
              <option value="ALL">All Relationships</option>
              {RELATIONSHIP_OPTIONS.map((value) => (
                <option key={value} value={value}>{humanizeEnum(value)}</option>
              ))}
            </select>
          </div>
          {familyLoading ? <SkeletonTable columns={8} /> : <DataTable columns={familyColumns} rows={family} rowKey={(row) => row.id} emptyTitle="No family approvals" emptyDescription="No family request matches current filters." />}
        </TabsContent>

        <TabsContent value="delegates" className="space-y-3">
          <div className="grid gap-3 rounded-xl border border-[#E2E8F0] bg-white p-3 md:grid-cols-5">
            <Input placeholder="Search name or phone" value={delegateSearch} onChange={(event) => setDelegateSearch(event.target.value)} />
            <Input type="date" value={delegateDateFrom} onChange={(event) => setDelegateDateFrom(event.target.value)} />
            <Input type="date" value={delegateDateTo} onChange={(event) => setDelegateDateTo(event.target.value)} />
            <select className="h-10 rounded-md border border-[#CBD5E1] px-3" value={delegateStatus} onChange={(event) => setDelegateStatus(event.target.value as StatusFilter)}>
              <option value="PENDING">Pending</option>
              <option value="PROCESSING">Processing</option>
              <option value="ALL">All</option>
            </select>
            <select className="h-10 rounded-md border border-[#CBD5E1] px-3" value={delegateFeeMode} onChange={(event) => setDelegateFeeMode(event.target.value as "ALL" | DelegateFeeMode)}>
              <option value="ALL">All Fee Modes</option>
              {DELEGATE_FEE_MODES.map((value) => (
                <option key={value} value={value}>{humanizeEnum(value)}</option>
              ))}
            </select>
          </div>
          {delegatesLoading ? <SkeletonTable columns={8} /> : <DataTable columns={delegateColumns} rows={delegates} rowKey={(row) => row.id} emptyTitle="No delegate approvals" emptyDescription="No delegate request matches current filters." />}
        </TabsContent>

        <TabsContent value="home-staff" className="space-y-3">
          <div className="grid gap-3 rounded-xl border border-[#E2E8F0] bg-white p-3 md:grid-cols-5">
            <Input placeholder="Search name or phone" value={homeStaffSearch} onChange={(event) => setHomeStaffSearch(event.target.value)} />
            <Input type="date" value={homeStaffDateFrom} onChange={(event) => setHomeStaffDateFrom(event.target.value)} />
            <Input type="date" value={homeStaffDateTo} onChange={(event) => setHomeStaffDateTo(event.target.value)} />
            <select className="h-10 rounded-md border border-[#CBD5E1] px-3" value={homeStaffStatus} onChange={(event) => setHomeStaffStatus(event.target.value as StatusFilter)}>
              <option value="PENDING">Pending</option>
              <option value="PROCESSING">Processing</option>
              <option value="ALL">All</option>
            </select>
            <select className="h-10 rounded-md border border-[#CBD5E1] px-3" value={homeStaffType} onChange={(event) => setHomeStaffType(event.target.value as "ALL" | HomeStaffType)}>
              <option value="ALL">All Staff Types</option>
              {HOME_STAFF_TYPES.map((value) => (
                <option key={value} value={value}>{humanizeEnum(value)}</option>
              ))}
            </select>
          </div>
          {homeStaffLoading ? <SkeletonTable columns={9} /> : <DataTable columns={homeStaffColumns} rows={homeStaff} rowKey={(row) => row.id} emptyTitle="No home staff approvals" emptyDescription="No home staff request matches current filters." />}
        </TabsContent>

        <TabsContent value="tenants" className="space-y-3">
          <div className="grid gap-3 rounded-xl border border-[#E2E8F0] bg-white p-3 md:grid-cols-3">
            <Input placeholder="Search tenant name or email" value={tenantSearch} onChange={(event) => setTenantSearch(event.target.value)} />
            <select className="h-10 rounded-md border border-[#CBD5E1] px-3" value={tenantStatus} onChange={(event) => setTenantStatus(event.target.value as "PENDING" | "APPROVED" | "REJECTED" | "ALL")}>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
              <option value="ALL">All</option>
            </select>
            <p className="flex items-center text-sm text-[#64748B]">
              {tenantsLoading ? "Loading..." : `${tenantsTotal} total`}
            </p>
          </div>
          {tenantsLoading
            ? <SkeletonTable columns={8} />
            : <DataTable
                columns={tenantColumns}
                rows={tenants}
                rowKey={(row) => row.id}
                emptyTitle="No tenant approvals"
                emptyDescription="No rent requests match current filters."
              />
          }
        </TabsContent>
      </Tabs>

      <DrawerForm
        open={drawerOpen}
        onOpenChange={(open) => {
          setDrawerOpen(open);
          if (!open) {
            setRejectMode(false);
            setRejectReason("");
          }
        }}
        title="Review Request"
        description="Review applicant details, documents, and action request."
        widthClassName="w-full sm:max-w-[560px]"
        footer={
          <div className="w-full space-y-3">
            {rejectMode ? (
              <Textarea value={rejectReason} onChange={(event) => setRejectReason(event.target.value)} placeholder="Enter rejection reason" />
            ) : null}
            {selectedItem && selectedItem.tab === "tenants" && selectedItem.item.status !== "PENDING" ? (
              <p className="text-center text-sm text-[#64748B]">This request has already been {selectedItem.item.status.toLowerCase()}.</p>
            ) : (
              <div className="flex justify-end gap-2">
                {rejectMode ? (
                  <>
                    <Button variant="outline" onClick={() => setRejectMode(false)} disabled={actionBusy}>Cancel</Button>
                    <Button variant="destructive" onClick={() => void handleReject()} disabled={actionBusy}>Confirm Reject</Button>
                  </>
                ) : (
                  <>
                    <Button variant="destructive" onClick={() => setRejectMode(true)} disabled={actionBusy}>Reject</Button>
                    <Button onClick={() => void handleApprove()} disabled={actionBusy}>Approve</Button>
                  </>
                )}
              </div>
            )}
          </div>
        }
      >
        {selectedItem ? (
          <div className="space-y-4">
            {/* Profile header */}
            <div className="rounded-xl border border-[#E2E8F0] p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#E2E8F0] text-sm font-semibold text-[#334155]">
                  {selectedItem.tab === "owners"
                    ? toInitials(selectedItem.item.name || "Owner")
                    : selectedItem.tab === "tenants"
                    ? toInitials(selectedItem.item.tenantName)
                    : toInitials((selectedItem.item as FamilyApprovalItem | DelegateApprovalItem | HomeStaffApprovalItem).fullName)}
                </div>
                <div>
                  <p className="text-sm font-medium text-[#0F172A]">
                    {selectedItem.tab === "owners"
                      ? selectedItem.item.name || "Owner"
                      : selectedItem.tab === "tenants"
                      ? selectedItem.item.tenantName
                      : (selectedItem.item as FamilyApprovalItem | DelegateApprovalItem | HomeStaffApprovalItem).fullName}
                  </p>
                  <p className="text-xs text-[#64748B]">
                    {selectedItem.tab === "tenants"
                      ? selectedItem.item.tenantPhone
                      : (selectedItem.item as OwnerApprovalItem | FamilyApprovalItem | DelegateApprovalItem | HomeStaffApprovalItem).phone}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-[#64748B]">
                {selectedItem.tab === "tenants" ? (
                  <span>Requested: {formatDateTime(selectedItem.item.requestedAt)}</span>
                ) : (
                  <>
                    <span>Submitted: {formatDateTime(selectedItem.item.submittedAt)}</span>
                    <Badge>{selectedItem.item.isPreRegistration ? "Pre-Registered" : "Self-Registered"}</Badge>
                  </>
                )}
              </div>
            </div>

            {/* Documents — only for non-tenant tabs */}
            {selectedItem.tab !== "tenants" ? (
              <div className="rounded-xl border border-[#E2E8F0] p-4">
                <h3 className="mb-3 text-sm font-medium text-[#0F172A]">Documents</h3>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {renderDocumentCard("Profile Photo", selectedItem.item.documents.photo)}
                  {renderDocumentCard("National ID", selectedItem.item.documents.nationalId)}
                  {renderDocumentCard("Passport", selectedItem.item.documents.passport)}
                  {selectedItem.item.documents.other.map((doc) => renderDocumentCard(doc.label, doc.url))}
                </div>
              </div>
            ) : null}

            <div className="rounded-xl border border-[#E2E8F0] p-4">
              <h3 className="mb-3 text-sm font-medium text-[#0F172A]">Details</h3>
              {selectedItem.tab === "owners" ? (
                <div className="space-y-1 text-sm text-[#334155]">
                  <p>Registration Source: {selectedItem.item.origin}</p>
                  <p>National ID: {selectedItem.item.nationalId}</p>
                  <p>Expires At: {formatDateTime(selectedItem.item.expiresAt)}</p>
                </div>
              ) : null}

              {selectedItem.tab === "family" ? (
                <div className="space-y-1 text-sm text-[#334155]">
                  <p>Relationship: {humanizeEnum(selectedItem.item.relationship)}</p>
                  <p>Owner: {selectedItem.item.ownerName}</p>
                  <p>Unit: {buildUnitLabel(selectedItem.item.projectName, selectedItem.item.unitNumber)}</p>
                  <p>Permissions: {selectedItem.item.featurePermissions ? Object.keys(selectedItem.item.featurePermissions).join(", ") || "None" : "None"}</p>
                </div>
              ) : null}

              {selectedItem.tab === "delegates" ? (
                <div className="space-y-1 text-sm text-[#334155]">
                  <p>Owner: {selectedItem.item.ownerName}</p>
                  <p>Unit: {buildUnitLabel(selectedItem.item.projectName, selectedItem.item.unitNumber)}</p>
                  <p>Valid: {formatDate(selectedItem.item.validFrom)} - {formatDate(selectedItem.item.validTo)}</p>
                  <p>QR Scopes: {selectedItem.item.qrScopes.length ? selectedItem.item.qrScopes.join(", ") : "None"}</p>
                  <p>Fee: {humanizeEnum(selectedItem.item.feeMode)} {selectedItem.item.feeAmount !== null ? `(${formatCurrencyEGP(selectedItem.item.feeAmount)})` : ""}</p>
                </div>
              ) : null}

              {selectedItem.tab === "home-staff" ? (
                <div className="space-y-1 text-sm text-[#334155]">
                  <p>Staff Type: {humanizeEnum(selectedItem.item.staffType)}</p>
                  <p>Owner: {selectedItem.item.ownerName}</p>
                  <p>Unit: {buildUnitLabel(selectedItem.item.projectName, selectedItem.item.unitNumber)}</p>
                  <p>Live-In: {selectedItem.item.isLiveIn ? "Yes" : "No"}</p>
                  <p>Employment: {selectedItem.item.employmentFrom ? formatDate(selectedItem.item.employmentFrom) : "N/A"} - {selectedItem.item.employmentTo ? formatDate(selectedItem.item.employmentTo) : "N/A"}</p>
                  <p>Access: {formatDate(selectedItem.item.accessValidFrom)} - {formatDate(selectedItem.item.accessValidTo)}</p>
                </div>
              ) : null}

              {selectedItem.tab === "tenants" ? (
                <div className="space-y-2 text-sm text-[#334155]">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                    <div><p className="text-xs text-[#64748B]">Tenant Email</p><p>{selectedItem.item.tenantEmail}</p></div>
                    <div><p className="text-xs text-[#64748B]">Phone</p><p>{selectedItem.item.tenantPhone}</p></div>
                    <div><p className="text-xs text-[#64748B]">Nationality</p><p>{selectedItem.item.tenantNationality || "—"}</p></div>
                    <div><p className="text-xs text-[#64748B]">Unit</p><p>{selectedItem.item.unitNumber || "—"}</p></div>
                    <div><p className="text-xs text-[#64748B]">Owner</p><p>{selectedItem.item.ownerName || "—"}</p></div>
                    <div><p className="text-xs text-[#64748B]">Owner Email</p><p>{selectedItem.item.ownerEmail || "—"}</p></div>
                    {selectedItem.item.rejectionReason ? (
                      <div className="col-span-2"><p className="text-xs text-[#64748B]">Rejection Reason</p><p className="text-[#DC2626]">{selectedItem.item.rejectionReason}</p></div>
                    ) : null}
                    {selectedItem.item.reviewedAt ? (
                      <div><p className="text-xs text-[#64748B]">Reviewed At</p><p>{formatDateTime(selectedItem.item.reviewedAt)}</p></div>
                    ) : null}
                    {selectedItem.item.reviewedByName ? (
                      <div><p className="text-xs text-[#64748B]">Reviewed By</p><p>{selectedItem.item.reviewedByName}</p></div>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        ) : (
          <EmptyState title="No request selected" description="Select a row from the approvals table to review details." />
        )}
      </DrawerForm>

      <Dialog open={preRegisterOpen} onOpenChange={setPreRegisterOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Pre-Registration</DialogTitle>
            <DialogDescription>Step {preRegisterStep} of 2</DialogDescription>
          </DialogHeader>

          <div className="mb-3 flex gap-2">
            <Button variant={preRegisterMode === "OWNER" ? "default" : "outline"} onClick={() => setPreRegisterMode("OWNER")}>Pre-Register Owner</Button>
            <Button variant={preRegisterMode === "FAMILY" ? "default" : "outline"} onClick={() => setPreRegisterMode("FAMILY")}>Pre-Register Family Member</Button>
          </div>

          {preRegisterStep === 1 ? (
            <div className="space-y-3">
              {preRegisterMode === "OWNER" ? (
                <>
                  <Input placeholder="Name" value={ownerForm.nameEN} onChange={(event) => setOwnerForm((prev) => ({ ...prev, nameEN: event.target.value }))} />
                  <Input placeholder="Email" value={ownerForm.email} onChange={(event) => setOwnerForm((prev) => ({ ...prev, email: event.target.value }))} />
                  <Input placeholder="Phone" value={ownerForm.phone} onChange={(event) => setOwnerForm((prev) => ({ ...prev, phone: event.target.value }))} />
                  <Input placeholder="National ID" value={ownerForm.nationalId} onChange={(event) => setOwnerForm((prev) => ({ ...prev, nationalId: event.target.value }))} />
                  <select className="h-10 rounded-md border border-[#CBD5E1] px-3" value={ownerForm.unitId} onChange={(event) => setOwnerForm((prev) => ({ ...prev, unitId: event.target.value }))}>
                    <option value="">Select unit (optional)</option>
                    {unitOptions.map((row) => <option key={row.id} value={row.id}>{row.label}</option>)}
                  </select>
                  <Textarea placeholder="Notes (optional)" value={ownerForm.notes} onChange={(event) => setOwnerForm((prev) => ({ ...prev, notes: event.target.value }))} />
                </>
              ) : (
                <>
                  {optionsLoading ? (
                    <SkeletonTable columns={2} rows={3} />
                  ) : (
                    <>
                      <select className="h-10 rounded-md border border-[#CBD5E1] px-3" value={familyForm.ownerUserId} onChange={(event) => setFamilyForm((prev) => ({ ...prev, ownerUserId: event.target.value }))}>
                        <option value="">Select owner</option>
                        {ownerOptions.map((row) => <option key={row.id} value={row.id}>{row.label}</option>)}
                      </select>
                      <select className="h-10 rounded-md border border-[#CBD5E1] px-3" value={familyForm.unitId} onChange={(event) => setFamilyForm((prev) => ({ ...prev, unitId: event.target.value }))}>
                        <option value="">Select unit</option>
                        {unitOptions.map((row) => <option key={row.id} value={row.id}>{row.label}</option>)}
                      </select>
                    </>
                  )}
                  <Input placeholder="Name" value={familyForm.fullName} onChange={(event) => setFamilyForm((prev) => ({ ...prev, fullName: event.target.value }))} />
                  <Input placeholder="Phone" value={familyForm.phone} onChange={(event) => setFamilyForm((prev) => ({ ...prev, phone: event.target.value }))} />
                  <select className="h-10 rounded-md border border-[#CBD5E1] px-3" value={familyForm.relationship} onChange={(event) => setFamilyForm((prev) => ({ ...prev, relationship: event.target.value as FamilyRelationship }))}>
                    {RELATIONSHIP_OPTIONS.map((value) => (
                      <option key={value} value={value}>{humanizeEnum(value)}</option>
                    ))}
                  </select>
                  <Input placeholder="Email (optional)" value={familyForm.email} onChange={(event) => setFamilyForm((prev) => ({ ...prev, email: event.target.value }))} />
                  <Input placeholder="National ID / Passport (optional)" value={familyForm.nationalIdOrPassport} onChange={(event) => setFamilyForm((prev) => ({ ...prev, nationalIdOrPassport: event.target.value }))} />
                  <Textarea placeholder="Notes (optional)" value={familyForm.notes} onChange={(event) => setFamilyForm((prev) => ({ ...prev, notes: event.target.value }))} />
                </>
              )}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setPreRegisterOpen(false)}>Cancel</Button>
                <Button onClick={preRegisterNext}>Next</Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-xl border border-[#E2E8F0] p-4 text-sm text-[#334155]">
                {preRegisterMode === "OWNER" ? (
                  <div className="space-y-1">
                    <p>Name: {ownerForm.nameEN}</p>
                    <p>Email: {ownerForm.email}</p>
                    <p>Phone: {ownerForm.phone}</p>
                    <p>National ID: {ownerForm.nationalId}</p>
                    <p>Unit: {ownerForm.unitId || "Not assigned"}</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <p>Owner User: {familyForm.ownerUserId}</p>
                    <p>Unit: {familyForm.unitId}</p>
                    <p>Name: {familyForm.fullName}</p>
                    <p>Phone: {familyForm.phone}</p>
                    <p>Relationship: {humanizeEnum(familyForm.relationship)}</p>
                    <p>Email: {familyForm.email || "Not provided"}</p>
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setPreRegisterStep(1)}>Back</Button>
                <Button onClick={() => void confirmPreRegistration()} disabled={preRegisterBusy}>Confirm and Send Invite</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

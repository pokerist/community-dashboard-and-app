import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Tabs, TabsList, TabsTrigger } from "../ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { StatCard } from "../StatCard";
import { PageHeader } from "../PageHeader";
import { DataTable, DataTableColumn } from "../DataTable";
import { StatusBadge } from "../StatusBadge";
import { DrawerForm } from "../DrawerForm";
import { EmptyState } from "../EmptyState";
import usersService, {
  Broker,
  DelegateListItem,
  FamilyMemberListItem,
  HomeStaffListItem,
  HouseholdRequestStatus,
  OwnerListItem,
  SystemUserListItem,
  TenantListItem,
  UserDetailResponse,
  UserStatus,
  UserStats,
} from "../../lib/users-service";
import commercialService, {
  CommercialDirectoryUser,
} from "../../lib/commercial-service";
import compoundStaffService, { CompoundStaff, CompoundStaffStatus } from "../../lib/compound-staff-service";
import { errorMessage } from "../../lib/live-data";

type UsersTabKey =
  | "owners"
  | "family-members"
  | "tenants"
  | "home-staff"
  | "delegates"
  | "brokers"
  | "commercial"
  | "compound-staff"
  | "system-users";

const ALL_TABS: Array<{ key: UsersTabKey; label: string }> = [
  { key: "owners", label: "Owners" },
  { key: "family-members", label: "Family Members" },
  { key: "tenants", label: "Tenants" },
  { key: "home-staff", label: "Home Staff" },
  { key: "delegates", label: "Delegates" },
  { key: "brokers", label: "Brokers" },
  { key: "commercial", label: "Commercial" },
  { key: "compound-staff", label: "Compound Staff" },
  { key: "system-users", label: "System Users" },
];

const USER_STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "all", label: "All statuses" },
  { value: "ACTIVE", label: "Active" },
  { value: "SUSPENDED", label: "Suspended" },
  { value: "PENDING", label: "Pending" },
  { value: "INVITED", label: "Invited" },
  { value: "DISABLED", label: "Disabled" },
];

const HOUSEHOLD_STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "all", label: "All statuses" },
  { value: "APPROVED", label: "Approved" },
  { value: "PENDING", label: "Pending" },
  { value: "REJECTED", label: "Rejected" },
  { value: "CANCELLED", label: "Cancelled" },
];

const LEASE_STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "all", label: "All lease statuses" },
  { value: "ACTIVE", label: "Active" },
  { value: "EXPIRING_SOON", label: "Expiring Soon" },
  { value: "EXPIRED", label: "Expired" },
  { value: "TERMINATED", label: "Terminated" },
];

const STAFF_TYPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "all", label: "All staff types" },
  { value: "DRIVER", label: "Driver" },
  { value: "NANNY", label: "Nanny" },
  { value: "SERVANT", label: "Servant" },
  { value: "GARDENER", label: "Gardener" },
  { value: "OTHER", label: "Other" },
];

const COMMERCIAL_STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "all", label: "All statuses" },
  { value: "ACTIVE", label: "Active" },
  { value: "INACTIVE", label: "Inactive" },
];

function formatDate(value: string | null): string {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleDateString();
}

function formatDateTime(value: string | null): string {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleString();
}

function formatCurrency(value: number | null): string {
  if (value === null || Number.isNaN(value)) return "-";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function avatarFallback(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "NA"
  );
}

export function UsersHubPage() {
  const [activeTab, setActiveTab] = useState<UsersTabKey>("owners");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [secondaryFilter, setSecondaryFilter] = useState("all");
  const [tableLoading, setTableLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  const [stats, setStats] = useState<UserStats | null>(null);

  const [owners, setOwners] = useState<OwnerListItem[]>([]);
  const [familyMembers, setFamilyMembers] = useState<FamilyMemberListItem[]>([]);
  const [tenants, setTenants] = useState<TenantListItem[]>([]);
  const [homeStaff, setHomeStaff] = useState<HomeStaffListItem[]>([]);
  const [delegates, setDelegates] = useState<DelegateListItem[]>([]);
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [systemUsers, setSystemUsers] = useState<SystemUserListItem[]>([]);
  const [commercialUsers, setCommercialUsers] = useState<CommercialDirectoryUser[]>([]);
  const [compoundStaff, setCompoundStaff] = useState<CompoundStaff[]>([]);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [userDetail, setUserDetail] = useState<UserDetailResponse | null>(null);
  const [detailTab, setDetailTab] = useState<"profile" | "activity" | "linked">("profile");

  const [brokerDrawerOpen, setBrokerDrawerOpen] = useState(false);
  const [brokerSaving, setBrokerSaving] = useState(false);
  const [editingBroker, setEditingBroker] = useState<Broker | null>(null);
  const [brokerForm, setBrokerForm] = useState({
    name: "",
    email: "",
    phone: "",
    agencyName: "",
    licenseNumber: "",
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab");
    if (tab && ALL_TABS.some((entry) => entry.key === tab)) {
      setActiveTab(tab as UsersTabKey);
    }
    setSearch(params.get("q") ?? "");
    setStatusFilter(params.get("status") ?? "all");
    setSecondaryFilter(params.get("f1") ?? "all");
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    params.set("tab", activeTab);
    if (search.trim()) params.set("q", search.trim());
    else params.delete("q");
    if (statusFilter !== "all") params.set("status", statusFilter);
    else params.delete("status");
    if (secondaryFilter !== "all") params.set("f1", secondaryFilter);
    else params.delete("f1");
    const query = params.toString();
    const nextUrl = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash || ""}`;
    window.history.replaceState(null, "", nextUrl);
  }, [activeTab, search, secondaryFilter, statusFilter]);

  const refreshStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const payload = await usersService.getStats();
      setStats(payload);
    } catch (error) {
      toast.error("Failed to load user stats", { description: errorMessage(error) });
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const loadTabData = useCallback(async () => {
    setTableLoading(true);
    const searchTerm = search.trim() || undefined;
    try {
      if (activeTab === "owners") {
        const response = await usersService.listOwners({
          page: 1,
          limit: 20,
          search: searchTerm,
          status: statusFilter === "all" ? undefined : (statusFilter as UserStatus),
        });
        setOwners(response.items);
      } else if (activeTab === "family-members") {
        const response = await usersService.listFamilyMembers({
          page: 1,
          limit: 20,
          search: searchTerm,
          status: statusFilter === "all" ? undefined : (statusFilter as UserStatus),
        });
        setFamilyMembers(response.items);
      } else if (activeTab === "tenants") {
        const response = await usersService.listTenants({
          page: 1,
          limit: 20,
          search: searchTerm,
          status: statusFilter === "all" ? undefined : (statusFilter as UserStatus),
          leaseStatus: secondaryFilter === "all" ? undefined : (secondaryFilter as "ACTIVE" | "EXPIRING_SOON" | "EXPIRED" | "TERMINATED"),
        });
        setTenants(response.items);
      } else if (activeTab === "home-staff") {
        const response = await usersService.listHomeStaff({
          page: 1,
          limit: 20,
          search: searchTerm,
          status:
            statusFilter === "all"
              ? undefined
              : (statusFilter as HouseholdRequestStatus),
          staffType: secondaryFilter === "all" ? undefined : (secondaryFilter as HomeStaffListItem["staffType"]),
        });
        setHomeStaff(response.items);
      } else if (activeTab === "delegates") {
        const response = await usersService.listDelegates({
          page: 1,
          limit: 20,
          search: searchTerm,
          status:
            statusFilter === "all"
              ? undefined
              : (statusFilter as HouseholdRequestStatus),
        });
        setDelegates(response.items);
      } else if (activeTab === "brokers") {
        const response = await usersService.listBrokers({
          page: 1,
          limit: 20,
          search: searchTerm,
          status: statusFilter === "all" ? undefined : (statusFilter as UserStatus),
        });
        setBrokers(response.items);
      } else if (activeTab === "system-users") {
        const response = await usersService.listSystemUsers({
          page: 1,
          limit: 20,
          search: searchTerm,
          status: statusFilter === "all" ? undefined : (statusFilter as UserStatus),
        });
        setSystemUsers(response.items);
      } else if (activeTab === "commercial") {
        const includeInactive = statusFilter === "all" || statusFilter === "INACTIVE";
        const rows = await commercialService.listDirectoryUsers({ includeInactive });
        const statusScopedRows =
          statusFilter === "ACTIVE" || statusFilter === "INACTIVE"
            ? rows.filter((row) => row.status === statusFilter)
            : rows;
        const filteredRows = searchTerm
          ? statusScopedRows.filter((row) =>
              [
                row.userLabel,
                row.role,
                row.entityName,
                row.communityName,
                row.unitLabel,
              ]
                .join(" ")
                .toLowerCase()
                .includes(searchTerm.toLowerCase()),
            )
          : statusScopedRows;
        setCommercialUsers(filteredRows.slice(0, 20));
      } else if (activeTab === "compound-staff") {
        const rows = await compoundStaffService.list({
          status:
            statusFilter === "all"
              ? undefined
              : (statusFilter as CompoundStaffStatus),
          profession: searchTerm,
        });
        setCompoundStaff(rows.slice(0, 20));
      }
    } catch (error) {
      toast.error("Failed to load users tab", { description: errorMessage(error) });
    } finally {
      setTableLoading(false);
    }
  }, [activeTab, search, secondaryFilter, statusFilter]);

  useEffect(() => {
    void refreshStats();
  }, [refreshStats]);

  useEffect(() => {
    void loadTabData();
  }, [loadTabData]);

  const openUserDetail = useCallback(async (userId: string) => {
    setDetailOpen(true);
    setDetailLoading(true);
    setDetailTab("profile");
    try {
      const response = await usersService.getUserDetail(userId);
      setUserDetail(response);
    } catch (error) {
      toast.error("Failed to load user detail", { description: errorMessage(error) });
      setDetailOpen(false);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const applyUserStatusLocally = useCallback((userId: string, nextStatus: UserStatus) => {
    setOwners((prev) => prev.map((row) => (row.userId === userId ? { ...row, status: nextStatus } : row)));
    setFamilyMembers((prev) => prev.map((row) => (row.userId === userId ? { ...row, status: nextStatus } : row)));
    setTenants((prev) => prev.map((row) => (row.userId === userId ? { ...row, status: nextStatus } : row)));
    setBrokers((prev) => prev.map((row) => (row.userId === userId ? { ...row, status: nextStatus } : row)));
    setSystemUsers((prev) => prev.map((row) => (row.userId === userId ? { ...row, status: nextStatus } : row)));
    setUserDetail((prev) => (prev && prev.id === userId ? { ...prev, status: nextStatus } : prev));
  }, []);

  const suspendOrActivateUser = useCallback(
    async (userId: string, currentStatus: UserStatus) => {
      try {
        if (currentStatus === "SUSPENDED") {
          await usersService.activateUser(userId);
          applyUserStatusLocally(userId, "ACTIVE");
          toast.success("User activated");
        } else {
          const reason = window.prompt("Suspension reason");
          if (!reason || !reason.trim()) {
            return;
          }
          await usersService.suspendUser(userId, { reason: reason.trim() });
          applyUserStatusLocally(userId, "SUSPENDED");
          toast.success("User suspended");
        }
        void refreshStats();
      } catch (error) {
        toast.error("Failed to update user status", { description: errorMessage(error) });
      }
    },
    [applyUserStatusLocally, refreshStats],
  );

  const openBrokerCreate = () => {
    setEditingBroker(null);
    setBrokerForm({
      name: "",
      email: "",
      phone: "",
      agencyName: "",
      licenseNumber: "",
    });
    setBrokerDrawerOpen(true);
  };

  const openBrokerEdit = (broker: Broker) => {
    setEditingBroker(broker);
    setBrokerForm({
      name: broker.name,
      email: broker.email ?? "",
      phone: broker.phone ?? "",
      agencyName: broker.agencyName ?? "",
      licenseNumber: broker.licenseNumber ?? "",
    });
    setBrokerDrawerOpen(true);
  };

  const saveBroker = async () => {
    if (!editingBroker && !brokerForm.name.trim()) {
      toast.error("Name is required for new broker");
      return;
    }

    setBrokerSaving(true);
    try {
      if (editingBroker) {
        await usersService.updateBroker(editingBroker.id, {
          name: brokerForm.name.trim() || undefined,
          email: brokerForm.email.trim() || null,
          phone: brokerForm.phone.trim() || null,
          agencyName: brokerForm.agencyName.trim() || null,
          licenseNumber: brokerForm.licenseNumber.trim() || null,
        });
        toast.success("Broker updated");
      } else {
        await usersService.createBroker({
          name: brokerForm.name.trim(),
          email: brokerForm.email.trim() || undefined,
          phone: brokerForm.phone.trim() || undefined,
          agencyName: brokerForm.agencyName.trim() || undefined,
          licenseNumber: brokerForm.licenseNumber.trim() || undefined,
        });
        toast.success("Broker created");
      }
      setBrokerDrawerOpen(false);
      await Promise.all([loadTabData(), refreshStats()]);
    } catch (error) {
      toast.error("Failed to save broker", { description: errorMessage(error) });
    } finally {
      setBrokerSaving(false);
    }
  };

  const ownerColumns = useMemo<Array<DataTableColumn<OwnerListItem>>>(
    () => [
      {
        key: "name",
        header: "Avatar + Name",
        render: (row) => (
          <div className="flex items-center gap-2">
            <Avatar className="h-8 w-8">
              <AvatarFallback>{avatarFallback(row.name)}</AvatarFallback>
            </Avatar>
            <span className="font-medium text-[#0F172A]">{row.name}</span>
          </div>
        ),
      },
      { key: "email", header: "Email", render: (row) => row.email || "-" },
      { key: "phone", header: "Phone", render: (row) => row.phone || "-" },
      {
        key: "units",
        header: "Units",
        render: (row) => (row.unitNumbers.length ? row.unitNumbers.join(", ") : "0"),
      },
      { key: "family", header: "Family", render: (row) => String(row.familyMembersCount) },
      { key: "staff", header: "Home Staff", render: (row) => String(row.homeStaffCount) },
      {
        key: "status",
        header: "Status",
        render: (row) => <StatusBadge value={row.status} />,
      },
      {
        key: "actions",
        header: "Actions",
        render: (row) => (
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => void openUserDetail(row.userId)}>
              View Profile
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void suspendOrActivateUser(row.userId, row.status)}
            >
              {row.status === "SUSPENDED" ? "Activate" : "Suspend"}
            </Button>
          </div>
        ),
      },
    ],
    [openUserDetail, suspendOrActivateUser],
  );

  const familyColumns = useMemo<Array<DataTableColumn<FamilyMemberListItem>>>(
    () => [
      {
        key: "name",
        header: "Avatar + Name",
        render: (row) => (
          <div className="flex items-center gap-2">
            <Avatar className="h-8 w-8">
              <AvatarFallback>{avatarFallback(row.name)}</AvatarFallback>
            </Avatar>
            <span className="font-medium text-[#0F172A]">{row.name}</span>
          </div>
        ),
      },
      { key: "owner", header: "Owner", render: (row) => row.primaryOwnerName },
      { key: "unit", header: "Unit", render: (row) => row.unitNumber || "-" },
      { key: "relationship", header: "Relationship", render: (row) => row.relationshipType },
      { key: "status", header: "Status", render: (row) => <StatusBadge value={row.status} /> },
      { key: "activated", header: "Activated", render: (row) => formatDate(row.activatedAt) },
      {
        key: "actions",
        header: "Actions",
        render: (row) => (
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => void openUserDetail(row.userId)}>
              View Profile
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void suspendOrActivateUser(row.userId, row.status)}
            >
              {row.status === "SUSPENDED" ? "Activate" : "Suspend"}
            </Button>
          </div>
        ),
      },
    ],
    [openUserDetail, suspendOrActivateUser],
  );

  const tenantColumns = useMemo<Array<DataTableColumn<TenantListItem>>>(
    () => [
      {
        key: "name",
        header: "Avatar + Name",
        render: (row) => (
          <div className="flex items-center gap-2">
            <Avatar className="h-8 w-8">
              <AvatarFallback>{avatarFallback(row.name)}</AvatarFallback>
            </Avatar>
            <span className="font-medium text-[#0F172A]">{row.name}</span>
          </div>
        ),
      },
      { key: "unit", header: "Unit", render: (row) => row.unitNumber || "-" },
      {
        key: "lease-period",
        header: "Lease Period",
        render: (row) => `${formatDate(row.leaseStart)} - ${formatDate(row.leaseEnd)}`,
      },
      {
        key: "rent",
        header: "Monthly Rent",
        render: (row) => formatCurrency(row.monthlyRent),
      },
      {
        key: "lease-status",
        header: "Lease Status",
        render: (row) => <StatusBadge value={row.leaseStatus ?? "N/A"} />,
      },
      {
        key: "actions",
        header: "Actions",
        render: (row) => (
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => void openUserDetail(row.userId)}>
              View Profile
            </Button>
          </div>
        ),
      },
    ],
    [openUserDetail],
  );

  const homeStaffColumns = useMemo<Array<DataTableColumn<HomeStaffListItem>>>(
    () => [
      { key: "name", header: "Name", render: (row) => row.fullName },
      { key: "type", header: "Type", render: (row) => <StatusBadge value={row.staffType} /> },
      { key: "owner", header: "Owner", render: (row) => row.ownerName },
      { key: "unit", header: "Unit", render: (row) => row.unitNumber || "-" },
      { key: "until", header: "Access Until", render: (row) => formatDate(row.accessValidTo) },
      { key: "live-in", header: "Live-In", render: (row) => (row.isLiveIn ? "Yes" : "No") },
      { key: "status", header: "Status", render: (row) => <StatusBadge value={row.status} /> },
      { key: "actions", header: "Actions", render: () => "-" },
    ],
    [],
  );

  const delegateColumns = useMemo<Array<DataTableColumn<DelegateListItem>>>(
    () => [
      { key: "name", header: "Name", render: (row) => row.fullName },
      { key: "owner", header: "Owner", render: (row) => row.ownerName },
      { key: "unit", header: "Unit", render: (row) => row.unitNumber || "-" },
      { key: "type", header: "Type", render: (row) => row.delegateType },
      {
        key: "valid-period",
        header: "Valid Period",
        render: (row) => `${formatDate(row.validFrom)} - ${formatDate(row.validTo)}`,
      },
      { key: "scopes", header: "QR Scopes", render: (row) => (row.qrScopes.length ? row.qrScopes.join(", ") : "-") },
      { key: "fee-mode", header: "Fee Mode", render: (row) => row.feeMode },
      { key: "actions", header: "Actions", render: () => "-" },
    ],
    [],
  );

  const brokerColumns = useMemo<Array<DataTableColumn<Broker>>>(
    () => [
      { key: "name", header: "Name", render: (row) => row.name },
      { key: "agency", header: "Agency", render: (row) => row.agencyName || "-" },
      { key: "license", header: "License", render: (row) => row.licenseNumber || "-" },
      { key: "email", header: "Email", render: (row) => row.email || "-" },
      { key: "phone", header: "Phone", render: (row) => row.phone || "-" },
      { key: "status", header: "Status", render: (row) => <StatusBadge value={row.status} /> },
      { key: "created", header: "Created", render: (row) => formatDate(row.createdAt) },
      {
        key: "actions",
        header: "Actions",
        render: (row) => (
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => openBrokerEdit(row)}>
              Edit
            </Button>
            <Button size="sm" variant="outline" onClick={() => void openUserDetail(row.userId)}>
              View Profile
            </Button>
          </div>
        ),
      },
    ],
    [openUserDetail],
  );

  const systemUserColumns = useMemo<Array<DataTableColumn<SystemUserListItem>>>(
    () => [
      { key: "name", header: "Name", render: (row) => row.name },
      { key: "email", header: "Email", render: (row) => row.email || "-" },
      { key: "roles", header: "Roles", render: (row) => (row.roles.length ? row.roles.join(", ") : "-") },
      { key: "status", header: "Status", render: (row) => <StatusBadge value={row.status} /> },
      { key: "login", header: "Last Login", render: (row) => formatDateTime(row.lastLoginAt) },
      {
        key: "actions",
        header: "Actions",
        render: (row) => (
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => void openUserDetail(row.userId)}>
              View Profile
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void suspendOrActivateUser(row.userId, row.status)}
            >
              {row.status === "SUSPENDED" ? "Activate" : "Suspend"}
            </Button>
          </div>
        ),
      },
    ],
    [openUserDetail, suspendOrActivateUser],
  );

  const commercialColumns = useMemo<Array<DataTableColumn<CommercialDirectoryUser>>>(
    () => [
      { key: "name", header: "User", render: (row) => row.userLabel },
      { key: "role", header: "Role", render: (row) => <StatusBadge value={row.role} /> },
      { key: "entity", header: "Entity", render: (row) => row.entityName },
      { key: "community", header: "Community", render: (row) => row.communityName },
      { key: "unit", header: "Unit", render: (row) => row.unitLabel },
      { key: "status", header: "Status", render: (row) => <StatusBadge value={row.status} /> },
      {
        key: "actions",
        header: "Actions",
        render: (row) => (
          <Button size="sm" variant="outline" onClick={() => void openUserDetail(row.userId)}>
            View Profile
          </Button>
        ),
      },
    ],
    [openUserDetail],
  );

  const compoundStaffColumns = useMemo<Array<DataTableColumn<CompoundStaff>>>(
    () => [
      { key: "name", header: "Name", render: (row) => row.fullName },
      { key: "profession", header: "Profession", render: (row) => row.profession },
      { key: "phone", header: "Phone", render: (row) => row.phone },
      { key: "community", header: "Community", render: (row) => row.communityId || "-" },
      { key: "status", header: "Status", render: (row) => <StatusBadge value={row.status} /> },
      { key: "contract", header: "Contract To", render: (row) => formatDate(row.contractTo) },
      { key: "actions", header: "Actions", render: () => "-" },
    ],
    [],
  );

  const kpiCards = [
    { title: "Total Users", value: stats?.totalUsers, icon: "active-users" as const },
    { title: "Total Owners", value: stats?.totalOwners, icon: "active-users" as const },
    { title: "Total Family Members", value: stats?.totalFamilyMembers, icon: "visitors" as const },
    { title: "Total Tenants", value: stats?.totalTenants, icon: "occupancy" as const },
    { title: "Home Staff", value: stats?.totalHomeStaff, icon: "workers" as const },
    { title: "Delegates", value: stats?.totalDelegates, icon: "devices" as const },
    { title: "Brokers", value: stats?.totalBrokers, icon: "tickets" as const },
    { title: "Suspended", value: stats?.suspendedUsers, icon: "complaints-closed" as const },
  ];

  const onTabChange = (nextValue: string) => {
    setActiveTab(nextValue as UsersTabKey);
    setStatusFilter("all");
    setSecondaryFilter("all");
  };

  const renderFilterBar = () => (
    <div className="flex flex-col gap-2 rounded-xl border border-[#E2E8F0] bg-white p-3 md:flex-row md:items-center">
      <Input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search by name, email, phone"
        className="md:max-w-[320px]"
      />
      <Select value={statusFilter} onValueChange={setStatusFilter}>
        <SelectTrigger className="md:max-w-[220px]">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          {(activeTab === "delegates" || activeTab === "home-staff"
            ? HOUSEHOLD_STATUS_OPTIONS
            : activeTab === "commercial"
              ? COMMERCIAL_STATUS_OPTIONS
              : USER_STATUS_OPTIONS
          ).map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {activeTab === "tenants" ? (
        <Select value={secondaryFilter} onValueChange={setSecondaryFilter}>
          <SelectTrigger className="md:max-w-[220px]">
            <SelectValue placeholder="Lease status" />
          </SelectTrigger>
          <SelectContent>
            {LEASE_STATUS_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}
      {activeTab === "home-staff" ? (
        <Select value={secondaryFilter} onValueChange={setSecondaryFilter}>
          <SelectTrigger className="md:max-w-[220px]">
            <SelectValue placeholder="Staff type" />
          </SelectTrigger>
          <SelectContent>
            {STAFF_TYPE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}
      {activeTab === "brokers" ? (
        <Button className="md:ml-auto" onClick={openBrokerCreate}>
          Add Broker
        </Button>
      ) : null}
    </div>
  );

  const renderActiveTable = () => {
    if (activeTab === "owners") {
      return (
        <DataTable
          columns={ownerColumns}
          rows={owners}
          rowKey={(row) => row.userId}
          loading={tableLoading}
          emptyTitle="No owners found"
          emptyDescription="Try changing search terms or filters."
        />
      );
    }
    if (activeTab === "family-members") {
      return (
        <DataTable
          columns={familyColumns}
          rows={familyMembers}
          rowKey={(row) => row.userId}
          loading={tableLoading}
          emptyTitle="No family members found"
        />
      );
    }
    if (activeTab === "tenants") {
      return (
        <DataTable
          columns={tenantColumns}
          rows={tenants}
          rowKey={(row) => row.userId}
          loading={tableLoading}
          emptyTitle="No tenants found"
        />
      );
    }
    if (activeTab === "home-staff") {
      return (
        <DataTable
          columns={homeStaffColumns}
          rows={homeStaff}
          rowKey={(row) => row.id}
          loading={tableLoading}
          emptyTitle="No home staff found"
        />
      );
    }
    if (activeTab === "delegates") {
      return (
        <DataTable
          columns={delegateColumns}
          rows={delegates}
          rowKey={(row) => row.id}
          loading={tableLoading}
          emptyTitle="No delegates found"
        />
      );
    }
    if (activeTab === "brokers") {
      return (
        <DataTable
          columns={brokerColumns}
          rows={brokers}
          rowKey={(row) => row.id}
          loading={tableLoading}
          emptyTitle="No brokers found"
        />
      );
    }
    if (activeTab === "system-users") {
      return (
        <DataTable
          columns={systemUserColumns}
          rows={systemUsers}
          rowKey={(row) => row.userId}
          loading={tableLoading}
          emptyTitle="No system users found"
        />
      );
    }
    if (activeTab === "commercial") {
      return (
        <DataTable
          columns={commercialColumns}
          rows={commercialUsers}
          rowKey={(row) => row.memberId}
          loading={tableLoading}
          emptyTitle="No commercial users found"
        />
      );
    }
    if (activeTab === "compound-staff") {
      return (
        <DataTable
          columns={compoundStaffColumns}
          rows={compoundStaff}
          rowKey={(row) => row.id}
          loading={tableLoading}
          emptyTitle="No compound staff found"
        />
      );
    }
    return <EmptyState title="No tab selected" />;
  };

  const detailBroker = useMemo(
    () => brokers.find((row) => row.userId === userDetail?.id) ?? null,
    [brokers, userDetail?.id],
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Users Hub"
        description={`Unified residents/users directory across owners, tenants, family, delegates, brokers, system users, commercial, and compound staff. Total users in system: ${
          statsLoading ? "..." : stats ? String(stats.totalUsers) : "-"
        }.`}
        actions={
          <Button variant="outline" onClick={() => void Promise.all([refreshStats(), loadTabData()])}>
            Refresh
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {kpiCards.map((card) => (
          <StatCard
            key={card.title}
            title={card.title}
            value={statsLoading ? "..." : stats ? String(card.value ?? 0) : "-"}
            icon={card.icon}
          />
        ))}
      </div>

      <Tabs value={activeTab} onValueChange={onTabChange} className="space-y-3">
        <TabsList className="h-auto w-full flex-wrap justify-start gap-1 rounded-xl border border-[#E2E8F0] bg-white p-1">
          {ALL_TABS.map((tab) => (
            <TabsTrigger key={tab.key} value={tab.key} className="rounded-lg px-3 py-1.5">
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {renderFilterBar()}
      {renderActiveTable()}

      <DrawerForm
        open={detailOpen}
        onOpenChange={setDetailOpen}
        title="User Profile"
        description="Profile, activity, and linked records"
      >
        {detailLoading || !userDetail ? (
          <p className="text-sm text-[#64748B]">Loading profile...</p>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3">
              <Avatar className="h-12 w-12">
                {userDetail.profilePhotoUrl ? (
                  <AvatarImage src={userDetail.profilePhotoUrl} />
                ) : null}
                <AvatarFallback>{avatarFallback(userDetail.name)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate font-semibold text-[#0F172A]">{userDetail.name}</p>
                <div className="mt-1 flex items-center gap-2">
                  <StatusBadge value={userDetail.userType} />
                  <StatusBadge value={userDetail.status} />
                </div>
              </div>
            </div>

            <Tabs value={detailTab} onValueChange={(value) => setDetailTab(value as "profile" | "activity" | "linked")}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="profile">Profile</TabsTrigger>
                <TabsTrigger value="activity">Activity</TabsTrigger>
                <TabsTrigger value="linked">Linked Records</TabsTrigger>
              </TabsList>
            </Tabs>

            {detailTab === "profile" ? (
              <div className="space-y-2 text-sm">
                <p><span className="text-[#64748B]">Email:</span> {userDetail.email || "-"}</p>
                <p><span className="text-[#64748B]">Phone:</span> {userDetail.phone || "-"}</p>
                <p><span className="text-[#64748B]">Last Login:</span> {formatDateTime(userDetail.lastLoginAt)}</p>
                <p><span className="text-[#64748B]">Created:</span> {formatDateTime(userDetail.createdAt)}</p>
                {userDetail.ownerData ? (
                  <p><span className="text-[#64748B]">Owner Units:</span> {userDetail.ownerData.units.map((unit) => unit.unitNumber).join(", ") || "-"}</p>
                ) : null}
                {userDetail.tenantData ? (
                  <p><span className="text-[#64748B]">Tenant Lease:</span> {formatDate(userDetail.tenantData.lease.startDate)} - {formatDate(userDetail.tenantData.lease.endDate)}</p>
                ) : null}
                {userDetail.familyData ? (
                  <p><span className="text-[#64748B]">Family Relationship:</span> {userDetail.familyData.relationship}</p>
                ) : null}
                {userDetail.delegateData ? (
                  <p><span className="text-[#64748B]">Delegate Scopes:</span> {userDetail.delegateData.permissions.join(", ") || "-"}</p>
                ) : null}
                {userDetail.homeStaffData ? (
                  <p><span className="text-[#64748B]">Home Staff Type:</span> {userDetail.homeStaffData.staffType}</p>
                ) : null}
                {userDetail.brokerData ? (
                  <p><span className="text-[#64748B]">Broker Agency:</span> {userDetail.brokerData.agencyName || "-"}</p>
                ) : null}
              </div>
            ) : null}

            {detailTab === "activity" ? (
              <div className="space-y-2">
                {userDetail.activity.length === 0 ? (
                  <EmptyState title="No activity logs" description="No status log entries found for this user." />
                ) : (
                  userDetail.activity.map((activity) => (
                    <div key={activity.id} className="rounded-lg border border-[#E2E8F0] p-2 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <StatusBadge value={activity.newStatus} />
                        <span className="text-xs text-[#64748B]">{formatDateTime(activity.createdAt)}</span>
                      </div>
                      <p className="mt-1 text-xs text-[#64748B]">{activity.note || "No note"}</p>
                    </div>
                  ))
                )}
              </div>
            ) : null}

            {detailTab === "linked" ? (
              <div className="space-y-2 text-sm">
                <p><span className="text-[#64748B]">Units:</span> {userDetail.linkedRecords.units.map((unit) => unit.unitNumber).join(", ") || "-"}</p>
                <p><span className="text-[#64748B]">Leases:</span> {userDetail.linkedRecords.leases.length}</p>
                <p><span className="text-[#64748B]">Complaints:</span> {userDetail.linkedRecords.complaints}</p>
                <p><span className="text-[#64748B]">Violations:</span> {userDetail.linkedRecords.violations}</p>
              </div>
            ) : null}
          </div>
        )}
        {!detailLoading && userDetail ? (
          <div className="flex w-full items-center justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => void suspendOrActivateUser(userDetail.id, userDetail.status)}
            >
              {userDetail.status === "SUSPENDED" ? "Activate" : "Suspend"}
            </Button>
            <Button
              variant="outline"
              disabled={!detailBroker}
              onClick={() => detailBroker && openBrokerEdit(detailBroker)}
            >
              Edit
            </Button>
          </div>
        ) : null}
      </DrawerForm>

      <DrawerForm
        open={brokerDrawerOpen}
        onOpenChange={setBrokerDrawerOpen}
        title={editingBroker ? "Edit Broker" : "Add Broker"}
        description="Create or update broker profile details."
      >
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-sm text-[#334155]">Name</label>
            <Input
              value={brokerForm.name}
              onChange={(event) => setBrokerForm((prev) => ({ ...prev, name: event.target.value }))}
              placeholder="Broker full name"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm text-[#334155]">Email</label>
            <Input
              value={brokerForm.email}
              onChange={(event) => setBrokerForm((prev) => ({ ...prev, email: event.target.value }))}
              placeholder="broker@email.com"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm text-[#334155]">Phone</label>
            <Input
              value={brokerForm.phone}
              onChange={(event) => setBrokerForm((prev) => ({ ...prev, phone: event.target.value }))}
              placeholder="+1 ..."
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm text-[#334155]">Agency</label>
            <Input
              value={brokerForm.agencyName}
              onChange={(event) => setBrokerForm((prev) => ({ ...prev, agencyName: event.target.value }))}
              placeholder="Agency name"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm text-[#334155]">License Number</label>
            <Input
              value={brokerForm.licenseNumber}
              onChange={(event) => setBrokerForm((prev) => ({ ...prev, licenseNumber: event.target.value }))}
              placeholder="License number"
            />
          </div>
        </div>
        <div className="flex w-full justify-end gap-2">
          <Button variant="outline" onClick={() => setBrokerDrawerOpen(false)} disabled={brokerSaving}>
            Cancel
          </Button>
          <Button onClick={() => void saveBroker()} disabled={brokerSaving}>
            {brokerSaving ? "Saving..." : editingBroker ? "Update Broker" : "Create Broker"}
          </Button>
        </div>
      </DrawerForm>
    </div>
  );
}

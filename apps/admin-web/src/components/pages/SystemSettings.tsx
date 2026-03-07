import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Database, Link as LinkIcon, RefreshCw, Save, Shield, Bell, Settings, CheckCircle, XCircle, Palette, Upload, Plug, Image as ImageIcon, Plus, Users } from "lucide-react";
import { toast } from "sonner";
import apiClient from "../../lib/api-client";
import { errorMessage, extractRows, formatDateTime } from "../../lib/live-data";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Switch } from "../ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Textarea } from "../ui/textarea";

type Department = {
  id: string;
  name: string;
  code: string;
  colorDot?: string;
  staffMembers?: any[];
};

type SystemUser = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role?: { name: string };
  isActive: boolean;
};

type Role = {
  id: string;
  name: string;
  description?: string;
  permissionCodes?: string[];
};

type Permission = {
  id: string;
  code: string;
  name: string;
  description?: string;
};

type SettingsState = {
  general: {
    companyName: string;
    timezone: string;
    currency: string;
    dateFormat: string;
    defaultLanguage: string;
  };
  notifications: {
    emailFrom: string;
    smsSender: string;
    pushTopic: string;
    emailTemplate: string;
    smsTemplate: string;
    enableEmail: boolean;
    enableSms: boolean;
    enablePush: boolean;
    enableInApp: boolean;
  };
  security: {
    enforce2fa: boolean;
    autoLogoutEnabled: boolean;
    sessionTimeoutMinutes: number;
    rateLimitEnabled: boolean;
    rateLimitPerMinute: number;
    minPasswordLength: number;
    maxLoginAttempts: number;
    lockoutDurationMinutes: number;
    ipWhitelistEnabled: boolean;
    ipWhitelist: string[];
    auditLoggingEnabled: boolean;
    requireSecureConnections: boolean;
    allowConcurrentSessions: number;
  };
  backup: {
    autoBackups: boolean;
    backupTime: string;
    retentionDays: number;
  };
  brand: {
    companyName: string;
    appDisplayName: string;
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
    logoFileId: string;
    tagline: string;
    supportEmail: string;
    supportPhone: string;
  };
  mobileAccess: {
    owner: Record<string, boolean>;
    tenant: Record<string, boolean>;
    family: Record<string, boolean>;
    authorized: Record<string, boolean>;
    contractor: Record<string, boolean>;
    preDeliveryOwner: Record<string, boolean>;
    resident: Record<string, boolean>;
  };
};

type BackupHistoryItem = {
  id: string;
  label?: string | null;
  createdAt: string;
  createdById?: string | null;
  restoredAt?: string | null;
  restoredById?: string | null;
};

type DiagnosticsState = {
  checkedAt?: string;
  backendApiOk?: boolean;
  notificationsAdminOk?: boolean;
  backendError?: string;
};

type ProviderTestResult = {
  status: "NOT_TESTED" | "PASS" | "FAIL";
  message: string;
  checkedAt: string | null;
  latencyMs: number | null;
};

type IntegrationsState = {
  version: number;
  smtp: {
    enabled: boolean;
    configured: boolean;
    host: string;
    port: number;
    secure: boolean;
    username: string;
    password: string;
    fromEmail: string;
    fromName: string;
    lastTest: ProviderTestResult | null;
  };
  smsOtp: {
    enabled: boolean;
    configured: boolean;
    provider: "FIREBASE_AUTH";
    firebaseProjectId: string;
    lastTest: ProviderTestResult | null;
  };
  fcm: {
    enabled: boolean;
    configured: boolean;
    serviceAccountJson: string;
    projectId: string;
    clientEmail: string;
    privateKey: string;
    lastTest: ProviderTestResult | null;
  };
  s3: {
    enabled: boolean;
    configured: boolean;
    provider: "LOCAL" | "S3" | "SUPABASE";
    bucket: string;
    region: string;
    endpoint: string;
    accessKeyId: string;
    secretAccessKey: string;
    forcePathStyle: boolean;
    supabaseUrl: string;
    supabaseServiceRoleKey: string;
    lastTest: ProviderTestResult | null;
  };
  crm: {
    enabled: boolean;
    configured: boolean;
    baseUrl: string;
    authToken: string;
    lastTest: ProviderTestResult | null;
  };
  erp: {
    enabled: boolean;
    configured: boolean;
    baseUrl: string;
    authToken: string;
    lastTest: ProviderTestResult | null;
  };
  hcp: {
    enabled: boolean;
    configured: boolean;
    baseUrl: string;
    authToken: string;
    lastTest: ProviderTestResult | null;
  };
  paymentGateway: {
    enabled: boolean;
    configured: boolean;
    provider: "STRIPE" | "PAYFORT" | "OTHER";
    apiKey: string;
    secretKey: string;
    lastTest: ProviderTestResult | null;
  };
  fireAlarm: {
    enabled: boolean;
    configured: boolean;
    baseUrl: string;
    apiKey: string;
    lastTest: ProviderTestResult | null;
  };
  smartHome: {
    enabled: boolean;
    configured: boolean;
    baseUrl: string;
    apiKey: string;
    lastTest: ProviderTestResult | null;
  };
  hikCentral: {
    enabled: boolean;
    configured: boolean;
    baseUrl: string;
    apiKey: string;
    lastTest: ProviderTestResult | null;
  };
};

const mobileAccessFeatureCatalog = [
  {
    key: "canUseServices",
    label: "Services & Requests",
    hint: "Show services and requests in mobile.",
  },
  {
    key: "canUseBookings",
    label: "Bookings",
    hint: "Allow amenities booking and history.",
  },
  {
    key: "canUseComplaints",
    label: "Complaints",
    hint: "Allow complaints submission and follow-up.",
  },
  {
    key: "canUseQr",
    label: "QR Access",
    hint: "Allow generating and managing QR access.",
  },
  {
    key: "canViewFinance",
    label: "Finance",
    hint: "Show invoices, violations, and payments.",
  },
  {
    key: "canManageHousehold",
    label: "Manage Household",
    hint: "Allow family/authorized/home-staff operations.",
  },
  {
    key: "canUseDiscover",
    label: "Discover",
    hint: "Show discover places.",
  },
  {
    key: "canUseHelpCenter",
    label: "Help Center",
    hint: "Show help/support center.",
  },
  {
    key: "canUseUtilities",
    label: "Utilities",
    hint: "Show utility tracking flows.",
  },
] as const;

const mobileAccessPersonaCatalog = [
  { key: "owner", label: "Owner", hint: "Primary owner account policy." },
  { key: "tenant", label: "Tenant", hint: "Active tenant account policy." },
  { key: "family", label: "Family", hint: "First-degree family member policy." },
  { key: "authorized", label: "Authorized", hint: "Delegate/authorized account policy." },
  { key: "contractor", label: "Contractor", hint: "Internal contractor persona policy." },
  {
    key: "preDeliveryOwner",
    label: "Pre-delivery Owner",
    hint: "Owner of not-delivered unit policy.",
  },
  { key: "resident", label: "Resident (Fallback)", hint: "Fallback resident policy." },
] as const;

const defaultSettings: SettingsState = {
  general: {
    companyName: "Al Karma Developments",
    timezone: "Africa/Cairo",
    currency: "EGP",
    dateFormat: "DD/MM/YYYY",
    defaultLanguage: "English",
  },
  notifications: {
    emailFrom: "noreply@alkarma.com",
    smsSender: "AlKarma",
    pushTopic: "community-updates",
    emailTemplate: "Dear {resident_name},\n\n{message}\n\nRegards,\nAl Karma Team",
    smsTemplate: "{message} - Al Karma",
    enableEmail: true,
    enableSms: false,
    enablePush: false,
    enableInApp: true,
  },
  security: {
    enforce2fa: true,
    autoLogoutEnabled: true,
    sessionTimeoutMinutes: 30,
    rateLimitEnabled: true,
    rateLimitPerMinute: 100,
    minPasswordLength: 8,
    maxLoginAttempts: 5,
    lockoutDurationMinutes: 15,
    ipWhitelistEnabled: false,
    ipWhitelist: [],
    auditLoggingEnabled: true,
    requireSecureConnections: true,
    allowConcurrentSessions: 3,
  },
  backup: {
    autoBackups: false,
    backupTime: "02:00",
    retentionDays: 30,
  },
  brand: {
    companyName: "Al Karma Developments",
    appDisplayName: "AlKarma Community",
    primaryColor: "#2A3E35",
    secondaryColor: "#C9A961",
    accentColor: "#0B5FFF",
    logoFileId: "",
    tagline: "Smart Living",
    supportEmail: "",
    supportPhone: "",
  },
  mobileAccess: {
    owner: {
      canUseServices: true,
      canUseBookings: true,
      canUseComplaints: true,
      canUseQr: true,
      canViewFinance: true,
      canManageHousehold: true,
      canUseDiscover: true,
      canUseHelpCenter: true,
      canUseUtilities: true,
    },
    tenant: {
      canUseServices: true,
      canUseBookings: true,
      canUseComplaints: true,
      canUseQr: true,
      canViewFinance: true,
      canManageHousehold: true,
      canUseDiscover: true,
      canUseHelpCenter: true,
      canUseUtilities: true,
    },
    family: {
      canUseServices: true,
      canUseBookings: true,
      canUseComplaints: true,
      canUseQr: false,
      canViewFinance: false,
      canManageHousehold: false,
      canUseDiscover: true,
      canUseHelpCenter: true,
      canUseUtilities: false,
    },
    authorized: {
      canUseServices: true,
      canUseBookings: true,
      canUseComplaints: true,
      canUseQr: true,
      canViewFinance: false,
      canManageHousehold: false,
      canUseDiscover: true,
      canUseHelpCenter: true,
      canUseUtilities: false,
    },
    contractor: {
      canUseServices: false,
      canUseBookings: false,
      canUseComplaints: false,
      canUseQr: true,
      canViewFinance: false,
      canManageHousehold: false,
      canUseDiscover: false,
      canUseHelpCenter: true,
      canUseUtilities: false,
    },
    preDeliveryOwner: {
      canUseServices: false,
      canUseBookings: false,
      canUseComplaints: true,
      canUseQr: false,
      canViewFinance: true,
      canManageHousehold: false,
      canUseDiscover: true,
      canUseHelpCenter: true,
      canUseUtilities: true,
    },
    resident: {
      canUseServices: true,
      canUseBookings: true,
      canUseComplaints: true,
      canUseQr: true,
      canViewFinance: true,
      canManageHousehold: false,
      canUseDiscover: true,
      canUseHelpCenter: true,
      canUseUtilities: true,
    },
  },
};

const defaultIntegrations: IntegrationsState = {
  version: 1,
  smtp: {
    enabled: false,
    configured: false,
    host: "",
    port: 587,
    secure: false,
    username: "",
    password: "",
    fromEmail: "",
    fromName: "",
    lastTest: null,
  },
  smsOtp: {
    enabled: false,
    configured: false,
    provider: "FIREBASE_AUTH",
    firebaseProjectId: "",
    lastTest: null,
  },
  fcm: {
    enabled: false,
    configured: false,
    serviceAccountJson: "",
    projectId: "",
    clientEmail: "",
    privateKey: "",
    lastTest: null,
  },
  s3: {
    enabled: false,
    configured: false,
    provider: "LOCAL",
    bucket: "",
    region: "",
    endpoint: "",
    accessKeyId: "",
    secretAccessKey: "",
    forcePathStyle: true,
    supabaseUrl: "",
    supabaseServiceRoleKey: "",
    lastTest: null,
  },
  crm: {
    enabled: false,
    configured: false,
    baseUrl: "",
    authToken: "",
    lastTest: null,
  },
  erp: {
    enabled: false,
    configured: false,
    baseUrl: "",
    authToken: "",
    lastTest: null,
  },
  hcp: {
    enabled: false,
    configured: false,
    baseUrl: "",
    authToken: "",
    lastTest: null,
  },
  paymentGateway: {
    enabled: false,
    configured: false,
    provider: "STRIPE",
    apiKey: "",
    secretKey: "",
    lastTest: null,
  },
  fireAlarm: {
    enabled: false,
    configured: false,
    baseUrl: "",
    apiKey: "",
    lastTest: null,
  },
  smartHome: {
    enabled: false,
    configured: false,
    baseUrl: "",
    apiKey: "",
    lastTest: null,
  },
  hikCentral: {
    enabled: false,
    configured: false,
    baseUrl: "",
    apiKey: "",
    lastTest: null,
  },
};

function mergeSettings(parsed: any): SettingsState {
  return {
    ...defaultSettings,
    ...parsed,
    general: { ...defaultSettings.general, ...(parsed?.general ?? {}) },
    notifications: { ...defaultSettings.notifications, ...(parsed?.notifications ?? {}) },
    security: { ...defaultSettings.security, ...(parsed?.security ?? {}) },
    backup: { ...defaultSettings.backup, ...(parsed?.backup ?? {}) },
    brand: { ...defaultSettings.brand, ...(parsed?.brand ?? {}) },
    mobileAccess: {
      ...defaultSettings.mobileAccess,
      ...(parsed?.mobileAccess ?? {}),
      owner: { ...defaultSettings.mobileAccess.owner, ...(parsed?.mobileAccess?.owner ?? {}) },
      tenant: { ...defaultSettings.mobileAccess.tenant, ...(parsed?.mobileAccess?.tenant ?? {}) },
      family: { ...defaultSettings.mobileAccess.family, ...(parsed?.mobileAccess?.family ?? {}) },
      authorized: { ...defaultSettings.mobileAccess.authorized, ...(parsed?.mobileAccess?.authorized ?? {}) },
      contractor: { ...defaultSettings.mobileAccess.contractor, ...(parsed?.mobileAccess?.contractor ?? {}) },
      preDeliveryOwner: {
        ...defaultSettings.mobileAccess.preDeliveryOwner,
        ...(parsed?.mobileAccess?.preDeliveryOwner ?? {}),
      },
      resident: { ...defaultSettings.mobileAccess.resident, ...(parsed?.mobileAccess?.resident ?? {}) },
    },
  };
}

function toLocalDateTimeValue(iso?: string | null): string {
  if (!iso) return "";
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  const year = dt.getFullYear();
  const month = pad(dt.getMonth() + 1);
  const day = pad(dt.getDate());
  const hours = pad(dt.getHours());
  const minutes = pad(dt.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function fromLocalDateTimeValue(local: string): string {
  if (!local.trim()) return "";
  const dt = new Date(local);
  return Number.isNaN(dt.getTime()) ? "" : dt.toISOString();
}

function mergeIntegrations(parsed: any): IntegrationsState {
  return {
    ...defaultIntegrations,
    ...(parsed ?? {}),
    smtp: { ...defaultIntegrations.smtp, ...(parsed?.smtp ?? {}) },
    smsOtp: { ...defaultIntegrations.smsOtp, ...(parsed?.smsOtp ?? {}) },
    fcm: { ...defaultIntegrations.fcm, ...(parsed?.fcm ?? {}) },
    s3: { ...defaultIntegrations.s3, ...(parsed?.s3 ?? {}) },
    crm: { ...defaultIntegrations.crm, ...(parsed?.crm ?? {}) },
    erp: { ...defaultIntegrations.erp, ...(parsed?.erp ?? {}) },
    hcp: { ...defaultIntegrations.hcp, ...(parsed?.hcp ?? {}) },
    paymentGateway: { ...defaultIntegrations.paymentGateway, ...(parsed?.paymentGateway ?? {}) },
    fireAlarm: { ...defaultIntegrations.fireAlarm, ...(parsed?.fireAlarm ?? {}) },
    smartHome: { ...defaultIntegrations.smartHome, ...(parsed?.smartHome ?? {}) },
    hikCentral: { ...defaultIntegrations.hikCentral, ...(parsed?.hikCentral ?? {}) },
  };
}

function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function SystemSettings() {
  const [saved, setSaved] = useState<SettingsState>(defaultSettings);
  const [draft, setDraft] = useState<SettingsState>(defaultSettings);
  const [integrations, setIntegrations] = useState<IntegrationsState>(defaultIntegrations);
  const [backupHistory, setBackupHistory] = useState<BackupHistoryItem[]>([]);
  const [diagnostics, setDiagnostics] = useState<DiagnosticsState>({});
  const [isLoadingSettings, setIsLoadingSettings] = useState(false);
  const [isLoadingIntegrations, setIsLoadingIntegrations] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [savingIntegration, setSavingIntegration] = useState<string | null>(null);
  const [testingIntegration, setTestingIntegration] = useState<string | null>(null);
  const [isCheckingBackend, setIsCheckingBackend] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isCreatingBackup, setIsCreatingBackup] = useState(false);
  const [restoringBackupId, setRestoringBackupId] = useState<string | null>(null);
  const restoreInputRef = useRef<HTMLInputElement | null>(null);

  // Departments, System Users, Roles state
  const [departments, setDepartments] = useState<Department[]>([]);
  const [systemUsers, setSystemUsers] = useState<SystemUser[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [isLoadingDepartments, setIsLoadingDepartments] = useState(false);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [isLoadingRoles, setIsLoadingRoles] = useState(false);

  const setMobileAccessFlag = useCallback(
    (
      persona: (typeof mobileAccessPersonaCatalog)[number]["key"],
      feature: (typeof mobileAccessFeatureCatalog)[number]["key"],
      enabled: boolean,
    ) => {
      setDraft((s) => ({
        ...s,
        mobileAccess: {
          ...s.mobileAccess,
          [persona]: {
            ...(s.mobileAccess[persona] ?? {}),
            [feature]: enabled,
          },
        },
      }));
    },
    [],
  );

  const loadBackupHistory = useCallback(async () => {
    const response = await apiClient.get("/system-settings/backup/history", {
      params: { limit: 20 },
    });
    setBackupHistory(extractRows<BackupHistoryItem>(response.data));
  }, []);

  const loadDepartments = useCallback(async () => {
    setIsLoadingDepartments(true);
    try {
      const response = await apiClient.get("/system-settings/departments", {
        params: { limit: 100 },
      });
      setDepartments(extractRows<any>(response.data));
    } catch (error) {
      toast.error("Failed to load departments", { description: errorMessage(error) });
    } finally {
      setIsLoadingDepartments(false);
    }
  }, []);

  const loadSystemUsers = useCallback(async () => {
    setIsLoadingUsers(true);
    try {
      const response = await apiClient.get("/system-settings/users", {
        params: { limit: 100 },
      });
      setSystemUsers(extractRows<any>(response.data));
    } catch (error) {
      toast.error("Failed to load system users", { description: errorMessage(error) });
    } finally {
      setIsLoadingUsers(false);
    }
  }, []);

  const loadRoles = useCallback(async () => {
    setIsLoadingRoles(true);
    try {
      const [rolesRes, permissionsRes] = await Promise.all([
        apiClient.get("/system-settings/roles"),
        apiClient.get("/system-settings/permissions"),
      ]);
      setRoles(extractRows<any>(rolesRes.data));
      setPermissions(extractRows<any>(permissionsRes.data));
    } catch (error) {
      toast.error("Failed to load roles", { description: errorMessage(error) });
    } finally {
      setIsLoadingRoles(false);
    }
  }, []);

  const loadIntegrations = useCallback(async () => {
    setIsLoadingIntegrations(true);
    try {
      const response = await apiClient.get("/system-settings/integrations");
      const merged = mergeIntegrations(response.data?.data ?? response.data);
      setIntegrations(merged);
    } catch (error) {
      toast.error("Failed to load integrations", { description: errorMessage(error) });
    } finally {
      setIsLoadingIntegrations(false);
    }
  }, []);

  const loadSettings = useCallback(async () => {
    setIsLoadingSettings(true);
    try {
      const [settingsRes] = await Promise.all([
        apiClient.get("/system-settings"),
        loadBackupHistory(),
      ]);
      const merged = mergeSettings(settingsRes.data?.data ?? settingsRes.data);
      setSaved(merged);
      setDraft(merged);
    } catch (error) {
      toast.error("Failed to load system settings", { description: errorMessage(error) });
    } finally {
      setIsLoadingSettings(false);
    }
  }, [loadBackupHistory]);

  useEffect(() => {
    void loadSettings();
    void loadIntegrations();
    void loadDepartments();
    void loadSystemUsers();
    void loadRoles();
  }, [loadIntegrations, loadSettings, loadDepartments, loadSystemUsers, loadRoles]);

  const hasUnsavedChanges = useMemo(
    () => JSON.stringify(saved) !== JSON.stringify(draft),
    [saved, draft],
  );

  const saveDraft = async () => {
    setIsSaving(true);
    try {
      await Promise.all([
        apiClient.patch("/system-settings/general", draft.general),
        apiClient.patch("/system-settings/notifications", draft.notifications),
        apiClient.patch("/system-settings/security", draft.security),
        apiClient.patch("/system-settings/backup", draft.backup),
        apiClient.patch("/system-settings/brand", draft.brand),
        apiClient.patch("/system-settings/mobile-access", draft.mobileAccess),
      ]);
      setSaved(draft);
      toast.success("Settings saved", {
        description: "Settings were persisted to backend storage.",
      });
    } catch (error) {
      toast.error("Failed to save settings", { description: errorMessage(error) });
    } finally {
      setIsSaving(false);
    }
  };

  const resetDraft = () => {
    setDraft(saved);
    toast.success("Changes discarded", { description: "Draft settings were reset to the last saved values." });
  };

  const checkBackend = useCallback(async () => {
    setIsCheckingBackend(true);
    try {
      const [summaryRes, notificationsRes] = await Promise.all([
        apiClient.get("/dashboard/summary"),
        apiClient.get("/notifications/admin/all", { params: { page: 1, limit: 1 } }),
      ]);

      setDiagnostics((prev) => ({
        ...prev,
        checkedAt: new Date().toISOString(),
        backendApiOk: !!summaryRes.data,
        notificationsAdminOk: Array.isArray(notificationsRes.data?.data),
        backendError: undefined,
      }));

      toast.success("Backend diagnostics passed", {
        description: "Dashboard and notifications admin endpoints are reachable.",
      });
    } catch (error) {
      const msg = errorMessage(error);
      setDiagnostics((prev) => ({
        ...prev,
        checkedAt: new Date().toISOString(),
        backendApiOk: false,
        notificationsAdminOk: false,
        backendError: msg,
      }));
      toast.error("Backend diagnostics failed", { description: msg });
    } finally {
      setIsCheckingBackend(false);
    }
  }, []);

  const createLocalBackup = async () => {
    setIsCreatingBackup(true);
    try {
      const response = await apiClient.post("/system-settings/backup/create", {
        label: `Admin UI backup ${new Date().toISOString().slice(0, 19)}`,
      });
      await loadBackupHistory();
      toast.success("Settings backup created", {
        description: response.data?.data?.label ?? "Backend snapshot stored successfully.",
      });
    } catch (error) {
      toast.error("Failed to create settings backup", { description: errorMessage(error) });
    } finally {
      setIsCreatingBackup(false);
    }
  };

  const uploadBrandLogo = async (file: File) => {
    const form = new FormData();
    form.append("file", file);
    const response = await apiClient.post("/files/upload/brand-logo", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    const fileId = response.data?.id;
    if (!fileId) throw new Error("Brand logo upload did not return file id");
    setDraft((s) => ({ ...s, brand: { ...s.brand, logoFileId: String(fileId) } }));
    toast.success("Brand logo uploaded", { description: `File ID: ${String(fileId).slice(0, 8)}...` });
  };

  const restoreFromBackupFile = async (file: File) => {
    setIsRestoring(true);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const incoming = parsed?.settings ?? parsed;
      const response = await apiClient.post("/system-settings/backup/import", {
        snapshot: incoming,
      });
      const merged = mergeSettings(response.data?.data ?? incoming);
      setSaved(merged);
      setDraft(merged);
      await loadBackupHistory();
      toast.success("Backup imported", {
        description: "Settings were restored from JSON snapshot and saved to backend.",
      });
    } catch (error) {
      toast.error("Failed to restore backup", { description: errorMessage(error) });
    } finally {
      setIsRestoring(false);
    }
  };

  const restoreStoredBackup = async (backupId: string) => {
    setRestoringBackupId(backupId);
    try {
      const response = await apiClient.post("/system-settings/backup/restore", { backupId });
      const merged = mergeSettings(response.data?.data ?? response.data);
      setSaved(merged);
      setDraft(merged);
      await loadBackupHistory();
      toast.success("Backup restored", { description: "Stored backup snapshot restored successfully." });
    } catch (error) {
      toast.error("Failed to restore stored backup", { description: errorMessage(error) });
    } finally {
      setRestoringBackupId(null);
    }
  };

  const saveIntegration = async (
    provider: "smtp" | "smsOtp" | "fcm" | "s3",
    payload: Record<string, unknown>,
  ) => {
    setSavingIntegration(provider);
    try {
      await apiClient.patch(`/system-settings/integrations/${provider}`, payload);
      await loadIntegrations();
      toast.success(`${provider.toUpperCase()} settings saved`);
    } catch (error) {
      toast.error(`Failed to save ${provider} settings`, {
        description: errorMessage(error),
      });
    } finally {
      setSavingIntegration(null);
    }
  };

  const testIntegration = async (
    provider: "smtp" | "smsOtp" | "fcm" | "s3",
    payload: Record<string, unknown> = {},
  ) => {
    setTestingIntegration(provider);
    try {
      const response = await apiClient.post(
        `/system-settings/integrations/${provider}/test`,
        payload,
      );
      const result = response.data ?? {};
      const ok = String(result.status ?? "").toUpperCase() === "PASS";
      if (ok) {
        toast.success(`${provider.toUpperCase()} test passed`, {
          description: result.message ?? "Provider test succeeded",
        });
      } else {
        toast.error(`${provider.toUpperCase()} test failed`, {
          description: result.message ?? "Provider test failed",
        });
      }
      await loadIntegrations();
    } catch (error) {
      toast.error(`Failed to test ${provider}`, { description: errorMessage(error) });
    } finally {
      setTestingIntegration(null);
    }
  };

  const providerReadiness = useMemo(
    () => [
      { label: "In-App Notifications", ready: true, note: "Supported in backend" },
      { label: "Email (SMTP)", ready: draft.notifications.enableEmail, note: "Requires SMTP envs (or mock mode) in backend" },
      { label: "OTP (Firebase Auth)", ready: draft.notifications.enableSms, note: "Uses Firebase ID token verification (client-side phone auth)." },
      { label: "Push (FCM)", ready: draft.notifications.enablePush, note: "Backend supports FCM/mock; requires device tokens + provider config" },
    ],
    [draft.notifications.enableEmail, draft.notifications.enablePush, draft.notifications.enableSms],
  );

  const settingsTabTriggerClass =
    "relative flex items-center gap-1.5 rounded-none border-b-2 border-transparent px-4 py-3 text-[13px] font-medium text-[#64748B] transition-colors duration-150 hover:text-[#1E293B] data-[state=active]:border-[#0F172A] data-[state=active]:text-[#0F172A] data-[state=active]:font-semibold";

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-[#1E293B]">System Settings</h1>
            {hasUnsavedChanges ? (
              <span className="rounded-full border border-[#FDE68A] bg-[#FFFBEB] px-2 py-0.5 text-[10px] font-semibold text-[#B45309]">
                Unsaved changes
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 text-sm text-[#64748B]">
            Manage backend-backed configuration, integrations, access policies, and system health.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={resetDraft} disabled={!hasUnsavedChanges || isSaving} className="rounded-lg">
            Cancel
          </Button>
          <Button
            size="sm"
            className="rounded-lg bg-[#0F172A] text-white hover:bg-[#1E293B]"
            onClick={() => void saveDraft()}
            disabled={isSaving || isLoadingSettings}
          >
            <Save className="w-3.5 h-3.5 mr-1.5" />
            {isLoadingSettings ? "Loading..." : isSaving ? "Saving..." : "Save Settings"}
          </Button>
        </div>
      </div>

      {/* Runtime Diagnostics */}
      <Card className="overflow-hidden rounded-xl border border-[#E2E8F0] shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
        <div className="flex flex-col gap-3 border-b border-[#F1F5F9] px-5 py-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#F8FAFC]">
              <LinkIcon className="h-3.5 w-3.5 text-[#64748B]" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[#1E293B]">Runtime Diagnostics</h3>
              <p className="text-[11px] text-[#94A3B8]">Live connectivity checks for backend endpoints</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => void checkBackend()} disabled={isCheckingBackend} className="rounded-lg">
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isCheckingBackend ? "animate-spin" : ""}`} />
            {isCheckingBackend ? "Checking..." : "Check Now"}
          </Button>
        </div>
        <div className="grid grid-cols-1 divide-y divide-[#F8FAFC] md:grid-cols-3 md:divide-x md:divide-y-0">
          <div className="flex items-center gap-3 px-5 py-4">
            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${diagnostics.backendApiOk ? "bg-[#ECFDF5]" : diagnostics.checkedAt ? "bg-[#FEF2F2]" : "bg-[#F8FAFC]"}`}>
              {diagnostics.backendApiOk
                ? <CheckCircle className="w-4 h-4 text-[#10B981]" />
                : diagnostics.checkedAt
                ? <XCircle className="w-4 h-4 text-[#EF4444]" />
                : <RefreshCw className="w-4 h-4 text-[#94A3B8]" />}
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-[#94A3B8]">Backend API</p>
              <p className={`text-sm font-semibold ${diagnostics.backendApiOk ? "text-[#10B981]" : diagnostics.checkedAt ? "text-[#EF4444]" : "text-[#94A3B8]"}`}>
                {diagnostics.backendApiOk ? "Reachable" : diagnostics.checkedAt ? "Failed" : "Not checked"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 px-5 py-4">
            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${diagnostics.notificationsAdminOk ? "bg-[#ECFDF5]" : diagnostics.checkedAt ? "bg-[#FEF2F2]" : "bg-[#F8FAFC]"}`}>
              {diagnostics.notificationsAdminOk
                ? <CheckCircle className="w-4 h-4 text-[#10B981]" />
                : diagnostics.checkedAt
                ? <XCircle className="w-4 h-4 text-[#EF4444]" />
                : <Bell className="w-4 h-4 text-[#94A3B8]" />}
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-[#94A3B8]">Notifications</p>
              <p className={`text-sm font-semibold ${diagnostics.notificationsAdminOk ? "text-[#10B981]" : diagnostics.checkedAt ? "text-[#EF4444]" : "text-[#94A3B8]"}`}>
                {diagnostics.notificationsAdminOk ? "Reachable" : diagnostics.checkedAt ? "Failed" : "Not checked"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 px-5 py-4">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#F8FAFC]">
              <Database className="w-4 h-4 text-[#94A3B8]" />
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-[#94A3B8]">Last Checked</p>
              <p className="text-sm font-semibold text-[#1E293B]">{diagnostics.checkedAt ? formatDateTime(diagnostics.checkedAt) : "—"}</p>
            </div>
          </div>
        </div>
        {diagnostics.backendError ? (
          <div className="mx-5 mb-4 rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-sm text-[#991B1B]">
            {diagnostics.backendError}
          </div>
        ) : null}
      </Card>

      <Tabs defaultValue="general" className="w-full">
        <div className="overflow-x-auto rounded-xl border border-[#E2E8F0] bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
          <TabsList className="flex h-auto w-full min-w-max justify-start gap-0 rounded-none bg-transparent p-0">
            <TabsTrigger value="general" className={settingsTabTriggerClass}><Settings className="w-3.5 h-3.5" />General</TabsTrigger>
            <TabsTrigger value="brand" className={settingsTabTriggerClass}><Palette className="w-3.5 h-3.5" />Brand</TabsTrigger>
            <div className="my-3 w-px bg-[#F1F5F9]" />
            <TabsTrigger value="notifications" className={settingsTabTriggerClass}><Bell className="w-3.5 h-3.5" />Notifications</TabsTrigger>
            <div className="my-3 w-px bg-[#F1F5F9]" />
            <TabsTrigger value="integrations" className={settingsTabTriggerClass}><Plug className="w-3.5 h-3.5" />Integrations</TabsTrigger>
            <TabsTrigger value="backup" className={settingsTabTriggerClass}><Database className="w-3.5 h-3.5" />Backup</TabsTrigger>
            <div className="my-3 w-px bg-[#F1F5F9]" />
            <TabsTrigger value="security" className={settingsTabTriggerClass}><Shield className="w-3.5 h-3.5" />Security</TabsTrigger>
            <TabsTrigger value="mobile-access" className={settingsTabTriggerClass}><Shield className="w-3.5 h-3.5" />Mobile Access</TabsTrigger>
            <div className="my-3 w-px bg-[#F1F5F9]" />
            <TabsTrigger value="departments" className={settingsTabTriggerClass}><Settings className="w-3.5 h-3.5" />Departments</TabsTrigger>
            <TabsTrigger value="users" className={settingsTabTriggerClass}><Users className="w-3.5 h-3.5" />System Users</TabsTrigger>
            <TabsTrigger value="roles" className={settingsTabTriggerClass}><Shield className="w-3.5 h-3.5" />Roles & Permissions</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="general" className="mt-4">
          <Card className="p-6 space-y-4">
            <h3 className="text-[#1E293B]">General & Regional</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Company Name</Label>
                <Input value={draft.general.companyName} onChange={(e) => setDraft((s) => ({ ...s, general: { ...s.general, companyName: e.target.value } }))} />
              </div>
              <div className="space-y-2">
                <Label>Time Zone</Label>
                <Input value={draft.general.timezone} onChange={(e) => setDraft((s) => ({ ...s, general: { ...s.general, timezone: e.target.value } }))} />
              </div>
              <div className="space-y-2">
                <Label>Currency</Label>
                <Input value={draft.general.currency} onChange={(e) => setDraft((s) => ({ ...s, general: { ...s.general, currency: e.target.value } }))} />
              </div>
              <div className="space-y-2">
                <Label>Date Format</Label>
                <Input value={draft.general.dateFormat} onChange={(e) => setDraft((s) => ({ ...s, general: { ...s.general, dateFormat: e.target.value } }))} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Default Language</Label>
                <Input value={draft.general.defaultLanguage} onChange={(e) => setDraft((s) => ({ ...s, general: { ...s.general, defaultLanguage: e.target.value } }))} />
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="mt-4">
          <Card className="p-6 space-y-6">
            <h3 className="text-[#1E293B]">Notification Settings (Demo Config)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Email From</Label>
                <Input value={draft.notifications.emailFrom} onChange={(e) => setDraft((s) => ({ ...s, notifications: { ...s.notifications, emailFrom: e.target.value } }))} />
              </div>
              <div className="space-y-2">
                <Label>SMS Sender</Label>
                <Input value={draft.notifications.smsSender} onChange={(e) => setDraft((s) => ({ ...s, notifications: { ...s.notifications, smsSender: e.target.value } }))} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Push Topic</Label>
                <Input value={draft.notifications.pushTopic} onChange={(e) => setDraft((s) => ({ ...s, notifications: { ...s.notifications, pushTopic: e.target.value } }))} />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Email Template</Label>
                <Textarea rows={6} value={draft.notifications.emailTemplate} onChange={(e) => setDraft((s) => ({ ...s, notifications: { ...s.notifications, emailTemplate: e.target.value } }))} />
              </div>
              <div className="space-y-2">
                <Label>SMS Template</Label>
                <Textarea rows={6} value={draft.notifications.smsTemplate} onChange={(e) => setDraft((s) => ({ ...s, notifications: { ...s.notifications, smsTemplate: e.target.value } }))} />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center justify-between rounded-lg border p-3"><span>Enable In-App</span><Switch checked={draft.notifications.enableInApp} onCheckedChange={(v: boolean) => setDraft((s) => ({ ...s, notifications: { ...s.notifications, enableInApp: v === true } }))} /></div>
              <div className="flex items-center justify-between rounded-lg border p-3"><span>Enable Email</span><Switch checked={draft.notifications.enableEmail} onCheckedChange={(v: boolean) => setDraft((s) => ({ ...s, notifications: { ...s.notifications, enableEmail: v === true } }))} /></div>
              <div className="flex items-center justify-between rounded-lg border p-3"><span>Enable SMS</span><Switch checked={draft.notifications.enableSms} onCheckedChange={(v: boolean) => setDraft((s) => ({ ...s, notifications: { ...s.notifications, enableSms: v === true } }))} /></div>
              <div className="flex items-center justify-between rounded-lg border p-3"><span>Enable Push</span><Switch checked={draft.notifications.enablePush} onCheckedChange={(v: boolean) => setDraft((s) => ({ ...s, notifications: { ...s.notifications, enablePush: v === true } }))} /></div>
            </div>
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-[#1E293B]">Provider Readiness Checklist</h4>
              <div className="space-y-2">
                {providerReadiness.map((item) => (
                  <div key={item.label} className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <div className="text-sm text-[#1E293B]">{item.label}</div>
                      <div className="text-xs text-[#64748B]">{item.note}</div>
                    </div>
                    <div className={`text-xs px-2 py-1 rounded ${item.ready ? "bg-[#DCFCE7] text-[#166534]" : "bg-[#FEF2F2] text-[#991B1B]"}`}>
                      {item.ready ? "Configured" : "Needs Backend"}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="integrations" className="mt-4">
          <Card className="p-6 space-y-6">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="text-[#1E293B]">Integrations (Fallback First)</h3>
                <p className="text-sm text-[#64748B]">
                  Configure providers gradually. If a provider is disabled/not configured, backend falls back without breaking core flows.
                </p>
              </div>
              <Button variant="outline" onClick={() => void loadIntegrations()} disabled={isLoadingIntegrations}>
                <RefreshCw className={`w-4 h-4 mr-2 ${isLoadingIntegrations ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>

            <div className="space-y-4">
              <div className="rounded-xl border p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-semibold text-[#1E293B]">SMTP Mail</h4>
                    <p className="text-xs text-[#64748B]">Credentials for transactional emails and notifications.</p>
                  </div>
                  <div className={`text-xs px-2 py-1 rounded ${integrations.smtp.configured ? "bg-[#DCFCE7] text-[#166534]" : "bg-[#FEF2F2] text-[#991B1B]"}`}>
                    {integrations.smtp.configured ? "Configured" : "Not Configured"}
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <span className="text-sm">Enable SMTP</span>
                  <Switch
                    checked={integrations.smtp.enabled}
                    onCheckedChange={(v: boolean) =>
                      setIntegrations((s) => ({
                        ...s,
                        smtp: { ...s.smtp, enabled: v === true },
                      }))
                    }
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Input placeholder="Host" value={integrations.smtp.host} onChange={(e) => setIntegrations((s) => ({ ...s, smtp: { ...s.smtp, host: e.target.value } }))} />
                  <Input placeholder="Port" type="number" value={String(integrations.smtp.port || 587)} onChange={(e) => setIntegrations((s) => ({ ...s, smtp: { ...s.smtp, port: Number(e.target.value || 587) } }))} />
                  <Input placeholder="Username" value={integrations.smtp.username} onChange={(e) => setIntegrations((s) => ({ ...s, smtp: { ...s.smtp, username: e.target.value } }))} />
                  <Input placeholder="Password" type="password" value={integrations.smtp.password} onChange={(e) => setIntegrations((s) => ({ ...s, smtp: { ...s.smtp, password: e.target.value } }))} />
                  <Input placeholder="From Email" value={integrations.smtp.fromEmail} onChange={(e) => setIntegrations((s) => ({ ...s, smtp: { ...s.smtp, fromEmail: e.target.value } }))} />
                  <Input placeholder="From Name" value={integrations.smtp.fromName} onChange={(e) => setIntegrations((s) => ({ ...s, smtp: { ...s.smtp, fromName: e.target.value } }))} />
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" disabled={testingIntegration === "smtp"} onClick={() => void testIntegration("smtp", integrations.smtp as unknown as Record<string, unknown>)}>
                    {testingIntegration === "smtp" ? "Testing..." : "Test SMTP"}
                  </Button>
                  <Button disabled={savingIntegration === "smtp"} onClick={() => void saveIntegration("smtp", integrations.smtp as unknown as Record<string, unknown>)}>
                    {savingIntegration === "smtp" ? "Saving..." : "Save SMTP"}
                  </Button>
                </div>
              </div>

              <div className="rounded-xl border p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-semibold text-[#1E293B]">OTP Verification (Firebase Auth)</h4>
                    <p className="text-xs text-[#64748B]">Phone OTP is verified via Firebase ID token. SMS transport from dashboard is disabled.</p>
                  </div>
                  <div className={`text-xs px-2 py-1 rounded ${integrations.smsOtp.configured ? "bg-[#DCFCE7] text-[#166534]" : "bg-[#FEF2F2] text-[#991B1B]"}`}>
                    {integrations.smsOtp.configured ? "Configured" : "Not Configured"}
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <span className="text-sm">Enable Firebase OTP Verification</span>
                  <Switch
                    checked={integrations.smsOtp.enabled}
                    onCheckedChange={(v: boolean) =>
                      setIntegrations((s) => ({
                        ...s,
                        smsOtp: { ...s.smsOtp, enabled: v === true },
                      }))
                    }
                  />
                </div>
                <div className="grid grid-cols-1 gap-3">
                  <Input
                    placeholder="Firebase Project ID (optional override)"
                    value={integrations.smsOtp.firebaseProjectId}
                    onChange={(e) =>
                      setIntegrations((s) => ({
                        ...s,
                        smsOtp: { ...s.smsOtp, firebaseProjectId: e.target.value },
                      }))
                    }
                  />
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" disabled={testingIntegration === "smsOtp"} onClick={() => void testIntegration("smsOtp", integrations.smsOtp as unknown as Record<string, unknown>)}>
                    {testingIntegration === "smsOtp" ? "Testing..." : "Test OTP"}
                  </Button>
                  <Button disabled={savingIntegration === "smsOtp"} onClick={() => void saveIntegration("smsOtp", integrations.smsOtp as unknown as Record<string, unknown>)}>
                    {savingIntegration === "smsOtp" ? "Saving..." : "Save OTP"}
                  </Button>
                </div>
              </div>

              <div className="rounded-xl border p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-semibold text-[#1E293B]">FCM Push</h4>
                    <p className="text-xs text-[#64748B]">Android push notifications. Disable to keep polling-only mode in mobile.</p>
                  </div>
                  <div className={`text-xs px-2 py-1 rounded ${integrations.fcm.configured ? "bg-[#DCFCE7] text-[#166534]" : "bg-[#FEF2F2] text-[#991B1B]"}`}>
                    {integrations.fcm.configured ? "Configured" : "Not Configured"}
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <span className="text-sm">Enable Push</span>
                  <Switch
                    checked={integrations.fcm.enabled}
                    onCheckedChange={(v: boolean) =>
                      setIntegrations((s) => ({
                        ...s,
                        fcm: { ...s.fcm, enabled: v === true },
                      }))
                    }
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Input placeholder="Project ID" value={integrations.fcm.projectId} onChange={(e) => setIntegrations((s) => ({ ...s, fcm: { ...s.fcm, projectId: e.target.value } }))} />
                  <Input placeholder="Client Email" value={integrations.fcm.clientEmail} onChange={(e) => setIntegrations((s) => ({ ...s, fcm: { ...s.fcm, clientEmail: e.target.value } }))} />
                  <Textarea className="md:col-span-2" rows={4} placeholder="Service Account JSON (optional)" value={integrations.fcm.serviceAccountJson} onChange={(e) => setIntegrations((s) => ({ ...s, fcm: { ...s.fcm, serviceAccountJson: e.target.value } }))} />
                  <Textarea className="md:col-span-2" rows={3} placeholder="Private Key (optional if JSON provided)" value={integrations.fcm.privateKey} onChange={(e) => setIntegrations((s) => ({ ...s, fcm: { ...s.fcm, privateKey: e.target.value } }))} />
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" disabled={testingIntegration === "fcm"} onClick={() => void testIntegration("fcm", integrations.fcm as unknown as Record<string, unknown>)}>
                    {testingIntegration === "fcm" ? "Testing..." : "Test FCM"}
                  </Button>
                  <Button disabled={savingIntegration === "fcm"} onClick={() => void saveIntegration("fcm", integrations.fcm as unknown as Record<string, unknown>)}>
                    {savingIntegration === "fcm" ? "Saving..." : "Save FCM"}
                  </Button>
                </div>
              </div>

              <div className="rounded-xl border p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-semibold text-[#1E293B]">Storage Provider</h4>
                    <p className="text-xs text-[#64748B]">Local fallback is always available. Switch to S3/Supabase when ready.</p>
                  </div>
                  <div className={`text-xs px-2 py-1 rounded ${integrations.s3.configured ? "bg-[#DCFCE7] text-[#166534]" : "bg-[#FEF2F2] text-[#991B1B]"}`}>
                    {integrations.s3.configured ? "Configured" : "Not Configured"}
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Provider</Label>
                    <select
                      className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                      value={integrations.s3.provider}
                      onChange={(e) =>
                        setIntegrations((s) => ({
                          ...s,
                          s3: { ...s.s3, provider: e.target.value as IntegrationsState["s3"]["provider"] },
                        }))
                      }
                    >
                      <option value="LOCAL">LOCAL</option>
                      <option value="S3">S3</option>
                      <option value="SUPABASE">SUPABASE</option>
                    </select>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border p-3 mt-7">
                    <span className="text-sm">Enable External Storage</span>
                    <Switch
                      checked={integrations.s3.enabled}
                      onCheckedChange={(v: boolean) =>
                        setIntegrations((s) => ({
                          ...s,
                          s3: { ...s.s3, enabled: v === true },
                        }))
                      }
                    />
                  </div>
                  <Input placeholder="Bucket" value={integrations.s3.bucket} onChange={(e) => setIntegrations((s) => ({ ...s, s3: { ...s.s3, bucket: e.target.value } }))} />
                  <Input placeholder="Region" value={integrations.s3.region} onChange={(e) => setIntegrations((s) => ({ ...s, s3: { ...s.s3, region: e.target.value } }))} />
                  <Input placeholder="Endpoint (optional)" value={integrations.s3.endpoint} onChange={(e) => setIntegrations((s) => ({ ...s, s3: { ...s.s3, endpoint: e.target.value } }))} />
                  <Input placeholder="Access Key ID" value={integrations.s3.accessKeyId} onChange={(e) => setIntegrations((s) => ({ ...s, s3: { ...s.s3, accessKeyId: e.target.value } }))} />
                  <Input placeholder="Secret Access Key" type="password" value={integrations.s3.secretAccessKey} onChange={(e) => setIntegrations((s) => ({ ...s, s3: { ...s.s3, secretAccessKey: e.target.value } }))} />
                  <Input placeholder="Supabase URL (if provider=SUPABASE)" value={integrations.s3.supabaseUrl} onChange={(e) => setIntegrations((s) => ({ ...s, s3: { ...s.s3, supabaseUrl: e.target.value } }))} />
                  <Input className="md:col-span-2" placeholder="Supabase Service Role Key (if provider=SUPABASE)" type="password" value={integrations.s3.supabaseServiceRoleKey} onChange={(e) => setIntegrations((s) => ({ ...s, s3: { ...s.s3, supabaseServiceRoleKey: e.target.value } }))} />
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" disabled={testingIntegration === "s3"} onClick={() => void testIntegration("s3", integrations.s3 as unknown as Record<string, unknown>)}>
                    {testingIntegration === "s3" ? "Testing..." : "Test Storage"}
                  </Button>
                  <Button disabled={savingIntegration === "s3"} onClick={() => void saveIntegration("s3", integrations.s3 as unknown as Record<string, unknown>)}>
                    {savingIntegration === "s3" ? "Saving..." : "Save Storage"}
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="brand" className="mt-4">
          <Card className="p-6 space-y-6">
            <h3 className="text-[#1E293B]">Brand (White Label)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Company Name</Label>
                <Input value={draft.brand.companyName} onChange={(e) => setDraft((s) => ({ ...s, brand: { ...s.brand, companyName: e.target.value } }))} />
              </div>
              <div className="space-y-2">
                <Label>App Display Name</Label>
                <Input value={draft.brand.appDisplayName} onChange={(e) => setDraft((s) => ({ ...s, brand: { ...s.brand, appDisplayName: e.target.value } }))} />
              </div>
              <div className="space-y-2">
                <Label>Primary Color</Label>
                <Input value={draft.brand.primaryColor} onChange={(e) => setDraft((s) => ({ ...s, brand: { ...s.brand, primaryColor: e.target.value } }))} />
              </div>
              <div className="space-y-2">
                <Label>Secondary Color</Label>
                <Input value={draft.brand.secondaryColor} onChange={(e) => setDraft((s) => ({ ...s, brand: { ...s.brand, secondaryColor: e.target.value } }))} />
              </div>
              <div className="space-y-2">
                <Label>Accent Color</Label>
                <Input value={draft.brand.accentColor} onChange={(e) => setDraft((s) => ({ ...s, brand: { ...s.brand, accentColor: e.target.value } }))} />
              </div>
              <div className="space-y-2">
                <Label>Tagline</Label>
                <Input value={draft.brand.tagline} onChange={(e) => setDraft((s) => ({ ...s, brand: { ...s.brand, tagline: e.target.value } }))} />
              </div>
              <div className="space-y-2">
                <Label>Support Email</Label>
                <Input value={draft.brand.supportEmail} onChange={(e) => setDraft((s) => ({ ...s, brand: { ...s.brand, supportEmail: e.target.value } }))} />
              </div>
              <div className="space-y-2">
                <Label>Support Phone</Label>
                <Input value={draft.brand.supportPhone} onChange={(e) => setDraft((s) => ({ ...s, brand: { ...s.brand, supportPhone: e.target.value } }))} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Logo File ID</Label>
                <div className="flex flex-col md:flex-row gap-2">
                  <Input value={draft.brand.logoFileId} onChange={(e) => setDraft((s) => ({ ...s, brand: { ...s.brand, logoFileId: e.target.value } }))} />
                  <label className="inline-flex">
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/jpg"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        try {
                          await uploadBrandLogo(file);
                        } catch (error) {
                          toast.error("Brand logo upload failed", { description: errorMessage(error) });
                        } finally {
                          e.currentTarget.value = "";
                        }
                      }}
                    />
                    <Button type="button" variant="outline" className="w-full md:w-auto">
                      <Upload className="w-4 h-4 mr-2" />
                      Upload Logo
                    </Button>
                  </label>
                </div>
              </div>
            </div>

            <div className="rounded-xl border p-4 space-y-3">
              <div className="text-sm font-medium text-[#1E293B]">Mobile Preview</div>
              <div
                className="rounded-2xl p-4 text-white"
                style={{
                  background: `linear-gradient(135deg, ${draft.brand.primaryColor || "#2A3E35"}, ${draft.brand.secondaryColor || "#C9A961"})`,
                }}
              >
                <div className="text-xs opacity-80">Welcome to</div>
                <div className="text-lg font-semibold">
                  {draft.brand.appDisplayName || draft.brand.companyName || "Community App"}
                </div>
                <div className="text-xs opacity-80 mt-1">{draft.brand.tagline || "Smart Living"}</div>
                <div className="mt-3 inline-flex rounded-full bg-white/90 px-3 py-1 text-xs font-medium" style={{ color: draft.brand.primaryColor || "#2A3E35" }}>
                  Primary CTA
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="mobile-access" className="mt-4">
          <Card className="p-6 space-y-6">
            <div>
              <h3 className="text-[#1E293B]">Mobile Access Policies</h3>
              <p className="text-sm text-[#64748B] mt-1">
                Control mobile features per persona. Changes are applied in the mobile bootstrap response.
              </p>
            </div>

            <div className="space-y-4">
              {mobileAccessPersonaCatalog.map((persona) => (
                <div key={persona.key} className="rounded-xl border p-4 space-y-4">
                  <div>
                    <h4 className="text-sm font-semibold text-[#1E293B]">{persona.label}</h4>
                    <p className="text-xs text-[#64748B]">{persona.hint}</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {mobileAccessFeatureCatalog.map((feature) => {
                      const enabled = Boolean(draft.mobileAccess[persona.key]?.[feature.key]);
                      return (
                        <div
                          key={`${persona.key}-${feature.key}`}
                          className="flex items-center justify-between rounded-lg border px-3 py-2 gap-3"
                        >
                          <div>
                            <div className="text-sm text-[#1E293B]">{feature.label}</div>
                            <div className="text-xs text-[#64748B]">{feature.hint}</div>
                          </div>
                          <Switch
                            checked={enabled}
                            onCheckedChange={(v: boolean) =>
                              setMobileAccessFlag(persona.key, feature.key, v === true)
                            }
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="mt-4">
          <div className="space-y-4">
            {/* Authentication */}
            <Card className="overflow-hidden rounded-xl border border-[#E2E8F0] shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
              <div className="flex items-center gap-2 border-b border-[#F1F5F9] px-5 py-4">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#EEF2FF]">
                  <Shield className="h-3.5 w-3.5 text-[#4338CA]" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-[#1E293B]">Authentication</h3>
                  <p className="text-[11px] text-[#94A3B8]">Login, session, and multi-factor policies</p>
                </div>
              </div>
              <div className="divide-y divide-[#F8FAFC]">
                <div className="flex items-center justify-between px-5 py-3.5">
                  <div>
                    <p className="text-sm font-medium text-[#1E293B]">Enforce Two-Factor Authentication</p>
                    <p className="text-[11px] text-[#94A3B8]">Require 2FA for all admin accounts</p>
                  </div>
                  <Switch checked={draft.security.enforce2fa} onCheckedChange={(v: boolean) => setDraft((s) => ({ ...s, security: { ...s.security, enforce2fa: v === true } }))} />
                </div>
                <div className="flex items-center justify-between px-5 py-3.5">
                  <div>
                    <p className="text-sm font-medium text-[#1E293B]">Auto Logout on Inactivity</p>
                    <p className="text-[11px] text-[#94A3B8]">Automatically sign out idle sessions</p>
                  </div>
                  <Switch checked={draft.security.autoLogoutEnabled} onCheckedChange={(v: boolean) => setDraft((s) => ({ ...s, security: { ...s.security, autoLogoutEnabled: v === true } }))} />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 border-t border-[#F8FAFC] px-5 py-4 md:grid-cols-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-[#64748B] uppercase tracking-wide">Session Timeout</Label>
                  <div className="flex items-center gap-2">
                    <Input type="number" className="rounded-lg" value={String(draft.security.sessionTimeoutMinutes)} onChange={(e) => setDraft((s) => ({ ...s, security: { ...s.security, sessionTimeoutMinutes: Number(e.target.value || 0) } }))} />
                    <span className="shrink-0 text-sm text-[#94A3B8]">min</span>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-[#64748B] uppercase tracking-wide">Concurrent Sessions</Label>
                  <Input type="number" className="rounded-lg" value={String(draft.security.allowConcurrentSessions)} onChange={(e) => setDraft((s) => ({ ...s, security: { ...s.security, allowConcurrentSessions: Number(e.target.value || 1) } }))} />
                </div>
              </div>
            </Card>

            {/* Password Policy */}
            <Card className="overflow-hidden rounded-xl border border-[#E2E8F0] shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
              <div className="flex items-center gap-2 border-b border-[#F1F5F9] px-5 py-4">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#FFF7ED]">
                  <Shield className="h-3.5 w-3.5 text-[#C2410C]" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-[#1E293B]">Password & Brute-Force Policy</h3>
                  <p className="text-[11px] text-[#94A3B8]">Strength requirements and account lockout rules</p>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 px-5 py-4 md:grid-cols-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-[#64748B] uppercase tracking-wide">Min Password Length</Label>
                  <div className="flex items-center gap-2">
                    <Input type="number" className="rounded-lg" value={String(draft.security.minPasswordLength)} onChange={(e) => setDraft((s) => ({ ...s, security: { ...s.security, minPasswordLength: Number(e.target.value || 0) } }))} />
                    <span className="shrink-0 text-sm text-[#94A3B8]">chars</span>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-[#64748B] uppercase tracking-wide">Max Login Attempts</Label>
                  <Input type="number" className="rounded-lg" value={String(draft.security.maxLoginAttempts)} onChange={(e) => setDraft((s) => ({ ...s, security: { ...s.security, maxLoginAttempts: Number(e.target.value || 0) } }))} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-[#64748B] uppercase tracking-wide">Lockout Duration</Label>
                  <div className="flex items-center gap-2">
                    <Input type="number" className="rounded-lg" value={String(draft.security.lockoutDurationMinutes)} onChange={(e) => setDraft((s) => ({ ...s, security: { ...s.security, lockoutDurationMinutes: Number(e.target.value || 0) } }))} />
                    <span className="shrink-0 text-sm text-[#94A3B8]">min</span>
                  </div>
                </div>
              </div>
              <div className="mx-5 mb-4 rounded-lg bg-[#FFFBEB] border border-[#FDE68A] px-4 py-3">
                <p className="text-[11px] text-[#92400E]">
                  <span className="font-semibold">Note:</span> Password hashing uses bcrypt (cost factor 10) on the backend. These settings control policy enforcement at the API layer.
                </p>
              </div>
            </Card>

            {/* Network & Logging */}
            <Card className="overflow-hidden rounded-xl border border-[#E2E8F0] shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
              <div className="flex items-center gap-2 border-b border-[#F1F5F9] px-5 py-4">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#F0FDF4]">
                  <Shield className="h-3.5 w-3.5 text-[#15803D]" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-[#1E293B]">Network & Audit</h3>
                  <p className="text-[11px] text-[#94A3B8]">Rate limiting, HTTPS enforcement, and audit trail</p>
                </div>
              </div>
              <div className="divide-y divide-[#F8FAFC]">
                <div className="flex items-center justify-between px-5 py-3.5">
                  <div>
                    <p className="text-sm font-medium text-[#1E293B]">Rate Limiting</p>
                    <p className="text-[11px] text-[#94A3B8]">Throttle API requests per client</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {draft.security.rateLimitEnabled ? (
                      <span className="text-[11px] text-[#94A3B8]">{draft.security.rateLimitPerMinute} req/min</span>
                    ) : null}
                    <Switch checked={draft.security.rateLimitEnabled} onCheckedChange={(v: boolean) => setDraft((s) => ({ ...s, security: { ...s.security, rateLimitEnabled: v === true } }))} />
                  </div>
                </div>
                {draft.security.rateLimitEnabled ? (
                  <div className="px-5 py-3.5">
                    <div className="max-w-xs space-y-1.5">
                      <Label className="text-xs font-semibold text-[#64748B] uppercase tracking-wide">Requests per Minute</Label>
                      <Input type="number" className="rounded-lg" value={String(draft.security.rateLimitPerMinute)} onChange={(e) => setDraft((s) => ({ ...s, security: { ...s.security, rateLimitPerMinute: Number(e.target.value || 0) } }))} />
                    </div>
                  </div>
                ) : null}
                <div className="flex items-center justify-between px-5 py-3.5">
                  <div>
                    <p className="text-sm font-medium text-[#1E293B]">IP Whitelist</p>
                    <p className="text-[11px] text-[#94A3B8]">Restrict access to specific IP addresses or CIDR ranges</p>
                  </div>
                  <Switch checked={draft.security.ipWhitelistEnabled} onCheckedChange={(v: boolean) => setDraft((s) => ({ ...s, security: { ...s.security, ipWhitelistEnabled: v === true } }))} />
                </div>
                {draft.security.ipWhitelistEnabled ? (
                  <div className="px-5 py-3.5 space-y-1.5">
                    <Label className="text-xs font-semibold text-[#64748B] uppercase tracking-wide">Allowed IPs / CIDRs</Label>
                    <Textarea rows={3} className="rounded-lg font-mono text-xs" placeholder="192.168.1.0/24, 10.0.0.1" value={draft.security.ipWhitelist.join(", ")} onChange={(e) => setDraft((s) => ({ ...s, security: { ...s.security, ipWhitelist: e.target.value.split(",").map((ip) => ip.trim()).filter(Boolean) } }))} />
                    <p className="text-[11px] text-[#94A3B8]">Comma-separated IPv4/IPv6 addresses or CIDR notation</p>
                  </div>
                ) : null}
                <div className="flex items-center justify-between px-5 py-3.5">
                  <div>
                    <p className="text-sm font-medium text-[#1E293B]">Audit Logging</p>
                    <p className="text-[11px] text-[#94A3B8]">Record all admin actions for compliance</p>
                  </div>
                  <Switch checked={draft.security.auditLoggingEnabled} onCheckedChange={(v: boolean) => setDraft((s) => ({ ...s, security: { ...s.security, auditLoggingEnabled: v === true } }))} />
                </div>
                <div className="flex items-center justify-between px-5 py-3.5">
                  <div>
                    <p className="text-sm font-medium text-[#1E293B]">Require HTTPS</p>
                    <p className="text-[11px] text-[#94A3B8]">Reject non-secure HTTP connections</p>
                  </div>
                  <Switch checked={draft.security.requireSecureConnections} onCheckedChange={(v: boolean) => setDraft((s) => ({ ...s, security: { ...s.security, requireSecureConnections: v === true } }))} />
                </div>
              </div>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="backup" className="mt-4">
          <Card className="p-6 space-y-6">
            <h3 className="text-[#1E293B]">Backup & Restore (Backend Snapshots)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center justify-between rounded-lg border p-3"><span>Auto Backups</span><Switch checked={draft.backup.autoBackups} onCheckedChange={(v: boolean) => setDraft((s) => ({ ...s, backup: { ...s.backup, autoBackups: v === true } }))} /></div>
              <div className="space-y-2">
                <Label>Backup Time</Label>
                <Input type="time" value={draft.backup.backupTime} onChange={(e) => setDraft((s) => ({ ...s, backup: { ...s.backup, backupTime: e.target.value } }))} />
              </div>
              <div className="space-y-2">
                <Label>Retention (days)</Label>
                <Input type="number" value={String(draft.backup.retentionDays)} onChange={(e) => setDraft((s) => ({ ...s, backup: { ...s.backup, retentionDays: Number(e.target.value || 0) } }))} />
              </div>
              <div className="rounded-lg border p-3 text-sm text-[#64748B]">
                Creates and restores backend system-settings snapshots. Optional JSON import below can also restore directly to backend.
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button className="bg-[#0B5FFF] hover:bg-[#0B5FFF]/90 text-white" onClick={() => void createLocalBackup()} disabled={isCreatingBackup}>
                <Database className="w-4 h-4 mr-2" />
                {isCreatingBackup ? "Creating Backup..." : "Create Backend Backup"}
              </Button>
              <Button variant="outline" onClick={() => restoreInputRef.current?.click()} disabled={isRestoring}>
                {isRestoring ? "Importing..." : "Import JSON Snapshot"}
              </Button>
              <Button variant="outline" onClick={() => downloadJson(`admin-system-settings-${new Date().toISOString().replace(/[:.]/g, "-")}.json`, { exportedAt: new Date().toISOString(), settings: draft })}>
                Download Draft JSON
              </Button>
              <input
                ref={restoreInputRef}
                type="file"
                accept="application/json"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    await restoreFromBackupFile(file);
                  }
                  e.currentTarget.value = "";
                }}
              />
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-[#1E293B]">Stored Backup History</h4>
                <Button variant="outline" size="sm" onClick={() => void loadBackupHistory()}>
                  Refresh History
                </Button>
              </div>
              <div className="space-y-2">
                {backupHistory.length === 0 ? (
                  <div className="rounded-lg border p-3 text-sm text-[#64748B]">No backups created yet.</div>
                ) : (
                  backupHistory.map((item) => (
                    <div key={item.id} className="rounded-lg border p-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <div className="min-w-0">
                        <div className="text-sm text-[#1E293B] truncate">{item.label || `Backup ${item.id.slice(0, 8)}`}</div>
                        <div className="text-xs text-[#64748B]">
                          Created: {formatDateTime(item.createdAt)} {item.restoredAt ? `• Last restored: ${formatDateTime(item.restoredAt)}` : ""}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <code className="text-xs text-[#64748B]">{item.id.slice(0, 8)}</code>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={restoringBackupId === item.id}
                          onClick={() => void restoreStoredBackup(item.id)}
                        >
                          {restoringBackupId === item.id ? "Restoring..." : "Restore"}
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="departments" className="mt-4">
          <Card className="p-6 space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-[#1E293B]">Departments Management</h3>
              <Button className="bg-[#0B5FFF] hover:bg-[#0B5FFF]/90 text-white" disabled={isLoadingDepartments}>
                <Plus className="w-4 h-4 mr-2" />
                New Department
              </Button>
            </div>
            <div className="space-y-2">
              {isLoadingDepartments ? (
                <div className="text-sm text-[#64748B]">Loading departments...</div>
              ) : departments.length === 0 ? (
                <div className="rounded-lg border p-4 text-center text-sm text-[#64748B]">
                  No departments created. Create your first department to organize staff.
                </div>
              ) : (
                <div className="space-y-2">
                  {departments.map((dept: any) => (
                    <div key={dept.id} className="flex items-center justify-between rounded-lg border p-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: dept.colorDot || '#94A3B8' }}
                        />
                        <div>
                          <div className="text-sm font-medium text-[#1E293B]">{dept.name}</div>
                          <div className="text-xs text-[#64748B]">{dept.code} • {dept.staffMembers?.length || 0} staff</div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm">Edit</Button>
                        <Button variant="outline" size="sm" className="text-[#EF4444]">Delete</Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="users" className="mt-4">
          <Card className="p-6 space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-[#1E293B]">System Users Management</h3>
              <Button className="bg-[#0B5FFF] hover:bg-[#0B5FFF]/90 text-white" disabled={isLoadingUsers}>
                <Plus className="w-4 h-4 mr-2" />
                New User
              </Button>
            </div>
            <div className="space-y-2">
              {isLoadingUsers ? (
                <div className="text-sm text-[#64748B]">Loading users...</div>
              ) : systemUsers.length === 0 ? (
                <div className="rounded-lg border p-4 text-center text-sm text-[#64748B]">
                  No system users created.
                </div>
              ) : (
                <div className="space-y-2">
                  {systemUsers.map((user: any) => (
                    <div key={user.id} className="flex items-center justify-between rounded-lg border p-3">
                      <div>
                        <div className="text-sm font-medium text-[#1E293B]">
                          {user.firstName} {user.lastName}
                        </div>
                        <div className="text-xs text-[#64748B]">
                          {user.email} • {user.role?.name || 'No role'} • {user.isActive ? 'Active' : 'Inactive'}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm">Edit</Button>
                        <Button variant="outline" size="sm" className="text-[#EF4444]">
                          {user.isActive ? 'Deactivate' : 'Reactivate'}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="roles" className="mt-4">
          <Card className="p-6 space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-[#1E293B]">Roles & Permissions</h3>
              <Button className="bg-[#0B5FFF] hover:bg-[#0B5FFF]/90 text-white" disabled={isLoadingRoles}>
                <Plus className="w-4 h-4 mr-2" />
                New Role
              </Button>
            </div>
            <div className="space-y-4">
              {isLoadingRoles ? (
                <div className="text-sm text-[#64748B]">Loading roles...</div>
              ) : roles.length === 0 ? (
                <div className="rounded-lg border p-4 text-center text-sm text-[#64748B]">
                  No roles created.
                </div>
              ) : (
                <div className="space-y-3">
                  {roles.map((role: any) => (
                    <div key={role.id} className="rounded-lg border p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm font-medium text-[#1E293B]">{role.name}</div>
                          {role.description && (
                            <div className="text-xs text-[#64748B]">{role.description}</div>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm">Edit</Button>
                          <Button variant="outline" size="sm" className="text-[#EF4444]">Delete</Button>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {role.permissionCodes?.slice(0, 5).map((perm: string) => (
                          <span key={perm} className="inline-block px-2 py-1 bg-[#F1F5F9] rounded text-xs text-[#475569]">
                            {perm}
                          </span>
                        ))}
                        {role.permissionCodes?.length > 5 && (
                          <span className="inline-block px-2 py-1 bg-[#F1F5F9] rounded text-xs text-[#475569]">
                            +{role.permissionCodes.length - 5} more
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </TabsContent>
        </Tabs>
        </div>
);
}
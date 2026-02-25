import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Database, Link as LinkIcon, RefreshCw, Save, Shield, Bell, Settings, CheckCircle, XCircle, Palette, Upload } from "lucide-react";
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
  };
  backup: {
    autoBackups: boolean;
    backupTime: string;
    retentionDays: number;
  };
  crm: {
    baseUrl: string;
    authToken: string;
    autoSyncResidents: boolean;
    autoSyncPayments: boolean;
    autoSyncServiceRequests: boolean;
    syncIntervalMinutes: number;
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
  crmTestOk?: boolean;
  crmStatusCode?: number;
  crmError?: string;
  crmCheckedAt?: string;
};

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
  },
  backup: {
    autoBackups: false,
    backupTime: "02:00",
    retentionDays: 30,
  },
  crm: {
    baseUrl: "",
    authToken: "",
    autoSyncResidents: true,
    autoSyncPayments: true,
    autoSyncServiceRequests: false,
    syncIntervalMinutes: 15,
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
};

function mergeSettings(parsed: any): SettingsState {
  return {
    ...defaultSettings,
    ...parsed,
    general: { ...defaultSettings.general, ...(parsed?.general ?? {}) },
    notifications: { ...defaultSettings.notifications, ...(parsed?.notifications ?? {}) },
    security: { ...defaultSettings.security, ...(parsed?.security ?? {}) },
    backup: { ...defaultSettings.backup, ...(parsed?.backup ?? {}) },
    crm: { ...defaultSettings.crm, ...(parsed?.crm ?? {}) },
    brand: { ...defaultSettings.brand, ...(parsed?.brand ?? {}) },
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
  const [backupHistory, setBackupHistory] = useState<BackupHistoryItem[]>([]);
  const [diagnostics, setDiagnostics] = useState<DiagnosticsState>({});
  const [isLoadingSettings, setIsLoadingSettings] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isCheckingBackend, setIsCheckingBackend] = useState(false);
  const [isTestingCrm, setIsTestingCrm] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isCreatingBackup, setIsCreatingBackup] = useState(false);
  const [restoringBackupId, setRestoringBackupId] = useState<string | null>(null);
  const restoreInputRef = useRef<HTMLInputElement | null>(null);

  const loadBackupHistory = useCallback(async () => {
    const response = await apiClient.get("/system-settings/backup/history", {
      params: { limit: 20 },
    });
    setBackupHistory(extractRows<BackupHistoryItem>(response.data));
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
  }, [loadSettings]);

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
        apiClient.patch("/system-settings/crm", draft.crm),
        apiClient.patch("/system-settings/brand", draft.brand),
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

  const testCrmConnection = async () => {
    if (!draft.crm.baseUrl.trim()) {
      toast.error("CRM Base URL is required");
      return;
    }
    setIsTestingCrm(true);
    try {
      const response = await apiClient.post("/system-settings/crm/test", {
        baseUrl: draft.crm.baseUrl,
        authToken: draft.crm.authToken || undefined,
      });
      const data = response.data ?? {};

      setDiagnostics((prev) => ({
        ...prev,
        crmCheckedAt: data.checkedAt ?? new Date().toISOString(),
        crmTestOk: Boolean(data.ok),
        crmStatusCode: data.statusCode ?? undefined,
        crmError: data.ok ? undefined : (data.error ?? (data.statusCode ? `HTTP ${data.statusCode}` : "Connection failed")),
      }));

      if (data.ok) {
        toast.success("CRM connection test succeeded", {
          description: `HTTP ${data.statusCode ?? "200"} from ${data.url ?? draft.crm.baseUrl}`,
        });
      } else {
        toast.error("CRM connection test failed", {
          description: data.error ?? `HTTP ${data.statusCode ?? "unknown"} from ${data.url ?? draft.crm.baseUrl}`,
        });
      }
    } catch (error) {
      const msg = errorMessage(error);
      setDiagnostics((prev) => ({
        ...prev,
        crmCheckedAt: new Date().toISOString(),
        crmTestOk: false,
        crmStatusCode: undefined,
        crmError: msg,
      }));
      toast.error("CRM connection test failed", { description: msg });
    } finally {
      setIsTestingCrm(false);
    }
  };

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

  const providerReadiness = useMemo(
    () => [
      { label: "In-App Notifications", ready: true, note: "Supported in backend" },
      { label: "Email (SMTP)", ready: draft.notifications.enableEmail, note: "Requires SMTP envs (or mock mode) in backend" },
      { label: "SMS (Twilio)", ready: draft.notifications.enableSms, note: "Backend supports Twilio/mock; requires credentials or mock mode" },
      { label: "Push (FCM)", ready: draft.notifications.enablePush, note: "Backend supports FCM/mock; requires device tokens + provider config" },
    ],
    [draft.notifications.enableEmail, draft.notifications.enablePush, draft.notifications.enableSms],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-[#1E293B]">System Settings</h1>
          <p className="text-[#64748B] mt-1">
            Backend-backed system settings with runtime diagnostics, CRM connectivity checks, and backup snapshots.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={resetDraft} disabled={!hasUnsavedChanges || isSaving}>
            Cancel
          </Button>
          <Button className="bg-[#00B386] hover:bg-[#00B386]/90 text-white" onClick={() => void saveDraft()} disabled={isSaving || isLoadingSettings}>
            <Save className="w-4 h-4 mr-2" />
            {isLoadingSettings ? "Loading..." : isSaving ? "Saving..." : "Save Settings"}
          </Button>
        </div>
      </div>

      <Card className="p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-[#1E293B]">Runtime Diagnostics</h3>
            <p className="text-sm text-[#64748B]">Checks the current backend endpoints and optional CRM base URL.</p>
          </div>
          <Button variant="outline" onClick={() => void checkBackend()} disabled={isCheckingBackend}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isCheckingBackend ? "animate-spin" : ""}`} />
            Check Backend
          </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
          <div className="rounded-lg border p-3">
            <div className="text-xs text-[#64748B]">Backend API</div>
            <div className="mt-2 flex items-center gap-2">
              {diagnostics.backendApiOk ? <CheckCircle className="w-4 h-4 text-[#10B981]" /> : <XCircle className="w-4 h-4 text-[#EF4444]" />}
              <span className="text-sm">{diagnostics.backendApiOk ? "Reachable" : "Unchecked / Failed"}</span>
            </div>
          </div>
          <div className="rounded-lg border p-3">
            <div className="text-xs text-[#64748B]">Notifications Admin</div>
            <div className="mt-2 flex items-center gap-2">
              {diagnostics.notificationsAdminOk ? <CheckCircle className="w-4 h-4 text-[#10B981]" /> : <XCircle className="w-4 h-4 text-[#EF4444]" />}
              <span className="text-sm">{diagnostics.notificationsAdminOk ? "Reachable" : "Unchecked / Failed"}</span>
            </div>
          </div>
          <div className="rounded-lg border p-3">
            <div className="text-xs text-[#64748B]">Last Backend Check</div>
            <div className="mt-2 text-sm">{formatDateTime(diagnostics.checkedAt)}</div>
          </div>
        </div>
        {diagnostics.backendError ? (
          <div className="mt-3 rounded-lg border border-[#FECACA] bg-[#FEF2F2] p-3 text-sm text-[#991B1B]">
            {diagnostics.backendError}
          </div>
        ) : null}
      </Card>

      <Tabs defaultValue="general" className="w-full">
        <TabsList className="w-full justify-start border rounded-lg p-1 bg-white overflow-x-auto">
          <TabsTrigger value="general" className="gap-2"><Settings className="w-4 h-4" />General</TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2"><Bell className="w-4 h-4" />Notifications</TabsTrigger>
          <TabsTrigger value="brand" className="gap-2"><Palette className="w-4 h-4" />Brand</TabsTrigger>
          <TabsTrigger value="security" className="gap-2"><Shield className="w-4 h-4" />Security</TabsTrigger>
          <TabsTrigger value="backup" className="gap-2"><Database className="w-4 h-4" />Backup</TabsTrigger>
          <TabsTrigger value="crm" className="gap-2"><LinkIcon className="w-4 h-4" />CRM</TabsTrigger>
        </TabsList>

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
              <div className="flex items-center justify-between rounded-lg border p-3"><span>Enable In-App</span><Switch checked={draft.notifications.enableInApp} onCheckedChange={(v) => setDraft((s) => ({ ...s, notifications: { ...s.notifications, enableInApp: v === true } }))} /></div>
              <div className="flex items-center justify-between rounded-lg border p-3"><span>Enable Email</span><Switch checked={draft.notifications.enableEmail} onCheckedChange={(v) => setDraft((s) => ({ ...s, notifications: { ...s.notifications, enableEmail: v === true } }))} /></div>
              <div className="flex items-center justify-between rounded-lg border p-3"><span>Enable SMS</span><Switch checked={draft.notifications.enableSms} onCheckedChange={(v) => setDraft((s) => ({ ...s, notifications: { ...s.notifications, enableSms: v === true } }))} /></div>
              <div className="flex items-center justify-between rounded-lg border p-3"><span>Enable Push</span><Switch checked={draft.notifications.enablePush} onCheckedChange={(v) => setDraft((s) => ({ ...s, notifications: { ...s.notifications, enablePush: v === true } }))} /></div>
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

        <TabsContent value="security" className="mt-4">
          <Card className="p-6 space-y-4">
            <h3 className="text-[#1E293B]">Security Settings (Demo Config)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center justify-between rounded-lg border p-3"><span>Enforce 2FA</span><Switch checked={draft.security.enforce2fa} onCheckedChange={(v) => setDraft((s) => ({ ...s, security: { ...s.security, enforce2fa: v === true } }))} /></div>
              <div className="flex items-center justify-between rounded-lg border p-3"><span>Auto Logout</span><Switch checked={draft.security.autoLogoutEnabled} onCheckedChange={(v) => setDraft((s) => ({ ...s, security: { ...s.security, autoLogoutEnabled: v === true } }))} /></div>
              <div className="space-y-2">
                <Label>Session Timeout (minutes)</Label>
                <Input type="number" value={String(draft.security.sessionTimeoutMinutes)} onChange={(e) => setDraft((s) => ({ ...s, security: { ...s.security, sessionTimeoutMinutes: Number(e.target.value || 0) } }))} />
              </div>
              <div className="space-y-2">
                <Label>Min Password Length</Label>
                <Input type="number" value={String(draft.security.minPasswordLength)} onChange={(e) => setDraft((s) => ({ ...s, security: { ...s.security, minPasswordLength: Number(e.target.value || 0) } }))} />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3"><span>Rate Limiting</span><Switch checked={draft.security.rateLimitEnabled} onCheckedChange={(v) => setDraft((s) => ({ ...s, security: { ...s.security, rateLimitEnabled: v === true } }))} /></div>
              <div className="space-y-2">
                <Label>Requests / Minute</Label>
                <Input type="number" value={String(draft.security.rateLimitPerMinute)} onChange={(e) => setDraft((s) => ({ ...s, security: { ...s.security, rateLimitPerMinute: Number(e.target.value || 0) } }))} />
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="backup" className="mt-4">
          <Card className="p-6 space-y-6">
            <h3 className="text-[#1E293B]">Backup & Restore (Backend Snapshots)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center justify-between rounded-lg border p-3"><span>Auto Backups</span><Switch checked={draft.backup.autoBackups} onCheckedChange={(v) => setDraft((s) => ({ ...s, backup: { ...s.backup, autoBackups: v === true } }))} /></div>
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

        <TabsContent value="crm" className="mt-4">
          <Card className="p-6 space-y-6">
            <h3 className="text-[#1E293B]">CRM Integration</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2 md:col-span-2">
                <Label>CRM Base URL</Label>
                <Input value={draft.crm.baseUrl} placeholder="https://example-crm.test/api" onChange={(e) => setDraft((s) => ({ ...s, crm: { ...s.crm, baseUrl: e.target.value } }))} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>CRM Auth Token</Label>
                <Input type="password" value={draft.crm.authToken} onChange={(e) => setDraft((s) => ({ ...s, crm: { ...s.crm, authToken: e.target.value } }))} />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3"><span>Auto-sync Residents</span><Switch checked={draft.crm.autoSyncResidents} onCheckedChange={(v) => setDraft((s) => ({ ...s, crm: { ...s.crm, autoSyncResidents: v === true } }))} /></div>
              <div className="flex items-center justify-between rounded-lg border p-3"><span>Auto-sync Payments</span><Switch checked={draft.crm.autoSyncPayments} onCheckedChange={(v) => setDraft((s) => ({ ...s, crm: { ...s.crm, autoSyncPayments: v === true } }))} /></div>
              <div className="flex items-center justify-between rounded-lg border p-3"><span>Auto-sync Service Requests</span><Switch checked={draft.crm.autoSyncServiceRequests} onCheckedChange={(v) => setDraft((s) => ({ ...s, crm: { ...s.crm, autoSyncServiceRequests: v === true } }))} /></div>
              <div className="space-y-2">
                <Label>Sync Interval (minutes)</Label>
                <Input type="number" value={String(draft.crm.syncIntervalMinutes)} onChange={(e) => setDraft((s) => ({ ...s, crm: { ...s.crm, syncIntervalMinutes: Number(e.target.value || 0) } }))} />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => void testCrmConnection()} disabled={isTestingCrm}>
                <LinkIcon className={`w-4 h-4 mr-2 ${isTestingCrm ? "animate-pulse" : ""}`} />
                {isTestingCrm ? "Testing..." : "Test CRM Connection"}
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="rounded-lg border p-3">
                <div className="text-xs text-[#64748B]">CRM Connection</div>
                <div className="mt-2 flex items-center gap-2">
                  {diagnostics.crmTestOk ? <CheckCircle className="w-4 h-4 text-[#10B981]" /> : <XCircle className="w-4 h-4 text-[#EF4444]" />}
                  <span className="text-sm">{diagnostics.crmTestOk ? "Reachable" : "Unchecked / Failed"}</span>
                </div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-xs text-[#64748B]">Status Code</div>
                <div className="mt-2 text-sm">{diagnostics.crmStatusCode ?? "—"}</div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-xs text-[#64748B]">Last CRM Test</div>
                <div className="mt-2 text-sm">{formatDateTime(diagnostics.crmCheckedAt)}</div>
              </div>
            </div>
            {diagnostics.crmError ? (
              <div className="rounded-lg border border-[#FECACA] bg-[#FEF2F2] p-3 text-sm text-[#991B1B]">
                {diagnostics.crmError}
              </div>
            ) : null}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

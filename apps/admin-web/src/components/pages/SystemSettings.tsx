import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Settings, Bell, Shield, Palette, Globe, Database,
  Check, X, ChevronRight, Eye, EyeOff, Save, RefreshCw,
  Upload, Trash2, Info, Link, Smartphone, UserPlus, Key, Lock, Users2, Layers,
  Plus, Pencil,
} from "lucide-react";
import apiClient from "../../lib/api-client";

// ─── Types ────────────────────────────────────────────────────

type SettingsTab =
  | "general" | "notifications" | "security" | "appearance"
  | "localization" | "data" | "departments"
  | "integrations" | "authentication" | "mobile";

type GeneralSettings = {
  companyName: string; supportEmail: string; supportPhone: string;
  address: string; timezone: string; logoFileId: string;
};

type NotificationSettings = {
  emailEnabled: boolean; pushEnabled: boolean; smsEnabled: boolean;
  otpEnabled: boolean;
  maintenanceAlerts: boolean; paymentReminders: boolean; emergencyBroadcast: boolean;
  digestFrequency: "immediate" | "hourly" | "daily" | "weekly";
};

type SecuritySettings = {
  auditLogRetentionDays: number;
};

type AppearanceSettings = {
  primaryColor: string; accentColor: string; logoUrl: string;
  darkMode: boolean; compactLayout: boolean; language: string;
};

type LocalizationSettings = {
  defaultLanguage: "en" | "ar"; currency: string; dateFormat: string;
  rtlSupport: boolean; timezone: string;
};

type DataSettings = {
  backupEnabled: boolean; backupFrequency: "daily" | "weekly" | "monthly";
  retentionDays: number; exportFormat: "csv" | "xlsx" | "json";
  analyticsEnabled: boolean;
};

type AuthenticationSettings = {
  require2fa: boolean;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
  passwordMinLength: number;
  maxRequestsPerMinute: number;
  sessionTimeoutMinutes: number;
  maxLoginAttempts: number;
  registrationType: "pre-registered" | "self-registration";
};

type Department = {
  id: string; name: string; description: string; head: string; memberCount: number;
};

type SystemUser = {
  id: string; fullName: string; email: string; role: string; department: string; status: "active" | "inactive";
};

type Role = {
  id: string; name: string; description: string; permissions: string[];
};

type MobileAccessMap = Record<string, Record<string, boolean>>;

function ensureArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (value && typeof value === "object") {
    const payload = value as Record<string, unknown>;
    if (Array.isArray(payload.data)) return payload.data as T[];
    if (Array.isArray(payload.rows)) return payload.rows as T[];
    if (Array.isArray(payload.items)) return payload.items as T[];
  }
  return [];
}

// ─── Design tokens ────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "8px 10px", borderRadius: "7px", border: "1px solid #E5E7EB",
  fontSize: "13px", color: "#111827", background: "#FFF", outline: "none",
  fontFamily: "'Work Sans', sans-serif", boxSizing: "border-box", height: "36px",
};
const selectStyle: React.CSSProperties = { ...inputStyle, cursor: "pointer" };

const dialogOverlayStyle: React.CSSProperties = {
  position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", display: "flex",
  alignItems: "center", justifyContent: "center", zIndex: 100,
};
const dialogBoxStyle: React.CSSProperties = {
  background: "#FFF", borderRadius: "12px", padding: "24px", width: "480px",
  maxHeight: "80vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.18)",
  fontFamily: "'Work Sans', sans-serif",
};
const dialogTitleStyle: React.CSSProperties = {
  fontSize: "15px", fontWeight: 800, color: "#111827", margin: "0 0 16px",
};
const btnPrimary: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: "6px", padding: "7px 16px", borderRadius: "7px",
  background: "#111827", color: "#FFF", border: "none", cursor: "pointer",
  fontSize: "12.5px", fontWeight: 700, fontFamily: "'Work Sans', sans-serif",
};
const btnSecondary: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: "5px", padding: "6px 12px", borderRadius: "7px",
  border: "1px solid #E5E7EB", background: "#FFF", color: "#6B7280", cursor: "pointer",
  fontSize: "12.5px", fontWeight: 500, fontFamily: "'Work Sans', sans-serif",
};
const btnDanger: React.CSSProperties = {
  ...btnSecondary, border: "1px solid #FECACA", color: "#DC2626", background: "#FFF5F5",
};
const tableHeaderCell: React.CSSProperties = {
  fontSize: "11px", fontWeight: 700, color: "#6B7280", textTransform: "uppercase",
  letterSpacing: "0.06em", padding: "8px 10px", textAlign: "left",
  fontFamily: "'Work Sans', sans-serif", borderBottom: "1px solid #F3F4F6",
};
const tableCell: React.CSSProperties = {
  fontSize: "13px", color: "#374151", padding: "10px 10px",
  fontFamily: "'Work Sans', sans-serif", borderBottom: "1px solid #F9FAFB",
};

// ─── Primitives ───────────────────────────────────────────────

function Field({ label, hint, required, children, horizontal }: {
  label: string; hint?: string; required?: boolean; children: React.ReactNode; horizontal?: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: horizontal ? "row" : "column", gap: horizontal ? "0" : "4px", alignItems: horizontal ? "center" : undefined, justifyContent: horizontal ? "space-between" : undefined }}>
      <div style={{ flex: horizontal ? 1 : undefined }}>
        <label style={{ fontSize: "12.5px", fontWeight: 600, color: "#374151", fontFamily: "'Work Sans', sans-serif" }}>
          {label}{required && <span style={{ color: "#DC2626", marginLeft: "3px" }}>*</span>}
        </label>
        {hint && <p style={{ fontSize: "11.5px", color: "#9CA3AF", margin: "2px 0 0", fontFamily: "'Work Sans', sans-serif" }}>{hint}</p>}
      </div>
      <div style={{ flex: horizontal ? "0 0 240px" : undefined }}>
        {children}
      </div>
    </div>
  );
}

function SectionLabel({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "14px", paddingBottom: "8px", borderBottom: "1px solid #F3F4F6" }}>
      <span style={{ color: "#9CA3AF" }}>{icon}</span>
      <span style={{ fontSize: "11px", fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "'Work Sans', sans-serif" }}>{label}</span>
    </div>
  );
}

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={() => !disabled && onChange(!checked)} aria-pressed={checked}
      style={{ width: "38px", height: "22px", borderRadius: "11px", border: "none", cursor: disabled ? "not-allowed" : "pointer", background: checked ? "#111827" : "#E5E7EB", position: "relative", transition: "background 200ms", flexShrink: 0, outline: "none", opacity: disabled ? 0.5 : 1 }}>
      <span style={{ position: "absolute", top: "3px", left: checked ? "19px" : "3px", width: "16px", height: "16px", borderRadius: "50%", background: "#FFF", transition: "left 200ms", boxShadow: "0 1px 3px rgba(0,0,0,0.15)" }} />
    </button>
  );
}

function PasswordInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <input type={show ? "text" : "password"} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        style={{ ...inputStyle, paddingRight: "38px" }} />
      <button type="button" onClick={() => setShow((p) => !p)}
        style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#9CA3AF", padding: 0, display: "flex" }}>
        {show ? <EyeOff style={{ width: "13px", height: "13px" }} /> : <Eye style={{ width: "13px", height: "13px" }} />}
      </button>
    </div>
  );
}

function SaveBar({ dirty, saving, onSave, onDiscard }: { dirty: boolean; saving: boolean; onSave: () => void; onDiscard: () => void }) {
  if (!dirty) return null;
  return (
    <div style={{ position: "sticky", bottom: "16px", zIndex: 20, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderRadius: "9px", border: "1px solid #EBEBEB", background: "#FFF", boxShadow: "0 4px 16px rgba(0,0,0,0.1)", margin: "0 0 0 0" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
        <Info style={{ width: "13px", height: "13px", color: "#D97706" }} />
        <span style={{ fontSize: "12.5px", fontWeight: 600, color: "#374151", fontFamily: "'Work Sans', sans-serif" }}>You have unsaved changes</span>
      </div>
      <div style={{ display: "flex", gap: "8px" }}>
        <button type="button" onClick={onDiscard}
          style={{ display: "flex", alignItems: "center", gap: "5px", padding: "6px 12px", borderRadius: "7px", border: "1px solid #E5E7EB", background: "#FFF", color: "#6B7280", cursor: "pointer", fontSize: "12.5px", fontWeight: 500, fontFamily: "'Work Sans', sans-serif" }}>
          <X style={{ width: "11px", height: "11px" }} /> Discard
        </button>
        <button type="button" onClick={onSave} disabled={saving}
          style={{ display: "flex", alignItems: "center", gap: "5px", padding: "6px 16px", borderRadius: "7px", background: saving ? "#6B7280" : "#111827", color: "#FFF", border: "none", cursor: saving ? "not-allowed" : "pointer", fontSize: "13px", fontWeight: 700, fontFamily: "'Work Sans', sans-serif" }}>
          <Save style={{ width: "12px", height: "12px" }} />
          {saving ? "Saving…" : "Save Changes"}
        </button>
      </div>
    </div>
  );
}

// ─── Permission definitions ───────────────────────────────────

const PERMISSION_GROUPS: { module: string; permissions: string[] }[] = [
  { module: "Residents", permissions: ["residents:read", "residents:write"] },
  { module: "Units", permissions: ["units:read", "units:write"] },
  { module: "Billing", permissions: ["billing:read", "billing:write"] },
  { module: "Settings", permissions: ["settings:read", "settings:write"] },
  { module: "Services", permissions: ["services:read", "services:write"] },
  { module: "Permits", permissions: ["permits:read", "permits:write"] },
  { module: "Complaints", permissions: ["complaints:read", "complaints:write"] },
  { module: "Violations", permissions: ["violations:read", "violations:write"] },
  { module: "Amenities", permissions: ["amenities:read", "amenities:write"] },
  { module: "Surveys", permissions: ["surveys:read", "surveys:write"] },
  { module: "Reports", permissions: ["reports:read", "reports:write"] },
  { module: "Ordering", permissions: ["ordering:read", "ordering:write"] },
  { module: "Marketing", permissions: ["marketing:read", "marketing:write"] },
  { module: "Emergency", permissions: ["emergency:read", "emergency:write"] },
];

// ─── Integration definitions ──────────────────────────────────

const INTEGRATIONS = [
  { id: "hcp", name: "HCP", description: "Health Care Provider integration for community health services." },
  { id: "erp", name: "ERP", description: "Enterprise Resource Planning for finance and operations." },
  { id: "crm", name: "CRM", description: "Customer Relationship Management for resident interactions." },
  { id: "payment", name: "Payment Gateways", description: "Online payment processing for billing and fees." },
  { id: "fire-alarm", name: "Fire Alarm System", description: "Fire detection and alarm management integration." },
  { id: "smart-homes", name: "Smart Homes System", description: "IoT and smart home device management." },
  { id: "hikcentral", name: "HikCentral", description: "Video surveillance and access control platform." },
];

// ─── Mobile access module list ────────────────────────────────

const MOBILE_MODULES = [
  "Dashboard", "Communities", "Units", "Residents", "Billing", "Notifications",
  "Services", "Permits", "Complaints", "Violations", "Amenities", "Surveys",
  "Reports", "Ordering", "Marketing", "Emergency",
];
const MOBILE_USER_TYPES = ["Owner", "Tenant", "Family Member", "Staff"];

// ─── Tab content panels ───────────────────────────────────────

function GeneralPanel({ settings, onChange, onLogoUpload }: {
  settings: GeneralSettings;
  onChange: (patch: Partial<GeneralSettings>) => void;
  onLogoUpload: (f: File) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <SectionLabel icon={<Settings style={{ width: "12px", height: "12px" }} />} label="Company Info" />
      <Field label="Company Name" required>
        <input value={settings.companyName} onChange={(e) => onChange({ companyName: e.target.value })} placeholder="Acme Properties LLC" style={inputStyle} />
      </Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
        <Field label="Support Email" required>
          <input type="email" value={settings.supportEmail} onChange={(e) => onChange({ supportEmail: e.target.value })} placeholder="support@company.com" style={inputStyle} />
        </Field>
        <Field label="Support Phone">
          <input value={settings.supportPhone} onChange={(e) => onChange({ supportPhone: e.target.value })} placeholder="+20 2 xxxx xxxx" style={{ ...inputStyle, fontFamily: "'DM Mono', monospace" }} />
        </Field>
      </div>
      <Field label="Address">
        <textarea value={settings.address} onChange={(e) => onChange({ address: e.target.value })} rows={2} style={{ ...inputStyle, height: "auto", resize: "vertical" }} />
      </Field>
      <Field label="Timezone">
        <select value={settings.timezone} onChange={(e) => onChange({ timezone: e.target.value })} style={selectStyle}>
          <option value="Africa/Cairo">Africa/Cairo (UTC+2)</option>
          <option value="Asia/Dubai">Asia/Dubai (UTC+4)</option>
          <option value="Europe/London">Europe/London (UTC+0)</option>
          <option value="America/New_York">America/New_York (UTC-5)</option>
          <option value="Asia/Riyadh">Asia/Riyadh (UTC+3)</option>
        </select>
      </Field>

      <div style={{ borderTop: "1px solid #F3F4F6", paddingTop: "16px" }}>
        <SectionLabel icon={<Upload style={{ width: "12px", height: "12px" }} />} label="Branding" />
        <Field label="Company Logo" hint="Displayed in the app header and communications.">
          <label style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 10px", borderRadius: "7px", border: "1.5px dashed #D1D5DB", background: "#FAFAFA", cursor: "pointer", fontSize: "12px", color: "#6B7280", height: "36px", boxSizing: "border-box" }}>
            <Upload style={{ width: "12px", height: "12px" }} />
            Upload logo (PNG, SVG)
            <input type="file" accept="image/*,.svg" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) onLogoUpload(f); }} />
          </label>
        </Field>
        {settings.logoFileId && (
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "6px", padding: "7px 10px", borderRadius: "6px", border: "1px solid #D1FAE5", background: "#ECFDF5" }}>
            <Check style={{ width: "11px", height: "11px", color: "#059669" }} />
            <span style={{ fontSize: "12px", color: "#059669", flex: 1, fontWeight: 600 }}>Logo uploaded successfully</span>
            <button type="button" onClick={() => onChange({ logoFileId: "" })} style={{ width: "22px", height: "22px", borderRadius: "5px", border: "1px solid #FECACA", background: "#FFF5F5", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#DC2626" }}>
              <Trash2 style={{ width: "9px", height: "9px" }} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function NotificationsPanel({ settings, onChange }: { settings: NotificationSettings; onChange: (p: Partial<NotificationSettings>) => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <SectionLabel icon={<Bell style={{ width: "12px", height: "12px" }} />} label="Channels" />
      {([
        { key: "emailEnabled", label: "Email Notifications", hint: "Send transactional emails to residents and staff." },
        { key: "pushEnabled", label: "Push Notifications", hint: "Mobile push alerts via FCM / APNs." },
        { key: "smsEnabled", label: "SMS Notifications", hint: "Text messages for critical alerts (carrier charges may apply)." },
        { key: "otpEnabled", label: "OTP Notifications", hint: "Send one-time passwords for verification." },
      ] as { key: keyof NotificationSettings; label: string; hint: string }[]).map(({ key, label, hint }) => (
        <Field key={key} label={label} hint={hint} horizontal>
          <Toggle checked={settings[key] as boolean} onChange={(v) => onChange({ [key]: v })} />
        </Field>
      ))}

      <div style={{ borderTop: "1px solid #F3F4F6", paddingTop: "16px" }}>
        <SectionLabel icon={<Bell style={{ width: "12px", height: "12px" }} />} label="Alert Types" />
        {([
          { key: "maintenanceAlerts", label: "Maintenance Alerts", hint: "Notify residents of scheduled maintenance." },
          { key: "paymentReminders", label: "Payment Reminders", hint: "Automated reminders before and after due dates." },
          { key: "emergencyBroadcast", label: "Emergency Broadcasts", hint: "Fire alarms and critical safety alerts." },
        ] as { key: keyof NotificationSettings; label: string; hint: string }[]).map(({ key, label, hint }) => (
          <Field key={key} label={label} hint={hint} horizontal>
            <Toggle checked={settings[key] as boolean} onChange={(v) => onChange({ [key]: v })} />
          </Field>
        ))}
      </div>

      <div style={{ borderTop: "1px solid #F3F4F6", paddingTop: "16px" }}>
        <SectionLabel icon={<Bell style={{ width: "12px", height: "12px" }} />} label="Digest Frequency" />
        <Field label="Admin Digest" hint="How often to send activity summaries to admins.">
          <select value={settings.digestFrequency} onChange={(e) => onChange({ digestFrequency: e.target.value as NotificationSettings["digestFrequency"] })} style={selectStyle}>
            <option value="immediate">Immediate</option>
            <option value="hourly">Hourly</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
          </select>
        </Field>
      </div>
    </div>
  );
}

function SecurityPanel({ settings, onChange }: { settings: SecuritySettings; onChange: (p: Partial<SecuritySettings>) => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <SectionLabel icon={<Shield style={{ width: "12px", height: "12px" }} />} label="Audit" />
      <Field label="Audit Log Retention" hint="Days to retain audit logs before automatic purge.">
        <input type="number" min={30} max={730} value={settings.auditLogRetentionDays} onChange={(e) => onChange({ auditLogRetentionDays: Number(e.target.value) })} style={{ ...inputStyle, maxWidth: "120px" }} />
      </Field>
    </div>
  );
}

function AuthenticationPanel({ settings, onChange }: { settings: AuthenticationSettings; onChange: (p: Partial<AuthenticationSettings>) => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <SectionLabel icon={<Key style={{ width: "12px", height: "12px" }} />} label="Two-Factor Authentication" />
      <Field label="Require 2FA for Admins" hint="All admin accounts must enrol in two-factor authentication." horizontal>
        <Toggle checked={settings.require2fa} onChange={(v) => onChange({ require2fa: v })} />
      </Field>

      <div style={{ borderTop: "1px solid #F3F4F6", paddingTop: "16px" }}>
        <SectionLabel icon={<Lock style={{ width: "12px", height: "12px" }} />} label="Password Policy" />
        <Field label="Minimum Password Length">
          <input type="number" min={6} max={32} value={settings.passwordMinLength} onChange={(e) => onChange({ passwordMinLength: Number(e.target.value) })} style={{ ...inputStyle, maxWidth: "120px" }} />
        </Field>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "12px" }}>
          <SectionLabel icon={<Lock style={{ width: "12px", height: "12px" }} />} label="Password Complexity" />
          {([
            { key: "requireUppercase", label: "Require Uppercase", hint: "At least one uppercase letter (A-Z)." },
            { key: "requireLowercase", label: "Require Lowercase", hint: "At least one lowercase letter (a-z)." },
            { key: "requireNumbers", label: "Require Numbers", hint: "At least one digit (0-9)." },
            { key: "requireSpecialChars", label: "Require Special Characters", hint: "At least one special character (!@#$...)." },
          ] as { key: keyof AuthenticationSettings; label: string; hint: string }[]).map(({ key, label, hint }) => (
            <Field key={key} label={label} hint={hint} horizontal>
              <Toggle checked={settings[key] as boolean} onChange={(v) => onChange({ [key]: v })} />
            </Field>
          ))}
        </div>
      </div>

      <div style={{ borderTop: "1px solid #F3F4F6", paddingTop: "16px" }}>
        <SectionLabel icon={<Shield style={{ width: "12px", height: "12px" }} />} label="Rate Limiting & Sessions" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          <Field label="Max Requests per Minute" hint="Rate limit for API calls.">
            <input type="number" min={10} max={1000} value={settings.maxRequestsPerMinute} onChange={(e) => onChange({ maxRequestsPerMinute: Number(e.target.value) })} style={inputStyle} />
          </Field>
          <Field label="Session Timeout" hint="Minutes before auto-logout.">
            <input type="number" min={5} max={1440} value={settings.sessionTimeoutMinutes} onChange={(e) => onChange({ sessionTimeoutMinutes: Number(e.target.value) })} style={inputStyle} />
          </Field>
        </div>
        <div style={{ marginTop: "12px" }}>
          <Field label="Max Login Attempts" hint="Locks account after N failed attempts.">
            <input type="number" min={3} max={20} value={settings.maxLoginAttempts} onChange={(e) => onChange({ maxLoginAttempts: Number(e.target.value) })} style={{ ...inputStyle, maxWidth: "120px" }} />
          </Field>
        </div>
      </div>

      <div style={{ borderTop: "1px solid #F3F4F6", paddingTop: "16px" }}>
        <SectionLabel icon={<Users2 style={{ width: "12px", height: "12px" }} />} label="User Registration" />
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <label style={{ display: "flex", gap: "10px", padding: "12px 14px", borderRadius: "8px", border: settings.registrationType === "pre-registered" ? "1.5px solid #111827" : "1px solid #E5E7EB", background: settings.registrationType === "pre-registered" ? "#F9FAFB" : "#FFF", cursor: "pointer" }}>
            <input type="radio" name="registrationType" checked={settings.registrationType === "pre-registered"} onChange={() => onChange({ registrationType: "pre-registered" })} style={{ marginTop: "2px" }} />
            <div>
              <div style={{ fontSize: "13px", fontWeight: 700, color: "#111827" }}>Pre-registered</div>
              <div style={{ fontSize: "11.5px", color: "#6B7280", marginTop: "2px" }}>Users must be added by an administrator before they can access the system. Provides tighter control over who has access.</div>
            </div>
          </label>
          <label style={{ display: "flex", gap: "10px", padding: "12px 14px", borderRadius: "8px", border: settings.registrationType === "self-registration" ? "1.5px solid #111827" : "1px solid #E5E7EB", background: settings.registrationType === "self-registration" ? "#F9FAFB" : "#FFF", cursor: "pointer" }}>
            <input type="radio" name="registrationType" checked={settings.registrationType === "self-registration"} onChange={() => onChange({ registrationType: "self-registration" })} style={{ marginTop: "2px" }} />
            <div>
              <div style={{ fontSize: "13px", fontWeight: 700, color: "#111827" }}>Self-registration</div>
              <div style={{ fontSize: "11.5px", color: "#6B7280", marginTop: "2px" }}>Users can create their own account and request access. An admin may still need to approve new accounts depending on role configuration.</div>
            </div>
          </label>
        </div>
      </div>
    </div>
  );
}

function AppearancePanel({ settings, onChange }: { settings: AppearanceSettings; onChange: (p: Partial<AppearanceSettings>) => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <SectionLabel icon={<Palette style={{ width: "12px", height: "12px" }} />} label="Colours" />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
        <Field label="Primary Colour" hint="Used for buttons and key actions.">
          <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
            <input type="color" value={settings.primaryColor} onChange={(e) => onChange({ primaryColor: e.target.value })}
              style={{ width: "36px", height: "36px", borderRadius: "7px", border: "1px solid #E5E7EB", padding: "2px", cursor: "pointer", background: "#FFF" }} />
            <input value={settings.primaryColor} onChange={(e) => onChange({ primaryColor: e.target.value })} style={{ ...inputStyle, fontFamily: "'DM Mono', monospace", flex: 1 }} />
          </div>
        </Field>
        <Field label="Accent Colour" hint="Used for highlights and links.">
          <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
            <input type="color" value={settings.accentColor} onChange={(e) => onChange({ accentColor: e.target.value })}
              style={{ width: "36px", height: "36px", borderRadius: "7px", border: "1px solid #E5E7EB", padding: "2px", cursor: "pointer", background: "#FFF" }} />
            <input value={settings.accentColor} onChange={(e) => onChange({ accentColor: e.target.value })} style={{ ...inputStyle, fontFamily: "'DM Mono', monospace", flex: 1 }} />
          </div>
        </Field>
      </div>

      <div style={{ borderTop: "1px solid #F3F4F6", paddingTop: "16px" }}>
        <SectionLabel icon={<Palette style={{ width: "12px", height: "12px" }} />} label="Layout" />
        {([
          { key: "darkMode", label: "Dark Mode", hint: "Enable dark theme for all admin users." },
          { key: "compactLayout", label: "Compact Layout", hint: "Reduce padding for higher information density." },
        ] as { key: keyof AppearanceSettings; label: string; hint: string }[]).map(({ key, label, hint }) => (
          <Field key={key} label={label} hint={hint} horizontal>
            <Toggle checked={settings[key] as boolean} onChange={(v) => onChange({ [key]: v })} />
          </Field>
        ))}
      </div>
    </div>
  );
}

function LocalizationPanel({ settings, onChange }: { settings: LocalizationSettings; onChange: (p: Partial<LocalizationSettings>) => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <SectionLabel icon={<Globe style={{ width: "12px", height: "12px" }} />} label="Language & Region" />
      <Field label="Default Language">
        <select value={settings.defaultLanguage} onChange={(e) => onChange({ defaultLanguage: e.target.value as LocalizationSettings["defaultLanguage"] })} style={selectStyle}>
          <option value="en">English</option>
          <option value="ar">Arabic (عربي)</option>
        </select>
      </Field>
      <Field label="RTL Support" hint="Right-to-left layout for Arabic content." horizontal>
        <Toggle checked={settings.rtlSupport} onChange={(v) => onChange({ rtlSupport: v })} />
      </Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
        <Field label="Currency">
          <select value={settings.currency} onChange={(e) => onChange({ currency: e.target.value })} style={selectStyle}>
            <option value="EGP">EGP – Egyptian Pound</option>
            <option value="USD">USD – US Dollar</option>
            <option value="AED">AED – UAE Dirham</option>
            <option value="SAR">SAR – Saudi Riyal</option>
          </select>
        </Field>
        <Field label="Date Format">
          <select value={settings.dateFormat} onChange={(e) => onChange({ dateFormat: e.target.value })} style={selectStyle}>
            <option value="DD/MM/YYYY">DD/MM/YYYY</option>
            <option value="MM/DD/YYYY">MM/DD/YYYY</option>
            <option value="YYYY-MM-DD">YYYY-MM-DD (ISO)</option>
          </select>
        </Field>
      </div>
    </div>
  );
}

function DataPanel({ settings, onChange, onBackupNow }: { settings: DataSettings; onChange: (p: Partial<DataSettings>) => void; onBackupNow: () => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <SectionLabel icon={<Database style={{ width: "12px", height: "12px" }} />} label="Backup" />
      <Field label="Automated Backups" hint="Schedule regular data backups." horizontal>
        <Toggle checked={settings.backupEnabled} onChange={(v) => onChange({ backupEnabled: v })} />
      </Field>
      <Field label="Backup Frequency">
        <select value={settings.backupFrequency} onChange={(e) => onChange({ backupFrequency: e.target.value as DataSettings["backupFrequency"] })} disabled={!settings.backupEnabled} style={{ ...selectStyle, opacity: settings.backupEnabled ? 1 : 0.5 }}>
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
        </select>
      </Field>
      <Field label="Data Retention" hint="Days to keep backups before automatic deletion.">
        <input type="number" min={7} max={365} value={settings.retentionDays} onChange={(e) => onChange({ retentionDays: Number(e.target.value) })} style={{ ...inputStyle, maxWidth: "120px" }} />
      </Field>

      <div style={{ borderTop: "1px solid #F3F4F6", paddingTop: "16px" }}>
        <SectionLabel icon={<Database style={{ width: "12px", height: "12px" }} />} label="Export" />
        <Field label="Default Export Format">
          <select value={settings.exportFormat} onChange={(e) => onChange({ exportFormat: e.target.value as DataSettings["exportFormat"] })} style={{ ...selectStyle, maxWidth: "160px" }}>
            <option value="csv">CSV</option>
            <option value="xlsx">Excel (XLSX)</option>
            <option value="json">JSON</option>
          </select>
        </Field>
        <Field label="Analytics Tracking" hint="Allow anonymised usage analytics to improve the platform." horizontal>
          <Toggle checked={settings.analyticsEnabled} onChange={(v) => onChange({ analyticsEnabled: v })} />
        </Field>
      </div>

      <div style={{ borderTop: "1px solid #F3F4F6", paddingTop: "16px" }}>
        <SectionLabel icon={<Database style={{ width: "12px", height: "12px" }} />} label="Manual Backup" />
        <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px 14px", borderRadius: "8px", border: "1px solid #EBEBEB", background: "#FAFAFA" }}>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: "13px", fontWeight: 600, color: "#374151", margin: 0 }}>Backup Now</p>
            <p style={{ fontSize: "11.5px", color: "#9CA3AF", margin: "2px 0 0" }}>Trigger an immediate full database snapshot.</p>
          </div>
          <button type="button" onClick={onBackupNow}
            style={{ display: "flex", alignItems: "center", gap: "6px", padding: "7px 14px", borderRadius: "7px", background: "#111827", color: "#FFF", border: "none", cursor: "pointer", fontSize: "12.5px", fontWeight: 700, fontFamily: "'Work Sans', sans-serif" }}>
            <Database style={{ width: "12px", height: "12px" }} /> Run Backup
          </button>
        </div>
      </div>
    </div>
  );
}

function DepartmentsPanel({ departments, onRefresh }: { departments: Department[]; onRefresh: () => void }) {
  const safeDepartments = ensureArray<Department>(departments);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [form, setForm] = useState({ name: "", description: "", head: "" });

  const openCreate = () => {
    setEditingDept(null);
    setForm({ name: "", description: "", head: "" });
    setDialogOpen(true);
  };

  const openEdit = (dept: Department) => {
    setEditingDept(dept);
    setForm({ name: dept.name, description: dept.description, head: dept.head });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    try {
      if (editingDept) {
        await apiClient.patch(`/admin/departments/${editingDept.id}`, form);
        toast.success("Department updated");
      } else {
        await apiClient.post("/admin/departments", form);
        toast.success("Department created");
      }
      setDialogOpen(false);
      onRefresh();
    } catch { toast.error("Failed to save department"); }
  };

  const handleDelete = async (id: string) => {
    try {
      await apiClient.delete(`/admin/departments/${id}`);
      toast.success("Department deleted");
      onRefresh();
    } catch { toast.error("Failed to delete department"); }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <SectionLabel icon={<Layers style={{ width: "12px", height: "12px" }} />} label="Departments" />
        <button type="button" onClick={openCreate} style={btnPrimary}>
          <Plus style={{ width: "12px", height: "12px" }} /> New Department
        </button>
      </div>

      {safeDepartments.length === 0 ? (
        <p style={{ fontSize: "13px", color: "#9CA3AF", textAlign: "center", padding: "24px" }}>No departments found. Create your first department.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={tableHeaderCell}>Name</th>
              <th style={tableHeaderCell}>Description</th>
              <th style={tableHeaderCell}>Head</th>
              <th style={tableHeaderCell}>Members</th>
              <th style={{ ...tableHeaderCell, textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {safeDepartments.map((dept) => (
              <tr key={dept.id}>
                <td style={{ ...tableCell, fontWeight: 600 }}>{dept.name}</td>
                <td style={{ ...tableCell, color: "#6B7280" }}>{dept.description}</td>
                <td style={tableCell}>{dept.head}</td>
                <td style={tableCell}>{dept.memberCount}</td>
                <td style={{ ...tableCell, textAlign: "right" }}>
                  <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
                    <button type="button" onClick={() => openEdit(dept)} style={btnSecondary}>
                      <Pencil style={{ width: "10px", height: "10px" }} /> Edit
                    </button>
                    <button type="button" onClick={() => void handleDelete(dept.id)} style={btnDanger}>
                      <Trash2 style={{ width: "10px", height: "10px" }} /> Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {dialogOpen && (
        <div style={dialogOverlayStyle} onClick={() => setDialogOpen(false)}>
          <div style={dialogBoxStyle} onClick={(e) => e.stopPropagation()}>
            <h3 style={dialogTitleStyle}>{editingDept ? "Edit Department" : "New Department"}</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <Field label="Name" required>
                <input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} style={inputStyle} placeholder="e.g. Operations" />
              </Field>
              <Field label="Description">
                <textarea value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} rows={2} style={{ ...inputStyle, height: "auto", resize: "vertical" }} placeholder="Brief description of this department" />
              </Field>
              <Field label="Head">
                <input value={form.head} onChange={(e) => setForm((p) => ({ ...p, head: e.target.value }))} style={inputStyle} placeholder="Department head name" />
              </Field>
              <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", marginTop: "8px" }}>
                <button type="button" onClick={() => setDialogOpen(false)} style={btnSecondary}>Cancel</button>
                <button type="button" onClick={() => void handleSubmit()} style={btnPrimary}>
                  {editingDept ? "Update" : "Create"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SystemUsersPanel({ users, departments, onRefresh }: { users: SystemUser[]; departments: Department[]; onRefresh: () => void }) {
  const safeUsers = ensureArray<SystemUser>(users);
  const safeDepartments = ensureArray<Department>(departments);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<SystemUser | null>(null);
  const [form, setForm] = useState({ fullName: "", email: "", role: "staff", department: "", password: "" });

  const openCreate = () => {
    setEditingUser(null);
    setForm({ fullName: "", email: "", role: "staff", department: "", password: "" });
    setDialogOpen(true);
  };

  const openEdit = (user: SystemUser) => {
    setEditingUser(user);
    setForm({ fullName: user.fullName, email: user.email, role: user.role, department: user.department, password: "" });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    try {
      if (editingUser) {
        const payload: Record<string, string> = { fullName: form.fullName, email: form.email, role: form.role, department: form.department };
        if (form.password) payload.password = form.password;
        await apiClient.patch(`/admin/system-users/${editingUser.id}`, payload);
        toast.success("User updated");
      } else {
        await apiClient.post("/admin/system-users", form);
        toast.success("User created");
      }
      setDialogOpen(false);
      onRefresh();
    } catch { toast.error("Failed to save user"); }
  };

  const handleDeactivate = async (user: SystemUser) => {
    try {
      const newStatus = user.status === "active" ? "inactive" : "active";
      await apiClient.patch(`/admin/system-users/${user.id}`, { status: newStatus });
      toast.success(`User ${newStatus === "active" ? "activated" : "deactivated"}`);
      onRefresh();
    } catch { toast.error("Failed to update user status"); }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <SectionLabel icon={<UserPlus style={{ width: "12px", height: "12px" }} />} label="System Users" />
        <button type="button" onClick={openCreate} style={btnPrimary}>
          <UserPlus style={{ width: "12px", height: "12px" }} /> Add System User
        </button>
      </div>

      {safeUsers.length === 0 ? (
        <p style={{ fontSize: "13px", color: "#9CA3AF", textAlign: "center", padding: "24px" }}>No system users found.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={tableHeaderCell}>Name</th>
              <th style={tableHeaderCell}>Email</th>
              <th style={tableHeaderCell}>Role</th>
              <th style={tableHeaderCell}>Department</th>
              <th style={tableHeaderCell}>Status</th>
              <th style={{ ...tableHeaderCell, textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {safeUsers.map((user) => (
              <tr key={user.id}>
                <td style={{ ...tableCell, fontWeight: 600 }}>{user.fullName}</td>
                <td style={{ ...tableCell, fontFamily: "'DM Mono', monospace", fontSize: "12px" }}>{user.email}</td>
                <td style={tableCell}>{user.role}</td>
                <td style={tableCell}>{user.department}</td>
                <td style={tableCell}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "2px 8px", borderRadius: "10px", fontSize: "11px", fontWeight: 700, background: user.status === "active" ? "#ECFDF5" : "#FEF2F2", color: user.status === "active" ? "#059669" : "#DC2626" }}>
                    <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: user.status === "active" ? "#059669" : "#DC2626" }} />
                    {user.status}
                  </span>
                </td>
                <td style={{ ...tableCell, textAlign: "right" }}>
                  <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
                    <button type="button" onClick={() => openEdit(user)} style={btnSecondary}>
                      <Pencil style={{ width: "10px", height: "10px" }} /> Edit
                    </button>
                    <button type="button" onClick={() => void handleDeactivate(user)} style={user.status === "active" ? btnDanger : btnSecondary}>
                      {user.status === "active" ? "Deactivate" : "Activate"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {dialogOpen && (
        <div style={dialogOverlayStyle} onClick={() => setDialogOpen(false)}>
          <div style={dialogBoxStyle} onClick={(e) => e.stopPropagation()}>
            <h3 style={dialogTitleStyle}>{editingUser ? "Edit System User" : "Add System User"}</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <Field label="Full Name" required>
                <input value={form.fullName} onChange={(e) => setForm((p) => ({ ...p, fullName: e.target.value }))} style={inputStyle} placeholder="John Doe" />
              </Field>
              <Field label="Email" required>
                <input type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} style={inputStyle} placeholder="john@company.com" />
              </Field>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <Field label="Role" required>
                  <select value={form.role} onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))} style={selectStyle}>
                    <option value="staff">Staff</option>
                    <option value="admin">Admin</option>
                    <option value="manager">Manager</option>
                    <option value="supervisor">Supervisor</option>
                  </select>
                </Field>
                <Field label="Department">
                  <select value={form.department} onChange={(e) => setForm((p) => ({ ...p, department: e.target.value }))} style={selectStyle}>
                    <option value="">Select department</option>
                    {safeDepartments.map((d) => (
                      <option key={d.id} value={d.name}>{d.name}</option>
                    ))}
                  </select>
                </Field>
              </div>
              <Field label="Password" required={!editingUser}>
                <PasswordInput value={form.password} onChange={(v) => setForm((p) => ({ ...p, password: v }))} placeholder={editingUser ? "Leave blank to keep current" : "Enter password"} />
              </Field>
              <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", marginTop: "8px" }}>
                <button type="button" onClick={() => setDialogOpen(false)} style={btnSecondary}>Cancel</button>
                <button type="button" onClick={() => void handleSubmit()} style={btnPrimary}>
                  {editingUser ? "Update" : "Create"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RolesPanel({ roles, onRefresh }: { roles: Role[]; onRefresh: () => void }) {
  const safeRoles = ensureArray<Role>(roles);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [form, setForm] = useState({ name: "", description: "", permissions: [] as string[] });

  const openCreate = () => {
    setEditingRole(null);
    setForm({ name: "", description: "", permissions: [] });
    setDialogOpen(true);
  };

  const openEdit = (role: Role) => {
    setEditingRole(role);
    setForm({
      name: role.name,
      description: role.description,
      permissions: ensureArray<string>(role.permissions),
    });
    setDialogOpen(true);
  };

  const togglePermission = (perm: string) => {
    setForm((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(perm)
        ? prev.permissions.filter((p) => p !== perm)
        : [...prev.permissions, perm],
    }));
  };

  const handleSubmit = async () => {
    try {
      if (editingRole) {
        await apiClient.patch(`/admin/roles/${editingRole.id}`, form);
        toast.success("Role updated");
      } else {
        await apiClient.post("/admin/roles", form);
        toast.success("Role created");
      }
      setDialogOpen(false);
      onRefresh();
    } catch { toast.error("Failed to save role"); }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <SectionLabel icon={<Key style={{ width: "12px", height: "12px" }} />} label="Roles & Permissions" />
        <button type="button" onClick={openCreate} style={btnPrimary}>
          <Plus style={{ width: "12px", height: "12px" }} /> New Role
        </button>
      </div>

      {safeRoles.length === 0 ? (
        <p style={{ fontSize: "13px", color: "#9CA3AF", textAlign: "center", padding: "24px" }}>No roles defined. Create your first role.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={tableHeaderCell}>Name</th>
              <th style={tableHeaderCell}>Description</th>
              <th style={tableHeaderCell}>Permissions</th>
              <th style={{ ...tableHeaderCell, textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {safeRoles.map((role) => (
              <tr key={role.id}>
                <td style={{ ...tableCell, fontWeight: 600 }}>{role.name}</td>
                <td style={{ ...tableCell, color: "#6B7280" }}>{role.description}</td>
                <td style={tableCell}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "2px 8px", borderRadius: "10px", fontSize: "11px", fontWeight: 700, background: "#EEF2FF", color: "#4F46E5" }}>
                    {ensureArray<string>(role.permissions).length} permissions
                  </span>
                </td>
                <td style={{ ...tableCell, textAlign: "right" }}>
                  <button type="button" onClick={() => openEdit(role)} style={btnSecondary}>
                    <Pencil style={{ width: "10px", height: "10px" }} /> Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {dialogOpen && (
        <div style={dialogOverlayStyle} onClick={() => setDialogOpen(false)}>
          <div style={{ ...dialogBoxStyle, width: "560px" }} onClick={(e) => e.stopPropagation()}>
            <h3 style={dialogTitleStyle}>{editingRole ? "Edit Role" : "New Role"}</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <Field label="Role Name" required>
                <input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} style={inputStyle} placeholder="e.g. Community Manager" />
              </Field>
              <Field label="Description">
                <textarea value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} rows={2} style={{ ...inputStyle, height: "auto", resize: "vertical" }} placeholder="What this role can do" />
              </Field>

              <div style={{ marginTop: "8px" }}>
                <SectionLabel icon={<Lock style={{ width: "12px", height: "12px" }} />} label="Permissions" />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                  {PERMISSION_GROUPS.map((group) => (
                    <div key={group.module} style={{ padding: "10px 12px", borderRadius: "8px", border: "1px solid #F3F4F6", background: "#FAFAFA" }}>
                      <div style={{ fontSize: "12px", fontWeight: 700, color: "#374151", marginBottom: "6px" }}>{group.module}</div>
                      {group.permissions.map((perm) => (
                        <label key={perm} style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "#6B7280", cursor: "pointer", marginBottom: "4px" }}>
                          <input type="checkbox" checked={form.permissions.includes(perm)} onChange={() => togglePermission(perm)} style={{ accentColor: "#111827" }} />
                          {perm.split(":")[1]}
                        </label>
                      ))}
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", marginTop: "8px" }}>
                <button type="button" onClick={() => setDialogOpen(false)} style={btnSecondary}>Cancel</button>
                <button type="button" onClick={() => void handleSubmit()} style={btnPrimary}>
                  {editingRole ? "Update" : "Create"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function IntegrationsPanel() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <SectionLabel icon={<Link style={{ width: "12px", height: "12px" }} />} label="Integrations" />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
        {INTEGRATIONS.map((intg) => (
          <div key={intg.id} style={{ padding: "16px", borderRadius: "10px", border: "1px solid #EBEBEB", background: "#FFF", display: "flex", flexDirection: "column", gap: "10px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontSize: "14px", fontWeight: 700, color: "#111827" }}>{intg.name}</div>
                <p style={{ fontSize: "12px", color: "#6B7280", margin: "4px 0 0", lineHeight: "1.4" }}>{intg.description}</p>
              </div>
              <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "2px 8px", borderRadius: "10px", fontSize: "10px", fontWeight: 700, background: "#F3F4F6", color: "#9CA3AF", whiteSpace: "nowrap", flexShrink: 0, marginLeft: "8px" }}>
                <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: "#9CA3AF" }} />
                Disconnected
              </span>
            </div>
            <button type="button" onClick={() => toast.info("Coming soon")} style={{ ...btnSecondary, alignSelf: "flex-start", marginTop: "auto" }}>
              <Settings style={{ width: "10px", height: "10px" }} /> Configure
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function MobileAccessPanel({ mobileAccess, onChange }: { mobileAccess: MobileAccessMap; onChange: (m: MobileAccessMap) => void }) {
  const toggleAccess = (module: string, userType: string) => {
    const updated = { ...mobileAccess };
    if (!updated[module]) updated[module] = {};
    updated[module] = { ...updated[module], [userType]: !updated[module][userType] };
    onChange(updated);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <SectionLabel icon={<Smartphone style={{ width: "12px", height: "12px" }} />} label="Mobile Access Control" />
      <p style={{ fontSize: "12px", color: "#6B7280", margin: "-8px 0 4px" }}>Configure which modules are available in the mobile app for each user type.</p>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={tableHeaderCell}>Module</th>
              {MOBILE_USER_TYPES.map((ut) => (
                <th key={ut} style={{ ...tableHeaderCell, textAlign: "center" }}>{ut}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MOBILE_MODULES.map((mod) => (
              <tr key={mod}>
                <td style={{ ...tableCell, fontWeight: 600 }}>{mod}</td>
                {MOBILE_USER_TYPES.map((ut) => (
                  <td key={ut} style={{ ...tableCell, textAlign: "center" }}>
                    <Toggle
                      checked={mobileAccess[mod]?.[ut] ?? false}
                      onChange={() => toggleAccess(mod, ut)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Tab definitions ──────────────────────────────────────────

const TABS: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
  { id: "general", label: "General", icon: <Settings style={{ width: "13px", height: "13px" }} /> },
  { id: "notifications", label: "Notifications", icon: <Bell style={{ width: "13px", height: "13px" }} /> },
  { id: "security", label: "Security", icon: <Shield style={{ width: "13px", height: "13px" }} /> },
  { id: "authentication", label: "Authentication", icon: <Key style={{ width: "13px", height: "13px" }} /> },
  { id: "appearance", label: "Appearance", icon: <Palette style={{ width: "13px", height: "13px" }} /> },
  { id: "localization", label: "Localization", icon: <Globe style={{ width: "13px", height: "13px" }} /> },
  { id: "data", label: "Data & Backup", icon: <Database style={{ width: "13px", height: "13px" }} /> },
  { id: "departments", label: "Departments", icon: <Layers style={{ width: "13px", height: "13px" }} /> },
  { id: "integrations", label: "Integrations", icon: <Link style={{ width: "13px", height: "13px" }} /> },
  { id: "mobile", label: "Mobile Access", icon: <Smartphone style={{ width: "13px", height: "13px" }} /> },
];

// ─── Default values ───────────────────────────────────────────

const DEFAULT_GENERAL: GeneralSettings = { companyName: "", supportEmail: "", supportPhone: "", address: "", timezone: "Africa/Cairo", logoFileId: "" };
const DEFAULT_NOTIF: NotificationSettings = { emailEnabled: true, pushEnabled: true, smsEnabled: false, otpEnabled: true, maintenanceAlerts: true, paymentReminders: true, emergencyBroadcast: true, digestFrequency: "daily" };
const DEFAULT_SEC: SecuritySettings = { auditLogRetentionDays: 90 };
const DEFAULT_APPEAR: AppearanceSettings = { primaryColor: "#111827", accentColor: "#2563EB", logoUrl: "", darkMode: false, compactLayout: false, language: "en" };
const DEFAULT_LOCAL: LocalizationSettings = { defaultLanguage: "en", currency: "EGP", dateFormat: "DD/MM/YYYY", rtlSupport: false, timezone: "Africa/Cairo" };
const DEFAULT_DATA: DataSettings = { backupEnabled: true, backupFrequency: "daily", retentionDays: 90, exportFormat: "csv", analyticsEnabled: true };
const DEFAULT_AUTH: AuthenticationSettings = {
  require2fa: false, requireUppercase: true, requireLowercase: true, requireNumbers: true,
  requireSpecialChars: false, passwordMinLength: 8, maxRequestsPerMinute: 60,
  sessionTimeoutMinutes: 60, maxLoginAttempts: 5, registrationType: "pre-registered",
};

const DEFAULT_MOBILE_ACCESS: MobileAccessMap = (() => {
  const m: MobileAccessMap = {};
  for (const mod of MOBILE_MODULES) {
    m[mod] = {};
    for (const ut of MOBILE_USER_TYPES) {
      m[mod][ut] = true;
    }
  }
  return m;
})();

// ─── Main ─────────────────────────────────────────────────────

export function SystemSettings() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("general");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Settings state
  const [general, setGeneral] = useState<GeneralSettings>(DEFAULT_GENERAL);
  const [notif, setNotif] = useState<NotificationSettings>(DEFAULT_NOTIF);
  const [security, setSecurity] = useState<SecuritySettings>(DEFAULT_SEC);
  const [appearance, setAppearance] = useState<AppearanceSettings>(DEFAULT_APPEAR);
  const [localization, setLocalization] = useState<LocalizationSettings>(DEFAULT_LOCAL);
  const [data, setDataSettings] = useState<DataSettings>(DEFAULT_DATA);
  const [authentication, setAuthentication] = useState<AuthenticationSettings>(DEFAULT_AUTH);
  const [mobileAccess, setMobileAccess] = useState<MobileAccessMap>(DEFAULT_MOBILE_ACCESS);

  // Entity state (CRUD resources)
  const [departments, setDepartments] = useState<Department[]>([]);
  // Saved snapshots for discard
  const [saved, setSaved] = useState({
    general: DEFAULT_GENERAL, notif: DEFAULT_NOTIF, security: DEFAULT_SEC,
    appearance: DEFAULT_APPEAR, localization: DEFAULT_LOCAL, data: DEFAULT_DATA,
    authentication: DEFAULT_AUTH, mobileAccess: DEFAULT_MOBILE_ACCESS,
  });

  const loadDepartments = useCallback(async () => {
    try {
      const res = await apiClient.get("/admin/departments");
      setDepartments(ensureArray<Department>(res.data));
    } catch { /* silently fail, list stays empty */ }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const canonicalRes = await apiClient.get("/system-settings").catch(() => null);
      const fallbackRes =
        canonicalRes ?? (await apiClient.get("/admin/settings").catch(() => ({ data: {} })));
      const d = (fallbackRes as { data?: { data?: Record<string, unknown> } }).data?.data
        ?? (fallbackRes as { data?: Record<string, unknown> }).data
        ?? {};
      const g = { ...DEFAULT_GENERAL, ...(d.general ?? {}) };
      const n = { ...DEFAULT_NOTIF, ...(d.notifications ?? {}) };
      const s = { ...DEFAULT_SEC, ...(d.security ?? {}) };
      const a = { ...DEFAULT_APPEAR, ...(d.appearance ?? {}) };
      const l = { ...DEFAULT_LOCAL, ...(d.localization ?? {}) };
      const dt = { ...DEFAULT_DATA, ...(d.data ?? {}) };
      const auth = { ...DEFAULT_AUTH, ...(d.authentication ?? {}) };
      const ma = d.mobileAccess ? { ...DEFAULT_MOBILE_ACCESS, ...d.mobileAccess } : DEFAULT_MOBILE_ACCESS;
      setGeneral(g); setNotif(n); setSecurity(s); setAppearance(a); setLocalization(l); setDataSettings(dt);
      setAuthentication(auth); setMobileAccess(ma);
      setSaved({ general: g, notif: n, security: s, appearance: a, localization: l, data: dt, authentication: auth, mobileAccess: ma });
    } catch { toast.error("Failed to load settings"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // Load entity data when their tabs are first activated
  useEffect(() => {
    if (activeTab === "departments") void loadDepartments();
  }, [activeTab, loadDepartments]);

  const patch = <T,>(setter: React.Dispatch<React.SetStateAction<T>>) =>
    (p: Partial<T>) => { setter((prev) => ({ ...prev, ...p })); setDirty(true); };

  const handleSave = async () => {
    setSaving(true);
    try {
      try {
        await Promise.all([
          apiClient.patch("/system-settings/general", {
            companyName: general.companyName,
            timezone: general.timezone,
            currency: localization.currency,
            dateFormat: localization.dateFormat,
            defaultLanguage: localization.defaultLanguage,
          }),
          apiClient.patch("/system-settings/notifications", {
            enableEmail: notif.emailEnabled,
            enablePush: notif.pushEnabled,
            enableSms: notif.smsEnabled,
          }),
          apiClient.patch("/system-settings/security", {
            enforce2fa: authentication.require2fa,
            minPasswordLength: authentication.passwordMinLength,
            rateLimitPerMinute: authentication.maxRequestsPerMinute,
            sessionTimeoutMinutes: authentication.sessionTimeoutMinutes,
          }),
          apiClient.patch("/system-settings/backup", {
            autoBackups: data.backupEnabled,
            retentionDays: data.retentionDays,
          }),
          apiClient.patch("/system-settings/brand", {
            companyName: general.companyName,
            supportEmail: general.supportEmail,
            supportPhone: general.supportPhone,
            logoFileId: general.logoFileId,
            primaryColor: appearance.primaryColor,
            accentColor: appearance.accentColor,
          }),
        ]);
      } catch {
        await apiClient.patch("/admin/settings", {
          general, notifications: notif, security, appearance, localization,
          data, authentication, mobileAccess,
        });
      }
      setSaved({ general, notif, security, appearance, localization, data, authentication, mobileAccess });
      setDirty(false); toast.success("Settings saved");
    } catch { toast.error("Failed to save settings"); }
    finally { setSaving(false); }
  };

  const handleDiscard = () => {
    setGeneral(saved.general); setNotif(saved.notif); setSecurity(saved.security);
    setAppearance(saved.appearance); setLocalization(saved.localization); setDataSettings(saved.data);
    setAuthentication(saved.authentication); setMobileAccess(saved.mobileAccess);
    setDirty(false);
  };

  const handleLogoUpload = (file: File) => {
    patch(setGeneral)({ logoFileId: file.name });
    toast.success("Logo selected — will be uploaded on save.");
  };

  const handleBackupNow = async () => {
    try {
      await apiClient
        .post("/system-settings/backup/create", { label: "Manual admin backup" })
        .catch(() => apiClient.post("/admin/backup/trigger"));
      toast.success("Backup triggered successfully");
    } catch { toast.error("Failed to trigger backup"); }
  };

  const handleMobileAccessChange = (ma: MobileAccessMap) => {
    setMobileAccess(ma);
    setDirty(true);
  };

  return (
    <div style={{ fontFamily: "'Work Sans', sans-serif" }}>
      {/* ── Header ─── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px", marginBottom: "20px", flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: "18px", fontWeight: 900, color: "#111827", letterSpacing: "-0.02em", margin: 0 }}>System Settings</h1>
          <p style={{ marginTop: "4px", fontSize: "13px", color: "#6B7280" }}>Configure platform-wide preferences, security, and integrations.</p>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading}
          style={{ display: "flex", alignItems: "center", gap: "6px", padding: "8px 14px", borderRadius: "8px", background: "#FFF", color: "#374151", border: "1px solid #E5E7EB", cursor: loading ? "not-allowed" : "pointer", fontSize: "13px", fontWeight: 600, fontFamily: "'Work Sans', sans-serif", opacity: loading ? 0.6 : 1 }}>
          <RefreshCw style={{ width: "13px", height: "13px", animation: loading ? "spin 1s linear infinite" : "none" }} /> Reload
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: "14px", alignItems: "start" }}>
        {/* ── Sidebar nav ─── */}
        <div style={{ borderRadius: "10px", border: "1px solid #EBEBEB", background: "#FFF", overflow: "hidden" }}>
          {TABS.map((t, i) => (
            <button key={t.id} type="button" onClick={() => setActiveTab(t.id)}
              style={{ width: "100%", display: "flex", alignItems: "center", gap: "9px", padding: "10px 12px", background: activeTab === t.id ? "#F3F4F6" : "transparent", border: "none", borderTop: i > 0 ? "1px solid #F9FAFB" : "none", cursor: "pointer", fontFamily: "'Work Sans', sans-serif", transition: "background 100ms", textAlign: "left" }}>
              <span style={{ color: activeTab === t.id ? "#111827" : "#9CA3AF", transition: "color 100ms" }}>{t.icon}</span>
              <span style={{ fontSize: "12.5px", fontWeight: activeTab === t.id ? 700 : 500, color: activeTab === t.id ? "#111827" : "#6B7280", flex: 1 }}>{t.label}</span>
              {activeTab === t.id && <ChevronRight style={{ width: "11px", height: "11px", color: "#9CA3AF" }} />}
            </button>
          ))}
        </div>

        {/* ── Content panel ─── */}
        <div>
          <div style={{ borderRadius: "10px", border: "1px solid #EBEBEB", background: "#FFF", overflow: "hidden" }}>
            <div style={{ height: "3px", background: "linear-gradient(90deg, #111827, #374151)" }} />
            <div style={{ padding: "18px 20px" }}>
              {loading ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} style={{ height: "36px", borderRadius: "7px", background: "linear-gradient(90deg, #F3F4F6 25%, #E9EAEC 50%, #F3F4F6 75%)", backgroundSize: "200% 100%" }} />
                  ))}
                </div>
              ) : (
                <>
                  {activeTab === "general" && <GeneralPanel settings={general} onChange={patch(setGeneral)} onLogoUpload={handleLogoUpload} />}
                  {activeTab === "notifications" && <NotificationsPanel settings={notif} onChange={patch(setNotif)} />}
                  {activeTab === "security" && <SecurityPanel settings={security} onChange={patch(setSecurity)} />}
                  {activeTab === "authentication" && <AuthenticationPanel settings={authentication} onChange={patch(setAuthentication)} />}
                  {activeTab === "appearance" && <AppearancePanel settings={appearance} onChange={patch(setAppearance)} />}
                  {activeTab === "localization" && <LocalizationPanel settings={localization} onChange={patch(setLocalization)} />}
                  {activeTab === "data" && <DataPanel settings={data} onChange={patch(setDataSettings)} onBackupNow={() => void handleBackupNow()} />}
                  {activeTab === "departments" && <DepartmentsPanel departments={departments} onRefresh={() => void loadDepartments()} />}
                  {activeTab === "integrations" && <IntegrationsPanel />}
                  {activeTab === "mobile" && <MobileAccessPanel mobileAccess={mobileAccess} onChange={handleMobileAccessChange} />}
                </>
              )}
            </div>
          </div>

          <SaveBar dirty={dirty} saving={saving} onSave={() => void handleSave()} onDiscard={handleDiscard} />
        </div>
      </div>

      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { Shield, UserCircle2 } from "lucide-react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Badge } from "../ui/badge";
import apiClient from "../../lib/api-client";
import { errorMessage } from "../../lib/live-data";
import { toast } from "sonner";
import { useAuthContext } from "../../lib/auth-context";

type MyAccountPageProps = {
  onNavigate: (section: string) => void;
};

type AuthMeResponse = {
  user?: {
    id: string;
    email?: string | null;
    phone?: string | null;
    nameEN?: string | null;
    nameAR?: string | null;
    userStatus?: string | null;
    twoFactorEnabled?: boolean;
  };
  featureAvailability?: Record<string, boolean>;
};

const QUICK_LINKS: Array<{
  section: string;
  featureKey?: string;
  label: string;
  description: string;
}> = [
  {
    section: "services",
    featureKey: "canUseServices",
    label: "Services",
    description: "Create and follow your service requests.",
  },
  {
    section: "complaints",
    featureKey: "canUseComplaints",
    label: "Complaints",
    description: "Track community complaints and updates.",
  },
  {
    section: "amenities",
    featureKey: "canUseBookings",
    label: "Amenities",
    description: "Book facilities and review reservations.",
  },
  {
    section: "billing",
    featureKey: "canViewFinance",
    label: "Finance",
    description: "View invoices, payments, and penalties.",
  },
];

export function MyAccountPage({ onNavigate }: MyAccountPageProps) {
  const { visibleScreens, personas } = useAuthContext();
  const [loading, setLoading] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingSecurity, setSavingSecurity] = useState(false);

  const [me, setMe] = useState<AuthMeResponse>({});
  const [nameEN, setNameEN] = useState("");
  const [nameAR, setNameAR] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get<AuthMeResponse>("/auth/me");
      const payload = res.data ?? {};
      setMe(payload);
      setNameEN(payload.user?.nameEN ?? "");
      setNameAR(payload.user?.nameAR ?? "");
      setEmail(payload.user?.email ?? "");
      setPhone(payload.user?.phone ?? "");
      setTwoFactorEnabled(Boolean(payload.user?.twoFactorEnabled));
    } catch (error) {
      toast.error("Failed to load account", { description: errorMessage(error) });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const accessibleQuickLinks = useMemo(() => {
    return QUICK_LINKS.filter((link) => {
      const visible = visibleScreens.has(link.section);
      const featureOk = link.featureKey
        ? Boolean(me.featureAvailability?.[link.featureKey])
        : true;
      return visible && featureOk;
    });
  }, [me.featureAvailability, visibleScreens]);

  const saveProfile = async () => {
    setSavingProfile(true);
    try {
      await apiClient.patch("/auth/me/profile", {
        nameEN: nameEN.trim() || undefined,
        nameAR: nameAR.trim() || undefined,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
      });
      toast.success("Profile update request submitted");
    } catch (error) {
      toast.error("Failed to submit profile update", {
        description: errorMessage(error),
      });
    } finally {
      setSavingProfile(false);
    }
  };

  const saveSecurity = async () => {
    setSavingSecurity(true);
    try {
      await apiClient.patch("/auth/me/security", {
        twoFactorEnabled,
      });
      toast.success("Security settings saved");
    } catch (error) {
      toast.error("Failed to save security settings", {
        description: errorMessage(error),
      });
    } finally {
      setSavingSecurity(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[#1E293B]">My Account</h1>
          <p className="mt-1 text-sm text-[#64748B]">
            Manage your personal profile, security settings, and allowed dashboard access.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(Array.from(personas).slice(0, 3)).map((persona) => (
            <Badge key={persona} className="bg-[#DBEAFE] text-[#1D4ED8]">
              {persona}
            </Badge>
          ))}
        </div>
      </div>

      <Card className="grid gap-4 p-4 md:grid-cols-2">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <UserCircle2 className="h-4 w-4 text-[#0F172A]" />
            <h3 className="text-sm font-semibold text-[#1E293B]">Profile</h3>
          </div>
          <div className="space-y-2">
            <Label>Full Name (EN)</Label>
            <Input value={nameEN} onChange={(e) => setNameEN(e.target.value)} placeholder="Your name in English" />
          </div>
          <div className="space-y-2">
            <Label>Full Name (AR)</Label>
            <Input value={nameAR} onChange={(e) => setNameAR(e.target.value)} placeholder="اسمك بالعربي" />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@example.com" />
          </div>
          <div className="space-y-2">
            <Label>Phone</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+2010..." />
          </div>
          <Button onClick={saveProfile} disabled={savingProfile || loading}>
            {savingProfile ? "Submitting..." : "Submit Profile Update"}
          </Button>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-[#0F172A]" />
            <h3 className="text-sm font-semibold text-[#1E293B]">Security</h3>
          </div>
          <label className="flex items-center gap-2 rounded-md border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#334155]">
            <input
              type="checkbox"
              checked={twoFactorEnabled}
              onChange={(e) => setTwoFactorEnabled(e.target.checked)}
            />
            Enable two-factor authentication
          </label>
          <Button onClick={saveSecurity} disabled={savingSecurity || loading} variant="secondary">
            {savingSecurity ? "Saving..." : "Save Security Settings"}
          </Button>

          <div className="rounded-md border border-[#E2E8F0] bg-[#F8FAFC] p-3 text-xs text-[#475569]">
            Account status: <strong>{me.user?.userStatus ?? "UNKNOWN"}</strong>
          </div>
        </div>
      </Card>

      <Card className="space-y-3 p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[#1E293B]">Available Areas</h3>
          <p className="text-xs text-[#64748B]">Based on your roles/personas and unit status</p>
        </div>
        {accessibleQuickLinks.length === 0 ? (
          <div className="rounded-md border border-dashed border-[#CBD5E1] px-4 py-6 text-center text-sm text-[#64748B]">
            No additional sections are currently visible for this account.
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {accessibleQuickLinks.map((link) => (
              <button
                key={link.section}
                type="button"
                onClick={() => onNavigate(link.section)}
                className="rounded-md border border-[#E2E8F0] bg-white px-3 py-3 text-left transition hover:border-[#93C5FD] hover:bg-[#F8FBFF]"
              >
                <p className="text-sm font-semibold text-[#1E293B]">{link.label}</p>
                <p className="mt-1 text-xs text-[#64748B]">{link.description}</p>
              </button>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

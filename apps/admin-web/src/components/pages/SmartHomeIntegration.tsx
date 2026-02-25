import { Card } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Home, Clock3, Wrench, ShieldCheck } from "lucide-react";

export function SmartHomeIntegration() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[#1E293B]">Smart Home Integration</h1>
          <p className="text-[#64748B] mt-1">Deferred for the next demo phase. This section is intentionally hidden until device-registry backend APIs are ready.</p>
        </div>
        <Badge className="bg-[#F59E0B]/10 text-[#F59E0B] hover:bg-[#F59E0B]/20">Deferred</Badge>
      </div>

      <Card className="rounded-xl p-8 shadow-card border border-[#E5E7EB]">
        <div className="flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#0B5FFF]/10">
              <Home className="h-7 w-7 text-[#0B5FFF]" />
            </div>
            <div className="space-y-2">
              <h3 className="text-[#1E293B]">Smart Home Module Planned</h3>
              <p className="max-w-2xl text-sm text-[#64748B]">
                We intentionally disabled partial metrics/register actions here to avoid a half-functional demo.
                The page will be re-enabled when admin device registry endpoints and CRUD workflows are available.
              </p>
            </div>
          </div>
          <Button variant="outline" disabled className="cursor-not-allowed">
            Device Registry Pending
          </Button>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="rounded-xl p-6 shadow-card">
          <div className="flex items-center gap-3 mb-3">
            <Clock3 className="w-5 h-5 text-[#F59E0B]" />
            <h4 className="text-[#1E293B]">Why It Is Deferred</h4>
          </div>
          <p className="text-sm text-[#64748B]">
            The backend currently exposes dashboard metrics only. Admin device list/create/update/delete endpoints are not available yet.
          </p>
        </Card>

        <Card className="rounded-xl p-6 shadow-card">
          <div className="flex items-center gap-3 mb-3">
            <Wrench className="w-5 h-5 text-[#0B5FFF]" />
            <h4 className="text-[#1E293B]">Required Backend Work</h4>
          </div>
          <ul className="text-sm text-[#64748B] space-y-2 list-disc pl-5">
            <li>Smart device registry CRUD endpoints</li>
            <li>Unit linkage and device status model</li>
            <li>Admin-safe create/edit/delete policies</li>
          </ul>
        </Card>

        <Card className="rounded-xl p-6 shadow-card">
          <div className="flex items-center gap-3 mb-3">
            <ShieldCheck className="w-5 h-5 text-[#10B981]" />
            <h4 className="text-[#1E293B]">Demo Readiness Impact</h4>
          </div>
          <p className="text-sm text-[#64748B]">
            This keeps the admin demo clean and avoids exposing non-functional buttons or partial flows in the sidebar page.
          </p>
        </Card>
      </div>
    </div>
  );
}

import {
  ClipboardList,
  ConciergeBell,
  Hotel,
  Users,
  type LucideIcon,
} from "lucide-react";
import { EmptyState } from "../EmptyState";
import { PageHeader } from "../PageHeader";

type HospitalityFeature = {
  icon: LucideIcon;
  label: string;
};

const FEATURE_PREVIEW: HospitalityFeature[] = [
  { icon: Users, label: "Hospitality Staff" },
  { icon: ConciergeBell, label: "Guest Services" },
  { icon: ClipboardList, label: "Service Workflows" },
];

export function HospitalityPage() {
  return (
    <div className="min-h-screen bg-white p-8 space-y-6">
      <PageHeader
        title="Hospitality"
        description="Manage hospitality services and guest experiences"
      />

      <div
        className="bg-white rounded-xl border border-gray-200 p-6
                   flex flex-col items-center justify-center
                   min-h-[480px] text-center"
      >
        <div
          className="w-16 h-16 rounded-2xl bg-blue-50
                      flex items-center justify-center mb-6"
        >
          <Hotel className="w-8 h-8 text-blue-600" />
        </div>

        <div
          className="bg-blue-50 border border-blue-200 rounded-full
                      px-3 py-1 mb-4"
        >
          <span className="text-xs font-medium text-blue-600 uppercase tracking-wider">
            Coming Soon
          </span>
        </div>

        <h2 className="text-xl font-semibold text-gray-900 mb-3">
          Hospitality Module
        </h2>

        <p className="text-sm text-gray-600 max-w-md leading-relaxed mb-6">
          The hospitality module will introduce a dedicated Hospitality user type
          and tools for managing guest services, concierge operations, and
          hospitality staff workflows.
        </p>

        {FEATURE_PREVIEW.length === 0 ? (
          <div className="w-full max-w-lg">
            <EmptyState
              compact
              title="Feature preview unavailable"
              description="Hospitality preview cards will appear here."
            />
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-4 w-full max-w-lg">
            {FEATURE_PREVIEW.map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="bg-gray-50 rounded-xl border border-gray-200 p-4
                           flex flex-col items-center gap-2"
              >
                <Icon className="w-5 h-5 text-gray-600" />
                <span className="text-xs text-gray-600">{label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

import { Users, ConciergeBell, ClipboardList, Hotel, ArrowRight } from "lucide-react";

type HospitalityFeature = {
  icon: React.ComponentType<{ style?: React.CSSProperties }>;
  label: string;
  description: string;
};

const FEATURES: HospitalityFeature[] = [
  { icon: Users, label: "Hospitality Staff", description: "Dedicated role for hospitality team members with custom access controls." },
  { icon: ConciergeBell, label: "Guest Services", description: "Manage guest requests, concierge tasks, and service fulfilment." },
  { icon: ClipboardList, label: "Service Workflows", description: "Build structured workflows for recurring hospitality tasks." },
];

export function HospitalityPage() {
  return (
    <div style={{ fontFamily: "'Work Sans', sans-serif" }}>
      {/* ── Header ─── */}
      <div style={{ marginBottom: "20px" }}>
        <h1 style={{ fontSize: "18px", fontWeight: 900, color: "#111827", letterSpacing: "-0.02em", margin: 0 }}>Hospitality</h1>
        <p style={{ marginTop: "4px", fontSize: "13px", color: "#6B7280" }}>Manage hospitality services and guest experiences.</p>
      </div>

      {/* ── Coming soon panel ─── */}
      <div style={{ borderRadius: "10px", border: "1px solid #EBEBEB", background: "#FFF", overflow: "hidden" }}>
        {/* Accent bar */}
        <div style={{ height: "3px", background: "linear-gradient(90deg, #0D9488, #2563EB)" }} />

        <div style={{ padding: "48px 32px", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
          {/* Icon */}
          <div style={{ width: "52px", height: "52px", borderRadius: "14px", background: "#EFF6FF", border: "1.5px solid #BFDBFE", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "16px" }}>
            <Hotel style={{ width: "24px", height: "24px", color: "#2563EB" }} />
          </div>

          {/* Badge */}
          <div style={{ display: "inline-flex", alignItems: "center", gap: "5px", padding: "3px 10px", borderRadius: "20px", border: "1px solid #BFDBFE", background: "#EFF6FF", marginBottom: "14px" }}>
            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#2563EB", animation: "pulse 2s infinite" }} />
            <span style={{ fontSize: "10.5px", fontWeight: 700, color: "#2563EB", textTransform: "uppercase", letterSpacing: "0.08em" }}>Coming Soon</span>
          </div>

          {/* Title */}
          <h2 style={{ fontSize: "16px", fontWeight: 900, color: "#111827", margin: "0 0 10px", letterSpacing: "-0.01em" }}>Hospitality Module</h2>

          {/* Description */}
          <p style={{ fontSize: "13px", color: "#6B7280", maxWidth: "440px", lineHeight: "1.6", margin: "0 0 32px" }}>
            The hospitality module will introduce a dedicated Hospitality user type and tools for managing guest services, concierge operations, and hospitality staff workflows.
          </p>

          {/* Feature preview cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px", width: "100%", maxWidth: "560px" }}>
            {FEATURES.map(({ icon: Icon, label, description }) => (
              <div key={label}
                style={{ borderRadius: "8px", border: "1px solid #EBEBEB", background: "#FAFAFA", padding: "14px", textAlign: "left", transition: "border-color 150ms, background 150ms" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = "#BFDBFE"; (e.currentTarget as HTMLDivElement).style.background = "#F8FBFF"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = "#EBEBEB"; (e.currentTarget as HTMLDivElement).style.background = "#FAFAFA"; }}>
                <div style={{ width: "28px", height: "28px", borderRadius: "7px", background: "#EFF6FF", border: "1px solid #BFDBFE", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "8px" }}>
                  <Icon style={{ width: "13px", height: "13px", color: "#2563EB" }} />
                </div>
                <p style={{ fontSize: "12.5px", fontWeight: 700, color: "#111827", margin: "0 0 4px" }}>{label}</p>
                <p style={{ fontSize: "11.5px", color: "#9CA3AF", margin: 0, lineHeight: "1.5" }}>{description}</p>
              </div>
            ))}
          </div>

          {/* Footer note */}
          <div style={{ display: "flex", alignItems: "center", gap: "5px", marginTop: "28px", fontSize: "12px", color: "#9CA3AF" }}>
            <ArrowRight style={{ width: "12px", height: "12px" }} />
            <span>This feature is actively being developed. Check back soon.</span>
          </div>
        </div>
      </div>

      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
    </div>
  );
}
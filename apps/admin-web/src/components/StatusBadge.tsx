interface StatusBadgeProps {
  value: string | null | undefined;
  className?: string;
}

// ─── Status tone map ──────────────────────────────────────────
// Each entry: { bg, color, dot } — all raw hex, no Tailwind
const TONES: Record<string, { bg: string; color: string; dot: string }> = {
  // ── Green: success / resolved / active
  ACTIVE:    { bg: "#ECFDF5", color: "#065F46", dot: "#10B981" },
  APPROVED:  { bg: "#ECFDF5", color: "#065F46", dot: "#10B981" },
  PAID:      { bg: "#ECFDF5", color: "#065F46", dot: "#10B981" },
  RESOLVED:  { bg: "#ECFDF5", color: "#065F46", dot: "#10B981" },
  COMPLETED: { bg: "#ECFDF5", color: "#065F46", dot: "#10B981" },

  // ── Teal: in motion / checked-in
  IN_PROGRESS: { bg: "#F0FDFA", color: "#0D9488", dot: "#0D9488" },
  CHECKED_IN:  { bg: "#F0FDFA", color: "#0D9488", dot: "#0D9488" },
  PROCESSING:  { bg: "#F0FDFA", color: "#0D9488", dot: "#0D9488" },

  // ── Blue: new / open / awaiting
  NEW:       { bg: "#EFF6FF", color: "#1D4ED8", dot: "#2563EB" },
  OPEN:      { bg: "#EFF6FF", color: "#1D4ED8", dot: "#2563EB" },
  SUBMITTED: { bg: "#EFF6FF", color: "#1D4ED8", dot: "#2563EB" },
  SENT:      { bg: "#EFF6FF", color: "#1D4ED8", dot: "#2563EB" },

  // ── Amber: pending / waiting / on hold
  PENDING:    { bg: "#FFFBEB", color: "#92400E", dot: "#D97706" },
  ON_HOLD:    { bg: "#FFFBEB", color: "#92400E", dot: "#D97706" },
  UNDER_REVIEW: { bg: "#FFFBEB", color: "#92400E", dot: "#D97706" },
  DRAFT:      { bg: "#FFFBEB", color: "#92400E", dot: "#D97706" },

  // ── Dark pink / rose: rejected / cancelled / suspended
  REJECTED:   { bg: "#FFF1F2", color: "#BE185D", dot: "#E11D48" },
  CANCELLED:  { bg: "#FFF1F2", color: "#BE185D", dot: "#E11D48" },
  SUSPENDED:  { bg: "#FFF1F2", color: "#BE185D", dot: "#E11D48" },
  FAILED:     { bg: "#FFF1F2", color: "#BE185D", dot: "#E11D48" },
  REVOKED:    { bg: "#FFF1F2", color: "#BE185D", dot: "#E11D48" },

  // ── Red: overdue / urgent / violation
  OVERDUE:    { bg: "#FEF2F2", color: "#991B1B", dot: "#DC2626" },
  URGENT:     { bg: "#FEF2F2", color: "#991B1B", dot: "#DC2626" },
  VIOLATED:   { bg: "#FEF2F2", color: "#991B1B", dot: "#DC2626" },

  // ── Purple / violet: appealed / escalated
  APPEALED:   { bg: "#F5F3FF", color: "#5B21B6", dot: "#7C3AED" },
  ESCALATED:  { bg: "#F5F3FF", color: "#5B21B6", dot: "#7C3AED" },
  DISPUTED:   { bg: "#F5F3FF", color: "#5B21B6", dot: "#7C3AED" },

  // ── Neutral: closed / inactive / archived
  CLOSED:     { bg: "#F3F4F6", color: "#4B5563", dot: "#9CA3AF" },
  INACTIVE:   { bg: "#F3F4F6", color: "#4B5563", dot: "#9CA3AF" },
  ARCHIVED:   { bg: "#F3F4F6", color: "#4B5563", dot: "#9CA3AF" },
  EXPIRED:    { bg: "#F3F4F6", color: "#4B5563", dot: "#9CA3AF" },
  UNKNOWN:    { bg: "#F3F4F6", color: "#4B5563", dot: "#9CA3AF" },
};

// Humanize: UNDER_REVIEW → Under Review
function humanize(key: string) {
  return key
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function StatusBadge({ value, className }: StatusBadgeProps) {
  const key = String(value || "UNKNOWN").toUpperCase();
  const tone = TONES[key] ?? TONES.UNKNOWN;
  const label = value ? humanize(key) : "Unknown";

  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "5px",
        padding: "3px 9px",
        borderRadius: "6px",
        background: tone.bg,
        fontSize: "11.5px",
        fontWeight: 600,
        color: tone.color,
        fontFamily: "'Work Sans', sans-serif",
        letterSpacing: "0.01em",
        whiteSpace: "nowrap",
        lineHeight: 1.4,
      }}
    >
      {/* Status dot */}
      <span style={{
        width: "5px",
        height: "5px",
        borderRadius: "50%",
        background: tone.dot,
        flexShrink: 0,
        display: "inline-block",
      }} />
      {label}
    </span>
  );
}
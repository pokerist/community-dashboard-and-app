import { ReactNode } from "react";
import { EmptyState } from "./EmptyState";

export interface DataTableColumn<TRow> {
  key: string;
  header: string;
  className?: string;
  render: (row: TRow) => ReactNode;
}

interface DataTableProps<TRow> {
  columns: DataTableColumn<TRow>[];
  rows: TRow[];
  rowKey: (row: TRow) => string;
  loading?: boolean;
  skeletonRows?: number;
  emptyTitle?: string;
  emptyDescription?: string;
  variant?: "light" | "dark";
  wrapperClassName?: string;
  headerRowClassName?: string;
  rowClassName?: string | ((row: TRow) => string);
  cellClassName?: string;
  onRowClick?: (row: TRow) => void;
  minTableWidth?: number | string;
}

// Teal → Blue → Dark pink, cycling per column
const ACCENTS = ["#0D9488", "#2563EB", "#BE185D"];
const accentFor = (i: number) => ACCENTS[i % ACCENTS.length];

// Varied skeleton widths so the loading state looks natural
const SK_WIDTHS = ["62%", "78%", "48%", "68%", "55%", "72%"];

function SkeletonBar({ colIdx, dark }: { colIdx: number; dark: boolean }) {
  return (
    <div style={{
      height: "12px",
      width: SK_WIDTHS[colIdx % SK_WIDTHS.length],
      borderRadius: "4px",
      backgroundImage: dark
        ? "linear-gradient(90deg,rgba(255,255,255,0.06) 25%,rgba(255,255,255,0.12) 50%,rgba(255,255,255,0.06) 75%)"
        : "linear-gradient(90deg,#F3F4F6 25%,#E9EAEC 50%,#F3F4F6 75%)",
      backgroundSize: "200% 100%",
      animation: "dt-shimmer 1.4s ease infinite",
    }} />
  );
}

export function DataTable<TRow>({
  columns,
  rows,
  rowKey,
  loading = false,
  skeletonRows = 6,
  emptyTitle = "No records found",
  emptyDescription,
  variant = "light",
  wrapperClassName,
  rowClassName,
  onRowClick,
  minTableWidth,
}: DataTableProps<TRow>) {

  if (!loading && rows.length === 0) {
    return (
      <EmptyState
        title={emptyTitle}
        description={emptyDescription}
        variant={variant === "dark" ? "dark" : "light"}
      />
    );
  }

  const isDark = variant === "dark";

  return (
    <>
      <style>{`
        @keyframes dt-shimmer {
          0%   { background-position:  200% 0 }
          100% { background-position: -200% 0 }
        }
        .dt-row:hover .dt-cell {
          background: ${isDark ? "rgba(255,255,255,0.025)" : "#FAFAFA"} !important;
        }
      `}</style>

      <div
        className={wrapperClassName}
        style={{
          borderRadius: "10px",
          border: isDark ? "1px solid rgba(255,255,255,0.06)" : "1px solid #EBEBEB",
          overflowX: "auto",
          overflowY: "hidden",
          background: isDark ? "#181C27" : "#FFFFFF",
          boxShadow: isDark ? "none" : "0 1px 4px rgba(0,0,0,0.05)",
          fontFamily: "'Work Sans', sans-serif",
        }}
      >
        <table style={{ width: "max-content", minWidth: minTableWidth ?? "100%", borderCollapse: "collapse" }}>

          {/* ── Header ───────────────────────────────────────── */}
          <thead>
            <tr style={{ background: isDark ? "#0F1117" : "#FAFAFA" }}>
              {columns.map((col, ci) => {
                const accent = accentFor(ci);
                return (
                  <th
                    key={col.key}
                    className={col.className}
                    style={{
                      padding: "10px 16px",
                      textAlign: "left",
                      fontSize: "10.5px",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.07em",
                      color: isDark ? "#6B7280" : "#9CA3AF",
                      borderBottom: isDark
                        ? "1px solid rgba(255,255,255,0.06)"
                        : "1px solid #EBEBEB",
                      // Subtle colored underline glow per column
                      boxShadow: `inset 0 -2px 0 ${accent}35`,
                      whiteSpace: "nowrap",
                    }}
                  >
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                      {/* Accent dot */}
                      <span style={{
                        width: "5px", height: "5px", borderRadius: "50%",
                        background: accent, opacity: 0.8, flexShrink: 0,
                      }} />
                      {col.header}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>

          {/* ── Body ─────────────────────────────────────────── */}
          <tbody>
            {loading
              ? Array.from({ length: skeletonRows }).map((_, ri) => (
                  <tr key={`sk-${ri}`}>
                    {columns.map((col, ci) => (
                      <td
                        key={`${col.key}-sk-${ri}`}
                        className={col.className}
                        style={{
                          padding: "12px 16px",
                          borderBottom: ri < skeletonRows - 1
                            ? isDark ? "1px solid rgba(255,255,255,0.04)" : "1px solid #F3F4F6"
                            : "none",
                        }}
                      >
                        <SkeletonBar colIdx={ci} dark={isDark} />
                      </td>
                    ))}
                  </tr>
                ))

              : rows.map((row, ri) => {
                  const extra = typeof rowClassName === "function" ? rowClassName(row) : (rowClassName ?? "");
                  const isLast = ri === rows.length - 1;
                  return (
                    <tr
                      key={rowKey(row)}
                      className={`dt-row ${extra}`}
                      style={{ transition: "background 100ms ease", cursor: onRowClick ? "pointer" : undefined }}
                      onClick={onRowClick ? () => onRowClick(row) : undefined}
                    >
                      {columns.map((col, ci) => {
                        const accent = accentFor(ci);
                        return (
                          <td
                            key={`${col.key}-${rowKey(row)}`}
                            className={`dt-cell ${col.className ?? ""}`}
                            style={{
                              padding: "11px 16px",
                              fontSize: "13px",
                              color: isDark ? "#CBD5E1" : "#374151",
                              borderBottom: isLast
                                ? "none"
                                : isDark ? "1px solid rgba(255,255,255,0.04)" : "1px solid #F5F5F5",
                              // First column gets a faint accent left border
                              borderLeft: ci === 0 ? `2px solid ${accent}30` : "none",
                              transition: "background 100ms ease",
                              fontFamily: "'Work Sans', sans-serif",
                            }}
                          >
                            {col.render(row)}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
          </tbody>
        </table>
      </div>
    </>
  );
}

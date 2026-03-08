import { ReactNode, useEffect } from "react";
import { X } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────

interface DrawerFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  width?: number | string;
  variant?: "light" | "dark";
}

// ─── Style tokens ─────────────────────────────────────────────

const ff = "'Work Sans', sans-serif";

// ─── Component ────────────────────────────────────────────────

export function DrawerForm({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  width = 480,
  variant = "light",
}: DrawerFormProps) {
  const isDark = variant === "dark";

  const bg           = isDark ? "#181C27" : "#FFF";
  const headerBorder = isDark ? "rgba(255,255,255,0.07)" : "#F3F4F6";
  const titleColor   = isDark ? "#F1F5F9" : "#111827";
  const descColor    = isDark ? "#94A3B8" : "#9CA3AF";
  const closeHover   = isDark ? "rgba(255,255,255,0.08)" : "#F3F4F6";
  const closeColor   = isDark ? "#94A3B8" : "#6B7280";

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onOpenChange(false); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onOpenChange]);

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const widthPx = typeof width === "number" ? `${width}px` : width;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={() => onOpenChange(false)}
        style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", backdropFilter: "blur(2px)",
          zIndex: 49, opacity: open ? 1 : 0, pointerEvents: open ? "auto" : "none",
          transition: "opacity 220ms ease",
        }}
      />

      {/* Drawer panel */}
      <div
        style={{
          position: "fixed", top: 0, right: 0, bottom: 0, width: widthPx,
          maxWidth: "calc(100vw - 24px)", zIndex: 50,
          transform: open ? "translateX(0)" : "translateX(100%)",
          transition: "transform 260ms cubic-bezier(0.32, 0.72, 0, 1)",
          background: bg,
          borderLeft: `1px solid ${isDark ? "rgba(255,255,255,0.06)" : "#EBEBEB"}`,
          boxShadow: "-8px 0 32px rgba(0,0,0,0.12)",
          display: "flex", flexDirection: "column",
          fontFamily: ff,
        }}
      >
        {/* Top gradient accent */}
        <div style={{ height: "3px", flexShrink: 0, background: isDark ? "linear-gradient(90deg,#374151,#1F2937)" : "linear-gradient(90deg,#111827,#374151)" }} />

        {/* Header */}
        <div style={{ padding: "16px 20px 14px", borderBottom: `1px solid ${headerBorder}`, flexShrink: 0, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "10px" }}>
          <div style={{ minWidth: 0 }}>
            <h2 style={{ fontSize: "14px", fontWeight: 800, color: titleColor, margin: 0, letterSpacing: "-0.01em", fontFamily: ff }}>
              {title}
            </h2>
            {description && (
              <p style={{ fontSize: "12px", color: descColor, margin: "3px 0 0", fontFamily: ff, lineHeight: 1.4 }}>
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            style={{ width: "28px", height: "28px", borderRadius: "6px", border: "none", background: "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: closeColor, flexShrink: 0, transition: "background 120ms" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = closeHover; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
          >
            <X style={{ width: "13px", height: "13px" }} />
          </button>
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "18px 20px", display: "flex", flexDirection: "column", gap: "14px" }}>
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div style={{ padding: "12px 20px", borderTop: `1px solid ${headerBorder}`, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "8px" }}>
            {footer}
          </div>
        )}
      </div>

      <style>{`@keyframes drawerIn{from{transform:translateX(100%)}to{transform:translateX(0)}}`}</style>
    </>
  );
}
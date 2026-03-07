import { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  variant?: "light" | "dark";
  className?: string;
}

export function PageHeader({
  title,
  description,
  actions,
  variant = "light",
  className,
}: PageHeaderProps) {
  const isDark = variant === "dark";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: "16px",
        marginBottom: "24px",
        fontFamily: "'Work Sans', sans-serif",
      }}
      className={className}
    >
      {/* Left: title + description */}
      <div style={{ minWidth: 0, flex: 1 }}>
        <h1
          style={{
            fontSize: "18px",
            fontWeight: 700,
            color: isDark ? "#F9FAFB" : "#111827",
            lineHeight: 1.2,
            letterSpacing: "-0.02em",
            margin: 0,
            fontFamily: "'Work Sans', sans-serif",
          }}
        >
          {title}
        </h1>

        {description && (
          <p
            style={{
              marginTop: "4px",
              fontSize: "13px",
              color: isDark ? "#9CA3AF" : "#6B7280",
              lineHeight: 1.5,
              fontWeight: 400,
            }}
          >
            {description}
          </p>
        )}
      </div>

      {/* Right: action buttons */}
      {actions && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            flexShrink: 0,
          }}
        >
          {actions}
        </div>
      )}
    </div>
  );
}
import { ReactNode } from "react";
import { Card } from "./ui/card";

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
  variant?: "light" | "dark";
  compact?: boolean;
}

export function EmptyState({
  title,
  description,
  action,
  variant = "light",
  compact = false,
}: EmptyStateProps) {
  const cardClass =
    variant === "dark"
      ? "rounded-xl border border-white/10 bg-[#0f1117] text-center"
      : "rounded-xl border border-dashed border-[#CBD5E1] bg-[#F8FAFC] text-center";
  const titleClass =
    variant === "dark"
      ? "text-base font-semibold text-slate-100"
      : "text-base font-semibold text-[#0F172A]";
  const descriptionClass =
    variant === "dark"
      ? "mx-auto mt-2 max-w-xl text-sm text-slate-400"
      : "mx-auto mt-2 max-w-xl text-sm text-[#64748B]";
  const paddingClass = compact ? "p-6" : "p-8";

  return (
    <Card className={`${cardClass} ${paddingClass}`}>
      <h3 className={titleClass}>{title}</h3>
      {description ? (
        <p className={descriptionClass}>{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </Card>
  );
}

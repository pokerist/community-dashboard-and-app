import { ReactNode } from "react";
import { cn } from "./ui/utils";

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
  return (
    <div className={cn("flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between", className)}>
      <div>
        <h1 className={cn("text-2xl font-semibold", variant === "dark" ? "text-slate-100" : "text-[#0F172A]")}>
          {title}
        </h1>
        {description ? (
          <p className={cn("mt-1 text-sm", variant === "dark" ? "text-slate-400" : "text-[#64748B]")}>
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}

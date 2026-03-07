import { Skeleton } from "./ui/skeleton";
import { cn } from "./ui/utils";

interface SkeletonTableProps {
  columns: number;
  rows?: number;
  variant?: "light" | "dark";
}

function gridClass(columns: number): string {
  const map: Record<number, string> = {
    1: "grid-cols-1",
    2: "grid-cols-2",
    3: "grid-cols-3",
    4: "grid-cols-4",
    5: "grid-cols-5",
    6: "grid-cols-6",
    7: "grid-cols-7",
    8: "grid-cols-8",
    9: "grid-cols-9",
    10: "grid-cols-10",
    11: "grid-cols-11",
    12: "grid-cols-12",
  };
  return map[columns] ?? "grid-cols-4";
}

export function SkeletonTable({ columns, rows = 6, variant = "light" }: SkeletonTableProps) {
  const isDark = variant === "dark";
  const colsClass = gridClass(columns);

  return (
    <div className={cn(isDark ? "rounded-xl border border-white/5 bg-[#181c27] overflow-hidden" : "overflow-hidden rounded-xl border border-[#E2E8F0] bg-white")}>
      <div className={cn("grid gap-2 px-4 py-3", colsClass, isDark ? "border-b border-white/5 bg-[#0f1117]" : "border-b border-[#E2E8F0] bg-[#F8FAFC]")}>
        {Array.from({ length: columns }).map((_, index) => (
          <Skeleton key={`head-${index}`} className={cn("h-4 w-24", isDark ? "bg-white/10" : "")} />
        ))}
      </div>
      <div className="space-y-2 p-4">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div
            key={`row-${rowIndex}`}
            className={cn("grid gap-2", colsClass)}
          >
            {Array.from({ length: columns }).map((__, colIndex) => (
              <Skeleton key={`cell-${rowIndex}-${colIndex}`} className={cn("h-4 w-full", isDark ? "bg-white/10" : "")} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

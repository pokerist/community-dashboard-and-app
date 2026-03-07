import { ReactNode } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "./ui/sheet";
import { cn } from "./ui/utils";

interface DrawerFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  widthClassName?: string;
  variant?: "light" | "dark";
}

export function DrawerForm({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  widthClassName = "w-[480px] max-w-[calc(100vw-24px)]",
  variant = "light",
}: DrawerFormProps) {
  const isDark = variant === "dark";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className={cn(
          "p-0",
          widthClassName,
          isDark
            ? "bg-[#181c27] border-l border-white/5 flex flex-col"
            : "bg-white border-l border-[#E2E8F0] flex flex-col",
        )}
      >
        <SheetHeader className={cn(isDark ? "px-6 py-5 border-b border-white/5 flex-shrink-0" : "border-b border-[#E2E8F0] px-6 py-5 flex-shrink-0")}>
          <SheetTitle className={cn(isDark ? "text-base font-semibold text-slate-100" : "text-base font-semibold text-[#0F172A]")}>{title}</SheetTitle>
          {description ? (
            <SheetDescription className={cn(isDark ? "text-slate-400" : "text-sm text-[#64748B]")}>{description}</SheetDescription>
          ) : null}
        </SheetHeader>
        <div className={cn(isDark ? "h-[calc(100vh-140px)] overflow-y-auto px-6 py-6 space-y-4" : "h-[calc(100vh-140px)] overflow-y-auto px-6 py-6 space-y-4")}>
          {children}
        </div>
        {footer ? (
          <SheetFooter className={cn(isDark ? "px-6 py-4 border-t border-white/5 flex items-center justify-end gap-3 flex-shrink-0" : "border-t border-[#E2E8F0] px-6 py-4 flex items-center justify-end gap-3 flex-shrink-0")}>
            {footer}
          </SheetFooter>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

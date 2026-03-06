import { ReactNode } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "./ui/sheet";

interface DrawerFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  widthClassName?: string;
}

export function DrawerForm({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  widthClassName = "w-full sm:max-w-[480px]",
}: DrawerFormProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className={`p-0 ${widthClassName}`}>
        <SheetHeader className="border-b border-[#E2E8F0] p-5">
          <SheetTitle>{title}</SheetTitle>
          {description ? <SheetDescription>{description}</SheetDescription> : null}
        </SheetHeader>
        <div className="h-[calc(100vh-140px)] overflow-y-auto p-5">{children}</div>
        {footer ? <SheetFooter className="border-t border-[#E2E8F0] p-4">{footer}</SheetFooter> : null}
      </SheetContent>
    </Sheet>
  );
}


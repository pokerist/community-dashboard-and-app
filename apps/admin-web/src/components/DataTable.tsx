import { ReactNode } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import { Skeleton } from "./ui/skeleton";
import { EmptyState } from "./EmptyState";
import { cn } from "./ui/utils";

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
  headerRowClassName,
  rowClassName,
  cellClassName,
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

  const wrapperBaseClassName =
    variant === "dark"
      ? "rounded-xl border border-white/5 overflow-hidden bg-[#181c27]"
      : "overflow-hidden rounded-xl border border-[#E2E8F0] bg-white";

  const headRowBaseClassName =
    variant === "dark"
      ? "bg-[#0f1117] border-b border-white/5"
      : "bg-[#F8FAFC]";

  const tableHeadBaseClassName =
    variant === "dark"
      ? "py-3 px-4 text-left text-xs font-medium text-slate-500 uppercase tracking-wider"
      : undefined;

  const tableCellBaseClassName =
    variant === "dark"
      ? "py-4 px-4 text-sm text-slate-300"
      : undefined;

  const rowBaseClassName =
    variant === "dark"
      ? "border-b border-white/5 hover:bg-white/[0.02] transition-colors last:border-0"
      : undefined;

  return (
    <div className={cn(wrapperBaseClassName, wrapperClassName)}>
      <Table>
        <TableHeader>
          <TableRow className={cn(headRowBaseClassName, headerRowClassName)}>
            {columns.map((column) => (
              <TableHead
                key={column.key}
                className={cn(tableHeadBaseClassName, column.className)}
              >
                {column.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading
            ? Array.from({ length: skeletonRows }).map((_, index) => (
                <TableRow key={`skeleton-${index}`} className={rowBaseClassName}>
                  {columns.map((column) => (
                    <TableCell
                      key={`${column.key}-${index}`}
                      className={cn(tableCellBaseClassName, cellClassName, column.className)}
                    >
                      <Skeleton
                        className={cn(
                          "h-4 w-full max-w-[140px]",
                          variant === "dark" ? "bg-white/10" : "",
                        )}
                      />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            : rows.map((row) => (
                <TableRow
                  key={rowKey(row)}
                  className={cn(
                    rowBaseClassName,
                    typeof rowClassName === "function" ? rowClassName(row) : rowClassName,
                  )}
                >
                  {columns.map((column) => (
                    <TableCell
                      key={`${column.key}-${rowKey(row)}`}
                      className={cn(tableCellBaseClassName, cellClassName, column.className)}
                    >
                      {column.render(row)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
        </TableBody>
      </Table>
    </div>
  );
}

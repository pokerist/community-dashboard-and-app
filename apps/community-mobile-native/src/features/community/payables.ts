import type { InvoiceRow, PayableItem, ViolationRow } from './types';

function toNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function isPayableStatus(status?: string | null): boolean {
  const key = String(status ?? '').toUpperCase();
  return key === 'PENDING' || key === 'OVERDUE';
}

function violationLabel(v: ViolationRow): string {
  const type = String(v.type ?? 'VIOLATION').replaceAll('_', ' ');
  return `${type} Fine`;
}

export function buildPayables(
  invoices: InvoiceRow[],
  violations: ViolationRow[],
): PayableItem[] {
  const out: PayableItem[] = [];
  const coveredViolationIds = new Set<string>();

  for (const inv of invoices) {
    const status = String(inv.status ?? 'UNKNOWN').toUpperCase();
    if (!isPayableStatus(status)) continue;
    const amount = toNumber(inv.amount);
    if (amount <= 0) continue;
    out.push({
      key: `invoice:${inv.id}`,
      kind: 'INVOICE',
      invoiceId: inv.id,
      violationId: inv.violationId ?? undefined,
      title:
        String(inv.type ?? 'INVOICE').replaceAll('_', ' ') +
        (inv.violationId ? ' (Fine)' : ''),
      amount,
      dueDate: inv.dueDate ?? null,
      status,
      unitId: inv.unitId ?? inv.unit?.id ?? null,
      sourceType: inv.type ?? null,
    });
    if (inv.violationId) coveredViolationIds.add(inv.violationId);
  }

  for (const violation of violations) {
    if (!violation?.id || coveredViolationIds.has(violation.id)) continue;
    const linkedInvoice = (violation.invoices ?? []).find((inv) =>
      isPayableStatus(inv.status),
    );
    if (linkedInvoice) {
      const amount = toNumber(linkedInvoice.amount ?? violation.fineAmount);
      if (amount <= 0) continue;
      out.push({
        key: `violation-invoice:${linkedInvoice.id}`,
        kind: 'VIOLATION_FINE',
        invoiceId: linkedInvoice.id,
        violationId: violation.id,
        title: violationLabel(violation),
        amount,
        dueDate: linkedInvoice.dueDate ?? violation.dueDate ?? null,
        status: String(linkedInvoice.status ?? 'PENDING').toUpperCase(),
        unitId:
          violation.unitId ??
          violation.unit?.id ??
          linkedInvoice.unitId ??
          null,
        sourceType: 'VIOLATION_FINE',
      });
      coveredViolationIds.add(violation.id);
      continue;
    }

    const fallbackStatus = String(violation.status ?? '').toUpperCase();
    const amount = toNumber(violation.fineAmount);
    if (!isPayableStatus(fallbackStatus) || amount <= 0) continue;
    out.push({
      key: `violation:${violation.id}`,
      kind: 'VIOLATION_FINE',
      violationId: violation.id,
      title: violationLabel(violation),
      amount,
      dueDate: violation.dueDate ?? null,
      status: fallbackStatus,
      unitId: violation.unitId ?? violation.unit?.id ?? null,
      sourceType: 'VIOLATION_FINE',
    });
  }

  return out.sort((a, b) => {
    const da = new Date(a.dueDate ?? 0).getTime();
    const db = new Date(b.dueDate ?? 0).getTime();
    return da - db;
  });
}

export function filterPayablesByUnit(
  rows: PayableItem[],
  unitId?: string | null,
): PayableItem[] {
  if (!unitId) return rows;
  return rows.filter((row) => row.unitId === unitId);
}


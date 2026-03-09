import { humanizeEnum } from "./live-data";

export type TicketKind = "SERVICE" | "REQUEST" | "COMPLAINT" | "VIOLATION";

function normalized(value?: string | null): string {
  return String(value ?? "").toUpperCase();
}

export function adminPriorityLabel(value?: string | null): string {
  const key = normalized(value);
  switch (key) {
    case "LOW":
      return "Low";
    case "MEDIUM":
      return "Normal";
    case "HIGH":
      return "High";
    case "CRITICAL":
      return "Urgent";
    default:
      return humanizeEnum(key || "MEDIUM");
  }
}

export function adminTicketStatusLabel(kind: TicketKind | string, value?: string | null): string {
  const key = normalized(value);
  const ticketKind = normalized(kind);
  if (!key) return "—";
  if (ticketKind === "VIOLATION") {
    switch (key) {
      case "PENDING":      return "Pending Review";
      case "UNDER_REVIEW":  return "Under Review";
      case "APPEALED":      return "Appealed";
      case "PAID":          return "Paid";
      case "CLOSED":        return "Closed";
      case "CANCELLED":     return "Cancelled";
      default:              return humanizeEnum(key);
    }
  }
  switch (key) {
    case "NEW":
      return "Pending Approval";
    case "IN_PROGRESS":
      return ticketKind === "COMPLAINT" ? "Under Review" : "Approved / In Progress";
    case "PENDING_RESIDENT":
      return "Awaiting Resident Response";
    case "RESOLVED":
      return "Resolved";
    case "CLOSED":
      return ticketKind === "COMPLAINT" ? "Closed" : "Completed / Closed";
    case "CANCELLED":
      return ticketKind === "COMPLAINT" ? "Cancelled" : "Cancelled by Resident";
    case "REJECTED":
      return "Rejected by Management";
    default:
      return humanizeEnum(key);
  }
}

export function adminComplaintStatusLabel(value?: string | null): string {
  return adminTicketStatusLabel("COMPLAINT", value);
}

export function adminInvoiceStatusLabel(value?: string | null): string {
  const key = normalized(value);
  switch (key) {
    case "PENDING":
      return "Pending Payment";
    case "OVERDUE":
      return "Overdue";
    case "PAID":
      return "Paid";
    case "CANCELLED":
      return "Cancelled";
    default:
      return humanizeEnum(key || "PENDING");
  }
}

export function adminViolationStatusLabel(value?: string | null): string {
  const key = normalized(value);
  switch (key) {
    case "PENDING":
      return "Pending";
    case "RESOLVED":
      return "Resolved";
    case "PAID":
      return "Paid";
    case "CANCELLED":
      return "Cancelled";
    default:
      return humanizeEnum(key || "PENDING");
  }
}

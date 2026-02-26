function norm(value?: string | null): string {
  return String(value ?? '').toUpperCase();
}

function humanizeToken(value?: string | null): string {
  return String(value ?? '')
    .trim()
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function priorityDisplayLabel(value?: string | null): string {
  switch (norm(value)) {
    case 'LOW':
      return 'Low';
    case 'MEDIUM':
      return 'Normal';
    case 'HIGH':
      return 'High';
    case 'CRITICAL':
      return 'Urgent';
    default:
      return humanizeToken(value || 'Normal');
  }
}

export function serviceRequestStatusDisplayLabel(value?: string | null): string {
  switch (norm(value)) {
    case 'NEW':
      return 'Pending Approval';
    case 'IN_PROGRESS':
      return 'Approved / In Progress';
    case 'RESOLVED':
      return 'Resolved';
    case 'CLOSED':
      return 'Closed';
    case 'CANCELLED':
      return 'Cancelled by Resident';
    case 'REJECTED':
      return 'Rejected by Management';
    default:
      return humanizeToken(value || 'Pending Approval');
  }
}

export function complaintStatusDisplayLabel(value?: string | null): string {
  switch (norm(value)) {
    case 'NEW':
      return 'Pending Review';
    case 'IN_PROGRESS':
    case 'UNDER_REVIEW':
    case 'ASSIGNED':
    case 'REVIEWING':
      return 'Under Review';
    case 'RESOLVED':
      return 'Resolved';
    case 'CLOSED':
      return 'Closed';
    case 'CANCELLED':
      return 'Cancelled';
    default:
      return humanizeToken(value || 'Pending Review');
  }
}

export function bookingStatusDisplayLabel(value?: string | null): string {
  switch (norm(value)) {
    case 'PENDING':
      return 'Pending Approval';
    case 'APPROVED':
      return 'Approved';
    case 'CONFIRMED':
      return 'Confirmed';
    case 'REJECTED':
      return 'Rejected';
    case 'CANCELLED':
      return 'Cancelled';
    case 'COMPLETED':
      return 'Completed';
    default:
      return humanizeToken(value || 'Pending');
  }
}

export function invoiceStatusDisplayLabel(value?: string | null): string {
  switch (norm(value)) {
    case 'PENDING':
      return 'Pending Payment';
    case 'OVERDUE':
      return 'Overdue';
    case 'PAID':
      return 'Paid';
    case 'CANCELLED':
      return 'Cancelled';
    default:
      return humanizeToken(value || 'Pending Payment');
  }
}

export function violationStatusDisplayLabel(value?: string | null): string {
  switch (norm(value)) {
    case 'PENDING':
      return 'Pending';
    case 'RESOLVED':
      return 'Resolved';
    case 'PAID':
      return 'Paid';
    case 'CANCELLED':
      return 'Cancelled';
    default:
      return humanizeToken(value || 'Pending');
  }
}

export function unitStatusDisplayLabel(value?: string | null): string {
  switch (norm(value)) {
    case 'NOT_DELIVERED':
      return 'Pre-delivery';
    case 'DELIVERED':
      return 'Delivered';
    default:
      return humanizeToken(value);
  }
}

import { GateAccessMode, GateRole, UnitStatus, UnitType } from '@prisma/client';
import { UnitDisplayStatus } from './unit-query.dto';

export interface GateItem {
  id: string;
  name: string;
  code: string | null;
  allowedRoles: GateRole[];
  etaMinutes: number | null;
  isActive: boolean;
}

export interface LeaseItem {
  id: string;
  startDate: string;
  endDate: string;
  status: string;
  tenantId: string | null;
  tenantEmail: string | null;
}

export interface ResidentItem {
  id: string;
  userId: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  isPrimary: boolean;
}

export interface ComplaintItem {
  id: string;
  complaintNumber: string;
  category: string;
  status: string;
  createdAt: string;
}

export interface UnitListItem {
  id: string;
  communityId: string | null;
  clusterId: string | null;
  unitNumber: string;
  block: string | null;
  type: UnitType;
  status: UnitStatus;
  displayStatus: UnitDisplayStatus;
  isDelivered: boolean;
  isActive: boolean;
  communityName: string;
  clusterName: string | null;
  bedrooms: number | null;
  sizeSqm: number | null;
  price: number | null;
  residentCount: number;
  createdAt: string;
}

export interface UnitDetailResponse extends UnitListItem {
  gateAccess: {
    mode: GateAccessMode;
    gates: GateItem[];
  };
  leases: LeaseItem[];
  currentResidents: ResidentItem[];
  recentComplaints: ComplaintItem[];
  invoiceSummary: {
    totalPaid: number;
    totalPending: number;
    overdueCount: number;
  };
}

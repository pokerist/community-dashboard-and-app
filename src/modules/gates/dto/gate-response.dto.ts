import {
  EntityStatus,
  GateAccessRole,
  GateDirection,
  GateRole,
  GateScanResult,
} from '@prisma/client';

export class GateResponseDto {
  id!: string;
  communityId!: string;
  name!: string;
  code!: string | null;
  status!: EntityStatus;
  allowedRoles!: GateRole[];
  etaMinutes!: number | null;
  isVisitorRequestRequired!: boolean;
  unitIds!: string[];
  unitCount!: number;
  createdAt!: Date;
  updatedAt!: Date;
}

export class GateUnitAccessResponseDto {
  id!: string;
  gateId!: string;
  unitId!: string;
  createdAt!: Date;
  updatedAt!: Date;
}

export class GateEntryLogResponseDto {
  id!: string;
  gateId!: string | null;
  qrCodeId!: string | null;
  unitId!: string | null;
  direction!: GateDirection;
  result!: GateScanResult;
  scanRole!: GateAccessRole | null;
  operatorUserId!: string | null;
  visitorNameSnapshot!: string | null;
  scannedAt!: Date;
  notes!: string | null;
  createdAt!: Date;
  updatedAt!: Date;
}


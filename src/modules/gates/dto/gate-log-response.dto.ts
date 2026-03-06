import { AccessStatus, QRType } from '@prisma/client';

export class GateLogItemResponseDto {
  id!: string;
  visitorName!: string | null;
  requesterName!: string | null;
  unitNumber!: string | null;
  qrType!: QRType;
  status!: AccessStatus;
  checkedInAt!: string | null;
  checkedOutAt!: string | null;
  durationMinutes!: number | null;
  gateOperatorName!: string | null;
}

export class PaginatedGateLogResponseDto {
  data!: GateLogItemResponseDto[];
  total!: number;
  page!: number;
  limit!: number;
}

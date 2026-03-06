import {
  BlueCollarRequestStatus,
  BlueCollarWeekDay,
  EntityStatus,
  QRType,
  AccessStatus,
} from '@prisma/client';

export class BlueCollarSettingResponseDto {
  id!: string;
  communityId!: string;
  workDays!: BlueCollarWeekDay[];
  workStartTime!: string | null;
  workEndTime!: string | null;
  holidays!: string[];
  termsAndConditions!: string | null;
  requiresAdminApproval!: boolean;
  createdById!: string | null;
  updatedById!: string | null;
  createdAt!: Date;
  updatedAt!: Date;
}

export class BlueCollarRequestWorkerDto {
  id!: string;
  jobType!: string | null;
  status!: EntityStatus;
  fullName!: string;
  nationalId!: string;
}

export class BlueCollarRequestContractorDto {
  id!: string;
  name!: string;
  status!: EntityStatus;
}

export class BlueCollarRequestQrDto {
  id!: string;
  qrId!: string;
  type!: QRType;
  status!: AccessStatus;
  validFrom!: Date;
  validTo!: Date;
}

export class BlueCollarAccessRequestResponseDto {
  id!: string;
  workerId!: string;
  unitId!: string;
  contractorId!: string;
  settingId!: string | null;
  requestedById!: string;
  reviewedById!: string | null;
  qrCodeId!: string | null;
  idDocumentRef!: string | null;
  status!: BlueCollarRequestStatus;
  requestedValidFrom!: Date;
  requestedValidTo!: Date;
  gates!: string[];
  notes!: string | null;
  rejectionReason!: string | null;
  reviewedAt!: Date | null;
  createdAt!: Date;
  updatedAt!: Date;
  worker!: BlueCollarRequestWorkerDto;
  contractor!: BlueCollarRequestContractorDto;
  qrCode!: BlueCollarRequestQrDto | null;
}

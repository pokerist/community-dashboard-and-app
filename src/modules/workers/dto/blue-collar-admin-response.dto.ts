import { AccessGrantPermission, AccessStatus, EntityStatus } from '@prisma/client';

export class BlueCollarSettingsResponseDto {
  id!: string;
  communityId!: string;
  workingHoursStart!: string;
  workingHoursEnd!: string;
  allowedDays!: number[];
  termsAndConditions!: string | null;
  termsVersion!: number;
  updatedAt!: Date;
  updatedById!: string | null;
}

export class BlueCollarHolidayResponseDto {
  id!: string;
  communityId!: string;
  date!: string;
  label!: string;
  createdAt!: string;
}

export class BlueCollarTermsResponseDto {
  terms!: string;
  version!: number;
  updatedAt!: string | null;
}

export class BlueCollarWorkerListItemResponseDto {
  id!: string;
  accessProfileId!: string;
  fullName!: string;
  nationalId!: string;
  jobType!: string | null;
  contractorName!: string;
  unitNumber!: string;
  status!: EntityStatus;
  accessProfileStatus!: AccessStatus;
}

export class PaginatedBlueCollarWorkersResponseDto {
  data!: BlueCollarWorkerListItemResponseDto[];
  total!: number;
  page!: number;
  limit!: number;
}

export class AccessGrantTimelineItemDto {
  id!: string;
  unitId!: string;
  validFrom!: string;
  validTo!: string;
  permissions!: AccessGrantPermission[];
}

export class BlueCollarWorkerDetailResponseDto {
  id!: string;
  accessProfileId!: string;
  fullName!: string;
  nationalId!: string;
  phone!: string | null;
  photoId!: string | null;
  notes!: string | null;
  jobType!: string | null;
  status!: EntityStatus;
  accessProfileStatus!: AccessStatus;
  contractorName!: string;
  unitNumber!: string;
  accessGrants!: AccessGrantTimelineItemDto[];
}

export class BlueCollarWorkerStatsResponseDto {
  totalWorkers!: number;
  activeWorkers!: number;
  pendingApproval!: number;
  contractorCount!: number;
}

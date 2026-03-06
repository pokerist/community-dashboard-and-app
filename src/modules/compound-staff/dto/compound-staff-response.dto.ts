import {
  BlueCollarWeekDay,
  CompoundStaffPermission,
  CompoundStaffStatus,
  GateDirection,
} from '@prisma/client';

export class CompoundStaffAccessResponseDto {
  id!: string;
  staffId!: string;
  permission!: CompoundStaffPermission;
  isGranted!: boolean;
  grantedById!: string | null;
  createdAt!: Date;
  updatedAt!: Date;
}

export class CompoundStaffScheduleResponseDto {
  id!: string;
  staffId!: string;
  dayOfWeek!: BlueCollarWeekDay;
  startTime!: string | null;
  endTime!: string | null;
  notes!: string | null;
  isActive!: boolean;
  createdAt!: Date;
  updatedAt!: Date;
}

export class CompoundStaffGateAccessResponseDto {
  id!: string;
  staffId!: string;
  gateId!: string;
  gateName!: string;
  directions!: GateDirection[];
  isActive!: boolean;
  grantedById!: string | null;
  createdAt!: Date;
  updatedAt!: Date;
}

export class CompoundStaffActivityLogResponseDto {
  id!: string;
  staffId!: string;
  actorUserId!: string | null;
  action!: string;
  metadata!: unknown | null;
  createdAt!: Date;
}

export class CompoundStaffResponseDto {
  id!: string;
  communityId!: string | null;
  commercialEntityId!: string | null;
  userId!: string | null;
  fullName!: string;
  phone!: string;
  nationalId!: string;
  photoFileId!: string | null;
  profession!: string;
  jobTitle!: string | null;
  workSchedule!: unknown | null;
  contractFrom!: Date | null;
  contractTo!: Date | null;
  status!: CompoundStaffStatus;
  isActive!: boolean;
  createdAt!: Date;
  updatedAt!: Date;
  accesses!: CompoundStaffAccessResponseDto[];
  schedules!: CompoundStaffScheduleResponseDto[];
  gateAccesses!: CompoundStaffGateAccessResponseDto[];
  activityLogs!: CompoundStaffActivityLogResponseDto[];
}

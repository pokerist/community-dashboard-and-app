import { CommercialEntityMemberRole } from '@prisma/client';

export class CommercialMemberPermissionsResponseDto {
  can_work_orders!: boolean;
  can_attendance!: boolean;
  can_service_requests!: boolean;
  can_tickets!: boolean;
  can_photo_upload!: boolean;
  can_task_reminders!: boolean;
  can_invoices!: boolean;
  can_staff_management!: boolean;
}

export class CommercialEntityMemberResponseDto {
  id!: string;
  entityId!: string;
  userId!: string;
  role!: CommercialEntityMemberRole;
  permissions!: CommercialMemberPermissionsResponseDto;
  createdById!: string | null;
  photoFileId!: string | null;
  nationalIdFileId!: string | null;
  isActive!: boolean;
  createdAt!: Date;
  updatedAt!: Date;
}

export class CommercialEntityResponseDto {
  id!: string;
  name!: string;
  description!: string | null;
  communityId!: string;
  unitId!: string;
  isActive!: boolean;
  createdAt!: Date;
  updatedAt!: Date;
  owner!: CommercialEntityMemberResponseDto | null;
  tenants!: CommercialEntityMemberResponseDto[];
  hrMembers!: CommercialEntityMemberResponseDto[];
  financeMembers!: CommercialEntityMemberResponseDto[];
  staffMembers!: CommercialEntityMemberResponseDto[];
  memberCount!: number;
}

export class CommercialAuditLogResponseDto {
  id!: string;
  entityId!: string;
  action!: string;
  actorUserId!: string | null;
  metadata!: Record<string, unknown> | null;
  createdAt!: Date;
}

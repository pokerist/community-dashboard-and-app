import apiClient from "./api-client";
import { extractRows } from "./live-data";

export type CommercialMemberRole = "OWNER" | "TENANT" | "HR" | "FINANCE" | "STAFF";

export type CommercialMemberPermissions = {
  can_work_orders: boolean;
  can_attendance: boolean;
  can_service_requests: boolean;
  can_tickets: boolean;
  can_photo_upload: boolean;
  can_task_reminders: boolean;
  can_invoices: boolean;
  can_staff_management: boolean;
};

export type CommercialEntityMember = {
  id: string;
  entityId: string;
  userId: string;
  role: CommercialMemberRole;
  permissions: CommercialMemberPermissions;
  createdById: string | null;
  photoFileId: string | null;
  nationalIdFileId: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CommercialEntity = {
  id: string;
  name: string;
  description: string | null;
  communityId: string;
  unitId: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  owner: CommercialEntityMember | null;
  tenants: CommercialEntityMember[];
  hrMembers: CommercialEntityMember[];
  financeMembers: CommercialEntityMember[];
  staffMembers: CommercialEntityMember[];
  memberCount: number;
};

export type AuditLogEntry = {
  id: string;
  entityId: string;
  action: string;
  actorUserId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

export type CommercialDirectoryUserStatus = "ACTIVE" | "INACTIVE";

export type CommercialDirectoryUser = {
  memberId: string;
  entityId: string;
  entityName: string;
  communityId: string;
  communityName: string;
  unitId: string;
  unitLabel: string;
  userId: string;
  userLabel: string;
  role: CommercialMemberRole;
  status: CommercialDirectoryUserStatus;
  createdAt: string;
  updatedAt: string;
};

export type CreateCommercialEntityPayload = {
  name: string;
  description?: string;
  communityId: string;
  unitId: string;
  ownerUserId: string;
};

export type UpdateCommercialEntityPayload = {
  name?: string;
  description?: string | null;
  communityId?: string;
  unitId?: string;
};

export type AddCommercialMemberPayload = {
  userId: string;
  role: CommercialMemberRole;
  permissions?: Partial<CommercialMemberPermissions>;
};

export type UpdateCommercialMemberPayload = {
  role?: CommercialMemberRole;
  permissions?: Partial<CommercialMemberPermissions>;
  isActive?: boolean;
};

export type SetCommercialMemberPermissionsPayload = {
  permissions: Partial<CommercialMemberPermissions>;
};

type UserRow = {
  id: string;
  nameEN?: string | null;
  nameAR?: string | null;
  email?: string | null;
  phone?: string | null;
  userStatus?: string | null;
};

type CommunityRow = {
  id: string;
  name: string;
  code?: string | null;
};

type UnitRow = {
  id: string;
  unitNumber?: string | null;
  block?: string | null;
  projectName?: string | null;
  communityId?: string | null;
};

export type UserOption = {
  id: string;
  label: string;
  status?: string | null;
};

export type CommunityOption = {
  id: string;
  label: string;
};

export type UnitOption = {
  id: string;
  label: string;
  communityId: string | null;
};

function userLabel(row: UserRow): string {
  const name = row.nameEN?.trim() || row.nameAR?.trim();
  if (name) return `${name}${row.email ? ` (${row.email})` : ""}`;
  if (row.email?.trim()) return row.email.trim();
  if (row.phone?.trim()) return row.phone.trim();
  return row.id;
}

function unitLabel(row: UnitRow): string {
  return [
    row.projectName ? row.projectName : null,
    row.block ? `Block ${row.block}` : null,
    row.unitNumber ? `Unit ${row.unitNumber}` : null,
  ]
    .filter(Boolean)
    .join(" - ");
}

export const COMMERCIAL_MEMBER_ROLES: CommercialMemberRole[] = [
  "OWNER",
  "TENANT",
  "HR",
  "FINANCE",
  "STAFF",
];

export const COMMERCIAL_PERMISSION_KEYS: Array<keyof CommercialMemberPermissions> = [
  "can_work_orders",
  "can_attendance",
  "can_service_requests",
  "can_tickets",
  "can_photo_upload",
  "can_task_reminders",
  "can_invoices",
  "can_staff_management",
];

const commercialService = {
  async listEntities(filters?: {
    communityId?: string;
    unitId?: string;
    ownerUserId?: string;
    includeInactive?: boolean;
  }): Promise<CommercialEntity[]> {
    const response = await apiClient.get<CommercialEntity[]>("/commercial/entities", {
      params: filters,
    });
    return Array.isArray(response.data) ? response.data : [];
  },

  async createEntity(payload: CreateCommercialEntityPayload): Promise<CommercialEntity> {
    const response = await apiClient.post<CommercialEntity>("/commercial/entities", payload);
    return response.data;
  },

  async updateEntity(
    entityId: string,
    payload: UpdateCommercialEntityPayload,
  ): Promise<CommercialEntity> {
    const response = await apiClient.patch<CommercialEntity>(
      `/commercial/entities/${entityId}`,
      payload,
    );
    return response.data;
  },

  async removeEntity(entityId: string): Promise<{ success: true }> {
    const response = await apiClient.delete<{ success: true }>(
      `/commercial/entities/${entityId}`,
    );
    return response.data;
  },

  async listMembers(entityId: string): Promise<CommercialEntityMember[]> {
    const response = await apiClient.get<CommercialEntityMember[]>(
      `/commercial/entities/${entityId}/members`,
    );
    return Array.isArray(response.data) ? response.data : [];
  },

  async addMember(
    entityId: string,
    payload: AddCommercialMemberPayload,
  ): Promise<CommercialEntityMember> {
    const response = await apiClient.post<CommercialEntityMember>(
      `/commercial/entities/${entityId}/members`,
      payload,
    );
    return response.data;
  },

  async updateMember(
    memberId: string,
    payload: UpdateCommercialMemberPayload,
  ): Promise<CommercialEntityMember> {
    const response = await apiClient.patch<CommercialEntityMember>(
      `/commercial/members/${memberId}`,
      payload,
    );
    return response.data;
  },

  async removeMember(memberId: string): Promise<{ success: true }> {
    const response = await apiClient.delete<{ success: true }>(
      `/commercial/members/${memberId}`,
    );
    return response.data;
  },

  async getMemberPermissions(memberId: string): Promise<CommercialMemberPermissions> {
    const response = await apiClient.get<CommercialMemberPermissions>(
      `/commercial/members/${memberId}/permissions`,
    );
    return response.data;
  },

  async setMemberPermissions(
    memberId: string,
    payload: SetCommercialMemberPermissionsPayload,
  ): Promise<CommercialEntityMember> {
    const response = await apiClient.put<CommercialEntityMember>(
      `/commercial/members/${memberId}/permissions`,
      payload,
    );
    return response.data;
  },

  async getAuditLogs(
    entityId: string,
    options?: { limit?: number; offset?: number },
  ): Promise<{ data: AuditLogEntry[]; total: number }> {
    const response = await apiClient.get<{ data: AuditLogEntry[]; total: number }>(
      `/commercial/entities/${entityId}/audit-logs`,
      { params: options },
    );
    return response.data;
  },

  async updateMemberPhoto(
    memberId: string,
    photoFileId: string | null,
  ): Promise<CommercialEntityMember> {
    const response = await apiClient.patch<CommercialEntityMember>(
      `/commercial/members/${memberId}/photo`,
      { photoFileId },
    );
    return response.data;
  },

  async updateMemberNationalId(
    memberId: string,
    nationalIdFileId: string | null,
  ): Promise<CommercialEntityMember> {
    const response = await apiClient.patch<CommercialEntityMember>(
      `/commercial/members/${memberId}/national-id`,
      { nationalIdFileId },
    );
    return response.data;
  },

  async listCommunityOptions(): Promise<CommunityOption[]> {
    const response = await apiClient.get<CommunityRow[]>("/communities");
    const rows = extractRows<CommunityRow>(response.data);
    return rows.map((row) => ({
      id: row.id,
      label: row.code ? `${row.name} (${row.code})` : row.name,
    }));
  },

  async listUnitOptions(): Promise<UnitOption[]> {
    const response = await apiClient.get("/units", { params: { page: 1, limit: 100 } });
    const rows = extractRows<UnitRow>(response.data);
    return rows.map((row) => ({
      id: row.id,
      label: unitLabel(row) || row.id,
      communityId: row.communityId ?? null,
    }));
  },

  async listUserOptions(): Promise<UserOption[]> {
    const response = await apiClient.get<UserRow[]>("/admin/users", {
      params: { skip: 0, take: 100 },
    });
    const rows = extractRows<UserRow>(response.data);
    return rows.map((row) => ({
      id: row.id,
      label: userLabel(row),
      status: row.userStatus ?? null,
    }));
  },

  async listDirectoryUsers(filters?: {
    includeInactive?: boolean;
  }): Promise<CommercialDirectoryUser[]> {
    const includeInactive = filters?.includeInactive ?? true;
    const [entities, communities, units, users] = await Promise.all([
      this.listEntities({ includeInactive }),
      this.listCommunityOptions(),
      this.listUnitOptions(),
      this.listUserOptions(),
    ]);

    const communityById = new Map<string, string>();
    communities.forEach((row) => {
      communityById.set(row.id, row.label);
    });

    const unitById = new Map<string, string>();
    units.forEach((row) => {
      unitById.set(row.id, row.label);
    });

    const userById = new Map<string, string>();
    users.forEach((row) => {
      userById.set(row.id, row.label);
    });

    const entityMembers = await Promise.all(
      entities.map(async (entity) => {
        const members = await this.listMembers(entity.id);
        return { entity, members };
      }),
    );

    const rows: CommercialDirectoryUser[] = [];
    entityMembers.forEach(({ entity, members }) => {
      members.forEach((member) => {
        const status: CommercialDirectoryUserStatus =
          member.isActive && entity.isActive ? "ACTIVE" : "INACTIVE";
        rows.push({
          memberId: member.id,
          entityId: entity.id,
          entityName: entity.name,
          communityId: entity.communityId,
          communityName:
            communityById.get(entity.communityId) ?? entity.communityId,
          unitId: entity.unitId,
          unitLabel: unitById.get(entity.unitId) ?? entity.unitId,
          userId: member.userId,
          userLabel: userById.get(member.userId) ?? member.userId,
          role: member.role,
          status,
          createdAt: member.createdAt,
          updatedAt: member.updatedAt,
        });
      });
    });

    return rows;
  },
};

export default commercialService;

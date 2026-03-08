import apiClient from "./api-client";

export type CompoundStaffStatus = "ACTIVE" | "INACTIVE" | "SUSPENDED";
export type CompoundStaffPermission =
  | "ENTRY_EXIT"
  | "WORK_ORDERS"
  | "ATTENDANCE"
  | "RESIDENT_COMMUNICATION"
  | "TASK_REMINDERS";
export type GateDirection = "ENTRY" | "EXIT";
export type BlueCollarWeekDay =
  | "SUNDAY"
  | "MONDAY"
  | "TUESDAY"
  | "WEDNESDAY"
  | "THURSDAY"
  | "FRIDAY"
  | "SATURDAY";

export type CompoundStaffAccess = {
  id: string;
  staffId: string;
  permission: CompoundStaffPermission;
  isGranted: boolean;
  grantedById: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CompoundStaffSchedule = {
  id: string;
  staffId: string;
  dayOfWeek: BlueCollarWeekDay;
  startTime: string | null;
  endTime: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CompoundStaffGateAccess = {
  id: string;
  staffId: string;
  gateId: string;
  gateName: string;
  directions: GateDirection[];
  isActive: boolean;
  grantedById: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CompoundStaffActivityLog = {
  id: string;
  staffId: string;
  actorUserId: string | null;
  action: string;
  metadata: unknown | null;
  createdAt: string;
};

export type AttendanceLog = {
  id: string;
  staffId: string;
  clockInAt: string;
  clockOutAt: string | null;
  durationMin: number | null;
  notes: string | null;
  recordedById: string | null;
  createdAt: string;
};

export type CompoundStaff = {
  id: string;
  communityId: string | null;
  commercialEntityId: string | null;
  userId: string | null;
  fullName: string;
  phone: string;
  nationalId: string;
  photoFileId: string | null;
  profession: string;
  jobTitle: string | null;
  workSchedule: unknown | null;
  contractFrom: string | null;
  contractTo: string | null;
  status: CompoundStaffStatus;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  accesses: CompoundStaffAccess[];
  schedules: CompoundStaffSchedule[];
  gateAccesses: CompoundStaffGateAccess[];
  activityLogs: CompoundStaffActivityLog[];
};

export type CompoundStaffScheduleInput = {
  dayOfWeek: BlueCollarWeekDay;
  startTime?: string;
  endTime?: string;
  notes?: string;
  isActive?: boolean;
};

export type CompoundStaffGateAccessInput = {
  gateId: string;
  directions?: GateDirection[];
};

export type CreateCompoundStaffPayload = {
  communityId: string;
  commercialEntityId?: string;
  userId?: string;
  fullName: string;
  phone: string;
  nationalId: string;
  photoFileId?: string;
  profession: string;
  jobTitle?: string;
  workSchedule?: Record<string, unknown>;
  contractFrom?: string;
  contractTo?: string;
  status?: CompoundStaffStatus;
  permissions?: CompoundStaffPermission[];
  schedules?: CompoundStaffScheduleInput[];
  gateAccesses?: CompoundStaffGateAccessInput[];
};

export type UpdateCompoundStaffPayload = {
  communityId?: string;
  commercialEntityId?: string | null;
  userId?: string | null;
  fullName?: string;
  phone?: string;
  nationalId?: string;
  photoFileId?: string | null;
  profession?: string;
  jobTitle?: string | null;
  workSchedule?: Record<string, unknown> | null;
  contractFrom?: string | null;
  contractTo?: string | null;
  status?: CompoundStaffStatus;
  schedules?: CompoundStaffScheduleInput[] | null;
  gateAccesses?: CompoundStaffGateAccessInput[] | null;
};

export type SetCompoundStaffAccessPayload = {
  permissions: CompoundStaffPermission[];
};

export type SetCompoundStaffGatesPayload = {
  gateAccesses: CompoundStaffGateAccessInput[];
};

type UserRow = {
  id: string;
  nameEN?: string | null;
  nameAR?: string | null;
  email?: string | null;
  phone?: string | null;
};

type CommunityRow = {
  id: string;
  name: string;
  code?: string | null;
};

type CommercialEntityRow = {
  id: string;
  name: string;
  communityId: string;
};

type GateRow = {
  id: string;
  name: string;
  communityId: string;
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED";
};

type UploadedFileRow = {
  id: string;
  key: string;
  name: string;
  mimeType: string;
  size: number;
};

export type UserOption = {
  id: string;
  label: string;
};

export type CommunityOption = {
  id: string;
  label: string;
};

export type CommercialEntityOption = {
  id: string;
  label: string;
  communityId: string;
};

export type GateOption = {
  id: string;
  label: string;
  communityId: string;
};

export type UploadedFileResult = {
  id: string;
  name: string;
  mimeType: string;
  size: number;
};

function userLabel(row: UserRow): string {
  const name = row.nameEN?.trim() || row.nameAR?.trim();
  if (name) return `${name}${row.email ? ` (${row.email})` : ""}`;
  if (row.email?.trim()) return row.email.trim();
  if (row.phone?.trim()) return row.phone.trim();
  return row.id;
}

export const COMPOUND_STAFF_PERMISSIONS: CompoundStaffPermission[] = [
  "ENTRY_EXIT",
  "WORK_ORDERS",
  "ATTENDANCE",
  "RESIDENT_COMMUNICATION",
  "TASK_REMINDERS",
];

export const WEEK_DAYS: BlueCollarWeekDay[] = [
  "SUNDAY",
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
];

const compoundStaffService = {
  async list(filters?: {
    communityId?: string;
    commercialEntityId?: string;
    status?: CompoundStaffStatus;
    profession?: string;
    contractExpiringSoon?: boolean;
    contractExpiringSoonDays?: number;
    includeInactive?: boolean;
  }): Promise<CompoundStaff[]> {
    const response = await apiClient.get<CompoundStaff[]>("/compound-staff", {
      params: filters,
    });
    return Array.isArray(response.data) ? response.data : [];
  },

  async getById(id: string): Promise<CompoundStaff> {
    const response = await apiClient.get<CompoundStaff>(`/compound-staff/${id}`);
    return response.data;
  },

  async create(payload: CreateCompoundStaffPayload): Promise<CompoundStaff> {
    const response = await apiClient.post<CompoundStaff>("/compound-staff", payload);
    return response.data;
  },

  async update(id: string, payload: UpdateCompoundStaffPayload): Promise<CompoundStaff> {
    const response = await apiClient.patch<CompoundStaff>(`/compound-staff/${id}`, payload);
    return response.data;
  },

  async remove(id: string): Promise<{ success: true }> {
    const response = await apiClient.delete<{ success: true }>(`/compound-staff/${id}`);
    return response.data;
  },

  async getAccess(id: string): Promise<CompoundStaffAccess[]> {
    const response = await apiClient.get<CompoundStaffAccess[]>(`/compound-staff/${id}/access`);
    return Array.isArray(response.data) ? response.data : [];
  },

  async setAccess(
    id: string,
    payload: SetCompoundStaffAccessPayload,
  ): Promise<CompoundStaffAccess[]> {
    const response = await apiClient.put<CompoundStaffAccess[]>(`/compound-staff/${id}/access`, payload);
    return Array.isArray(response.data) ? response.data : [];
  },

  async getGates(id: string): Promise<CompoundStaffGateAccess[]> {
    const response = await apiClient.get<CompoundStaffGateAccess[]>(`/compound-staff/${id}/gates`);
    return Array.isArray(response.data) ? response.data : [];
  },

  async setGates(
    id: string,
    payload: SetCompoundStaffGatesPayload,
  ): Promise<CompoundStaffGateAccess[]> {
    const response = await apiClient.put<CompoundStaffGateAccess[]>(`/compound-staff/${id}/gates`, payload);
    return Array.isArray(response.data) ? response.data : [];
  },

  async getActivityLogs(id: string, limit = 20): Promise<CompoundStaffActivityLog[]> {
    const response = await apiClient.get<CompoundStaffActivityLog[]>(
      `/compound-staff/${id}/activity-logs`,
      { params: { limit } },
    );
    return Array.isArray(response.data) ? response.data : [];
  },

  async listUserOptions(): Promise<UserOption[]> {
    const response = await apiClient.get<UserRow[]>("/admin/users", {
      params: { skip: 0, take: 100 },
    });
    const rows = Array.isArray(response.data) ? response.data : [];
    return rows.map((row) => ({
      id: row.id,
      label: userLabel(row),
    }));
  },

  async listCommunityOptions(): Promise<CommunityOption[]> {
    const response = await apiClient.get<CommunityRow[]>("/communities");
    const rows = Array.isArray(response.data) ? response.data : [];
    return rows.map((row) => ({
      id: row.id,
      label: row.code ? `${row.name} (${row.code})` : row.name,
    }));
  },

  async listCommercialEntityOptions(communityId?: string): Promise<CommercialEntityOption[]> {
    const response = await apiClient.get<CommercialEntityRow[]>("/commercial/entities", {
      params: communityId ? { communityId } : undefined,
    });
    const rows = Array.isArray(response.data) ? response.data : [];
    return rows.map((row) => ({
      id: row.id,
      label: row.name,
      communityId: row.communityId,
    }));
  },

  async listGateOptions(communityId?: string): Promise<GateOption[]> {
    const response = await apiClient.get<GateRow[]>("/gates", {
      params: communityId ? { communityId } : undefined,
    });
    const rows = Array.isArray(response.data) ? response.data : [];
    return rows
      .filter((row) => row.status === "ACTIVE")
      .map((row) => ({
        id: row.id,
        label: row.name,
        communityId: row.communityId,
      }));
  },

  async getAttendance(id: string): Promise<AttendanceLog[]> {
    const response = await apiClient.get<{ data: AttendanceLog[] }>(
      `/compound-staff/${id}/attendance`,
    );
    return Array.isArray(response.data?.data) ? response.data.data : [];
  },

  async clockIn(id: string): Promise<AttendanceLog> {
    const response = await apiClient.post<AttendanceLog>(`/compound-staff/${id}/clock-in`);
    return response.data;
  },

  async clockOut(id: string): Promise<AttendanceLog> {
    const response = await apiClient.post<AttendanceLog>(`/compound-staff/${id}/clock-out`);
    return response.data;
  },

  async uploadProfilePhoto(file: File): Promise<UploadedFileResult> {
    const formData = new FormData();
    formData.append("file", file);
    const response = await apiClient.post<UploadedFileRow>(
      "/files/upload/profile-photo",
      formData,
      {
        headers: { "Content-Type": "multipart/form-data" },
      },
    );
    return {
      id: response.data.id,
      name: response.data.name,
      mimeType: response.data.mimeType,
      size: response.data.size,
    };
  },

  async uploadNationalId(file: File): Promise<UploadedFileResult> {
    const formData = new FormData();
    formData.append("file", file);
    const response = await apiClient.post<UploadedFileRow>(
      "/files/upload/national-id",
      formData,
      {
        headers: { "Content-Type": "multipart/form-data" },
      },
    );
    return {
      id: response.data.id,
      name: response.data.name,
      mimeType: response.data.mimeType,
      size: response.data.size,
    };
  },
};

export default compoundStaffService;

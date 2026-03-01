import { http } from '../../lib/http';
import type { AuthBootstrapProfile } from './types';
import type { UpdateMeProfileInput } from './types';
import type { ProfileChangeRequestRow } from './types';

export type ResidentVehiclePayload = {
  vehicleType: string;
  model: string;
  plateNumber: string;
  color?: string;
  notes?: string;
  isPrimary?: boolean;
};

export type ResidentVehicleRow = {
  id: string;
  vehicleType: string;
  model: string;
  plateNumber: string;
  color?: string | null;
  notes?: string | null;
  isPrimary?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export async function getAuthBootstrapProfile(
  accessToken: string,
): Promise<AuthBootstrapProfile> {
  const response = await http.get<AuthBootstrapProfile>('/auth/me', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  return response.data;
}

export async function updateAuthBootstrapProfile(
  accessToken: string,
  input: UpdateMeProfileInput,
): Promise<ProfileChangeRequestRow> {
  const response = await http.patch<ProfileChangeRequestRow>('/auth/me/profile', input, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  return response.data;
}

export async function createMyProfileChangeRequest(
  accessToken: string,
  input: UpdateMeProfileInput,
): Promise<ProfileChangeRequestRow> {
  const response = await http.post<ProfileChangeRequestRow>(
    '/auth/me/profile-change-requests',
    input,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );
  return response.data;
}

export async function listMyProfileChangeRequests(
  accessToken: string,
): Promise<ProfileChangeRequestRow[]> {
  const response = await http.get<ProfileChangeRequestRow[]>(
    '/auth/me/profile-change-requests',
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );
  return Array.isArray(response.data) ? response.data : [];
}

export async function updateAuthSecuritySettings(
  accessToken: string,
  input: { twoFactorEnabled: boolean },
): Promise<AuthBootstrapProfile> {
  const response = await http.patch<AuthBootstrapProfile>('/auth/me/security', input, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  return response.data;
}

export async function listMyResidentVehicles(
  accessToken: string,
): Promise<ResidentVehicleRow[]> {
  const response = await http.get<ResidentVehicleRow[]>('/resident-vehicles/me', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  return Array.isArray(response.data) ? response.data : [];
}

export async function createMyResidentVehicle(
  accessToken: string,
  input: ResidentVehiclePayload,
): Promise<ResidentVehicleRow> {
  const response = await http.post<ResidentVehicleRow>('/resident-vehicles/me', input, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  return response.data;
}

export async function updateMyResidentVehicle(
  accessToken: string,
  vehicleId: string,
  input: Partial<ResidentVehiclePayload>,
): Promise<ResidentVehicleRow> {
  const response = await http.patch<ResidentVehicleRow>(
    `/resident-vehicles/me/${vehicleId}`,
    input,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );
  return response.data;
}

export async function deleteMyResidentVehicle(
  accessToken: string,
  vehicleId: string,
): Promise<void> {
  await http.delete(`/resident-vehicles/me/${vehicleId}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

import { http } from '../../lib/http';
import type { AuthBootstrapProfile } from './types';
import type { UpdateMeProfileInput } from './types';

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
): Promise<AuthBootstrapProfile> {
  const response = await http.patch<AuthBootstrapProfile>('/auth/me/profile', input, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  return response.data;
}

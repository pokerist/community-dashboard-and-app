import { http } from '../../lib/http';
import type {
  LoginPayload,
  LoginResponse,
  RefreshResponse,
  SignupPayload,
  SignupResponse,
} from './types';

export async function loginRequest(payload: LoginPayload): Promise<LoginResponse> {
  const response = await http.post<LoginResponse>('/auth/login', payload);
  return response.data;
}

export async function refreshRequest(input: {
  userId: string;
  refreshToken: string;
}): Promise<RefreshResponse> {
  const response = await http.post<RefreshResponse>('/auth/refresh', input);
  return response.data;
}

export async function signupRequest(
  payload: SignupPayload,
): Promise<SignupResponse> {
  const response = await http.post<SignupResponse>('/signup', payload);
  return response.data;
}

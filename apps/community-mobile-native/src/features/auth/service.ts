import { http } from '../../lib/http';
import type {
  ActivationStatusResponse,
  CompleteActivationPayload,
  LoginPayload,
  LoginResponse,
  RefreshResponse,
  SignupPayload,
  SignupResponse,
  VerifyLoginTwoFactorPayload,
} from './types';

export async function loginRequest(payload: LoginPayload): Promise<LoginResponse> {
  const response = await http.post<LoginResponse>('/auth/login', payload);
  return response.data;
}

export async function verifyLoginTwoFactorRequest(
  payload: VerifyLoginTwoFactorPayload,
): Promise<LoginResponse> {
  const response = await http.post<LoginResponse>('/auth/login/2fa/verify', payload);
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

export async function forgotPasswordRequest(payload: {
  email?: string;
  phone?: string;
}): Promise<{ message?: string; code?: string }> {
  const response = await http.post<{ message?: string; code?: string }>(
    '/auth/forgot-password',
    payload,
  );
  return response.data;
}

export async function getActivationStatusRequest(
  accessToken: string,
): Promise<ActivationStatusResponse> {
  const response = await http.get<ActivationStatusResponse>('/auth/activation/status', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  return response.data;
}

export async function sendPhoneOtpRequest(
  accessToken: string,
  phone: string,
): Promise<{
  message?: string;
  provider?: string;
  channel?: 'SMS' | 'EMAIL' | string;
  cooldownSeconds?: number;
  expiresInSeconds?: number;
}> {
  const response = await http.post<{
    message?: string;
    provider?: string;
    channel?: 'SMS' | 'EMAIL' | string;
    cooldownSeconds?: number;
    expiresInSeconds?: number;
  }>(
    '/auth/send-phone-otp',
    { phone },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );
  return response.data;
}

export async function verifyPhoneOtpRequest(
  accessToken: string,
  payload: { otp?: string; firebaseIdToken?: string },
): Promise<{ message?: string }> {
  const response = await http.post<{ message?: string }>(
    '/auth/verify-phone-otp',
    payload,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );
  return response.data;
}

export async function completeActivationRequest(
  accessToken: string,
  payload: CompleteActivationPayload,
): Promise<{ message?: string; userStatus?: string; mustCompleteActivation?: boolean }> {
  const response = await http.post<{
    message?: string;
    userStatus?: string;
    mustCompleteActivation?: boolean;
  }>('/auth/activation/complete', payload, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  return response.data;
}

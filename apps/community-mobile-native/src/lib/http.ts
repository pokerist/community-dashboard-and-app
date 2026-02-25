import axios from 'axios';
import { API_BASE_URL } from '../config/env';

export const http = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
});

export function extractApiErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as
      | { message?: string | string[]; error?: string }
      | undefined;

    if (error.code === 'ERR_NETWORK' || !error.response) {
      return `Cannot reach backend at ${API_BASE_URL}`;
    }

    if (Array.isArray(data?.message)) return data.message.join(', ');
    if (typeof data?.message === 'string') return data.message;
    if (typeof data?.error === 'string') return data.error;
    if (typeof error.message === 'string') return error.message;
  }

  if (error instanceof Error && error.message) return error.message;
  return 'Unexpected error';
}

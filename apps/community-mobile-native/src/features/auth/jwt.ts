import { jwtDecode } from 'jwt-decode';

type JwtPayload = {
  sub?: string;
};

export function extractUserIdFromAccessToken(
  token: string,
): string | null {
  try {
    const payload = jwtDecode<JwtPayload>(token);
    return typeof payload.sub === 'string' ? payload.sub : null;
  } catch {
    return null;
  }
}

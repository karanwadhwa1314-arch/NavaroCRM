import { SignJWT } from 'jose/jwt/sign';
import { jwtVerify } from 'jose/jwt/verify';

export const SESSION_COOKIE = 'navaro_session';

const DAY_SECONDS = 24 * 60 * 60;

function expiresInSeconds(): number {
  const raw = process.env.JWT_EXPIRES_IN ?? '7d';
  const match = /^(\d+)([dhm])$/.exec(raw.trim());
  if (!match) return 7 * DAY_SECONDS;
  const n = Number(match[1]);
  switch (match[2]) {
    case 'd':
      return n * DAY_SECONDS;
    case 'h':
      return n * 60 * 60;
    case 'm':
      return n * 60;
    default:
      return 7 * DAY_SECONDS;
  }
}

export function sessionMaxAgeSeconds(): number {
  return expiresInSeconds();
}

function getSecretKey(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET is missing or too short (must be at least 32 characters).');
  }
  return new TextEncoder().encode(secret);
}

export interface SessionPayload {
  sub: string;
  tv: number;
}

export async function signSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ tv: payload.tv })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${expiresInSeconds()}s`)
    .sign(getSecretKey());
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (typeof payload.sub !== 'string' || typeof payload.tv !== 'number') return null;
    return { sub: payload.sub, tv: payload.tv };
  } catch {
    return null;
  }
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: expiresInSeconds(),
  };
}

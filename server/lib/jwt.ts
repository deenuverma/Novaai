import jwt from 'jsonwebtoken';
import type { CookieOptions, Request, Response } from 'express';

const ACCESS_SECRET =
  process.env.JWT_ACCESS_SECRET || 'novaai-dev-access-secret-key-2026';
const REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET || 'novaai-dev-refresh-secret-key-2026';

export interface CustomJwtPayload {
  uid: string;
  email: string;
  name: string;
  iss: 'novaai-auth';
}

export function signAccessToken(payload: {
  uid: string;
  email: string;
  name: string;
}): string {
  return jwt.sign({ ...payload, iss: 'novaai-auth' }, ACCESS_SECRET, {
    expiresIn: '2h',
  });
}

export function signRefreshToken(payload: {
  uid: string;
  email: string;
  name: string;
}): string {
  return jwt.sign({ ...payload, iss: 'novaai-auth' }, REFRESH_SECRET, {
    expiresIn: '7d',
  });
}

export function verifyAccessToken(token: string): CustomJwtPayload | null {
  try {
    const decoded = jwt.verify(token, ACCESS_SECRET) as CustomJwtPayload;
    if (decoded && decoded.iss === 'novaai-auth' && decoded.uid) {
      return decoded;
    }
    return null;
  } catch {
    return null;
  }
}

export function verifyRefreshToken(token: string): CustomJwtPayload | null {
  try {
    const decoded = jwt.verify(token, REFRESH_SECRET) as CustomJwtPayload;
    if (decoded && decoded.iss === 'novaai-auth' && decoded.uid) {
      return decoded;
    }
    return null;
  } catch {
    return null;
  }
}

export const REFRESH_COOKIE_NAME = 'novaai_refresh_token';

function isHttpsRequest(req: Request): boolean {
  if (req.secure) return true;

  const forwardedProto = req.headers['x-forwarded-proto'];
  if (typeof forwardedProto === 'string') {
    if (forwardedProto.split(',')[0].trim().toLowerCase() === 'https') {
      return true;
    }
  }

  const origin = req.headers.origin;
  if (typeof origin === 'string' && origin.toLowerCase().startsWith('https://')) {
    return true;
  }

  const referer = req.headers.referer;
  if (typeof referer === 'string' && referer.toLowerCase().startsWith('https://')) {
    return true;
  }

  const host = (req.headers['x-forwarded-host'] || req.headers.host || '')
    .toString()
    .toLowerCase();
  if (
    host &&
    !host.startsWith('localhost') &&
    !host.startsWith('127.0.0.1') &&
    !host.startsWith('0.0.0.0')
  ) {
    return true;
  }

  return false;
}

export function setRefreshTokenCookie(
  req: Request,
  res: Response,
  token: string
) {
  const https = isHttpsRequest(req);
  const options: CookieOptions & { partitioned?: boolean } = {
    httpOnly: true,
    secure: https,
    sameSite: https ? 'none' : 'lax',
    ...(https ? { partitioned: true } : {}),
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  };
  res.cookie(REFRESH_COOKIE_NAME, token, options as CookieOptions);
}

export function clearRefreshTokenCookie(req: Request, res: Response) {
  const https = isHttpsRequest(req);
  const options: CookieOptions & { partitioned?: boolean } = {
    httpOnly: true,
    secure: https,
    sameSite: https ? 'none' : 'lax',
    ...(https ? { partitioned: true } : {}),
    path: '/',
  };
  res.clearCookie(REFRESH_COOKIE_NAME, options as CookieOptions);
}

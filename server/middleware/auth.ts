import type { Request, Response, NextFunction } from 'express';
import { verifyFirebaseIdToken } from '../lib/firebaseAdmin.ts';
import { verifyAccessToken } from '../lib/jwt.ts';
import {
  findUserByUid,
  getOrCreateOAuthUser,
} from '../../src/db/repositories.ts';

export const ADMIN_EMAIL = 'deenuverma238@gmail.com';

export function isAdminEmail(email?: string | null): boolean {
  return Boolean(email && email.trim().toLowerCase() === ADMIN_EMAIL);
}

export interface AuthenticatedUser {
  id: number;
  uid: string;
  name: string;
  email: string;
  avatar: string | null;
  googleId: string | null;
  hasPassword: boolean;
  isAdmin: boolean;
  createdAt: Date;
}

export interface AuthRequest extends Request {
  user?: AuthenticatedUser;
}

const USER_CACHE_TTL_MS = 15_000;
const userCache = new Map<string, { user: AuthenticatedUser; expiresAt: number }>();

export function invalidateUserCache(uid?: string) {
  if (!uid) {
    userCache.clear();
    return;
  }
  userCache.delete(uid);
}

export async function resolveTokenToUser(
  token: string
): Promise<AuthenticatedUser | null> {
  // 1. Check custom JWT issued by /api/auth/login, /api/auth/signup, or /api/auth/firebase-session
  const customClaims = verifyAccessToken(token);
  if (customClaims) {
    const cached = userCache.get(customClaims.uid);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.user;
    }

    const dbUser = await findUserByUid(customClaims.uid);
    if (!dbUser) {
      userCache.delete(customClaims.uid);
      return null;
    }
    const resolved: AuthenticatedUser = {
      id: dbUser.id,
      uid: dbUser.uid,
      name: dbUser.name,
      email: dbUser.email,
      avatar: dbUser.avatar,
      googleId: dbUser.googleId,
      hasPassword: Boolean(dbUser.passwordHash),
      isAdmin: isAdminEmail(dbUser.email),
      createdAt: dbUser.createdAt,
    };
    userCache.set(customClaims.uid, {
      user: resolved,
      expiresAt: Date.now() + USER_CACHE_TTL_MS,
    });
    return resolved;
  }

  // 2. Verify Firebase ID Token (Google Sign-In via Firebase Auth)
  const decoded = await verifyFirebaseIdToken(token);
  const email = (decoded.email || `${decoded.uid}@users.novaai.app`)
    .trim()
    .toLowerCase();

  // Prevent unverified email spoofing on administrator identity
  if (isAdminEmail(email) && decoded.email_verified !== true) {
    throw new Error('Administrator email must be verified.');
  }

  const name = decoded.name || email.split('@')[0] || 'NOVAAI User';

  const dbUser = await getOrCreateOAuthUser({
    uid: decoded.uid,
    email,
    name,
    avatar: decoded.picture || null,
    googleId: decoded.uid,
  });

  return {
    id: dbUser.id,
    uid: dbUser.uid,
    name: dbUser.name,
    email: dbUser.email,
    avatar: dbUser.avatar,
    googleId: dbUser.googleId,
    hasPassword: Boolean(dbUser.passwordHash),
    isAdmin: isAdminEmail(dbUser.email),
    createdAt: dbUser.createdAt,
  };
}

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required. Please sign in.' });
    return;
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    res.status(401).json({ error: 'Authentication required. Missing token.' });
    return;
  }

  try {
    const user = await resolveTokenToUser(token);
    if (!user) {
      res
        .status(401)
        .json({ error: 'Invalid or expired session. Please sign in again.' });
      return;
    }
    req.user = user;
    next();
  } catch (error) {
    console.error('Authentication verification failed:', error);
    res
      .status(401)
      .json({ error: 'Unauthorized: Invalid authentication token.' });
  }
};

export const requireAdmin = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  if (!req.user || !isAdminEmail(req.user.email)) {
    res.status(403).json({
      error: 'Access denied. Administrator privileges are restricted strictly to the platform owner.',
    });
    return;
  }
  next();
};

export const optionalAuth = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    next();
    return;
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    next();
    return;
  }

  try {
    const user = await resolveTokenToUser(token);
    if (user) {
      req.user = user;
    }
  } catch {
    // Proceed unauthenticated if optional token is invalid
  }
  next();
};

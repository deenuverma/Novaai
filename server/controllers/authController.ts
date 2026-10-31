import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import type { Request, Response, NextFunction } from 'express';
import firebaseConfig from '../../firebase-applet-config.json' with { type: 'json' };
import { warmDatabasePool } from '../../src/db/index.ts';
import {
  createPasswordUser,
  findUserByEmail,
  findUserByEmailWithStats,
  findUserByUid,
  getOrCreateOAuthUser,
  getUserStats,
  updateUserPasswordHash,
  updateUserProfile,
} from '../../src/db/repositories.ts';
import { verifyFirebaseIdToken } from '../lib/firebaseAdmin.ts';
import {
  clearRefreshTokenCookie,
  REFRESH_COOKIE_NAME,
  setRefreshTokenCookie,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '../lib/jwt.ts';
import { HttpError } from '../middleware/errorHandler.ts';
import {
  invalidateUserCache,
  isAdminEmail,
  type AuthRequest,
} from '../middleware/auth.ts';
import {
  loginSchema,
  signupSchema,
  updateProfileSchema,
} from '../validators/schemas.ts';

const setPasswordSchema = z.object({
  newPassword: z
    .string()
    .min(6, 'Password must be at least 6 characters.')
    .max(128, 'Password is too long.'),
});

function sanitizeUserResponse(user: {
  id: number;
  uid: string;
  name: string;
  email: string;
  avatar: string | null;
  googleId: string | null;
  passwordHash?: string | null;
  hasPassword?: boolean;
  createdAt: Date;
}) {
  const hasPwd =
    user.hasPassword !== undefined
      ? user.hasPassword
      : Boolean(user.passwordHash);
  return {
    id: user.id,
    uid: user.uid,
    name: user.name,
    email: user.email,
    avatar: user.avatar,
    authProvider: user.googleId ? 'google' : 'password',
    hasPassword: hasPwd,
    isAdmin: isAdminEmail(user.email),
    createdAt: user.createdAt,
  };
}

export async function warmupAuthHandler(_req: Request, res: Response) {
  await warmDatabasePool();
  res.json({ ok: true });
}

export async function signupHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const parsed = signupSchema.parse(req.body);
    // Hash password in parallel with email uniqueness lookup to cut latency in half
    const [existing, passwordHash] = await Promise.all([
      findUserByEmail(parsed.email),
      bcrypt.hash(parsed.password, 8),
    ]);

    if (existing) {
      if (existing.googleId && !existing.passwordHash) {
        throw new HttpError(
          409,
          'This email is already registered with Google. Click "Continue with Google" to sign in.'
        );
      }
      throw new HttpError(
        409,
        'An account with this email already exists. Switch to "Sign In" above.'
      );
    }

    const uid = `usr_${crypto.randomUUID().replace(/-/g, '')}`;

    const created = await createPasswordUser({
      uid,
      name: parsed.name,
      email: parsed.email,
      passwordHash,
    });

    const accessToken = signAccessToken({
      uid: created.uid,
      email: created.email,
      name: created.name,
    });
    const refreshToken = signRefreshToken({
      uid: created.uid,
      email: created.email,
      name: created.name,
    });

    setRefreshTokenCookie(req, res, refreshToken);
    res.status(201).json({
      user: sanitizeUserResponse(created),
      stats: { chats: 0, notes: 0, cvs: 0 },
      accessToken,
      refreshToken,
      isNewUser: true,
    });
  } catch (err) {
    next(err);
  }
}

export async function loginHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const parsed = loginSchema.parse(req.body);
    const record = await findUserByEmailWithStats(parsed.email);

    if (!record) {
      throw new HttpError(
        401,
        'No account found with this email yet. Switch to "Create Account" above to sign up first.'
      );
    }

    const { user, stats } = record;

    if (!user.passwordHash) {
      throw new HttpError(
        401,
        'This account was created via Google Sign-In. Click "Continue with Google" above to sign in.'
      );
    }

    const valid = await bcrypt.compare(parsed.password, user.passwordHash);
    if (!valid) {
      throw new HttpError(401, 'Incorrect password. Please try again.');
    }

    const accessToken = signAccessToken({
      uid: user.uid,
      email: user.email,
      name: user.name,
    });
    const refreshToken = signRefreshToken({
      uid: user.uid,
      email: user.email,
      name: user.name,
    });

    setRefreshTokenCookie(req, res, refreshToken);
    res.json({
      user: sanitizeUserResponse(user),
      stats,
      accessToken,
      refreshToken,
    });
  } catch (err) {
    next(err);
  }
}

interface VerifiedGoogleIdentity {
  uid: string;
  email: string;
  name: string;
  avatar: string | null;
  emailVerified: boolean;
}

async function verifyGoogleOrFirebasePayload(
  req: Request
): Promise<VerifiedGoogleIdentity> {
  const authHeader = req.headers.authorization;
  const bearerToken =
    authHeader && authHeader.startsWith('Bearer ')
      ? authHeader.slice(7).trim()
      : '';
  const bodyIdToken =
    typeof req.body?.idToken === 'string' ? req.body.idToken.trim() : '';
  const firebaseIdToken = bearerToken || bodyIdToken;

  const googleAccessToken =
    typeof req.body?.googleAccessToken === 'string'
      ? req.body.googleAccessToken.trim()
      : '';
  const googleIdToken =
    typeof req.body?.googleIdToken === 'string'
      ? req.body.googleIdToken.trim()
      : '';

  const candidates: Promise<VerifiedGoogleIdentity>[] = [];

  if (firebaseIdToken) {
    candidates.push(
      verifyFirebaseIdToken(firebaseIdToken).then((decoded) => {
        const email = (decoded.email || `${decoded.uid}@users.novaai.app`)
          .trim()
          .toLowerCase();
        return {
          uid: decoded.uid,
          email,
          name: decoded.name || email.split('@')[0] || 'NOVAAI User',
          avatar: decoded.picture || null,
          emailVerified: decoded.email_verified === true,
        };
      })
    );
  }

  if (googleAccessToken) {
    candidates.push(
      fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${googleAccessToken}` },
      }).then(async (userInfoRes) => {
        if (!userInfoRes.ok) {
          throw new Error('Google userinfo check failed');
        }
        const info = (await userInfoRes.json()) as {
          sub?: string;
          email?: string;
          email_verified?: boolean;
          name?: string;
          picture?: string;
        };
        if (!info.sub || !info.email) {
          throw new Error('Incomplete Google userinfo');
        }
        const email = info.email.trim().toLowerCase();
        return {
          uid: `google_${info.sub}`,
          email,
          name: info.name || email.split('@')[0] || 'NOVAAI User',
          avatar: info.picture || null,
          emailVerified: info.email_verified === true,
        };
      })
    );
  }

  if (googleIdToken) {
    candidates.push(
      fetch(
        `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(
          googleIdToken
        )}`
      ).then(async (tokenInfoRes) => {
        if (!tokenInfoRes.ok) {
          throw new Error('Google tokeninfo check failed');
        }
        const info = (await tokenInfoRes.json()) as {
          sub?: string;
          aud?: string;
          email?: string;
          email_verified?: string | boolean;
          name?: string;
          picture?: string;
        };
        if (
          !info.sub ||
          !info.email ||
          (firebaseConfig.oAuthClientId &&
            info.aud !== firebaseConfig.oAuthClientId)
        ) {
          throw new Error('Google tokeninfo audience mismatch');
        }
        const email = info.email.trim().toLowerCase();
        return {
          uid: `google_${info.sub}`,
          email,
          name: info.name || email.split('@')[0] || 'NOVAAI User',
          avatar: info.picture || null,
          emailVerified:
            info.email_verified === true || info.email_verified === 'true',
        };
      })
    );
  }

  if (candidates.length > 0) {
    try {
      return await Promise.any(candidates);
    } catch {
      // All verification paths rejected
    }
  }

  throw new HttpError(
    401,
    'Google authentication could not be verified. Please try again or use Email & Password.'
  );
}

export async function firebaseSessionHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const verified = await verifyGoogleOrFirebasePayload(req);

    if (isAdminEmail(verified.email) && !verified.emailVerified) {
      throw new HttpError(403, 'Administrator email must be verified.');
    }

    const [existingUid, existingEmail] = await Promise.all([
      findUserByUid(verified.uid),
      findUserByEmail(verified.email),
    ]);
    const isNewUser = !existingUid && !existingEmail;

    const dbUser = await getOrCreateOAuthUser({
      uid: verified.uid,
      email: verified.email,
      name: verified.name,
      avatar: verified.avatar,
      googleId: verified.uid,
    });

    const accessToken = signAccessToken({
      uid: dbUser.uid,
      email: dbUser.email,
      name: dbUser.name,
    });
    const refreshToken = signRefreshToken({
      uid: dbUser.uid,
      email: dbUser.email,
      name: dbUser.name,
    });

    setRefreshTokenCookie(req, res, refreshToken);
    const stats = await getUserStats(dbUser.uid);
    res.json({
      user: sanitizeUserResponse(dbUser),
      stats,
      accessToken,
      refreshToken,
      isNewUser,
    });
  } catch (err) {
    next(err);
  }
}

export async function refreshHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const cookieToken = req.cookies?.[REFRESH_COOKIE_NAME];
    const bodyToken =
      typeof req.body?.refreshToken === 'string'
        ? req.body.refreshToken.trim()
        : '';
    const token = cookieToken || bodyToken;

    if (!token) {
      res.status(401).json({ error: 'No active refresh session.' });
      return;
    }

    const payload = verifyRefreshToken(token);
    if (!payload) {
      clearRefreshTokenCookie(req, res);
      res.status(401).json({ error: 'Refresh token expired or invalid.' });
      return;
    }

    const user = await findUserByUid(payload.uid);
    if (!user) {
      clearRefreshTokenCookie(req, res);
      res.status(401).json({ error: 'Account not found.' });
      return;
    }

    const accessToken = signAccessToken({
      uid: user.uid,
      email: user.email,
      name: user.name,
    });
    const nextRefresh = signRefreshToken({
      uid: user.uid,
      email: user.email,
      name: user.name,
    });
    setRefreshTokenCookie(req, res, nextRefresh);

    const stats = await getUserStats(user.uid);
    res.json({
      user: sanitizeUserResponse(user),
      stats,
      accessToken,
      refreshToken: nextRefresh,
    });
  } catch (err) {
    next(err);
  }
}

export async function logoutHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    clearRefreshTokenCookie(req, res);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

export async function googleAuthInfoHandler(_req: Request, res: Response) {
  res.json({
    provider: 'firebase-google-oauth',
    flow: 'popup',
    message:
      'Use client-side Google popup sign-in and pass the ID token via Authorization Bearer header.',
  });
}

export async function googleCallbackHandler(_req: Request, res: Response) {
  res.redirect('/login');
}

export async function getMeHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user) {
      throw new HttpError(401, 'Unauthorized');
    }
    const stats = await getUserStats(req.user.uid);
    res.json({
      user: sanitizeUserResponse(req.user),
      stats,
    });
  } catch (err) {
    next(err);
  }
}

export async function updateMeHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user) {
      throw new HttpError(401, 'Unauthorized');
    }
    const parsed = updateProfileSchema.parse(req.body);
    const updated = await updateUserProfile(req.user.uid, {
      ...(parsed.name !== undefined ? { name: parsed.name } : {}),
      ...(parsed.avatar !== undefined ? { avatar: parsed.avatar } : {}),
    });

    if (!updated) {
      throw new HttpError(404, 'User profile not found.');
    }

    invalidateUserCache(updated.uid);
    const stats = await getUserStats(updated.uid);
    res.json({
      user: sanitizeUserResponse(updated),
      stats,
    });
  } catch (err) {
    next(err);
  }
}

export async function updatePasswordHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user) {
      throw new HttpError(401, 'Unauthorized');
    }
    const parsed = setPasswordSchema.parse(req.body);
    const passwordHash = await bcrypt.hash(parsed.newPassword, 8);
    const updated = await updateUserPasswordHash(req.user.uid, passwordHash);
    if (!updated) {
      throw new HttpError(404, 'User profile not found.');
    }
    invalidateUserCache(updated.uid);
    res.json({
      user: sanitizeUserResponse(updated),
      message: 'Password saved successfully.',
    });
  } catch (err) {
    next(err);
  }
}

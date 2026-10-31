import type { Auth, DecodedIdToken } from 'firebase-admin/auth';
import firebaseConfig from '../../firebase-applet-config.json' with { type: 'json' };

let cachedAuthPromise: Promise<Auth> | null = null;

async function getLazyAdminAuth(): Promise<Auth> {
  if (!cachedAuthPromise) {
    cachedAuthPromise = (async () => {
      const [{ initializeApp, getApps }, { getAuth }] = await Promise.all([
        import('firebase-admin/app'),
        import('firebase-admin/auth'),
      ]);
      if (!getApps().length) {
        initializeApp({
          projectId: firebaseConfig.projectId,
        });
      }
      return getAuth();
    })();
  }
  return cachedAuthPromise;
}

export async function verifyFirebaseIdToken(
  idToken: string
): Promise<DecodedIdToken> {
  const auth = await getLazyAdminAuth();
  return auth.verifyIdToken(idToken);
}

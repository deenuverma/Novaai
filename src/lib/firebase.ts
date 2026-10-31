import { initializeApp } from 'firebase/app';
import {
  browserPopupRedirectResolver,
  getAuth,
  GoogleAuthProvider,
  initializeAuth,
  inMemoryPersistence,
  type Auth,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

// Clear any stale browser IndexedDB Firebase session from older visits so the
// SDK never attempts a background refresh against securetoken.googleapis.com.
if (typeof window !== 'undefined') {
  try {
    window.indexedDB?.deleteDatabase('firebaseLocalStorageDb');
  } catch {
    // Ignore storage access restrictions in sandboxed frames
  }
}

const app = initializeApp(firebaseConfig);

let resolvedAuth: Auth;
try {
  resolvedAuth = initializeAuth(app, {
    persistence: inMemoryPersistence,
    popupRedirectResolver: browserPopupRedirectResolver,
  });
} catch {
  resolvedAuth = getAuth(app);
}

export const auth = resolvedAuth;
export const googleAuthProvider = new GoogleAuthProvider();
googleAuthProvider.addScope('email');
googleAuthProvider.addScope('profile');
googleAuthProvider.setCustomParameters({ prompt: 'select_account' });

declare global {
  interface Window {
    google?: {
      accounts?: {
        oauth2?: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            prompt?: string;
            callback: (response: {
              access_token?: string;
              error?: string;
              error_description?: string;
            }) => void;
            error_callback?: (err: { type?: string; message?: string }) => void;
          }) => { requestAccessToken: (overrideConfig?: { prompt?: string }) => void };
        };
      };
    };
  }
}

let gisScriptPromise: Promise<void> | null = null;

export function preloadGoogleIdentityScript(): void {
  if (typeof window !== 'undefined') {
    void ensureGoogleIdentityScript().catch(() => undefined);
  }
}

function ensureGoogleIdentityScript(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Google Sign-In requires a browser environment.'));
  }
  if (window.google?.accounts?.oauth2) {
    return Promise.resolve();
  }
  if (gisScriptPromise) {
    return gisScriptPromise;
  }

  gisScriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://accounts.google.com/gsi/client"]'
    );
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener(
        'error',
        () => reject(new Error('Failed to load Google Sign-In script.')),
        { once: true }
      );
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => {
      gisScriptPromise = null;
      reject(new Error('Failed to load Google Sign-In script.'));
    };
    document.head.appendChild(script);
  });

  return gisScriptPromise;
}

/**
 * Direct Google OAuth2 popup fallback via Google Identity Services using the
 * provisioned project's Web OAuth Client ID (zero dependency on securetoken API).
 */
export async function signInWithGoogleIdentityPopup(): Promise<string> {
  const clientId = firebaseConfig.oAuthClientId;
  if (!clientId) {
    throw new Error('Google OAuth client is not configured.');
  }

  await ensureGoogleIdentityScript();
  const oauth2 = window.google?.accounts?.oauth2;
  if (!oauth2) {
    throw new Error('Google OAuth2 client failed to initialize.');
  }

  return new Promise<string>((resolve, reject) => {
    const tokenClient = oauth2.initTokenClient({
      client_id: clientId,
      scope: 'openid email profile',
      prompt: 'select_account',
      callback: (resp) => {
        if (resp.error || !resp.access_token) {
          reject(
            new Error(
              resp.error_description || resp.error || 'Google Sign-In was cancelled.'
            )
          );
          return;
        }
        resolve(resp.access_token);
      },
      error_callback: (err) => {
        const errObj = new Error(
          err?.type === 'popup_closed'
            ? 'Google sign-in popup closed before finishing.'
            : err?.message || 'Google sign-in popup could not complete.'
        ) as Error & { code?: string };
        if (err?.type === 'popup_closed') {
          errObj.code = 'auth/popup-closed-by-user';
        } else if (err?.type === 'popup_failed_to_open') {
          errObj.code = 'auth/popup-blocked';
        }
        reject(errObj);
      },
    });

    tokenClient.requestAccessToken({ prompt: 'select_account' });
  });
}

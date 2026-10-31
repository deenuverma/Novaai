import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import {
  auth,
  googleAuthProvider,
  signInWithGoogleIdentityPopup,
} from '../lib/firebase.ts';
import {
  playServerAudioBase64,
  unlockLiveAudioEngine,
} from '../lib/liveAudioEngine.ts';
import {
  authApi,
  chatApi,
  getCachedSessionSnapshot,
  getInMemoryAccessToken,
  hasActiveSessionHint,
  setCachedSessionSnapshot,
  setInMemoryAccessToken,
} from '../services/api.ts';
import type { UserProfile, UserStats } from '../types/models.ts';

async function playCuteSignupVoiceGreeting() {
  try {
    await unlockLiveAudioEngine();
    const res = await chatApi.fetchWelcomeVoice();
    if (res.audioBase64) {
      const played = await playServerAudioBase64(res.audioBase64);
      if (played) return;
    }
    if (
      res.welcomeText &&
      typeof window !== 'undefined' &&
      'speechSynthesis' in window
    ) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(res.welcomeText);
      utterance.lang = 'hi-IN';
      utterance.pitch = 1.18;
      utterance.rate = 0.98;
      window.speechSynthesis.speak(utterance);
    }
  } catch {
    // Non-blocking signup voice welcome
  }
}

interface AuthContextValue {
  user: UserProfile | null;
  stats: UserStats;
  loading: boolean;
  loginWithGoogle: () => Promise<UserProfile>;
  loginWithEmail: (email: string, password: string) => Promise<UserProfile>;
  signupWithEmail: (
    name: string,
    email: string,
    password: string
  ) => Promise<UserProfile>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const EMPTY_STATS: UserStats = { chats: 0, notes: 0, cvs: 0 };

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const initialCached = getCachedSessionSnapshot();
  const [user, setUser] = useState<UserProfile | null>(
    () => initialCached?.user ?? null
  );
  const [stats, setStats] = useState<UserStats>(
    () => initialCached?.stats ?? EMPTY_STATS
  );
  // 0ms instant render if either cached user exists OR visitor has never logged in
  const [loading, setLoading] = useState<boolean>(
    () => !initialCached && hasActiveSessionHint()
  );
  const manualAuthInProgressRef = useRef(false);

  const refreshProfile = useCallback(async () => {
    try {
      const me = await authApi.getMe();
      setUser(me.user);
      setStats(me.stats);
      setCachedSessionSnapshot({ user: me.user, stats: me.stats });
    } catch {
      // ignore if unauthenticated
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const bootstrapSession = async () => {
      if (manualAuthInProgressRef.current) return;
      if (!hasActiveSessionHint() && !getInMemoryAccessToken()) {
        if (mounted) setLoading(false);
        return;
      }

      try {
        if (getInMemoryAccessToken()) {
          try {
            const me = await authApi.getMe();
            if (mounted) {
              setUser(me.user);
              setStats(me.stats);
              setCachedSessionSnapshot({ user: me.user, stats: me.stats });
            }
            return;
          } catch {
            setInMemoryAccessToken(null);
          }
        }

        const refreshed = await authApi.refreshSession();
        if (refreshed && mounted) {
          setUser(refreshed.user);
          if (refreshed.stats) {
            setStats(refreshed.stats);
          }
        } else if (mounted) {
          setUser(null);
          setStats(EMPTY_STATS);
        }
      } catch (err) {
        console.error('Auth state bootstrap error:', err);
        if (mounted) {
          setUser(null);
          setStats(EMPTY_STATS);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void bootstrapSession();

    return () => {
      mounted = false;
    };
  }, []);

  const loginWithGoogle = async (): Promise<UserProfile> => {
    manualAuthInProgressRef.current = true;
    try {
      if (auth.currentUser) {
        await firebaseSignOut(auth).catch(() => undefined);
      }

      let idToken: string | null = null;
      let googleAccessToken: string | null = null;
      let googleIdToken: string | null = null;

      try {
        const credential = await signInWithPopup(auth, googleAuthProvider);
        const rawResp = (
          credential as unknown as {
            _tokenResponse?: {
              idToken?: string;
              oauthAccessToken?: string;
              oauthIdToken?: string;
            };
          }
        )._tokenResponse;

        const oauthCred = GoogleAuthProvider.credentialFromResult(credential);

        idToken = rawResp?.idToken || null;
        googleAccessToken =
          oauthCred?.accessToken || rawResp?.oauthAccessToken || null;
        googleIdToken = oauthCred?.idToken || rawResp?.oauthIdToken || null;

        if (!idToken) {
          const stsToken = (
            credential.user as unknown as {
              stsTokenManager?: { accessToken?: string };
            }
          )?.stsTokenManager?.accessToken;
          if (stsToken) {
            idToken = stsToken;
          }
        }

        // Clear Firebase in-memory session immediately so background refresh timers
        // never call securetoken.googleapis.com; NOVAAI's own backend JWT persists auth.
        await firebaseSignOut(auth).catch(() => undefined);
      } catch (popupErr: unknown) {
        const msg =
          popupErr instanceof Error ? popupErr.message.toLowerCase() : '';
        const code =
          typeof (popupErr as { code?: string })?.code === 'string'
            ? (popupErr as { code: string }).code.toLowerCase()
            : '';

        if (
          msg.includes('token-service-api') ||
          msg.includes('securetoken') ||
          code.includes('token-service-api') ||
          code.includes('securetoken')
        ) {
          googleAccessToken = await signInWithGoogleIdentityPopup();
        } else {
          throw popupErr;
        }
      }

      const exchanged = await authApi.exchangeFirebaseSession({
        idToken,
        googleAccessToken,
        googleIdToken,
      });

      setUser(exchanged.user);
      setStats(exchanged.stats);
      setLoading(false);
      if (exchanged.isNewUser) {
        void playCuteSignupVoiceGreeting();
      }
      return exchanged.user;
    } finally {
      manualAuthInProgressRef.current = false;
    }
  };

  const loginWithEmail = async (
    email: string,
    password: string
  ): Promise<UserProfile> => {
    manualAuthInProgressRef.current = true;
    try {
      if (auth.currentUser) {
        await firebaseSignOut(auth).catch(() => undefined);
      }
      const res = await authApi.login({ email, password });
      setUser(res.user);
      if (res.stats) {
        setStats(res.stats);
      } else {
        try {
          const me = await authApi.getMe();
          setStats(me.stats);
        } catch {
          setStats(EMPTY_STATS);
        }
      }
      setLoading(false);
      return res.user;
    } finally {
      manualAuthInProgressRef.current = false;
    }
  };

  const signupWithEmail = async (
    name: string,
    email: string,
    password: string
  ): Promise<UserProfile> => {
    manualAuthInProgressRef.current = true;
    try {
      if (auth.currentUser) {
        await firebaseSignOut(auth).catch(() => undefined);
      }
      const res = await authApi.signup({ name, email, password });
      setUser(res.user);
      setStats(EMPTY_STATS);
      setLoading(false);
      void playCuteSignupVoiceGreeting();
      return res.user;
    } finally {
      manualAuthInProgressRef.current = false;
    }
  };

  const logout = async () => {
    manualAuthInProgressRef.current = true;
    try {
      if (auth.currentUser) {
        await firebaseSignOut(auth).catch(() => undefined);
      }
    } finally {
      await authApi.logout();
      setUser(null);
      setStats(EMPTY_STATS);
      setLoading(false);
      manualAuthInProgressRef.current = false;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        stats,
        loading,
        loginWithGoogle,
        loginWithEmail,
        signupWithEmail,
        logout,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}

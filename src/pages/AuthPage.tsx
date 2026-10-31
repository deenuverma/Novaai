import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Eye, EyeOff, Loader2, Lock, Moon, Sun } from 'lucide-react';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import { NovaLogo } from '../components/brand/NovaLogo.tsx';
import { Nova3DScene } from '../components/three/Nova3DScene.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { useTheme } from '../context/ThemeContext.tsx';
import { Button } from '../components/ui/button.tsx';
import { preloadGoogleIdentityScript } from '../lib/firebase.ts';
import { unlockLiveAudioEngine } from '../lib/liveAudioEngine.ts';
import { authApi } from '../services/api.ts';
import { isOwnerAdminUser, type UserProfile } from '../types/models.ts';

interface AuthLocationState {
  from?: string;
  requireAuthNotice?: boolean;
}

export function AuthPage({
  defaultMode = 'signup',
}: {
  defaultMode?: 'login' | 'signup';
}) {
  const [mode, setMode] = useState<'login' | 'signup'>(defaultMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { user, loginWithEmail, signupWithEmail, loginWithGoogle } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const locState = (location.state as AuthLocationState | null) || null;
  const explicitFrom = locState?.from;
  const requireAuthNotice = Boolean(locState?.requireAuthNotice);

  const getDestination = (signedInUser: UserProfile) => {
    if (
      isOwnerAdminUser(signedInUser) &&
      (!explicitFrom || explicitFrom === '/home')
    ) {
      return '/admin';
    }
    if (explicitFrom) return explicitFrom;
    return '/home';
  };

  useEffect(() => {
    setMode(defaultMode);
    setErrorMsg(null);
  }, [defaultMode]);

  useEffect(() => {
    authApi.warmup();
    preloadGoogleIdentityScript();
  }, []);

  useEffect(() => {
    if (user) {
      navigate(getDestination(user), { replace: true });
    }
  }, [user, navigate, explicitFrom]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    void unlockLiveAudioEngine();
    setErrorMsg(null);

    if (mode === 'signup' && name.trim().length < 2) {
      setErrorMsg('Please enter your full name (at least 2 characters).');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }
    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters.');
      return;
    }

    setSubmitting(true);
    try {
      let signedInUser: UserProfile;
      if (mode === 'signup') {
        signedInUser = await signupWithEmail(
          name.trim(),
          email.trim(),
          password
        );
        const firstName = signedInUser.name.trim().split(/\s+/)[0] || signedInUser.name;
        toast.success(
          isOwnerAdminUser(signedInUser)
            ? 'Welcome Deenu Verma! Owner Admin Dashboard unlocked.'
            : `हाय ${firstName}! NOVAAI में आपका बहुत प्यार से स्वागत है!`
        );
      } else {
        signedInUser = await loginWithEmail(email.trim(), password);
        const firstName = signedInUser.name.trim().split(/\s+/)[0] || signedInUser.name;
        toast.success(
          isOwnerAdminUser(signedInUser)
            ? 'Welcome back, Deenu Verma. Opening Admin Panel.'
            : `Welcome back, ${firstName}!`
        );
      }
      navigate(getDestination(signedInUser), { replace: true });
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Authentication failed.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    void unlockLiveAudioEngine();
    setErrorMsg(null);
    setGoogleSubmitting(true);
    try {
      const signedInUser = await loginWithGoogle();
      toast.success(
        isOwnerAdminUser(signedInUser)
          ? 'Signed in as Owner Admin (Deenu Verma).'
          : 'Signed in with Google.'
      );
      navigate(getDestination(signedInUser), { replace: true });
    } catch (err: any) {
      const code = typeof err?.code === 'string' ? err.code : '';
      if (code === 'auth/cancelled-popup-request') {
        return;
      }
      if (code === 'auth/popup-blocked') {
        setErrorMsg(
          'Your browser blocked the Google sign-in popup. Allow popups for this site or sign up / sign in with Email & Password below.'
        );
      } else if (code === 'auth/popup-closed-by-user') {
        setErrorMsg(
          'Google sign-in popup closed before finishing. Try again or use Email & Password below.'
        );
      } else if (code === 'auth/unauthorized-domain') {
        setErrorMsg(
          'Google popup is restricted on this preview URL. Please sign up or sign in using Email & Password below.'
        );
      } else {
        setErrorMsg(
          err instanceof Error ? err.message : 'Google Sign-In failed.'
        );
      }
    } finally {
      setGoogleSubmitting(false);
    }
  };

  const suggestSignupSwitch =
    mode === 'login' &&
    Boolean(errorMsg && errorMsg.toLowerCase().includes('no account found'));
  const suggestLoginSwitch =
    mode === 'signup' &&
    Boolean(errorMsg && errorMsg.toLowerCase().includes('already exists'));

  return (
    <div className="grid min-h-screen grid-cols-1 bg-[#F4F6F4] text-[#111916] dark:bg-[#0B0F0E] dark:text-[#F2F6F4] lg:grid-cols-12">
      {/* Unified Obsidian Studio 3D Showcase Panel — Visible on BOTH Mobile AND Laptop */}
      <div className="relative flex flex-col justify-between overflow-hidden border-b border-[#1F2D27] bg-[#0D1412] p-6 text-[#F2F6F4] sm:p-8 lg:col-span-5 lg:border-r lg:border-b-0 lg:p-10">
        <div className="flex items-center justify-between gap-4">
          <Link to="/" className="inline-flex focus-visible:outline-none">
            <NovaLogo size="md" inverted />
          </Link>
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={
              theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'
            }
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#24342E] bg-[#141E1B] px-3 text-xs font-medium text-[#DCE6E1] transition-colors hover:border-[#10B981] cursor-pointer whitespace-nowrap"
          >
            {theme === 'dark' ? (
              <>
                <Sun className="h-3.5 w-3.5 text-[#D4A373]" />
                <span>Light</span>
              </>
            ) : (
              <>
                <Moon className="h-3.5 w-3.5 text-[#34D399]" />
                <span>Dark</span>
              </>
            )}
          </button>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="my-5 max-w-md space-y-4 lg:my-auto lg:space-y-5"
        >
          <div className="h-40 w-full sm:h-48 lg:h-56">
            <Nova3DScene className="h-full w-full" voiceState="idle" interactive />
          </div>

          <div>
            <p className="text-xs font-semibold text-[#34D399]">
              Member Signup Required · Live Hindi Voice Studio
            </p>
            <h2 className="mt-1.5 font-display text-xl sm:text-2xl lg:text-3xl font-bold leading-tight text-[#F2F6F4] [text-wrap:balance]">
              Unlock Live Human Voice Chat, Notes Library, and ATS CV Maker.
            </h2>
            <p className="mt-2 text-xs sm:text-sm leading-relaxed text-[#9AB0A6]">
              Speak naturally hands-free in Hindi, Hinglish, or English, search academic lecture notes by keyword, and export single-column PDF resumes on Laptop &amp; Mobile.
            </p>
          </div>
        </motion.div>

        <p className="text-xs font-medium text-[#7D9187]">
          NOVAAI · Developed and created by Deenu Verma
        </p>
      </div>

      {/* Form Column */}
      <div className="flex flex-col justify-between px-4 py-6 sm:px-8 sm:py-8 lg:col-span-7">
        <div className="mx-auto flex w-full max-w-md items-center justify-between">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#52645B] hover:text-[#059669] dark:text-[#94A89E] dark:hover:text-[#34D399] hover:underline"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Overview</span>
          </Link>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          className="nova-3d-card mx-auto my-5 w-full max-w-md overflow-hidden rounded-3xl"
        >
          <div className="p-6 sm:p-8">
            <div>
              <h1 className="font-display text-2xl font-bold text-[#111916] dark:text-[#F2F6F4]">
                {mode === 'signup'
                  ? 'Create your NOVAAI account'
                  : 'Sign in to your workspace'}
              </h1>
              <p className="mt-1 text-sm text-[#52645B] dark:text-[#94A89E]">
                {mode === 'signup'
                  ? 'Sign up free to unlock every NOVAAI feature across Laptop & Mobile.'
                  : 'Welcome back. Sign in to access your NOVAAI workspace.'}
              </p>
            </div>

            {requireAuthNotice && (
              <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-[#C8956B]/45 bg-[#FAF5EF] px-3.5 py-2.5 text-xs text-[#784B2A] dark:border-[#C8956B]/40 dark:bg-[#1C1611] dark:text-[#E8C3A3]">
                <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#C8956B]" />
                <span>
                  किसी भी फ़ीचर का उपयोग करने के लिए पहले साइनअप (Create Account) या साइन-इन करें। All NOVAAI features require a registered account.
                </span>
              </div>
            )}

            {/* Mode Segmented Control */}
            <div className="mt-6 grid grid-cols-2 gap-1.5 rounded-xl border border-[#DCE3DF] bg-[#F4F6F4] p-1 dark:border-[#24342E] dark:bg-[#0E1513]">
              <button
                type="button"
                onClick={() => {
                  setMode('signup');
                  setErrorMsg(null);
                }}
                className={`h-9 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  mode === 'signup'
                    ? 'bg-[#059669] text-white dark:bg-[#10B981] dark:text-[#061510]'
                    : 'text-[#52645B] hover:text-[#111916] dark:text-[#94A89E] dark:hover:text-[#F2F6F4]'
                }`}
              >
                Create Account
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setErrorMsg(null);
                }}
                className={`h-9 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  mode === 'login'
                    ? 'bg-[#059669] text-white dark:bg-[#10B981] dark:text-[#061510]'
                    : 'text-[#52645B] hover:text-[#111916] dark:text-[#94A89E] dark:hover:text-[#F2F6F4]'
                }`}
              >
                Sign In
              </button>
            </div>

            {/* Google Sign-In */}
            <div className="mt-6">
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={handleGoogleSignIn}
                disabled={googleSubmitting || submitting}
              >
                {googleSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin text-[#10B981]" />
                ) : (
                  <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      fill="#4285F4"
                      d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v2.98h3.86c2.26-2.09 3.56-5.17 3.56-8.8z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-2.98c1.08.72 2.45 1.16 4.07 1.16 3.12 0 5.77-2.11 6.72-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.28 14.31c-.24-.72-.38-1.49-.38-2.31s.14-1.59.38-2.31V6.6H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.4l3.99-3.09z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.6l3.99 3.09c.95-2.85 3.6-4.94 6.72-4.94z"
                    />
                  </svg>
                )}
                <span>Continue with Google</span>
              </Button>
            </div>

            <div className="my-5 flex items-center gap-3">
              <div className="h-px flex-1 bg-[#DCE3DF] dark:bg-[#23312B]" />
              <span className="text-xs text-[#52645B] dark:text-[#94A89E]">or with email</span>
              <div className="h-px flex-1 bg-[#DCE3DF] dark:bg-[#23312B]" />
            </div>

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              {mode === 'signup' && (
                <div>
                  <label
                    htmlFor="auth-name"
                    className="mb-1.5 block text-xs font-semibold text-[#2C3A34] dark:text-[#DCE6E1]"
                  >
                    Full Name
                  </label>
                  <input
                    id="auth-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Deenu Verma"
                    autoComplete="name"
                    required
                    className="flex h-10 w-full rounded-xl border border-[#C2CEC8] bg-white px-3.5 text-sm text-[#111916] placeholder:text-[#6B8076] focus:border-[#059669] focus:outline-none focus:ring-2 focus:ring-[#10B981]/25 dark:border-[#2A3933] dark:bg-[#0E1513] dark:text-[#F2F6F4] dark:focus:border-[#10B981]"
                  />
                </div>
              )}

              <div>
                <label
                  htmlFor="auth-email"
                  className="mb-1.5 block text-xs font-semibold text-[#2C3A34] dark:text-[#DCE6E1]"
                >
                  Email Address
                </label>
                <input
                  id="auth-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@gmail.com"
                  autoComplete="email"
                  required
                  className="flex h-10 w-full rounded-xl border border-[#C2CEC8] bg-white px-3.5 text-sm text-[#111916] placeholder:text-[#6B8076] focus:border-[#059669] focus:outline-none focus:ring-2 focus:ring-[#10B981]/25 dark:border-[#2A3933] dark:bg-[#0E1513] dark:text-[#F2F6F4] dark:focus:border-[#10B981]"
                />
              </div>

              <div>
                <label
                  htmlFor="auth-password"
                  className="mb-1.5 block text-xs font-semibold text-[#2C3A34] dark:text-[#DCE6E1]"
                >
                  Password
                </label>
                <div className="relative">
                  <input
                    id="auth-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimum 6 characters"
                    autoComplete={
                      mode === 'signup' ? 'new-password' : 'current-password'
                    }
                    required
                    className="flex h-10 w-full rounded-xl border border-[#C2CEC8] bg-white pl-3.5 pr-10 text-sm text-[#111916] placeholder:text-[#6B8076] focus:border-[#059669] focus:outline-none focus:ring-2 focus:ring-[#10B981]/25 dark:border-[#2A3933] dark:bg-[#0E1513] dark:text-[#F2F6F4] dark:focus:border-[#10B981]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute top-1/2 right-2.5 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-[#52645B] hover:bg-[#EAEEEC] dark:text-[#94A89E] dark:hover:bg-[#18221E] cursor-pointer"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {errorMsg && (
                <div
                  role="alert"
                  className="space-y-2 rounded-xl border border-[#BE123C]/45 bg-[#FFF1F2] px-3.5 py-2.5 text-xs leading-relaxed text-[#9F1239] dark:border-[#E11D48]/45 dark:bg-[#241217] dark:text-[#FDA4AF]"
                >
                  <p>{errorMsg}</p>
                  {suggestSignupSwitch && (
                    <button
                      type="button"
                      onClick={() => {
                        setMode('signup');
                        setErrorMsg(null);
                      }}
                      className="font-bold text-[#059669] dark:text-[#34D399] underline cursor-pointer"
                    >
                      Switch to Create Account now →
                    </button>
                  )}
                  {suggestLoginSwitch && (
                    <button
                      type="button"
                      onClick={() => {
                        setMode('login');
                        setErrorMsg(null);
                      }}
                      className="font-bold text-[#059669] dark:text-[#34D399] underline cursor-pointer"
                    >
                      Switch to Sign In now →
                    </button>
                  )}
                </div>
              )}

              <Button
                type="submit"
                variant="default"
                size="lg"
                className="w-full"
                disabled={submitting || googleSubmitting}
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                <span>
                  {mode === 'signup' ? 'Create Account' : 'Sign In'}
                </span>
              </Button>
            </form>
          </div>
        </motion.div>

        <p className="mx-auto text-center text-xs text-[#52645B] dark:text-[#94A89E]">
          NOVAAI · Created by Deenu Verma
        </p>
      </div>
    </div>
  );
}

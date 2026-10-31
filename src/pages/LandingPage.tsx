import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  BookOpen,
  FileText,
  Lock,
  Menu,
  MessageSquare,
  Moon,
  Radio,
  Sun,
  Upload,
  X,
} from 'lucide-react';
import { motion } from 'motion/react';
import { NovaLogo } from '../components/brand/NovaLogo.tsx';
import { Nova3DScene } from '../components/three/Nova3DScene.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { useTheme } from '../context/ThemeContext.tsx';
import { preloadGoogleIdentityScript } from '../lib/firebase.ts';
import { unlockLiveAudioEngine } from '../lib/liveAudioEngine.ts';
import { authApi } from '../services/api.ts';
import { isOwnerAdminUser } from '../types/models.ts';

function ResilientImage({
  src,
  alt,
  className,
  fallbackLabel,
}: {
  src: string;
  alt: string;
  className?: string;
  fallbackLabel: string;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        className={`flex items-center justify-center bg-gradient-to-br from-[#0F241D] to-[#1D1814] p-6 text-center text-xs font-semibold text-[#E6EEEA] ${className || ''}`}
      >
        <span>{fallbackLabel}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}

export function LandingPage() {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    if (!user) {
      authApi.warmup();
      preloadGoogleIdentityScript();
    }
  }, [user]);

  const featureRoute = (target: string) => (user ? target : '/signup');
  const featureState = (target: string) =>
    user ? undefined : { from: target, requireAuthNotice: true };

  const handle3DCoreLaunch = () => {
    void unlockLiveAudioEngine();
    if (user) {
      navigate('/live');
    } else {
      navigate('/signup', {
        state: { from: '/live', requireAuthNotice: true },
      });
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F6F4] text-[#111916] dark:bg-[#0B0F0E] dark:text-[#F2F6F4]">
      {/* Unified Laptop & Mobile Top Navigation Header */}
      <header className="sticky top-0 z-40 border-b border-[#DCE3DF] bg-white/95 backdrop-blur-md dark:border-[#1E2B26] dark:bg-[#0E1513]/95">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3.5 sm:px-6">
          <Link to="/" className="whitespace-nowrap shrink-0">
            <NovaLogo size="md" />
          </Link>

          <nav
            aria-label="Primary navigation"
            className="hidden lg:flex items-center gap-6 text-sm font-medium text-[#4A5B53] dark:text-[#9AB0A6]"
          >
            <Link
              to={featureRoute('/home')}
              state={featureState('/home')}
              className="hover:text-[#111916] dark:hover:text-[#F2F6F4] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Workspace
            </Link>
            <a
              href="#capabilities"
              className="hover:text-[#111916] dark:hover:text-[#F2F6F4] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Capabilities
            </a>
            <Link
              to={featureRoute('/live')}
              onClick={() => void unlockLiveAudioEngine()}
              state={featureState('/live')}
              className="hover:text-[#059669] dark:hover:text-[#34D399] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Live Voice
            </Link>
            <Link
              to={featureRoute('/chat')}
              state={featureState('/chat')}
              className="hover:text-[#111916] dark:hover:text-[#F2F6F4] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              AI Chat
            </Link>
            <Link
              to={featureRoute('/notes')}
              state={featureState('/notes')}
              className="hover:text-[#111916] dark:hover:text-[#F2F6F4] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Notes Library
            </Link>
            <Link
              to={featureRoute('/cv')}
              state={featureState('/cv')}
              className="hover:text-[#111916] dark:hover:text-[#F2F6F4] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              CV Maker
            </Link>
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={
                theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'
              }
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#DCE3DF] bg-[#F4F6F4] text-[#4A5B53] transition-colors hover:border-[#059669] hover:text-[#111916] dark:border-[#24342E] dark:bg-[#131B18] dark:text-[#94A89E] dark:hover:border-[#10B981] dark:hover:text-[#F2F6F4] cursor-pointer"
            >
              {theme === 'dark' ? (
                <Sun className="h-4 w-4 text-[#D4A373]" />
              ) : (
                <Moon className="h-4 w-4 text-[#4A5B53]" />
              )}
            </button>

            {!user && (
              <Link
                to="/login"
                className="hidden sm:inline-flex h-10 items-center justify-center rounded-xl border border-[#C2CEC8] bg-white px-3.5 py-2 text-xs font-semibold text-[#111916] transition-colors hover:border-[#059669] hover:bg-[#EAEEEC] dark:border-[#2A3933] dark:bg-[#131B18] dark:text-[#F2F6F4] dark:hover:border-[#10B981] whitespace-nowrap shrink-0"
              >
                Sign In
              </Link>
            )}

            <Link
              to={
                isOwnerAdminUser(user)
                  ? '/admin'
                  : user
                    ? '/home'
                    : '/signup'
              }
              className="inline-flex h-10 items-center justify-center rounded-xl bg-[#059669] px-4 py-2 text-xs font-semibold text-white transition-colors duration-150 hover:bg-[#047857] dark:bg-[#10B981] dark:text-[#061510] dark:hover:bg-[#34D399] whitespace-nowrap shrink-0"
            >
              {isOwnerAdminUser(user)
                ? 'Admin Panel'
                : user
                  ? 'Open Workspace'
                  : 'Sign Up Free'}
            </Link>

            <button
              type="button"
              onClick={() => setMobileNavOpen((prev) => !prev)}
              aria-label="Toggle navigation menu"
              className="inline-flex lg:hidden h-10 w-10 items-center justify-center rounded-xl border border-[#DCE3DF] bg-[#F4F6F4] text-[#4A5B53] dark:border-[#24342E] dark:bg-[#131B18] dark:text-[#DCE6E1] cursor-pointer"
            >
              {mobileNavOpen ? (
                <X className="h-4 w-4" />
              ) : (
                <Menu className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile / Tablet Expandable Menu — Exact Same Links & Colors as Laptop */}
        {mobileNavOpen && (
          <div className="border-t border-[#DCE3DF] bg-white px-4 py-4 dark:border-[#1E2B26] dark:bg-[#0E1513] lg:hidden">
            <div className="grid grid-cols-2 gap-2 text-xs font-semibold">
              <Link
                to={featureRoute('/home')}
                state={featureState('/home')}
                onClick={() => setMobileNavOpen(false)}
                className="flex h-10 items-center gap-2 rounded-xl border border-[#DCE3DF] bg-[#F4F6F4] px-3 text-[#111916] dark:border-[#24342E] dark:bg-[#141D1A] dark:text-[#F2F6F4]"
              >
                <span>Workspace</span>
              </Link>
              <Link
                to={featureRoute('/live')}
                state={featureState('/live')}
                onClick={() => {
                  setMobileNavOpen(false);
                  void unlockLiveAudioEngine();
                }}
                className="flex h-10 items-center gap-2 rounded-xl border border-[#C8956B]/50 bg-[#FAF5EF] px-3 text-[#784B2A] dark:border-[#C8956B]/45 dark:bg-[#1B1612] dark:text-[#E8C3A3]"
              >
                <Radio className="h-3.5 w-3.5 text-[#C8956B]" />
                <span>Live Voice</span>
              </Link>
              <Link
                to={featureRoute('/chat')}
                state={featureState('/chat')}
                onClick={() => setMobileNavOpen(false)}
                className="flex h-10 items-center gap-2 rounded-xl border border-[#DCE3DF] bg-[#F4F6F4] px-3 text-[#111916] dark:border-[#24342E] dark:bg-[#141D1A] dark:text-[#F2F6F4]"
              >
                <MessageSquare className="h-3.5 w-3.5 text-[#059669] dark:text-[#34D399]" />
                <span>AI Chat</span>
              </Link>
              <Link
                to={featureRoute('/notes')}
                state={featureState('/notes')}
                onClick={() => setMobileNavOpen(false)}
                className="flex h-10 items-center gap-2 rounded-xl border border-[#DCE3DF] bg-[#F4F6F4] px-3 text-[#111916] dark:border-[#24342E] dark:bg-[#141D1A] dark:text-[#F2F6F4]"
              >
                <BookOpen className="h-3.5 w-3.5 text-[#059669] dark:text-[#34D399]" />
                <span>Notes Library</span>
              </Link>
              <Link
                to={featureRoute('/notes/upload')}
                state={featureState('/notes/upload')}
                onClick={() => setMobileNavOpen(false)}
                className="flex h-10 items-center gap-2 rounded-xl border border-[#DCE3DF] bg-[#F4F6F4] px-3 text-[#111916] dark:border-[#24342E] dark:bg-[#141D1A] dark:text-[#F2F6F4]"
              >
                <Upload className="h-3.5 w-3.5 text-[#9A633A] dark:text-[#D4A373]" />
                <span>Upload Notes</span>
              </Link>
              <Link
                to={featureRoute('/cv')}
                state={featureState('/cv')}
                onClick={() => setMobileNavOpen(false)}
                className="flex h-10 items-center gap-2 rounded-xl border border-[#DCE3DF] bg-[#F4F6F4] px-3 text-[#111916] dark:border-[#24342E] dark:bg-[#141D1A] dark:text-[#F2F6F4]"
              >
                <FileText className="h-3.5 w-3.5 text-[#059669] dark:text-[#34D399]" />
                <span>CV Maker</span>
              </Link>
            </div>
            {!user && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Link
                  to="/signup"
                  onClick={() => setMobileNavOpen(false)}
                  className="flex h-10 items-center justify-center rounded-xl bg-[#059669] px-4 text-xs font-semibold text-white dark:bg-[#10B981] dark:text-[#061510]"
                >
                  Create Free Account
                </Link>
                <Link
                  to="/login"
                  onClick={() => setMobileNavOpen(false)}
                  className="flex h-10 items-center justify-center rounded-xl border border-[#C2CEC8] bg-white px-4 text-xs font-semibold text-[#111916] dark:border-[#2A3933] dark:bg-[#131B18] dark:text-[#F2F6F4]"
                >
                  Sign In
                </Link>
              </div>
            )}
          </div>
        )}
      </header>

      <main>
        {/* Hero Section with Interactive Three.js Emerald & Champagne Bronze 3D Core */}
        <section
          id="home"
          className="mx-auto max-w-7xl px-4 pt-10 pb-14 sm:px-6 lg:pt-16 lg:pb-20"
        >
          <div className="grid grid-cols-1 items-stretch gap-8 lg:grid-cols-12 lg:gap-10">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-col justify-center lg:col-span-7"
            >
              <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-[#059669] dark:text-[#34D399]">
                <span>3D Live Voice &amp; Career Studio · Created by Deenu Verma</span>
              </div>

              <h1 className="mt-3 font-display text-[clamp(2rem,4vw,3.65rem)] font-bold leading-[1.08] tracking-tight text-[#111916] dark:text-[#F2F6F4] [text-wrap:balance]">
                Speak live like a human, search academic notes, and build ATS resumes.
              </h1>
              <p className="mt-4 max-w-xl text-sm sm:text-base leading-relaxed text-[#4A5B53] dark:text-[#9AB0A6]">
                Converse hands-free in natural Hindi, Hinglish, or English with real-time neural voice responses, search 25 MB lecture archives by theorem keyword, and export clean single-column PDF resumes.
              </p>

              {!user && (
                <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-[#9A633A] dark:text-[#D4A373]">
                  <Lock className="h-3.5 w-3.5 shrink-0" />
                  <span>
                    Sign up free to unlock Live Voice, AI Chat, Notes Library, and ATS CV Maker on Laptop &amp; Mobile.
                  </span>
                </p>
              )}

              <div className="mt-7 flex flex-wrap items-center gap-3.5">
                <Link
                  to={featureRoute('/live')}
                  onClick={() => void unlockLiveAudioEngine()}
                  state={featureState('/live')}
                  className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#059669] px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#047857] dark:bg-[#10B981] dark:text-[#061510] dark:hover:bg-[#34D399] whitespace-nowrap shrink-0"
                >
                  <Radio className="h-4 w-4" />
                  <span>
                    {user ? 'Start Live Hindi Voice' : 'Sign Up & Talk Live'}
                  </span>
                </Link>
                <Link
                  to={user ? '/home' : '/login'}
                  className="inline-flex h-11 items-center gap-2 rounded-xl border border-[#C2CEC8] bg-white px-5 py-2.5 text-sm font-semibold text-[#111916] transition-colors hover:border-[#059669] hover:bg-[#EAEEEC] dark:border-[#2A3933] dark:bg-[#131B18] dark:text-[#F2F6F4] dark:hover:border-[#10B981] dark:hover:bg-[#18221E] whitespace-nowrap shrink-0"
                >
                  <span>{user ? 'Open Home Workspace' : 'Already Registered? Sign In'}</span>
                </Link>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
              className="lg:col-span-5"
            >
              <div
                onClick={handle3DCoreLaunch}
                className="nova-3d-card flex h-full flex-col items-center justify-center rounded-3xl p-5 sm:p-6 cursor-pointer"
              >
                <div className="h-64 w-full sm:h-80">
                  <Nova3DScene
                    className="h-full w-full"
                    voiceState="idle"
                    interactive
                  />
                </div>
                <p className="mt-2 text-center text-xs font-medium text-[#52645B] dark:text-[#94A89E]">
                  Interactive 3D Emerald &amp; Bronze Voice Core ·{' '}
                  {user ? 'Tap to start Live Talk' : 'Tap to Sign Up & Talk Live'}
                </p>
              </div>
            </motion.div>
          </div>

          {/* Full-width 4-column quantitative specification strip */}
          <div className="nova-3d-card mt-12 grid grid-cols-2 gap-6 rounded-2xl p-5 sm:mt-14 sm:grid-cols-4 sm:p-8">
            <div>
              <p className="font-display text-xl sm:text-2xl font-bold tabular-nums text-[#059669] dark:text-[#34D399]">
                24 kHz Live
              </p>
              <p className="mt-1 text-xs text-[#52645B] dark:text-[#94A89E]">
                Hands-free human voice streaming in Hindi, Hinglish &amp; English
              </p>
            </div>
            <div>
              <p className="font-display text-xl sm:text-2xl font-bold tabular-nums text-[#9A633A] dark:text-[#D4A373]">
                25 MB Notes
              </p>
              <p className="mt-1 text-xs text-[#52645B] dark:text-[#94A89E]">
                Filter uploaded handouts by title, subject &amp; content keywords
              </p>
            </div>
            <div>
              <p className="font-display text-xl sm:text-2xl font-bold tabular-nums text-[#059669] dark:text-[#34D399]">
                3 ATS Layouts
              </p>
              <p className="mt-1 text-xs text-[#52645B] dark:text-[#94A89E]">
                Single-column selectable-text PDF resumes built for ATS parsers
              </p>
            </div>
            <div>
              <p className="font-display text-xl sm:text-2xl font-bold tabular-nums text-[#9A633A] dark:text-[#D4A373]">
                100% Synced
              </p>
              <p className="mt-1 text-xs text-[#52645B] dark:text-[#94A89E]">
                Identical Laptop &amp; Mobile studio backed by PostgreSQL storage
              </p>
            </div>
          </div>
        </section>

        {/* Core Capabilities Asymmetric Bento Grid */}
        <section
          id="capabilities"
          className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:py-20"
        >
          <div className="max-w-2xl">
            <h2 className="font-display text-2xl font-bold tracking-tight text-[#111916] dark:text-[#F2F6F4] sm:text-3xl [text-wrap:balance]">
              Designed around three daily student and developer workflows.
            </h2>
            <p className="mt-3 text-sm sm:text-base text-[#52645B] dark:text-[#94A89E]">
              Every live voice talk, uploaded lecture note, and career resume syncs directly across your Laptop and Mobile account.
            </p>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Marquee Capability (2 cols on lg) */}
            <div className="nova-accent-surface flex flex-col justify-between rounded-2xl p-6 sm:p-7 lg:col-span-2">
              <div>
                <p className="text-xs font-semibold text-[#6EE7B7]">
                  01. Live Human Voice &amp; Streaming AI Assistant
                </p>
                <h3 className="mt-2 font-display text-xl font-bold text-[#F2F6F4]">
                  Converse hands-free in natural Hindi like talking to a smart mentor
                </h3>
                <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#D1FAE5]/90">
                  Speak naturally without clicking a microphone button after every sentence — ask everyday questions or deep engineering concepts with instant voice barge-in, live Hindi transcripts, camera vision, and persistent chat history.
                </p>
              </div>

              <div className="mt-7 border-t border-[#34D399]/25 pt-5">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-2 text-xs text-[#A7F3D0]">
                    <Radio className="h-4 w-4 text-[#6EE7B7]" />
                    <span>Always-On Hands-Free Voice · Streaming Code · 10+ Languages</span>
                  </div>
                  <Link
                    to={featureRoute('/live')}
                    onClick={() => void unlockLiveAudioEngine()}
                    state={featureState('/live')}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-[#ECFDF5] hover:underline whitespace-nowrap shrink-0"
                  >
                    <span>{user ? 'Open Live Voice' : 'Sign Up for Live Voice'}</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            </div>

            {/* Notes Library Card */}
            <div className="nova-3d-card flex flex-col justify-between overflow-hidden rounded-2xl">
              <ResilientImage
                src="/src/assets/images/feature_notes_archive_1793018428726.jpg"
                alt="Organized university geometry and algorithm notes on desk"
                fallbackLabel="Academic Notes Archive"
                className="aspect-[4/3] w-full object-cover border-b border-[#DCE3DF] dark:border-[#23312B]"
              />
              <div className="p-6">
                <p className="text-xs font-semibold text-[#059669] dark:text-[#34D399]">
                  02. Notes Library &amp; Keyword Search
                </p>
                <h3 className="mt-1.5 font-display text-lg font-bold text-[#111916] dark:text-[#F2F6F4]">
                  Filter notes by title, subject, or content keywords
                </h3>
                <p className="mt-2 text-sm text-[#52645B] dark:text-[#94A89E]">
                  Search inside uploaded handouts with highlighted keyword snippets, scope to your own uploads, and preview PDFs or Markdown inline.
                </p>
                <Link
                  to={featureRoute('/notes')}
                  state={featureState('/notes')}
                  className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-[#059669] dark:text-[#34D399] hover:underline whitespace-nowrap"
                >
                  <BookOpen className="h-3.5 w-3.5" />
                  <span>{user ? 'Browse Notes Library' : 'Sign Up for Notes'}</span>
                </Link>
              </div>
            </div>

            {/* ATS CV Maker Card */}
            <div className="nova-3d-card flex flex-col justify-between overflow-hidden rounded-2xl">
              <ResilientImage
                src="/src/assets/images/feature_ats_resume_1793018429458.jpg"
                alt="Printed single-column ATS resume on desk"
                fallbackLabel="Single-Column ATS Resume"
                className="aspect-[4/3] w-full object-cover border-b border-[#DCE3DF] dark:border-[#23312B]"
              />
              <div className="p-6">
                <p className="text-xs font-semibold text-[#9A633A] dark:text-[#D4A373]">
                  03. ATS-Friendly CV Maker
                </p>
                <h3 className="mt-1.5 font-display text-lg font-bold text-[#111916] dark:text-[#F2F6F4]">
                  Single-column selectable-text PDF resumes
                </h3>
                <p className="mt-2 text-sm text-[#52645B] dark:text-[#94A89E]">
                  Edit seven structured career sections with live side-by-side preview and download clean PDFs free of parser-breaking tables.
                </p>
                <Link
                  to={featureRoute('/cv')}
                  state={featureState('/cv')}
                  className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-[#9A633A] dark:text-[#D4A373] hover:underline whitespace-nowrap"
                >
                  <FileText className="h-3.5 w-3.5" />
                  <span>{user ? 'Build Your CV' : 'Sign Up to Build CV'}</span>
                </Link>
              </div>
            </div>

            {/* Proof / Attributable Researcher Feedback (2 cols on lg) */}
            <div className="nova-3d-card flex flex-col justify-between rounded-2xl p-6 sm:p-7 lg:col-span-2">
              <div>
                <p className="text-xs font-semibold text-[#9A633A] dark:text-[#D4A373]">
                  Verified Student Workflow Outcome
                </p>
                <blockquote className="mt-3 text-base sm:text-lg font-medium leading-relaxed text-[#111916] dark:text-[#F2F6F4]">
                  “Before NOVAAI, our study group split exam notes across messaging threads and struggled with two-column resume templates that failed campus placement parsers. Switching to NOVAAI let us filter Semester 5 notes directly by theorem keywords, practice mock interviews in Live Hindi Voice mode, and export single-column PDF resumes that passed every technical screening.”
                </blockquote>
              </div>

              <div className="mt-6 flex items-center gap-3.5 border-t border-[#DCE3DF] pt-5 dark:border-[#23312B]">
                <ResilientImage
                  src="/src/assets/images/avatar_student_creator_1793018430249.jpg"
                  alt="Portrait of Ananya Rao, Computer Science Fellow"
                  fallbackLabel="AR"
                  className="h-11 w-11 shrink-0 rounded-full object-cover ring-2 ring-[#10B981]"
                />
                <div>
                  <p className="text-sm font-bold text-[#111916] dark:text-[#F2F6F4]">
                    Ananya Rao
                  </p>
                  <p className="text-xs text-[#52645B] dark:text-[#94A89E]">
                    B.Tech Computer Science Researcher · Campus Placement Coordinator
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Quiet Editorial Footer */}
      <footer className="border-t border-[#DCE3DF] bg-white py-10 text-[#111916] dark:border-[#1E2B26] dark:bg-[#0E1513] dark:text-[#F2F6F4]">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 px-4 sm:flex-row sm:items-center sm:px-6">
          <div>
            <NovaLogo size="sm" />
            <p className="mt-2 text-xs text-[#52645B] dark:text-[#94A89E]">
              Developed and created by Deenu Verma. All rights reserved.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-6 text-xs font-semibold text-[#4A5B53] dark:text-[#9AB0A6]">
            {user ? (
              <Link
                to="/home"
                className="hover:text-[#059669] dark:hover:text-[#34D399]"
              >
                Open Workspace
              </Link>
            ) : (
              <>
                <Link
                  to="/signup"
                  className="hover:text-[#059669] dark:hover:text-[#34D399]"
                >
                  Sign Up
                </Link>
                <Link
                  to="/login"
                  className="hover:text-[#059669] dark:hover:text-[#34D399]"
                >
                  Sign In
                </Link>
              </>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}

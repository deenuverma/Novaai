import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  BookOpen,
  Download,
  Eye,
  FileText,
  Lock,
  MessageSquare,
  Plus,
  Radio,
  Search,
  Send,
  ShieldCheck,
  Upload,
} from 'lucide-react';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import { NovaLogo } from '../components/brand/NovaLogo.tsx';
import { AppShell } from '../components/layout/AppShell.tsx';
import { NotePreviewModal } from '../components/notes/NotePreviewModal.tsx';
import { Nova3DScene } from '../components/three/Nova3DScene.tsx';
import { Button } from '../components/ui/button.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { preloadGoogleIdentityScript } from '../lib/firebase.ts';
import { unlockLiveAudioEngine } from '../lib/liveAudioEngine.ts';
import { formatBytes, formatShortDate } from '../lib/utils.ts';
import { authApi, chatApi, cvApi, notesApi } from '../services/api.ts';
import {
  isOwnerAdminUser,
  type ChatSummary,
  type CVRecord,
  type NoteItem,
} from '../types/models.ts';

const QUICK_AI_TOPICS = [
  'What is the capital of India and its history?',
  'Explain Dijkstra shortest path in Hinglish',
  'Write an ATS summary for a Full-Stack Developer',
];

export function HomePage() {
  const { user, stats } = useAuth();
  const navigate = useNavigate();

  const [quickPrompt, setQuickPrompt] = useState('');
  const [noteQuery, setNoteQuery] = useState('');

  const [featuredNotes, setFeaturedNotes] = useState<NoteItem[]>([]);
  const [totalLibraryNotes, setTotalLibraryNotes] = useState(0);
  const [notesLoading, setNotesLoading] = useState(true);
  const [previewNote, setPreviewNote] = useState<NoteItem | null>(null);

  const [recentChats, setRecentChats] = useState<ChatSummary[]>([]);
  const [recentCVs, setRecentCVs] = useState<CVRecord[]>([]);

  useEffect(() => {
    let active = true;
    if (!user) {
      authApi.warmup();
      preloadGoogleIdentityScript();
    }

    setNotesLoading(true);
    notesApi
      .listNotes({ sort: 'downloads', page: 1 })
      .then((res) => {
        if (!active) return;
        setFeaturedNotes(res.items.slice(0, 4));
        setTotalLibraryNotes(res.pagination.total);
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setNotesLoading(false);
      });

    return () => {
      active = false;
    };
  }, [user]);

  useEffect(() => {
    if (!user) {
      setRecentChats([]);
      setRecentCVs([]);
      return;
    }

    let active = true;
    Promise.allSettled([chatApi.listChats(1), cvApi.listCVs(1)]).then(
      ([chatsRes, cvsRes]) => {
        if (!active) return;
        if (chatsRes.status === 'fulfilled') {
          setRecentChats(chatsRes.value.items.slice(0, 4));
        }
        if (cvsRes.status === 'fulfilled') {
          setRecentCVs(cvsRes.value.items.slice(0, 3));
        }
      }
    );

    return () => {
      active = false;
    };
  }, [user]);

  const requireSignupRedirect = (targetPath: string) => {
    navigate('/signup', {
      state: { from: targetPath, requireAuthNotice: true },
    });
  };

  const handleQuickAskSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = quickPrompt.trim();
    const target = trimmed
      ? `/chat?q=${encodeURIComponent(trimmed)}`
      : '/chat';
    if (!user) {
      requireSignupRedirect(target);
      return;
    }
    navigate(target);
  };

  const handleLaunchLiveVoice = () => {
    void unlockLiveAudioEngine();
    const target = '/live';
    if (!user) {
      requireSignupRedirect(target);
      return;
    }
    navigate(target);
  };

  const handleQuickTopicClick = (topic: string) => {
    const target = `/chat?q=${encodeURIComponent(topic)}`;
    if (!user) {
      requireSignupRedirect(target);
      return;
    }
    navigate(target);
  };

  const handleQuickNoteSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = noteQuery.trim();
    const target = trimmed
      ? `/notes?q=${encodeURIComponent(trimmed)}`
      : '/notes';
    if (!user) {
      requireSignupRedirect(target);
      return;
    }
    navigate(target);
  };

  const handlePreviewNoteClick = (note: NoteItem) => {
    if (!user) {
      requireSignupRedirect('/notes');
      return;
    }
    setPreviewNote(note);
  };

  const handleDownloadNote = async (note: NoteItem) => {
    if (!user) {
      requireSignupRedirect('/notes');
      return;
    }
    try {
      const updated = await notesApi.downloadNote(note);
      setFeaturedNotes((prev) =>
        prev.map((item) =>
          item.id === note.id
            ? {
                ...item,
                downloads: updated !== null ? updated : item.downloads + 1,
              }
            : item
        )
      );
      setPreviewNote((prev) =>
        prev && prev.id === note.id
          ? {
              ...prev,
              downloads: updated !== null ? updated : prev.downloads + 1,
            }
          : prev
      );
      toast.success(`Downloading "${note.fileName}"`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Download failed.');
    }
  };

  return (
    <AppShell>
      <div className="min-h-screen w-full bg-[#F4F6F4] text-[#111916] dark:bg-[#0B0F0E] dark:text-[#F2F6F4]">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8 space-y-10">
          {/* Dominant Focal Anchor: Studio Hero + Interactive 3D Emerald & Bronze Core */}
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="nova-3d-card overflow-hidden rounded-3xl"
          >
            <div className="p-6 sm:p-8">
              <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-12">
                {/* Left Hero Copy + Quick Ask */}
                <div className="lg:col-span-7">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs font-semibold text-[#059669] dark:text-[#34D399]">
                      NOVAAI 3D Live Studio · Created by Deenu Verma
                    </p>
                    {!user ? (
                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <Link
                          to="/signup"
                          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-[#059669] px-3.5 text-xs font-semibold text-white transition-colors hover:bg-[#047857] dark:bg-[#10B981] dark:text-[#061510] dark:hover:bg-[#34D399] whitespace-nowrap"
                        >
                          <span>Create Free Account</span>
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                        <Link
                          to="/login"
                          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-[#C2CEC8] bg-[#F4F6F4] px-3.5 text-xs font-semibold text-[#111916] transition-colors hover:bg-[#EAEEEC] dark:border-[#2A3933] dark:bg-[#18221E] dark:text-[#F2F6F4] dark:hover:bg-[#22302B] whitespace-nowrap"
                        >
                          <span>Sign In</span>
                        </Link>
                      </div>
                    ) : isOwnerAdminUser(user) ? (
                      <Link
                        to="/admin"
                        className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-[#C8956B]/50 bg-[#FAF5EF] px-4 text-xs font-semibold text-[#784B2A] transition-colors hover:bg-[#F3E6D8] dark:border-[#C8956B]/45 dark:bg-[#1B1612] dark:text-[#E8C3A3] dark:hover:bg-[#261E18] whitespace-nowrap shrink-0"
                      >
                        <ShieldCheck className="h-4 w-4 text-[#C8956B]" />
                        <span>Open Admin Panel</span>
                      </Link>
                    ) : null}
                  </div>

                  <h1 className="mt-3 font-display text-2xl sm:text-4xl font-bold tracking-tight text-[#111916] dark:text-[#F2F6F4] [text-wrap:balance]">
                    {user
                      ? `Welcome back, ${user.name.split(' ')[0]}. Talk live in Hindi or study faster.`
                      : 'Speak live like a human with NOVAAI 3D Study & Career Studio.'}
                  </h1>
                  <p className="mt-2.5 max-w-2xl text-sm leading-relaxed text-[#52645B] dark:text-[#94A89E]">
                    {user
                      ? 'Start an always-on hands-free Hindi/English voice conversation, search academic notes by keyword, or export an ATS-friendly PDF resume.'
                      : 'Sign up free to unlock Hands-Free Live Hindi Voice Conversation, Multilingual AI Chat, Academic Notes Library & Uploads, and ATS-Friendly CV PDF export.'}
                  </p>

                  {/* Primary Live Voice Action */}
                  <div className="mt-5 flex flex-wrap items-center gap-3">
                    <Button
                      type="button"
                      variant="default"
                      size="lg"
                      onClick={handleLaunchLiveVoice}
                    >
                      <Radio className="h-4 w-4" />
                      <span>
                        {user
                          ? 'Talk Live with NOVAAI'
                          : 'Sign Up for Live Voice Chat'}
                      </span>
                    </Button>
                  </div>

                  <form
                    onSubmit={handleQuickAskSubmit}
                    className="mt-5 flex flex-col gap-2.5 sm:flex-row"
                  >
                    <div className="relative flex-1">
                      <MessageSquare className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[#059669] dark:text-[#34D399]" />
                      <input
                        type="text"
                        value={quickPrompt}
                        onChange={(e) => setQuickPrompt(e.target.value)}
                        placeholder="Ask NOVAAI anything (e.g. What is the capital of India?)..."
                        className="flex h-11 w-full rounded-xl border border-[#C2CEC8] bg-[#F4F6F4] pl-10 pr-4 text-sm text-[#111916] placeholder:text-[#6B8076] focus:border-[#059669] focus:bg-white focus:outline-none dark:border-[#2A3933] dark:bg-[#0E1513] dark:text-[#F2F6F4] dark:focus:border-[#10B981]"
                        aria-label="Ask NOVAAI a question"
                      />
                    </div>
                    <Button type="submit" variant="crimson" size="lg">
                      {user ? (
                        <Send className="h-4 w-4" />
                      ) : (
                        <Lock className="h-4 w-4" />
                      )}
                      <span>{user ? 'Send' : 'Sign Up & Send'}</span>
                    </Button>
                  </form>

                  {/* One-Click Starter Prompts */}
                  <div className="mt-3.5 flex flex-wrap items-center gap-2">
                    <span className="text-xs font-medium text-[#52645B] dark:text-[#94A89E] whitespace-nowrap">
                      Try asking:
                    </span>
                    {QUICK_AI_TOPICS.map((topic) => (
                      <button
                        key={topic}
                        type="button"
                        onClick={() => handleQuickTopicClick(topic)}
                        className="rounded-lg border border-[#DCE3DF] bg-[#F4F6F4] px-2.5 py-1 text-xs font-medium text-[#2C3A34] transition-colors hover:border-[#059669] hover:text-[#111916] dark:border-[#263831] dark:bg-[#18221E] dark:text-[#DCE6E1] dark:hover:border-[#10B981] dark:hover:text-white whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        {topic}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Right Interactive 3D Emerald & Champagne Bronze Core */}
                <div className="flex flex-col items-center justify-center lg:col-span-5">
                  <div
                    onClick={handleLaunchLiveVoice}
                    title="Click to start Live Human Voice Conversation"
                    className="h-64 w-full max-w-sm sm:h-72 cursor-pointer"
                  >
                    <Nova3DScene
                      className="h-full w-full"
                      voiceState="idle"
                      interactive
                    />
                  </div>
                  <p className="mt-1 text-center text-xs font-medium text-[#52645B] dark:text-[#94A89E]">
                    Drag to rotate 3D core · Click to talk live
                  </p>
                </div>
              </div>

              {/* Quantitative Workspace Metrics Strip */}
              <div className="mt-7 grid grid-cols-2 gap-6 border-t border-[#DCE3DF] pt-6 sm:grid-cols-4 dark:border-[#23312B]">
                <div>
                  <p className="font-display text-2xl font-bold tabular-nums text-[#059669] dark:text-[#34D399]">
                    {totalLibraryNotes}
                  </p>
                  <p className="mt-0.5 text-xs text-[#52645B] dark:text-[#94A89E]">
                    Indexed Library Notes
                  </p>
                </div>
                <div>
                  <p className="font-display text-2xl font-bold tabular-nums text-[#9A633A] dark:text-[#D4A373]">
                    {user ? stats.chats : '10+'}
                  </p>
                  <p className="mt-0.5 text-xs text-[#52645B] dark:text-[#94A89E]">
                    {user ? 'Your Saved AI Chats' : 'Live Voice Languages'}
                  </p>
                </div>
                <div>
                  <p className="font-display text-2xl font-bold tabular-nums text-[#059669] dark:text-[#34D399]">
                    {user ? stats.notes : '25 MB'}
                  </p>
                  <p className="mt-0.5 text-xs text-[#52645B] dark:text-[#94A89E]">
                    {user ? 'Your Uploaded Notes' : 'Max Note File Upload'}
                  </p>
                </div>
                <div>
                  <p className="font-display text-2xl font-bold tabular-nums text-[#9A633A] dark:text-[#D4A373]">
                    {user ? stats.cvs : '3'}
                  </p>
                  <p className="mt-0.5 text-xs text-[#52645B] dark:text-[#94A89E]">
                    {user ? 'Your Saved ATS CVs' : 'Single-Column ATS Layouts'}
                  </p>
                </div>
              </div>
            </div>
          </motion.section>

          {/* Core Workspace Modules */}
          <section className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
            <Link
              to={user ? '/live' : '/signup'}
              onClick={() => void unlockLiveAudioEngine()}
              state={
                !user ? { from: '/live', requireAuthNotice: true } : undefined
              }
              className="nova-accent-surface group flex flex-col justify-between rounded-2xl p-5"
            >
              <div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#10B981] text-[#061510]">
                  <Radio className="h-5 w-5" />
                </div>
                <h2 className="mt-4 font-display text-base font-bold text-[#F2F6F4]">
                  Live Hindi Voice Chat
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-[#D1FAE5]/90">
                  Speak naturally hands-free in Hindi, Hinglish, or English and hear expressive human answers in real time.
                </p>
              </div>
              <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-[#6EE7B7] group-hover:translate-x-0.5 transition-transform whitespace-nowrap">
                <span>{user ? 'Start Live Talk' : 'Sign Up for Live Voice'}</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </Link>

            <Link
              to={user ? '/notes' : '/signup'}
              state={!user ? { from: '/notes', requireAuthNotice: true } : undefined}
              className="nova-3d-card group flex flex-col justify-between rounded-2xl p-5"
            >
              <div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#ECFDF5] text-[#059669] dark:bg-[#0F261F] dark:text-[#34D399]">
                  <BookOpen className="h-5 w-5" />
                </div>
                <h2 className="mt-4 font-display text-base font-bold text-[#111916] dark:text-[#F2F6F4]">
                  Notes Library
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-[#52645B] dark:text-[#94A89E]">
                  Filter academic notes by title, subject, or content keywords with inline PDF &amp; Markdown preview.
                </p>
              </div>
              <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-[#059669] dark:text-[#34D399] group-hover:translate-x-0.5 transition-transform whitespace-nowrap">
                <span>{user ? 'Browse Notes' : 'Sign Up for Notes'}</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </Link>

            <Link
              to={user ? '/notes/upload' : '/signup'}
              state={
                !user
                  ? { from: '/notes/upload', requireAuthNotice: true }
                  : undefined
              }
              className="nova-3d-card group flex flex-col justify-between rounded-2xl p-5"
            >
              <div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FAF5EF] text-[#9A633A] dark:bg-[#231B14] dark:text-[#D4A373]">
                  <Upload className="h-5 w-5" />
                </div>
                <h2 className="mt-4 font-display text-base font-bold text-[#111916] dark:text-[#F2F6F4]">
                  Upload Study Notes
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-[#52645B] dark:text-[#94A89E]">
                  Publish PDFs, DOCX, slides, images, or Markdown up to 25 MB with automatic keyword indexing.
                </p>
              </div>
              <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-[#9A633A] dark:text-[#D4A373] group-hover:translate-x-0.5 transition-transform whitespace-nowrap">
                <span>{user ? 'Upload File' : 'Sign Up to Upload'}</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </Link>

            <Link
              to={user ? '/cv' : '/signup'}
              state={!user ? { from: '/cv', requireAuthNotice: true } : undefined}
              className="nova-3d-card group flex flex-col justify-between rounded-2xl p-5"
            >
              <div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#ECFDF5] text-[#059669] dark:bg-[#0F261F] dark:text-[#34D399]">
                  <FileText className="h-5 w-5" />
                </div>
                <h2 className="mt-4 font-display text-base font-bold text-[#111916] dark:text-[#F2F6F4]">
                  ATS CV Maker
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-[#52645B] dark:text-[#94A89E]">
                  Step-by-step editor with live side-by-side preview and selectable-text single-column PDF export.
                </p>
              </div>
              <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-[#059669] dark:text-[#34D399] group-hover:translate-x-0.5 transition-transform whitespace-nowrap">
                <span>{user ? 'Build Resume' : 'Sign Up for CV Maker'}</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </Link>
          </section>

          {/* Popular Academic Notes Showcase */}
          <section className="space-y-4">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div>
                <h2 className="font-display text-xl font-bold tracking-tight text-[#111916] dark:text-[#F2F6F4]">
                  Popular Academic Notes
                </h2>
                <p className="mt-0.5 text-xs sm:text-sm text-[#52645B] dark:text-[#94A89E]">
                  {user
                    ? 'Preview or download top study handouts, or jump straight into keyword search.'
                    : 'Explore featured lecture notes below — sign up free to preview or download files.'}
                </p>
              </div>

              <form
                onSubmit={handleQuickNoteSearch}
                className="flex w-full items-center gap-2 sm:w-auto"
              >
                <div className="relative flex-1 sm:w-64">
                  <Search className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-[#059669] dark:text-[#34D399]" />
                  <input
                    value={noteQuery}
                    onChange={(e) => setNoteQuery(e.target.value)}
                    placeholder="Search notes (e.g. Dijkstra, MVCC)..."
                    className="flex h-9 w-full rounded-xl border border-[#C2CEC8] bg-white pl-9 pr-3 text-xs text-[#111916] placeholder:text-[#6B8076] focus:border-[#059669] focus:outline-none dark:border-[#2A3933] dark:bg-[#131B18] dark:text-[#F2F6F4] dark:focus:border-[#10B981]"
                    aria-label="Quick search academic notes"
                  />
                </div>
                <Button type="submit" variant="default" size="sm">
                  Search
                </Button>
              </form>
            </div>

            {notesLoading ? (
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
                {Array.from({ length: 4 }).map((_, idx) => (
                  <div
                    key={idx}
                    className="nova-3d-card h-48 rounded-2xl p-5"
                  />
                ))}
              </div>
            ) : featuredNotes.length === 0 ? (
              <div className="nova-3d-card rounded-2xl p-8 text-center">
                <p className="text-sm text-[#52645B] dark:text-[#94A89E]">
                  No study notes uploaded yet.
                </p>
                <Link
                  to={user ? '/notes/upload' : '/signup'}
                  state={
                    !user
                      ? { from: '/notes/upload', requireAuthNotice: true }
                      : undefined
                  }
                  className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#059669] px-4 text-xs font-semibold text-white hover:bg-[#047857] dark:bg-[#10B981] dark:text-[#061510]"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Upload First Note</span>
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
                {featuredNotes.map((note) => (
                  <article
                    key={note.id}
                    className="nova-3d-card flex flex-col justify-between rounded-2xl p-5"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 text-xs text-[#52645B] dark:text-[#94A89E]">
                        <span className="truncate font-semibold text-[#059669] dark:text-[#34D399]">
                          {note.subject}
                        </span>
                        <span className="font-mono text-[11px] tabular-nums">
                          {formatBytes(note.fileSize)}
                        </span>
                      </div>
                      <h3 className="mt-2 line-clamp-2 font-display text-sm font-bold leading-snug text-[#111916] dark:text-[#F2F6F4]">
                        {note.title}
                      </h3>
                      <p className="mt-1.5 text-xs text-[#52645B] dark:text-[#94A89E]">
                        {note.classLevel} · {note.uploaderName}
                      </p>
                    </div>

                    <div className="mt-4 border-t border-[#DCE3DF] pt-3 dark:border-[#23312B]">
                      <div className="mb-2.5 flex items-center justify-between text-[11px] text-[#52645B] dark:text-[#94A89E] tabular-nums">
                        <span>{formatShortDate(note.createdAt)}</span>
                        <span className="font-semibold text-[#9A633A] dark:text-[#D4A373]">
                          {note.downloads} downloads
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          onClick={() => handlePreviewNoteClick(note)}
                        >
                          <Eye className="h-3.5 w-3.5" />
                          <span>Preview</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="default"
                          className="flex-1"
                          onClick={() => handleDownloadNote(note)}
                        >
                          <Download className="h-3.5 w-3.5" />
                          <span>Download</span>
                        </Button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          {/* Recent Conversations & Resumes */}
          <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="nova-3d-card rounded-2xl p-6">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-base font-bold text-[#111916] dark:text-[#F2F6F4]">
                  Recent AI &amp; Live Voice Conversations
                </h2>
                <Link
                  to={user ? '/chat' : '/signup'}
                  state={!user ? { from: '/chat', requireAuthNotice: true } : undefined}
                  className="text-xs font-semibold text-[#059669] dark:text-[#34D399] hover:underline whitespace-nowrap"
                >
                  {user ? 'Open Chat' : 'Sign Up'}
                </Link>
              </div>

              {!user ? (
                <div className="mt-4">
                  <p className="text-xs leading-relaxed text-[#52645B] dark:text-[#94A89E]">
                    Create a free NOVAAI account to unlock natural live Hindi voice chat, multilingual streaming answers, and persistent conversation history.
                  </p>
                  <div className="mt-4 flex items-center gap-2.5">
                    <Link
                      to="/signup"
                      state={{ from: '/live', requireAuthNotice: true }}
                      className="inline-flex h-9 items-center rounded-xl bg-[#059669] px-3.5 text-xs font-semibold text-white hover:bg-[#047857] dark:bg-[#10B981] dark:text-[#061510] whitespace-nowrap"
                    >
                      Create Free Account
                    </Link>
                    <Link
                      to="/login"
                      state={{ from: '/home' }}
                      className="inline-flex h-9 items-center rounded-xl border border-[#C2CEC8] bg-[#F4F6F4] px-3.5 text-xs font-semibold text-[#111916] hover:bg-[#EAEEEC] dark:border-[#2A3933] dark:bg-[#18221E] dark:text-[#F2F6F4] whitespace-nowrap"
                    >
                      Sign In
                    </Link>
                  </div>
                </div>
              ) : recentChats.length === 0 ? (
                <p className="mt-4 text-xs text-[#52645B] dark:text-[#94A89E]">
                  No conversations saved yet. Click “Talk Live with NOVAAI” above to begin!
                </p>
              ) : (
                <div className="mt-3 divide-y divide-[#DCE3DF] dark:divide-[#23312B]">
                  {recentChats.map((chat) => (
                    <Link
                      key={chat.id}
                      to="/chat"
                      className="flex items-center justify-between gap-4 py-2.5 text-xs transition-colors hover:text-[#059669] dark:hover:text-[#34D399]"
                    >
                      <span className="truncate font-medium text-[#111916] dark:text-[#F2F6F4]">
                        {chat.title}
                      </span>
                      <span className="shrink-0 text-[#52645B] dark:text-[#94A89E] tabular-nums">
                        {formatShortDate(chat.createdAt)}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <div className="nova-3d-card rounded-2xl p-6">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-base font-bold text-[#111916] dark:text-[#F2F6F4]">
                  ATS-Friendly Resumes
                </h2>
                <Link
                  to={user ? '/cv' : '/signup'}
                  state={!user ? { from: '/cv', requireAuthNotice: true } : undefined}
                  className="text-xs font-semibold text-[#9A633A] dark:text-[#D4A373] hover:underline whitespace-nowrap"
                >
                  {user ? 'Open CV Maker' : 'Sign Up'}
                </Link>
              </div>

              {!user || recentCVs.length === 0 ? (
                <div className="mt-4">
                  <p className="text-xs leading-relaxed text-[#52645B] dark:text-[#94A89E]">
                    Create single-column, parser-safe resumes in Executive Sans, Classic Serif, or Technical Compact layouts and export selectable-text PDFs.
                  </p>
                  <div className="mt-4">
                    <Link
                      to={user ? '/cv' : '/signup'}
                      state={!user ? { from: '/cv', requireAuthNotice: true } : undefined}
                      className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#9A633A] px-3.5 text-xs font-semibold text-white hover:bg-[#784B2A] dark:bg-[#C8956B] dark:text-[#160E07] dark:hover:bg-[#D4A373] whitespace-nowrap"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      <span>{user ? 'Create ATS Resume' : 'Sign Up to Build Resume'}</span>
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="mt-3 divide-y divide-[#DCE3DF] dark:divide-[#23312B]">
                  {recentCVs.map((cv) => (
                    <Link
                      key={cv.id}
                      to={`/cv?id=${cv.id}`}
                      className="flex items-center justify-between gap-4 py-2.5 text-xs transition-colors hover:text-[#9A633A] dark:hover:text-[#D4A373]"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium text-[#111916] dark:text-[#F2F6F4]">
                          {cv.title}
                        </p>
                        <p className="text-[11px] text-[#52645B] dark:text-[#94A89E]">
                          {cv.templateId} layout · Updated {formatShortDate(cv.updatedAt)}
                        </p>
                      </div>
                      <span className="shrink-0 font-semibold text-[#059669] dark:text-[#34D399]">
                        Edit / PDF
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Quiet Workspace Footer */}
          <footer className="flex flex-wrap items-center justify-between gap-4 border-t border-[#DCE3DF] pt-6 text-xs text-[#52645B] dark:border-[#23312B] dark:text-[#94A89E]">
            <div className="flex items-center gap-2.5">
              <NovaLogo size="sm" />
              <span>· Created by Deenu Verma</span>
            </div>
            <Link
              to="/"
              className="font-semibold text-[#059669] dark:text-[#34D399] hover:underline whitespace-nowrap"
            >
              View Product Overview Page
            </Link>
          </footer>
        </div>
      </div>

      <NotePreviewModal
        note={previewNote}
        onClose={() => setPreviewNote(null)}
        onDownload={handleDownloadNote}
      />
    </AppShell>
  );
}

import React, { useCallback, useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  Loader2,
  Lock,
  LogOut,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  UserCheck,
  X,
} from 'lucide-react';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import { AppShell } from '../components/layout/AppShell.tsx';
import { NotePreviewModal } from '../components/notes/NotePreviewModal.tsx';
import { Button } from '../components/ui/button.tsx';
import { Input } from '../components/ui/input.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { useDebounce } from '../hooks/useDebounce.ts';
import { formatBytes, formatShortDate } from '../lib/utils.ts';
import { adminApi, notesApi } from '../services/api.ts';
import {
  isOwnerAdminUser,
  OWNER_ADMIN_EMAIL,
  type AdminChatDetail,
  type AdminChatItem,
  type AdminCVItem,
  type AdminNoteItem,
  type AdminOverviewData,
  type AdminUserFullDetail,
  type AdminUserItem,
  type NoteItem,
  type PaginationMeta,
} from '../types/models.ts';

type AdminTab = 'overview' | 'users' | 'notes' | 'chats' | 'cvs';

const DEFAULT_PAGINATION: PaginationMeta = {
  page: 1,
  limit: 20,
  total: 0,
  totalPages: 1,
};

function formatAuthMethod(method: 'google' | 'password' | 'both'): string {
  if (method === 'both') return 'Google + Password';
  if (method === 'google') return 'Google OAuth';
  return 'Email & Password';
}

function formatExactDateTime(dateStr: string): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function AdminDashboardPage() {
  const { user, loading: authLoading, logout } = useAuth();
  const navigate = useNavigate();

  const isAuthorizedOwner = isOwnerAdminUser(user);

  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebounce(searchInput, 280);
  const [page, setPage] = useState(1);

  const [overview, setOverview] = useState<AdminOverviewData | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [overviewError, setOverviewError] = useState<string | null>(null);

  const [usersList, setUsersList] = useState<AdminUserItem[]>([]);
  const [notesList, setNotesList] = useState<AdminNoteItem[]>([]);
  const [chatsList, setChatsList] = useState<AdminChatItem[]>([]);
  const [cvsList, setCvsList] = useState<AdminCVItem[]>([]);
  const [pagination, setPagination] =
    useState<PaginationMeta>(DEFAULT_PAGINATION);

  const [tableLoading, setTableLoading] = useState(false);
  const [tableError, setTableError] = useState<string | null>(null);

  const [confirmDeleteKey, setConfirmDeleteKey] = useState<string | null>(null);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);

  const [previewNote, setPreviewNote] = useState<NoteItem | null>(null);
  const [inspectChat, setInspectChat] = useState<AdminChatDetail | null>(null);
  const [inspectLoadingId, setInspectLoadingId] = useState<number | null>(null);

  const [inspectUser, setInspectUser] = useState<AdminUserFullDetail | null>(
    null
  );
  const [inspectUserUid, setInspectUserUid] = useState<string | null>(null);

  const fetchOverview = useCallback(async () => {
    if (!isAuthorizedOwner) return;
    setOverviewLoading(true);
    setOverviewError(null);
    try {
      const data = await adminApi.getOverview();
      setOverview(data);
    } catch (err) {
      setOverviewError(
        err instanceof Error
          ? err.message
          : 'Failed to load administrator overview.'
      );
    } finally {
      setOverviewLoading(false);
    }
  }, [isAuthorizedOwner]);

  const fetchActiveTabTable = useCallback(async () => {
    if (!isAuthorizedOwner || activeTab === 'overview') return;
    setTableLoading(true);
    setTableError(null);
    try {
      if (activeTab === 'users') {
        const res = await adminApi.listUsers(debouncedSearch, page);
        setUsersList(res.items);
        setPagination(res.pagination);
      } else if (activeTab === 'notes') {
        const res = await adminApi.listNotes(debouncedSearch, page);
        setNotesList(res.items);
        setPagination(res.pagination);
      } else if (activeTab === 'chats') {
        const res = await adminApi.listChats(debouncedSearch, page);
        setChatsList(res.items);
        setPagination(res.pagination);
      } else if (activeTab === 'cvs') {
        const res = await adminApi.listCVs(debouncedSearch, page);
        setCvsList(res.items);
        setPagination(res.pagination);
      }
    } catch (err) {
      setTableError(
        err instanceof Error ? err.message : 'Failed to load records.'
      );
    } finally {
      setTableLoading(false);
    }
  }, [isAuthorizedOwner, activeTab, debouncedSearch, page]);

  useEffect(() => {
    if (isAuthorizedOwner) {
      fetchOverview();
    }
  }, [isAuthorizedOwner, fetchOverview]);

  useEffect(() => {
    if (isAuthorizedOwner && activeTab !== 'overview') {
      fetchActiveTabTable();
    }
  }, [isAuthorizedOwner, activeTab, fetchActiveTabTable]);

  const handleTabChange = (nextTab: AdminTab) => {
    setActiveTab(nextTab);
    setSearchInput('');
    setPage(1);
    setConfirmDeleteKey(null);
    setTableError(null);
  };

  const handleRefreshAll = async () => {
    await fetchOverview();
    if (activeTab !== 'overview') {
      await fetchActiveTabTable();
    }
    toast.success('Admin dashboard synced with Cloud SQL.');
  };

  const handleInspectUser = async (uid: string) => {
    setInspectUserUid(uid);
    try {
      const detail = await adminApi.getUserDetail(uid);
      setInspectUser(detail);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Could not load user activity.'
      );
    } finally {
      setInspectUserUid(null);
    }
  };

  const handleDeleteUser = async (target: AdminUserItem) => {
    const key = `user:${target.uid}`;
    setDeletingKey(key);
    try {
      await adminApi.deleteUser(target.uid);
      toast.success(`Removed user ${target.email}`);
      setConfirmDeleteKey(null);
      if (inspectUser?.user.uid === target.uid) {
        setInspectUser(null);
      }
      await Promise.all([fetchActiveTabTable(), fetchOverview()]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed.');
    } finally {
      setDeletingKey(null);
    }
  };

  const handleDeleteNote = async (target: AdminNoteItem) => {
    const key = `note:${target.id}`;
    setDeletingKey(key);
    try {
      await adminApi.deleteNote(target.id);
      toast.success(`Deleted note "${target.title}"`);
      setConfirmDeleteKey(null);
      await Promise.all([fetchActiveTabTable(), fetchOverview()]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed.');
    } finally {
      setDeletingKey(null);
    }
  };

  const handleDeleteChat = async (target: AdminChatItem) => {
    const key = `chat:${target.id}`;
    setDeletingKey(key);
    try {
      await adminApi.deleteChat(target.id);
      toast.success(`Deleted conversation "${target.title}"`);
      setConfirmDeleteKey(null);
      if (inspectChat?.id === target.id) {
        setInspectChat(null);
      }
      await Promise.all([fetchActiveTabTable(), fetchOverview()]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed.');
    } finally {
      setDeletingKey(null);
    }
  };

  const handleDeleteCV = async (target: AdminCVItem) => {
    const key = `cv:${target.id}`;
    setDeletingKey(key);
    try {
      await adminApi.deleteCV(target.id);
      toast.success(`Deleted resume "${target.title}"`);
      setConfirmDeleteKey(null);
      await Promise.all([fetchActiveTabTable(), fetchOverview()]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed.');
    } finally {
      setDeletingKey(null);
    }
  };

  const handleInspectChat = async (chatId: number) => {
    setInspectLoadingId(chatId);
    try {
      const res = await adminApi.getChatDetail(chatId);
      setInspectChat(res.chat);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Could not load conversation.'
      );
    } finally {
      setInspectLoadingId(null);
    }
  };

  const handleDownloadNote = async (note: NoteItem) => {
    try {
      await notesApi.downloadNote(note);
      toast.success(`Downloading "${note.fileName}"`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Download failed.');
    }
  };

  const handleSwitchAccount = async () => {
    await logout();
    navigate('/login', { state: { from: '/admin' } });
  };

  // 1. Auth Loading Skeleton
  if (authLoading) {
    return (
      <AppShell>
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
          <div className="h-44 rounded-2xl border border-[#DCE3DF] bg-[#EAEEEC]/70 dark:border-[#23312B] dark:bg-[#131B18]" />
          <div className="h-72 rounded-2xl border border-[#DCE3DF] bg-[#EAEEEC]/70 dark:border-[#23312B] dark:bg-[#131B18]" />
        </div>
      </AppShell>
    );
  }

  // 2. Unauthenticated -> Redirect to Signup with return path
  if (!user) {
    return (
      <Navigate
        to="/signup"
        state={{ from: '/admin', requireAuthNotice: true }}
        replace
      />
    );
  }

  // 3. Strictly Forbidden for Any Account Except deenuverma238@gmail.com
  if (!isAuthorizedOwner) {
    return (
      <AppShell>
        <div className="mx-auto flex min-h-[75vh] max-w-lg flex-col items-center justify-center px-6 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FAF3EE] text-[#9A633A] dark:bg-[#221610] dark:text-[#D4A373]">
            <Lock className="h-6 w-6" />
          </div>
          <h1 className="mt-4 font-display text-2xl font-bold text-[#111916] dark:text-[#F2F6F4]">
            Restricted Owner Console
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-[#52645B] dark:text-[#94A89E]">
            You are signed in as{' '}
            <span className="font-semibold text-[#111916] dark:text-[#F2F6F4]">
              {user.email}
            </span>
            . This administrator dashboard is strictly private and accessible only to the NOVAAI creator account.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/home"
              className="inline-flex h-10 items-center justify-center rounded-xl bg-[#059669] px-5 text-xs font-semibold text-white transition-colors hover:bg-[#047857] dark:bg-[#10B981] dark:text-[#071510] dark:hover:bg-[#34D399] whitespace-nowrap"
            >
              Return to Workspace Home
            </Link>
            <Button variant="crimson" onClick={handleSwitchAccount}>
              <LogOut className="h-4 w-4" />
              <span>Switch Account</span>
            </Button>
          </div>
        </div>
      </AppShell>
    );
  }

  // 4. Exclusive Owner Admin Dashboard (deenuverma238@gmail.com)
  const totals = overview?.totals;

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8 space-y-6">
        {/* Studio Alabaster / Obsidian Carbon + Emerald Jade + Champagne Bronze Owner Console Header */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
          className="overflow-hidden rounded-2xl border border-[#DCE3DF] bg-white dark:border-[#23312B] dark:bg-[#131B18]"
        >
          <div className="h-1.5 w-full bg-gradient-to-r from-[#059669] via-[#10B981] to-[#C8956B]" />
          <div className="p-6 sm:p-8">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <p className="flex items-center gap-1.5 text-xs font-semibold text-[#9A633A] dark:text-[#D4A373]">
                  <ShieldCheck className="h-4 w-4 shrink-0" />
                  <span>
                    NOVAAI Owner Console · Exclusive Access ({OWNER_ADMIN_EMAIL})
                  </span>
                </p>
                <h1 className="mt-1.5 font-display text-2xl sm:text-3xl font-bold tracking-tight text-[#111916] dark:text-[#F2F6F4] [text-wrap:balance]">
                  All Users, Emails, Signups &amp; Full App Activity
                </h1>
                <p className="mt-1 max-w-2xl text-sm text-[#52645B] dark:text-[#94A89E]">
                  View every registered user&apos;s email and signup timestamp, inspect everything they wrote or uploaded, read full AI chat transcripts, moderate notes, and manage ATS resumes.
                </p>
              </div>

              <button
                type="button"
                onClick={handleRefreshAll}
                disabled={overviewLoading || tableLoading}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#059669] px-4 text-xs font-semibold text-white transition-all duration-150 hover:bg-[#047857] active:scale-[0.98] disabled:opacity-60 dark:bg-[#10B981] dark:text-[#071510] dark:hover:bg-[#34D399] whitespace-nowrap shrink-0 cursor-pointer"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${
                    overviewLoading || tableLoading ? 'animate-spin' : ''
                  }`}
                />
                <span>Refresh Data</span>
              </button>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-6 border-t border-[#E6ECE9] pt-6 lg:grid-cols-4 dark:border-[#1E2B26]">
              <div>
                <p className="font-mono text-2xl sm:text-3xl font-bold tabular-nums text-[#059669] dark:text-[#34D399]">
                  {totals ? totals.users : '—'}
                </p>
                <p className="mt-1 text-xs font-semibold text-[#111916] dark:text-[#F2F6F4]">
                  Registered Users
                </p>
                <p className="mt-0.5 text-xs text-[#6B7E74] tabular-nums dark:text-[#869B90]">
                  {totals
                    ? `${totals.googleUsers} Google · ${totals.passwordUsers} Password`
                    : 'Loading breakdown'}
                </p>
              </div>

              <div>
                <p className="font-mono text-2xl sm:text-3xl font-bold tabular-nums text-[#9A633A] dark:text-[#D4A373]">
                  {totals ? totals.chats : '—'}
                </p>
                <p className="mt-1 text-xs font-semibold text-[#111916] dark:text-[#F2F6F4]">
                  AI Chat Sessions
                </p>
                <p className="mt-0.5 text-xs text-[#6B7E74] tabular-nums dark:text-[#869B90]">
                  {totals
                    ? `${totals.messages} total messages written`
                    : 'Loading messages'}
                </p>
              </div>

              <div>
                <p className="font-mono text-2xl sm:text-3xl font-bold tabular-nums text-[#059669] dark:text-[#34D399]">
                  {totals ? totals.notes : '—'}
                </p>
                <p className="mt-1 text-xs font-semibold text-[#111916] dark:text-[#F2F6F4]">
                  Academic Notes
                </p>
                <p className="mt-0.5 text-xs text-[#6B7E74] tabular-nums dark:text-[#869B90]">
                  {totals
                    ? `${totals.noteDownloads} downloads · ${formatBytes(
                        totals.noteStorageBytes
                      )}`
                    : 'Loading storage'}
                </p>
              </div>

              <div>
                <p className="font-mono text-2xl sm:text-3xl font-bold tabular-nums text-[#9A633A] dark:text-[#D4A373]">
                  {totals ? totals.cvs : '—'}
                </p>
                <p className="mt-1 text-xs font-semibold text-[#111916] dark:text-[#F2F6F4]">
                  Saved ATS Resumes
                </p>
                <p className="mt-0.5 text-xs text-[#6B7E74] dark:text-[#869B90]">
                  Single-column PDF records
                </p>
              </div>
            </div>
          </div>
        </motion.section>

        {/* Interactive Segmented Tab Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div
            role="tablist"
            aria-label="Admin sections"
            className="flex flex-wrap items-center gap-1 rounded-xl border border-[#DCE3DF] bg-white p-1 dark:border-[#23312B] dark:bg-[#131B18]"
          >
            {(
              [
                { id: 'overview', label: 'Overview' },
                { id: 'users', label: 'All Users & Emails' },
                { id: 'chats', label: 'All AI Chats' },
                { id: 'notes', label: 'All Uploaded Notes' },
                { id: 'cvs', label: 'All ATS Resumes' },
              ] as { id: AdminTab; label: string }[]
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`h-9 rounded-lg px-3.5 text-xs font-semibold transition-all duration-150 whitespace-nowrap shrink-0 cursor-pointer ${
                  activeTab === tab.id
                    ? tab.id === 'users' || tab.id === 'chats'
                      ? 'bg-[#9A633A] text-white dark:bg-[#C8956B] dark:text-[#140E08]'
                      : 'bg-[#059669] text-white dark:bg-[#10B981] dark:text-[#071510]'
                    : 'text-[#52645B] hover:bg-[#F4F6F4] hover:text-[#111916] dark:text-[#94A89E] dark:hover:bg-[#18221E] dark:hover:text-[#F2F6F4]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab !== 'overview' && (
            <div className="relative w-full sm:w-80">
              <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[#059669] dark:text-[#34D399]" />
              <Input
                value={searchInput}
                onChange={(e) => {
                  setSearchInput(e.target.value);
                  setPage(1);
                }}
                placeholder={
                  activeTab === 'users'
                    ? 'Search users by name or email...'
                    : activeTab === 'notes'
                      ? 'Search notes by title, subject, or keyword...'
                      : activeTab === 'chats'
                        ? 'Search chat sessions by title...'
                        : 'Search resumes by title...'
                }
                className="h-10 pl-9 pr-8 text-xs"
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchInput('');
                    setPage(1);
                  }}
                  aria-label="Clear search"
                  className="absolute top-1/2 right-2.5 -translate-y-1/2 text-[#6B7E74] hover:text-[#9A633A] dark:text-[#869B90] dark:hover:text-[#D4A373] cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <>
            {overviewError ? (
              <div className="rounded-2xl border border-[#DFC4B2] bg-[#FAF3EE] p-6 text-sm text-[#8C4A27] dark:border-[#4A3022] dark:bg-[#221610] dark:text-[#E7B89A]">
                <p>{overviewError}</p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-3"
                  onClick={fetchOverview}
                >
                  Retry
                </Button>
              </div>
            ) : overviewLoading && !overview ? (
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <div className="h-72 rounded-2xl border border-[#DCE3DF] bg-[#EAEEEC]/70 dark:border-[#23312B] dark:bg-[#131B18]" />
                <div className="h-72 rounded-2xl border border-[#DCE3DF] bg-[#EAEEEC]/70 dark:border-[#23312B] dark:bg-[#131B18]" />
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {/* Newest Registered Users */}
                <section className="rounded-2xl border border-[#DCE3DF] bg-white p-6 dark:border-[#23312B] dark:bg-[#131B18]">
                  <div className="flex items-center justify-between gap-4 border-b border-[#E6ECE9] pb-4 dark:border-[#1E2B26]">
                    <div>
                      <h2 className="font-display text-base font-semibold text-[#111916] dark:text-[#F2F6F4]">
                        Registered Users &amp; Signups
                      </h2>
                      <p className="text-xs text-[#6B7E74] dark:text-[#869B90]">
                        Click Inspect on any user to view everything they wrote
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleTabChange('users')}
                      className="text-xs font-semibold text-[#059669] hover:underline dark:text-[#34D399] whitespace-nowrap cursor-pointer"
                    >
                      View All Users
                    </button>
                  </div>

                  {!overview || overview.recentUsers.length === 0 ? (
                    <p className="py-8 text-center text-xs text-[#6B7E74] dark:text-[#869B90]">
                      No registered users found.
                    </p>
                  ) : (
                    <div className="divide-y divide-[#E6ECE9] dark:divide-[#1E2B26]">
                      {overview.recentUsers.map((u) => (
                        <div
                          key={u.uid}
                          className="flex items-center justify-between gap-3 py-3 text-xs"
                        >
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-[#111916] dark:text-[#F2F6F4]">
                              {u.name}
                              {u.email.toLowerCase() === OWNER_ADMIN_EMAIL && (
                                <span className="ml-1.5 font-semibold text-[#9A633A] dark:text-[#D4A373]">
                                  · Owner
                                </span>
                              )}
                            </p>
                            <p className="truncate font-medium text-[#059669] dark:text-[#34D399]">
                              {u.email}
                            </p>
                            <p className="mt-0.5 text-[11px] text-[#6B7E74] tabular-nums dark:text-[#869B90]">
                              {formatAuthMethod(u.authProvider)} · Signed up{' '}
                              {formatExactDateTime(u.createdAt)}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={inspectUserUid === u.uid}
                            onClick={() => handleInspectUser(u.uid)}
                          >
                            {inspectUserUid === u.uid ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin text-[#059669] dark:text-[#34D399]" />
                            ) : (
                              <Eye className="h-3.5 w-3.5 text-[#059669] dark:text-[#34D399]" />
                            )}
                            <span>Inspect</span>
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                {/* Top Downloaded Academic Notes */}
                <section className="rounded-2xl border border-[#DCE3DF] bg-white p-6 dark:border-[#23312B] dark:bg-[#131B18]">
                  <div className="flex items-center justify-between gap-4 border-b border-[#E6ECE9] pb-4 dark:border-[#1E2B26]">
                    <div>
                      <h2 className="font-display text-base font-semibold text-[#111916] dark:text-[#F2F6F4]">
                        Most Downloaded Academic Notes
                      </h2>
                      <p className="text-xs text-[#6B7E74] dark:text-[#869B90]">
                        Highest-traffic study materials across subjects
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleTabChange('notes')}
                      className="text-xs font-semibold text-[#9A633A] hover:underline dark:text-[#D4A373] whitespace-nowrap cursor-pointer"
                    >
                      Moderate Notes
                    </button>
                  </div>

                  {!overview || overview.topNotes.length === 0 ? (
                    <p className="py-8 text-center text-xs text-[#6B7E74] dark:text-[#869B90]">
                      No uploaded academic notes yet.
                    </p>
                  ) : (
                    <div className="divide-y divide-[#E6ECE9] dark:divide-[#1E2B26]">
                      {overview.topNotes.map((n) => (
                        <div
                          key={n.id}
                          className="flex items-center justify-between gap-4 py-3 text-xs"
                        >
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-[#111916] dark:text-[#F2F6F4]">
                              {n.title}
                            </p>
                            <p className="truncate text-[#6B7E74] dark:text-[#869B90]">
                              {n.subject} · {n.classLevel} · {n.uploaderName}
                            </p>
                          </div>
                          <div className="shrink-0 text-right font-mono text-[11px] tabular-nums">
                            <p className="font-semibold text-[#9A633A] dark:text-[#D4A373]">
                              {n.downloads} dl
                            </p>
                            <p className="text-[#6B7E74] dark:text-[#869B90]">
                              {formatBytes(n.fileSize)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            )}
          </>
        )}

        {/* DATA TABLE TABS (USERS / NOTES / CHATS / CVS) */}
        {activeTab !== 'overview' && (
          <section className="overflow-hidden rounded-2xl border border-[#DCE3DF] bg-white dark:border-[#23312B] dark:bg-[#131B18]">
            {tableError ? (
              <div className="p-6 text-sm text-[#8C4A27] dark:text-[#E7B89A]">
                <p>{tableError}</p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-3"
                  onClick={fetchActiveTabTable}
                >
                  Retry
                </Button>
              </div>
            ) : tableLoading ? (
              <div className="space-y-2 p-6">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-11 rounded-xl bg-[#EAEEEC]/80 dark:bg-[#18221E]"
                  />
                ))}
              </div>
            ) : (
              <>
                {/* USERS TABLE */}
                {activeTab === 'users' &&
                  (usersList.length === 0 ? (
                    <div className="p-10 text-center text-sm text-[#6B7E74] dark:text-[#869B90]">
                      No user accounts matched your search.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse text-left text-xs">
                        <thead>
                          <tr className="border-b border-[#DCE3DF] bg-[#F4F6F4] text-[#52645B] dark:border-[#23312B] dark:bg-[#0D1311] dark:text-[#94A89E]">
                            <th className="px-4 py-3 font-semibold">
                              Name &amp; Email
                            </th>
                            <th className="px-4 py-3 font-semibold">
                              Sign-Up Method
                            </th>
                            <th className="px-4 py-3 text-right font-semibold">
                              Chats
                            </th>
                            <th className="px-4 py-3 text-right font-semibold">
                              Notes
                            </th>
                            <th className="px-4 py-3 text-right font-semibold">
                              CVs
                            </th>
                            <th className="px-4 py-3 font-semibold">
                              Sign-Up Date &amp; Time
                            </th>
                            <th className="px-4 py-3 text-right font-semibold">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#E6ECE9] dark:divide-[#1E2B26]">
                          {usersList.map((u) => {
                            const isOwnerRow =
                              u.email.trim().toLowerCase() === OWNER_ADMIN_EMAIL;
                            const rowKey = `user:${u.uid}`;
                            return (
                              <tr
                                key={u.uid}
                                className="transition-colors hover:bg-[#F8FAF9] dark:hover:bg-[#18221E]"
                              >
                                <td className="px-4 py-3">
                                  <p className="font-semibold text-[#111916] dark:text-[#F2F6F4]">
                                    {u.name}
                                    {isOwnerRow && (
                                      <span className="ml-1.5 font-semibold text-[#9A633A] dark:text-[#D4A373]">
                                        · Owner Admin
                                      </span>
                                    )}
                                  </p>
                                  <p className="font-medium text-[#059669] dark:text-[#34D399]">
                                    {u.email}
                                  </p>
                                </td>
                                <td className="px-4 py-3 text-[#52645B] dark:text-[#B8C7BF] whitespace-nowrap">
                                  {formatAuthMethod(u.authProvider)}
                                </td>
                                <td className="px-4 py-3 text-right font-mono tabular-nums text-[#111916] dark:text-[#F2F6F4]">
                                  {u.chatsCount}
                                </td>
                                <td className="px-4 py-3 text-right font-mono tabular-nums text-[#111916] dark:text-[#F2F6F4]">
                                  {u.notesCount}
                                </td>
                                <td className="px-4 py-3 text-right font-mono tabular-nums text-[#111916] dark:text-[#F2F6F4]">
                                  {u.cvsCount}
                                </td>
                                <td className="px-4 py-3 font-mono tabular-nums text-[#6B7E74] dark:text-[#869B90] whitespace-nowrap">
                                  {formatExactDateTime(u.createdAt)}
                                </td>
                                <td className="px-4 py-3 text-right whitespace-nowrap">
                                  {confirmDeleteKey === rowKey ? (
                                    <div className="inline-flex items-center gap-1.5">
                                      <Button
                                        size="sm"
                                        variant="destructive"
                                        disabled={deletingKey === rowKey}
                                        onClick={() => handleDeleteUser(u)}
                                      >
                                        {deletingKey === rowKey && (
                                          <Loader2 className="h-3 w-3 animate-spin" />
                                        )}
                                        <span>Confirm</span>
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => setConfirmDeleteKey(null)}
                                      >
                                        Cancel
                                      </Button>
                                    </div>
                                  ) : (
                                    <div className="inline-flex items-center gap-1.5">
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        disabled={inspectUserUid === u.uid}
                                        onClick={() => handleInspectUser(u.uid)}
                                      >
                                        {inspectUserUid === u.uid ? (
                                          <Loader2 className="h-3.5 w-3.5 animate-spin text-[#059669] dark:text-[#34D399]" />
                                        ) : (
                                          <UserCheck className="h-3.5 w-3.5 text-[#059669] dark:text-[#34D399]" />
                                        )}
                                        <span>Full Activity</span>
                                      </Button>
                                      {!isOwnerRow && (
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() =>
                                            setConfirmDeleteKey(rowKey)
                                          }
                                        >
                                          <Trash2 className="h-3.5 w-3.5 text-[#9A633A] dark:text-[#D4A373]" />
                                          <span>Remove</span>
                                        </Button>
                                      )}
                                    </div>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ))}

                {/* NOTES MODERATION TABLE */}
                {activeTab === 'notes' &&
                  (notesList.length === 0 ? (
                    <div className="p-10 text-center text-sm text-[#6B7E74] dark:text-[#869B90]">
                      No academic notes matched your search.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse text-left text-xs">
                        <thead>
                          <tr className="border-b border-[#DCE3DF] bg-[#F4F6F4] text-[#52645B] dark:border-[#23312B] dark:bg-[#0D1311] dark:text-[#94A89E]">
                            <th className="px-4 py-3 font-semibold">
                              Note Title &amp; Subject
                            </th>
                            <th className="px-4 py-3 font-semibold">
                              Uploader &amp; Email
                            </th>
                            <th className="px-4 py-3 text-right font-semibold">
                              Size
                            </th>
                            <th className="px-4 py-3 text-right font-semibold">
                              Downloads
                            </th>
                            <th className="px-4 py-3 font-semibold">
                              Uploaded
                            </th>
                            <th className="px-4 py-3 text-right font-semibold">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#E6ECE9] dark:divide-[#1E2B26]">
                          {notesList.map((n) => {
                            const rowKey = `note:${n.id}`;
                            return (
                              <tr
                                key={n.id}
                                className="transition-colors hover:bg-[#F8FAF9] dark:hover:bg-[#18221E]"
                              >
                                <td className="px-4 py-3 max-w-xs">
                                  <p className="truncate font-semibold text-[#111916] dark:text-[#F2F6F4]">
                                    {n.title}
                                  </p>
                                  <p className="truncate text-[#6B7E74] dark:text-[#869B90]">
                                    {n.subject} · {n.classLevel} · {n.fileName}
                                  </p>
                                </td>
                                <td className="px-4 py-3">
                                  <p className="font-medium text-[#111916] dark:text-[#F2F6F4]">
                                    {n.uploaderName}
                                  </p>
                                  {n.uploaderEmail && (
                                    <p className="text-[#059669] dark:text-[#34D399]">
                                      {n.uploaderEmail}
                                    </p>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-right font-mono tabular-nums text-[#52645B] dark:text-[#B8C7BF] whitespace-nowrap">
                                  {formatBytes(n.fileSize)}
                                </td>
                                <td className="px-4 py-3 text-right font-mono tabular-nums text-[#9A633A] dark:text-[#D4A373]">
                                  {n.downloads}
                                </td>
                                <td className="px-4 py-3 font-mono tabular-nums text-[#6B7E74] dark:text-[#869B90] whitespace-nowrap">
                                  {formatExactDateTime(n.createdAt)}
                                </td>
                                <td className="px-4 py-3 text-right whitespace-nowrap">
                                  {confirmDeleteKey === rowKey ? (
                                    <div className="inline-flex items-center gap-1.5">
                                      <Button
                                        size="sm"
                                        variant="destructive"
                                        disabled={deletingKey === rowKey}
                                        onClick={() => handleDeleteNote(n)}
                                      >
                                        {deletingKey === rowKey && (
                                          <Loader2 className="h-3 w-3 animate-spin" />
                                        )}
                                        <span>Confirm</span>
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => setConfirmDeleteKey(null)}
                                      >
                                        Cancel
                                      </Button>
                                    </div>
                                  ) : (
                                    <div className="inline-flex items-center gap-1.5">
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => setPreviewNote(n)}
                                      >
                                        <Eye className="h-3.5 w-3.5 text-[#059669] dark:text-[#34D399]" />
                                        <span>Preview</span>
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleDownloadNote(n)}
                                      >
                                        <Download className="h-3.5 w-3.5 text-[#059669] dark:text-[#34D399]" />
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => setConfirmDeleteKey(rowKey)}
                                      >
                                        <Trash2 className="h-3.5 w-3.5 text-[#9A633A] dark:text-[#D4A373]" />
                                        <span>Delete</span>
                                      </Button>
                                    </div>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ))}

                {/* AI CHATS TABLE */}
                {activeTab === 'chats' &&
                  (chatsList.length === 0 ? (
                    <div className="p-10 text-center text-sm text-[#6B7E74] dark:text-[#869B90]">
                      No saved AI chat sessions matched your search.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse text-left text-xs">
                        <thead>
                          <tr className="border-b border-[#DCE3DF] bg-[#F4F6F4] text-[#52645B] dark:border-[#23312B] dark:bg-[#0D1311] dark:text-[#94A89E]">
                            <th className="px-4 py-3 font-semibold">
                              Conversation Title
                            </th>
                            <th className="px-4 py-3 font-semibold">
                              User &amp; Email
                            </th>
                            <th className="px-4 py-3 text-right font-semibold">
                              Messages
                            </th>
                            <th className="px-4 py-3 font-semibold">Created</th>
                            <th className="px-4 py-3 text-right font-semibold">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#E6ECE9] dark:divide-[#1E2B26]">
                          {chatsList.map((c) => {
                            const rowKey = `chat:${c.id}`;
                            return (
                              <tr
                                key={c.id}
                                className="transition-colors hover:bg-[#F8FAF9] dark:hover:bg-[#18221E]"
                              >
                                <td className="px-4 py-3 max-w-sm">
                                  <p className="truncate font-semibold text-[#111916] dark:text-[#F2F6F4]">
                                    {c.title}
                                  </p>
                                  <p className="font-mono text-[11px] text-[#6B7E74] tabular-nums dark:text-[#869B90]">
                                    ID #{c.id}
                                  </p>
                                </td>
                                <td className="px-4 py-3">
                                  <p className="font-medium text-[#111916] dark:text-[#F2F6F4]">
                                    {c.userName || 'Registered User'}
                                  </p>
                                  <p className="text-[#059669] dark:text-[#34D399]">
                                    {c.userEmail || c.userId}
                                  </p>
                                </td>
                                <td className="px-4 py-3 text-right font-mono tabular-nums text-[#111916] dark:text-[#F2F6F4]">
                                  {c.messageCount}
                                </td>
                                <td className="px-4 py-3 font-mono tabular-nums text-[#6B7E74] dark:text-[#869B90] whitespace-nowrap">
                                  {formatExactDateTime(c.createdAt)}
                                </td>
                                <td className="px-4 py-3 text-right whitespace-nowrap">
                                  {confirmDeleteKey === rowKey ? (
                                    <div className="inline-flex items-center gap-1.5">
                                      <Button
                                        size="sm"
                                        variant="destructive"
                                        disabled={deletingKey === rowKey}
                                        onClick={() => handleDeleteChat(c)}
                                      >
                                        {deletingKey === rowKey && (
                                          <Loader2 className="h-3 w-3 animate-spin" />
                                        )}
                                        <span>Confirm</span>
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => setConfirmDeleteKey(null)}
                                      >
                                        Cancel
                                      </Button>
                                    </div>
                                  ) : (
                                    <div className="inline-flex items-center gap-1.5">
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        disabled={inspectLoadingId === c.id}
                                        onClick={() => handleInspectChat(c.id)}
                                      >
                                        {inspectLoadingId === c.id ? (
                                          <Loader2 className="h-3.5 w-3.5 animate-spin text-[#059669] dark:text-[#34D399]" />
                                        ) : (
                                          <Eye className="h-3.5 w-3.5 text-[#059669] dark:text-[#34D399]" />
                                        )}
                                        <span>Read Messages</span>
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => setConfirmDeleteKey(rowKey)}
                                      >
                                        <Trash2 className="h-3.5 w-3.5 text-[#9A633A] dark:text-[#D4A373]" />
                                        <span>Delete</span>
                                      </Button>
                                    </div>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ))}

                {/* ATS RESUMES TABLE */}
                {activeTab === 'cvs' &&
                  (cvsList.length === 0 ? (
                    <div className="p-10 text-center text-sm text-[#6B7E74] dark:text-[#869B90]">
                      No saved ATS resumes matched your search.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse text-left text-xs">
                        <thead>
                          <tr className="border-b border-[#DCE3DF] bg-[#F4F6F4] text-[#52645B] dark:border-[#23312B] dark:bg-[#0D1311] dark:text-[#94A89E]">
                            <th className="px-4 py-3 font-semibold">
                              Resume Title
                            </th>
                            <th className="px-4 py-3 font-semibold">
                              User &amp; Email
                            </th>
                            <th className="px-4 py-3 font-semibold">
                              ATS Layout
                            </th>
                            <th className="px-4 py-3 font-semibold">
                              Last Updated
                            </th>
                            <th className="px-4 py-3 text-right font-semibold">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#E6ECE9] dark:divide-[#1E2B26]">
                          {cvsList.map((cv) => {
                            const rowKey = `cv:${cv.id}`;
                            return (
                              <tr
                                key={cv.id}
                                className="transition-colors hover:bg-[#F8FAF9] dark:hover:bg-[#18221E]"
                              >
                                <td className="px-4 py-3 max-w-sm">
                                  <p className="truncate font-semibold text-[#111916] dark:text-[#F2F6F4]">
                                    {cv.title}
                                  </p>
                                  <p className="font-mono text-[11px] text-[#6B7E74] tabular-nums dark:text-[#869B90]">
                                    ID #{cv.id}
                                  </p>
                                </td>
                                <td className="px-4 py-3">
                                  <p className="font-medium text-[#111916] dark:text-[#F2F6F4]">
                                    {cv.userName || 'Registered User'}
                                  </p>
                                  <p className="text-[#059669] dark:text-[#34D399]">
                                    {cv.userEmail || cv.userId}
                                  </p>
                                </td>
                                <td className="px-4 py-3 capitalize text-[#52645B] dark:text-[#B8C7BF] whitespace-nowrap">
                                  {cv.templateId}
                                </td>
                                <td className="px-4 py-3 font-mono tabular-nums text-[#6B7E74] dark:text-[#869B90] whitespace-nowrap">
                                  {formatExactDateTime(cv.updatedAt)}
                                </td>
                                <td className="px-4 py-3 text-right whitespace-nowrap">
                                  {confirmDeleteKey === rowKey ? (
                                    <div className="inline-flex items-center gap-1.5">
                                      <Button
                                        size="sm"
                                        variant="destructive"
                                        disabled={deletingKey === rowKey}
                                        onClick={() => handleDeleteCV(cv)}
                                      >
                                        {deletingKey === rowKey && (
                                          <Loader2 className="h-3 w-3 animate-spin" />
                                        )}
                                        <span>Confirm</span>
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => setConfirmDeleteKey(null)}
                                      >
                                        Cancel
                                      </Button>
                                    </div>
                                  ) : (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => setConfirmDeleteKey(rowKey)}
                                    >
                                      <Trash2 className="h-3.5 w-3.5 text-[#9A633A] dark:text-[#D4A373]" />
                                      <span>Delete</span>
                                    </Button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ))}

                {/* Pagination Footer */}
                {pagination.totalPages > 1 && (
                  <div className="flex items-center justify-between border-t border-[#E6ECE9] px-4 py-3 text-xs text-[#6B7E74] dark:border-[#1E2B26] dark:text-[#869B90]">
                    <span className="font-mono tabular-nums">
                      Page {pagination.page} of {pagination.totalPages} ·{' '}
                      {pagination.total} total records
                    </span>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={pagination.page <= 1}
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                      >
                        <ChevronLeft className="h-3.5 w-3.5" />
                        <span>Previous</span>
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={pagination.page >= pagination.totalPages}
                        onClick={() => setPage((p) => p + 1)}
                      >
                        <span>Next</span>
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </section>
        )}
      </div>

      {/* Note Preview Modal */}
      <NotePreviewModal
        note={previewNote}
        onClose={() => setPreviewNote(null)}
        onDownload={handleDownloadNote}
      />

      {/* Full User Activity Inspector Modal */}
      {inspectUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4"
          onClick={() => setInspectUser(null)}
        >
          <div
            className="animate-nova-scale flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-[#DCE3DF] bg-white dark:border-[#23312B] dark:bg-[#131B18]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="h-1.5 w-full bg-gradient-to-r from-[#059669] via-[#10B981] to-[#C8956B]" />
            <div className="flex items-center justify-between gap-4 border-b border-[#E6ECE9] px-5 py-4 dark:border-[#1E2B26]">
              <div className="min-w-0">
                <h3 className="truncate font-display text-lg font-bold text-[#111916] dark:text-[#F2F6F4]">
                  {inspectUser.user.name}
                </h3>
                <p className="truncate text-xs font-medium text-[#059669] dark:text-[#34D399]">
                  {inspectUser.user.email} ·{' '}
                  {formatAuthMethod(inspectUser.user.authProvider)} · Signed up{' '}
                  {formatExactDateTime(inspectUser.user.createdAt)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setInspectUser(null)}
                aria-label="Close user inspector"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#6B7E74] hover:bg-[#FAF3EE] hover:text-[#9A633A] dark:text-[#869B90] dark:hover:bg-[#221610] dark:hover:text-[#D4A373] cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 space-y-6 overflow-y-auto p-5 text-xs">
              {/* User AI Chats */}
              <div>
                <h4 className="font-display text-sm font-semibold text-[#111916] dark:text-[#F2F6F4]">
                  AI Chats Written ({inspectUser.chats.length})
                </h4>
                {inspectUser.chats.length === 0 ? (
                  <p className="mt-1.5 text-[#6B7E74] dark:text-[#869B90]">
                    No AI chat conversations saved by this user yet.
                  </p>
                ) : (
                  <div className="mt-2 divide-y divide-[#E6ECE9] rounded-xl border border-[#DCE3DF] px-4 dark:divide-[#1E2B26] dark:border-[#23312B]">
                    {inspectUser.chats.map((ch) => (
                      <div
                        key={ch.id}
                        className="flex items-center justify-between gap-3 py-2.5"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-[#111916] dark:text-[#F2F6F4]">
                            {ch.title}
                          </p>
                          <p className="text-[11px] text-[#6B7E74] tabular-nums dark:text-[#869B90]">
                            {ch.messageCount} messages ·{' '}
                            {formatExactDateTime(ch.createdAt)}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={inspectLoadingId === ch.id}
                          onClick={() => handleInspectChat(ch.id)}
                        >
                          {inspectLoadingId === ch.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Eye className="h-3 w-3 text-[#059669] dark:text-[#34D399]" />
                          )}
                          <span>Read Chat</span>
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* User Uploaded Notes */}
              <div>
                <h4 className="font-display text-sm font-semibold text-[#111916] dark:text-[#F2F6F4]">
                  Uploaded Academic Notes ({inspectUser.notes.length})
                </h4>
                {inspectUser.notes.length === 0 ? (
                  <p className="mt-1.5 text-[#6B7E74] dark:text-[#869B90]">
                    No academic notes uploaded by this user yet.
                  </p>
                ) : (
                  <div className="mt-2 divide-y divide-[#E6ECE9] rounded-xl border border-[#DCE3DF] px-4 dark:divide-[#1E2B26] dark:border-[#23312B]">
                    {inspectUser.notes.map((nt) => (
                      <div
                        key={nt.id}
                        className="flex items-center justify-between gap-3 py-2.5"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-[#111916] dark:text-[#F2F6F4]">
                            {nt.title}
                          </p>
                          <p className="text-[11px] text-[#6B7E74] tabular-nums dark:text-[#869B90]">
                            {nt.subject} · {nt.classLevel} ·{' '}
                            {formatBytes(nt.fileSize)} · {nt.downloads} dl
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setPreviewNote(nt)}
                        >
                          <Eye className="h-3 w-3 text-[#9A633A] dark:text-[#D4A373]" />
                          <span>Preview</span>
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* User Saved ATS CVs */}
              <div>
                <h4 className="font-display text-sm font-semibold text-[#111916] dark:text-[#F2F6F4]">
                  Saved ATS Resumes ({inspectUser.cvs.length})
                </h4>
                {inspectUser.cvs.length === 0 ? (
                  <p className="mt-1.5 text-[#6B7E74] dark:text-[#869B90]">
                    No ATS resumes saved by this user yet.
                  </p>
                ) : (
                  <div className="mt-2 divide-y divide-[#E6ECE9] rounded-xl border border-[#DCE3DF] px-4 dark:divide-[#1E2B26] dark:border-[#23312B]">
                    {inspectUser.cvs.map((cv) => (
                      <div
                        key={cv.id}
                        className="flex items-center justify-between gap-3 py-2.5"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-[#111916] dark:text-[#F2F6F4]">
                            {cv.title}
                          </p>
                          <p className="text-[11px] text-[#6B7E74] tabular-nums dark:text-[#869B90]">
                            Layout: {cv.templateId} · Updated{' '}
                            {formatExactDateTime(cv.updatedAt)}
                          </p>
                        </div>
                        <span className="font-mono text-[11px] text-[#059669] dark:text-[#34D399]">
                          ID #{cv.id}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI Chat Transcript Inspector Modal */}
      {inspectChat && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4"
          onClick={() => setInspectChat(null)}
        >
          <div
            className="animate-nova-scale flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[#DCE3DF] bg-white dark:border-[#23312B] dark:bg-[#131B18]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="h-1.5 w-full bg-gradient-to-r from-[#059669] to-[#C8956B]" />
            <div className="flex items-center justify-between gap-4 border-b border-[#E6ECE9] px-5 py-4 dark:border-[#1E2B26]">
              <div className="min-w-0">
                <h3 className="truncate font-display text-base font-semibold text-[#111916] dark:text-[#F2F6F4]">
                  {inspectChat.title}
                </h3>
                <p className="truncate text-xs text-[#6B7E74] dark:text-[#869B90]">
                  {inspectChat.userName || 'User'} ·{' '}
                  {inspectChat.userEmail || inspectChat.userId} ·{' '}
                  {formatShortDate(inspectChat.createdAt)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setInspectChat(null)}
                aria-label="Close transcript"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#6B7E74] hover:bg-[#FAF3EE] hover:text-[#9A633A] dark:text-[#869B90] dark:hover:bg-[#221610] dark:hover:text-[#D4A373] cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto p-5">
              {inspectChat.messages.length === 0 ? (
                <p className="py-6 text-center text-xs text-[#6B7E74] dark:text-[#869B90]">
                  No messages stored in this session.
                </p>
              ) : (
                inspectChat.messages.map((m) => (
                  <div
                    key={m.id}
                    className={`rounded-xl border p-3.5 text-xs leading-relaxed ${
                      m.role === 'user'
                        ? 'border-[#C9DED4] bg-[#EEF6F2] text-[#111916] dark:border-[#1F3A30] dark:bg-[#14251F] dark:text-[#F2F6F4]'
                        : 'border-[#DFC4B2] bg-[#FAF4EE] text-[#111916] dark:border-[#4A3526] dark:bg-[#211913] dark:text-[#F2F6F4]'
                    }`}
                  >
                    <p
                      className={`mb-1 font-semibold ${
                        m.role === 'user'
                          ? 'text-[#059669] dark:text-[#34D399]'
                          : 'text-[#9A633A] dark:text-[#D4A373]'
                      }`}
                    >
                      {m.role === 'user' ? 'User' : 'NOVAAI'} · {m.language}
                    </p>
                    <p className="whitespace-pre-wrap">{m.content}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

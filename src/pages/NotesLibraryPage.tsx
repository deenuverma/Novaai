import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  FileText,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { AppShell } from '../components/layout/AppShell.tsx';
import { HighlightText } from '../components/notes/HighlightText.tsx';
import { NotePreviewModal } from '../components/notes/NotePreviewModal.tsx';
import { Button } from '../components/ui/button.tsx';
import { Input } from '../components/ui/input.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { useDebounce } from '../hooks/useDebounce.ts';
import { formatBytes, formatShortDate } from '../lib/utils.ts';
import { notesApi } from '../services/api.ts';
import type { NoteItem, PaginationMeta } from '../types/models.ts';

type SearchFieldScope = 'all' | 'title' | 'subject' | 'content';

const SUBJECT_OPTIONS = [
  'All',
  'Computer Science',
  'Database Systems',
  'Machine Learning',
  'Operating Systems',
  'Mathematics',
  'System Design',
  'Physics',
  'Electronics',
  'Other',
];

const CLASS_OPTIONS = [
  'All',
  'Semester 1',
  'Semester 2',
  'Semester 3',
  'Semester 4',
  'Semester 5',
  'Semester 6',
  'Semester 7',
  'Semester 8',
  'Class 11',
  'Class 12',
];

const SEARCH_FIELDS: { value: SearchFieldScope; label: string }[] = [
  { value: 'all', label: 'All Fields' },
  { value: 'title', label: 'Title' },
  { value: 'subject', label: 'Subject' },
  { value: 'content', label: 'Content Keywords' },
];

const QUICK_KEYWORDS = [
  'Dijkstra',
  'MVCC',
  'Softmax',
  'Belady',
  'Eigenvalues',
];

function getContextualExcerpt(content: string | undefined, query: string): string {
  const clean = (content || '').replace(/\s+/g, ' ').trim();
  if (!clean) return '';

  const trimmedQuery = query.trim().toLowerCase();
  if (!trimmedQuery) {
    return clean.length > 135 ? `${clean.slice(0, 135)}…` : clean;
  }

  let matchIndex = clean.toLowerCase().indexOf(trimmedQuery);
  if (matchIndex === -1) {
    const firstToken = trimmedQuery
      .split(/\s+/)
      .find((t) => t.length >= 2 && clean.toLowerCase().includes(t));
    if (firstToken) {
      matchIndex = clean.toLowerCase().indexOf(firstToken);
    }
  }

  if (matchIndex === -1) {
    return clean.length > 135 ? `${clean.slice(0, 135)}…` : clean;
  }

  const start = Math.max(0, matchIndex - 42);
  const end = Math.min(clean.length, matchIndex + 98);
  const prefix = start > 0 ? '…' : '';
  const suffix = end < clean.length ? '…' : '';
  return `${prefix}${clean.slice(start, end)}${suffix}`;
}

export function NotesLibraryPage() {
  const { user, refreshProfile } = useAuth();
  const [searchParams] = useSearchParams();
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const [searchInput, setSearchInput] = useState(
    () => searchParams.get('q') || ''
  );
  const debouncedSearch = useDebounce(searchInput, 250);

  const [searchField, setSearchField] = useState<SearchFieldScope>('all');
  const [onlyMyNotes, setOnlyMyNotes] = useState(false);
  const [subject, setSubject] = useState('All');
  const [classLevel, setClassLevel] = useState('All');
  const [sort, setSort] = useState<'newest' | 'downloads'>('newest');
  const [page, setPage] = useState(1);

  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    limit: 12,
    total: 0,
    totalPages: 1,
  });
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [previewNote, setPreviewNote] = useState<NoteItem | null>(null);

  // Press "/" anywhere outside inputs to focus the academic search bar
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isEditable =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);

      if (e.key === '/' && !isEditable) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const fetchNotes = useCallback(async () => {
    if (onlyMyNotes && !user) {
      setNotes([]);
      setPagination({ page: 1, limit: 12, total: 0, totalPages: 1 });
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await notesApi.listNotes({
        search: debouncedSearch,
        searchField,
        mine: onlyMyNotes,
        subject,
        classLevel,
        sort,
        page,
      });
      setNotes(res.items);
      setPagination(res.pagination);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Unable to load notes library.'
      );
    } finally {
      setLoading(false);
    }
  }, [
    debouncedSearch,
    searchField,
    onlyMyNotes,
    user,
    subject,
    classLevel,
    sort,
    page,
  ]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, searchField, onlyMyNotes, subject, classLevel, sort]);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  const handleDownload = async (note: NoteItem) => {
    try {
      const newCount = await notesApi.downloadNote(note);
      setNotes((prev) =>
        prev.map((item) =>
          item.id === note.id
            ? {
                ...item,
                downloads:
                  newCount !== null ? newCount : item.downloads + 1,
              }
            : item
        )
      );
      setPreviewNote((prev) =>
        prev && prev.id === note.id
          ? {
              ...prev,
              downloads: newCount !== null ? newCount : prev.downloads + 1,
            }
          : prev
      );
      toast.success(`Downloading "${note.fileName}"`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Download failed.');
    }
  };

  const handleDelete = async (note: NoteItem) => {
    try {
      await notesApi.deleteNote(note.id);
      setNotes((prev) => prev.filter((n) => n.id !== note.id));
      refreshProfile();
      toast.success('Note deleted.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed.');
    }
  };

  const resetAllFilters = () => {
    setSearchInput('');
    setSearchField('all');
    setSubject('All');
    setClassLevel('All');
    setOnlyMyNotes(false);
  };

  const hasFilters =
    Boolean(searchInput.trim()) ||
    searchField !== 'all' ||
    onlyMyNotes ||
    subject !== 'All' ||
    classLevel !== 'All';

  const activePlaceholder =
    searchField === 'title'
      ? 'Search notes by title (e.g. Graph Algorithms, Relational Algebra)...'
      : searchField === 'subject'
        ? 'Search notes by academic subject (e.g. Computer Science, Mathematics)...'
        : searchField === 'content'
          ? 'Search inside note content keywords (e.g. Dijkstra, MVCC, Softmax, Belady)...'
          : 'Filter academic notes by title, subject, or content keywords...';

  return (
    <AppShell>
      <div className="animate-nova-enter mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        {/* Page Header + Collection Scope */}
        <div className="flex flex-col justify-between gap-4 border-b border-[#DCE3DF] pb-6 lg:flex-row lg:items-end dark:border-[#23312B]">
          <div>
            <p className="text-xs font-semibold tracking-wide text-[#9A633A] uppercase dark:text-[#D4A373]">
              Academic Study Repository
            </p>
            <h1 className="mt-1 font-display text-2xl sm:text-3xl font-bold tracking-tight text-[#111916] dark:text-[#F2F6F4]">
              Notes Library
            </h1>
            <p className="mt-1 text-sm text-[#52645B] dark:text-[#94A89E]">
              Filter uploaded lecture handouts, theorems, and study guides by title, subject, or indexed content keywords.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {/* Scope Toggle: All Library vs My Uploaded Notes */}
            <div
              role="group"
              aria-label="Note collection scope"
              className="inline-flex h-10 items-center gap-1 rounded-xl border border-[#DCE3DF] bg-white p-1 shadow-xs dark:border-[#23312B] dark:bg-[#131B18]"
            >
              <button
                type="button"
                onClick={() => setOnlyMyNotes(false)}
                className={`h-8 rounded-lg px-3 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  !onlyMyNotes
                    ? 'bg-[#059669] text-white dark:bg-[#10B981] dark:text-[#071510]'
                    : 'text-[#52645B] hover:text-[#111916] dark:text-[#94A89E] dark:hover:text-[#F2F6F4]'
                }`}
              >
                All Library
              </button>
              <button
                type="button"
                onClick={() => setOnlyMyNotes(true)}
                className={`h-8 rounded-lg px-3 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  onlyMyNotes
                    ? 'bg-[#059669] text-white dark:bg-[#10B981] dark:text-[#071510]'
                    : 'text-[#52645B] hover:text-[#111916] dark:text-[#94A89E] dark:hover:text-[#F2F6F4]'
                }`}
              >
                My Uploaded Notes
              </button>
            </div>

            <Link
              to="/notes/upload"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#059669] px-4 py-2 text-sm font-semibold text-white shadow-xs transition-all duration-150 hover:bg-[#047857] active:scale-[0.98] dark:bg-[#10B981] dark:text-[#071510] dark:hover:bg-[#34D399] whitespace-nowrap shrink-0"
            >
              <Plus className="h-4 w-4" />
              <span>Upload Notes</span>
            </Link>
          </div>
        </div>

        {/* Dedicated Academic Search Bar Surface */}
        <section
          aria-label="Search and filter academic notes"
          className="mt-6 rounded-2xl border border-[#DCE3DF] bg-white p-4 shadow-xs sm:p-5 dark:border-[#23312B] dark:bg-[#131B18]"
        >
          {/* Primary Search Input Row */}
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[#6B7E74] dark:text-[#869B90]" />
              <Input
                ref={searchInputRef}
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape' && searchInput) {
                    setSearchInput('');
                  }
                }}
                placeholder={activePlaceholder}
                className="h-11 pl-10 pr-16 text-sm"
                aria-label="Search academic notes by title, subject, or content keywords"
              />
              {searchInput ? (
                <button
                  type="button"
                  aria-label="Clear search query"
                  onClick={() => {
                    setSearchInput('');
                    searchInputRef.current?.focus();
                  }}
                  className="absolute top-1/2 right-2.5 inline-flex -translate-y-1/2 items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-[#52645B] hover:bg-[#EAEEEC] hover:text-[#111916] dark:text-[#94A89E] dark:hover:bg-[#1A2521] dark:hover:text-[#F2F6F4] cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                  <span>Clear</span>
                </button>
              ) : (
                <kbd className="pointer-events-none absolute top-1/2 right-3 hidden -translate-y-1/2 rounded border border-[#DCE3DF] bg-[#F4F6F4] px-1.5 py-0.5 font-mono text-[11px] text-[#6B7E74] sm:inline-block dark:border-[#23312B] dark:bg-[#18221E] dark:text-[#869B90]">
                  /
                </kbd>
              )}
            </div>

            {/* Search Target Selector: All Fields | Title | Subject | Content Keywords */}
            <div
              role="group"
              aria-label="Search field scope"
              className="flex items-center gap-1 overflow-x-auto rounded-xl border border-[#DCE3DF] bg-[#F4F6F4] p-1 dark:border-[#23312B] dark:bg-[#0D1311]"
            >
              {SEARCH_FIELDS.map((field) => {
                const active = searchField === field.value;
                return (
                  <button
                    key={field.value}
                    type="button"
                    onClick={() => setSearchField(field.value)}
                    className={`h-9 rounded-lg px-3 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      active
                        ? 'bg-[#059669] text-white dark:bg-[#10B981] dark:text-[#071510]'
                        : 'text-[#52645B] hover:text-[#111916] dark:text-[#94A89E] dark:hover:text-[#F2F6F4]'
                    }`}
                  >
                    {field.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Secondary Filter Controls + Quick Content Keyword Suggestions */}
          <div className="mt-4 grid grid-cols-1 gap-3 border-t border-[#E6ECE9] pt-4 md:grid-cols-12 md:items-center dark:border-[#1E2B26]">
            <div className="flex flex-wrap items-center gap-1.5 md:col-span-5">
              <span className="mr-1 text-xs text-[#52645B] dark:text-[#94A89E] whitespace-nowrap">
                Try keyword:
              </span>
              {QUICK_KEYWORDS.map((kw) => {
                const isSelected =
                  searchInput.trim().toLowerCase() === kw.toLowerCase();
                return (
                  <button
                    key={kw}
                    type="button"
                    onClick={() => {
                      if (isSelected) {
                        setSearchInput('');
                      } else {
                        setSearchInput(kw);
                      }
                    }}
                    className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      isSelected
                        ? 'bg-[#9A633A] text-white dark:bg-[#C8956B] dark:text-[#140E08]'
                        : 'bg-[#EEF3F0] text-[#047857] hover:bg-[#DCEAE3] dark:bg-[#18221E] dark:text-[#6EE7B7] dark:hover:bg-[#21302A]'
                    }`}
                  >
                    {kw}
                  </button>
                );
              })}
            </div>

            <div className="md:col-span-3">
              <select
                aria-label="Filter by subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="flex h-10 w-full rounded-xl border border-[#DCE3DF] bg-white px-3 text-xs font-medium text-[#111916] focus:outline-none focus:ring-2 focus:ring-[#10B981] dark:border-[#23312B] dark:bg-[#0D1311] dark:text-[#F2F6F4]"
              >
                {SUBJECT_OPTIONS.map((subj) => (
                  <option key={subj} value={subj}>
                    {subj === 'All' ? 'All Subjects' : subj}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <select
                aria-label="Filter by class or semester"
                value={classLevel}
                onChange={(e) => setClassLevel(e.target.value)}
                className="flex h-10 w-full rounded-xl border border-[#DCE3DF] bg-white px-3 text-xs font-medium text-[#111916] focus:outline-none focus:ring-2 focus:ring-[#10B981] dark:border-[#23312B] dark:bg-[#0D1311] dark:text-[#F2F6F4]"
              >
                {CLASS_OPTIONS.map((cls) => (
                  <option key={cls} value={cls}>
                    {cls === 'All' ? 'All Semesters' : cls}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <div className="grid h-10 grid-cols-2 gap-1 rounded-xl border border-[#DCE3DF] bg-[#F4F6F4] p-1 dark:border-[#23312B] dark:bg-[#0D1311]">
                <button
                  type="button"
                  onClick={() => setSort('newest')}
                  className={`rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                    sort === 'newest'
                      ? 'bg-white text-[#111916] shadow-xs dark:bg-[#1A2521] dark:text-[#F2F6F4]'
                      : 'text-[#52645B] hover:text-[#111916] dark:text-[#94A89E] dark:hover:text-[#F2F6F4]'
                  }`}
                >
                  Newest
                </button>
                <button
                  type="button"
                  onClick={() => setSort('downloads')}
                  className={`rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                    sort === 'downloads'
                      ? 'bg-white text-[#111916] shadow-xs dark:bg-[#1A2521] dark:text-[#F2F6F4]'
                      : 'text-[#52645B] hover:text-[#111916] dark:text-[#94A89E] dark:hover:text-[#F2F6F4]'
                  }`}
                >
                  Popular
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Summary Count & Active Filter Status */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-[#52645B] dark:text-[#94A89E]">
          <span className="tabular-nums">
            Showing {notes.length} of {pagination.total}{' '}
            {onlyMyNotes ? 'uploaded notes in your account' : 'academic study notes'}
            {debouncedSearch.trim()
              ? ` matching "${debouncedSearch.trim()}" in ${
                  SEARCH_FIELDS.find((f) => f.value === searchField)?.label.toLowerCase() ||
                  'all fields'
                }`
              : ''}
          </span>
          {hasFilters && (
            <button
              type="button"
              onClick={resetAllFilters}
              className="font-semibold text-[#9A633A] hover:underline dark:text-[#D4A373] cursor-pointer whitespace-nowrap"
            >
              Reset all filters
            </button>
          )}
        </div>

        {/* Error State */}
        {errorMsg && (
          <div
            role="alert"
            className="mt-6 rounded-xl border border-[#DFC4B2] bg-[#FAF3EE] p-4 text-sm text-[#8C4A27] dark:border-[#4A3022] dark:bg-[#221610] dark:text-[#E7B89A]"
          >
            {errorMsg}
          </div>
        )}

        {/* Guest Prompt when "My Uploaded Notes" is toggled while signed out */}
        {!loading && onlyMyNotes && !user ? (
          <div className="mt-8 flex flex-col items-center justify-center rounded-2xl border border-[#DCE3DF] bg-white px-6 py-16 text-center shadow-xs dark:border-[#23312B] dark:bg-[#131B18]">
            <FileText className="h-9 w-9 text-[#059669] dark:text-[#34D399]" />
            <h2 className="mt-3 font-display text-lg font-semibold text-[#111916] dark:text-[#F2F6F4]">
              Sign in to filter your uploaded notes
            </h2>
            <p className="mt-1 max-w-md text-sm text-[#52645B] dark:text-[#94A89E]">
              Sign in to view and search notes uploaded from your account, or switch back to All Library to browse shared study notes.
            </p>
            <div className="mt-5 flex items-center gap-3">
              <Link
                to="/login"
                state={{ from: '/notes' }}
                className="inline-flex h-10 items-center justify-center rounded-xl bg-[#059669] px-5 text-xs font-semibold text-white hover:bg-[#047857] dark:bg-[#10B981] dark:text-[#071510] dark:hover:bg-[#34D399] whitespace-nowrap"
              >
                Sign In
              </Link>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setOnlyMyNotes(false)}
              >
                Browse All Library
              </Button>
            </div>
          </div>
        ) : loading ? (
          /* Loading Skeletons */
          <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="h-64 rounded-2xl border border-[#DCE3DF] bg-[#EAEEEC]/70 p-5 dark:border-[#23312B] dark:bg-[#131B18]/80"
              />
            ))}
          </div>
        ) : notes.length === 0 ? (
          <div className="mt-8 flex flex-col items-center justify-center rounded-2xl border border-[#DCE3DF] bg-white px-6 py-16 text-center shadow-xs dark:border-[#23312B] dark:bg-[#131B18]">
            <FileText className="h-9 w-9 text-[#059669] dark:text-[#34D399]" />
            <h2 className="mt-3 font-display text-lg font-semibold text-[#111916] dark:text-[#F2F6F4]">
              No matching academic notes found
            </h2>
            <p className="mt-1 max-w-md text-sm text-[#52645B] dark:text-[#94A89E]">
              {hasFilters
                ? 'No notes matched your current title, subject, or content keyword query. Try broadening your search scope or clearing filters.'
                : 'Upload the first lecture handout or study guide to populate this collection.'}
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
              {hasFilters && (
                <Button variant="outline" size="sm" onClick={resetAllFilters}>
                  Clear Search &amp; Filters
                </Button>
              )}
              <Link
                to="/notes/upload"
                className="inline-flex h-9 items-center gap-2 rounded-xl bg-[#059669] px-4 text-xs font-semibold text-white hover:bg-[#047857] dark:bg-[#10B981] dark:text-[#071510] dark:hover:bg-[#34D399] whitespace-nowrap"
              >
                <Plus className="h-4 w-4" />
                <span>Upload Study Note</span>
              </Link>
            </div>
          </div>
        ) : (
          /* Responsive 1 -> 2 -> 3 -> 4 Column Grid */
          <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {notes.map((note) => {
              const isOwner = Boolean(user && user.uid === note.userId);
              const ext =
                note.fileName.split('.').pop()?.toUpperCase() || 'FILE';
              const excerpt = getContextualExcerpt(
                note.contentText,
                debouncedSearch
              );

              const highlightTitle =
                searchField === 'all' || searchField === 'title'
                  ? debouncedSearch
                  : '';
              const highlightSubject =
                searchField === 'all' || searchField === 'subject'
                  ? debouncedSearch
                  : '';
              const highlightContent =
                searchField === 'all' || searchField === 'content'
                  ? debouncedSearch
                  : '';

              return (
                <article
                  key={note.id}
                  className="nova-card-lift flex flex-col justify-between rounded-2xl border border-[#DCE3DF] bg-white p-5 shadow-xs transition-all hover:border-[#059669]/60 dark:border-[#23312B] dark:bg-[#131B18] dark:hover:border-[#10B981]/60"
                >
                  <div>
                    {/* Quiet unboxed metadata kicker (Zero-Pill Discipline) */}
                    <div className="flex items-center justify-between gap-2 text-xs text-[#52645B] dark:text-[#94A89E]">
                      <span className="truncate font-semibold text-[#059669] dark:text-[#34D399]">
                        <HighlightText
                          text={note.subject}
                          query={highlightSubject}
                        />
                      </span>
                      <span className="shrink-0 font-mono text-[11px] text-[#9A633A] dark:text-[#D4A373]">
                        {ext}
                      </span>
                    </div>

                    <h2 className="mt-2 line-clamp-2 font-display text-base font-semibold leading-snug text-[#111916] dark:text-[#F2F6F4]">
                      <HighlightText
                        text={note.title}
                        query={highlightTitle}
                      />
                    </h2>

                    <div className="mt-1.5 text-xs text-[#52645B] dark:text-[#94A89E]">
                      <span>{note.classLevel}</span>
                      <span className="mx-1.5" aria-hidden="true">
                        ·
                      </span>
                      <span>{note.uploaderName}</span>
                    </div>

                    {/* Indexed Content Snippet with Highlighted Keywords */}
                    {excerpt && (
                      <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-[#3D4E46] dark:text-[#B8C7BF]">
                        <HighlightText
                          text={excerpt}
                          query={highlightContent}
                        />
                      </p>
                    )}

                    {note.tags && note.tags.length > 0 && (
                      <p className="mt-2.5 line-clamp-1 text-[11px] text-[#6B7E74] dark:text-[#869B90]">
                        {note.tags.map((tag, i) => (
                          <React.Fragment key={tag}>
                            {i > 0 && (
                              <span className="mx-1.5" aria-hidden="true">
                                ·
                              </span>
                            )}
                            <span>
                              #
                              <HighlightText
                                text={tag}
                                query={highlightContent}
                              />
                            </span>
                          </React.Fragment>
                        ))}
                      </p>
                    )}
                  </div>

                  <div className="mt-5 border-t border-[#E6ECE9] pt-3.5 dark:border-[#1E2B26]">
                    <div className="mb-3 flex items-center justify-between text-[11px] text-[#52645B] dark:text-[#94A89E] tabular-nums">
                      <span>{formatShortDate(note.createdAt)}</span>
                      <span>
                        {formatBytes(note.fileSize)} · {note.downloads} downloads
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() => setPreviewNote(note)}
                      >
                        <Eye className="h-3.5 w-3.5" />
                        <span>Preview</span>
                      </Button>
                      <Button
                        size="sm"
                        className="flex-1"
                        onClick={() => handleDownload(note)}
                      >
                        <Download className="h-3.5 w-3.5" />
                        <span>Download</span>
                      </Button>
                      {isOwner && (
                        <button
                          type="button"
                          aria-label="Delete note"
                          onClick={() => handleDelete(note)}
                          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#DCE3DF] text-[#6B7E74] transition-colors hover:border-[#C8956B] hover:bg-[#FAF3EE] hover:text-[#8C4A27] dark:border-[#23312B] dark:text-[#869B90] dark:hover:border-[#8C5B3C] dark:hover:bg-[#221610] dark:hover:text-[#E7B89A] cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {/* Pagination Controls */}
        {pagination.totalPages > 1 && (
          <div className="mt-8 flex items-center justify-center gap-3">
            <Button
              size="sm"
              variant="outline"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="h-4 w-4" />
              <span>Previous</span>
            </Button>
            <span className="text-xs font-medium text-[#52645B] dark:text-[#94A89E] tabular-nums">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={page >= pagination.totalPages}
              onClick={() =>
                setPage((p) => Math.min(pagination.totalPages, p + 1))
              }
            >
              <span>Next</span>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      <NotePreviewModal
        note={previewNote}
        onClose={() => setPreviewNote(null)}
        onDownload={handleDownload}
      />
    </AppShell>
  );
}

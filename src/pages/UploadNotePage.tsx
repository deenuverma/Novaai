import React, { useRef, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { ArrowLeft, FileUp, Loader2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { AppShell } from '../components/layout/AppShell.tsx';
import { Button } from '../components/ui/button.tsx';
import { Input } from '../components/ui/input.tsx';
import { Textarea } from '../components/ui/textarea.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { formatBytes } from '../lib/utils.ts';
import { notesApi } from '../services/api.ts';

const SUBJECT_CHOICES = [
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

const CLASS_CHOICES = [
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

export function UploadNotePage() {
  const { user, loading: authLoading, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('Computer Science');
  const [classLevel, setClassLevel] = useState('Semester 5');
  const [tags, setTags] = useState('');
  const [contentSummary, setContentSummary] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleFilePick = (file: File | undefined | null) => {
    setErrorMsg(null);
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) {
      setErrorMsg('Selected file exceeds the 25MB maximum upload size.');
      return;
    }
    setSelectedFile(file);
    if (!title.trim()) {
      const base = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]+/g, ' ');
      setTitle(base.charAt(0).toUpperCase() + base.slice(1));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!title.trim() || title.trim().length < 3) {
      setErrorMsg('Please enter a descriptive note title (at least 3 characters).');
      return;
    }
    if (!selectedFile) {
      setErrorMsg('Please choose a file to upload.');
      return;
    }

    const formData = new FormData();
    formData.append('title', title.trim());
    formData.append('subject', subject);
    formData.append('classLevel', classLevel);
    formData.append('tags', tags);
    formData.append('contentSummary', contentSummary.trim());
    formData.append('file', selectedFile);

    setUploading(true);
    try {
      await notesApi.uploadNote(formData);
      await refreshProfile();
      toast.success('Study note uploaded and indexed for keyword search!');
      navigate('/notes');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  if (!authLoading && !user) {
    return (
      <Navigate
        to="/signup"
        state={{ from: '/notes/upload', requireAuthNotice: true }}
        replace
      />
    );
  }

  return (
    <AppShell>
      <div className="animate-nova-enter mx-auto max-w-2xl px-4 py-6 sm:px-6 lg:py-10">
        <Link
          to="/notes"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#52645B] hover:text-[#059669] dark:text-[#94A89E] dark:hover:text-[#34D399] hover:underline"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Notes Library</span>
        </Link>

        <div className="mt-4">
          <p className="text-xs font-semibold tracking-wide text-[#9A633A] uppercase dark:text-[#D4A373]">
            Publish Academic Handouts
          </p>
          <h1 className="mt-1 font-display text-2xl sm:text-3xl font-bold tracking-tight text-[#111916] dark:text-[#F2F6F4]">
            Upload Study Notes
          </h1>
          <p className="mt-1 text-sm text-[#52645B] dark:text-[#94A89E]">
            Supports PDF, DOC/DOCX, PPT/PPTX, PNG/JPG images, TXT, and Markdown files up to 25MB. Text content and summaries are automatically indexed for keyword search across Laptop and Mobile.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="nova-3d-card mt-7 space-y-5 rounded-2xl p-5 sm:p-7"
        >
          <div>
            <label
              htmlFor="note-title"
              className="mb-1.5 block text-xs font-semibold text-[#2C3A34] dark:text-[#DCE6E1]"
            >
              Note Title
            </label>
            <Input
              id="note-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Dynamic Programming & Graph Shortest Paths"
              required
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="note-subject"
                className="mb-1.5 block text-xs font-semibold text-[#2C3A34] dark:text-[#DCE6E1]"
              >
                Subject
              </label>
              <select
                id="note-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="flex h-10 w-full rounded-xl border border-[#C2CEC8] bg-white px-3 text-sm text-[#111916] focus:border-[#059669] focus:outline-none focus:ring-2 focus:ring-[#10B981]/25 dark:border-[#2A3933] dark:bg-[#111816] dark:text-[#F2F6F4]"
              >
                {SUBJECT_CHOICES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="note-class"
                className="mb-1.5 block text-xs font-semibold text-[#2C3A34] dark:text-[#DCE6E1]"
              >
                Class / Semester
              </label>
              <select
                id="note-class"
                value={classLevel}
                onChange={(e) => setClassLevel(e.target.value)}
                className="flex h-10 w-full rounded-xl border border-[#C2CEC8] bg-white px-3 text-sm text-[#111916] focus:border-[#059669] focus:outline-none focus:ring-2 focus:ring-[#10B981]/25 dark:border-[#2A3933] dark:bg-[#111816] dark:text-[#F2F6F4]"
              >
                {CLASS_CHOICES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label
              htmlFor="note-tags"
              className="mb-1.5 block text-xs font-semibold text-[#2C3A34] dark:text-[#DCE6E1]"
            >
              Tags (comma-separated)
            </label>
            <Input
              id="note-tags"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="e.g. algorithms, trees, mid-sem, exam-prep"
            />
          </div>

          <div>
            <label
              htmlFor="note-content-summary"
              className="mb-1.5 block text-xs font-semibold text-[#2C3A34] dark:text-[#DCE6E1]"
            >
              Content Keywords &amp; Topic Summary (indexed for search)
            </label>
            <Textarea
              id="note-content-summary"
              rows={3}
              value={contentSummary}
              onChange={(e) => setContentSummary(e.target.value)}
              placeholder="Optional: Add key theorems, formulas, or lecture topics covered inside scanned PDFs or diagrams so you can find this note by content keywords..."
            />
          </div>

          <div>
            <span className="mb-1.5 block text-xs font-semibold text-[#2C3A34] dark:text-[#DCE6E1]">
              Document File (Max 25MB)
            </span>
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                handleFilePick(e.dataTransfer.files?.[0]);
              }}
              onClick={() => fileInputRef.current?.click()}
              className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-[#C2CEC8] bg-[#F4F6F4] px-6 py-8 text-center transition-colors hover:border-[#059669] hover:bg-[#EAEEEC] dark:border-[#2A3933] dark:bg-[#0E1513] dark:hover:border-[#10B981] dark:hover:bg-[#16201D]"
            >
              <FileUp className="h-7 w-7 text-[#059669] dark:text-[#34D399]" />
              {selectedFile ? (
                <div className="mt-2">
                  <p className="text-sm font-semibold text-[#111916] dark:text-[#F2F6F4]">
                    {selectedFile.name}
                  </p>
                  <p className="mt-0.5 text-xs text-[#52645B] dark:text-[#94A89E] tabular-nums">
                    {formatBytes(selectedFile.size)} · Tap or click to replace file
                  </p>
                </div>
              ) : (
                <div className="mt-2">
                  <p className="text-sm font-semibold text-[#111916] dark:text-[#F2F6F4]">
                    Tap to select a file or drag and drop here
                  </p>
                  <p className="mt-0.5 text-xs text-[#52645B] dark:text-[#94A89E]">
                    PDF, DOCX, PPTX, PNG, JPG, TXT, MD, CSV (up to 25MB)
                  </p>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.md,.csv,.png,.jpg,.jpeg,.webp,.gif,.svg,.zip,.json"
                onChange={(e) => handleFilePick(e.target.files?.[0])}
              />
            </div>
          </div>

          {errorMsg && (
            <div
              role="alert"
              className="rounded-xl border border-[#DFC4B2] bg-[#FAF3EE] px-3.5 py-2.5 text-xs text-[#8C4A27] dark:border-[#4A3022] dark:bg-[#221610] dark:text-[#E7B89A]"
            >
              {errorMsg}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/notes')}
              disabled={uploading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={uploading}>
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              <span>{uploading ? 'Uploading...' : 'Publish Note'}</span>
            </Button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}

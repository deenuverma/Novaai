import React, { useEffect, useState } from 'react';
import { Download, FileText, Loader2 } from 'lucide-react';
import type { NoteItem } from '../../types/models.ts';
import { formatBytes, formatShortDate } from '../../lib/utils.ts';
import { notesApi } from '../../services/api.ts';
import { Button } from '../ui/button.tsx';
import { Modal } from '../ui/modal.tsx';
import { MarkdownRenderer } from '../chat/MarkdownRenderer.tsx';

interface NotePreviewModalProps {
  note: NoteItem | null;
  onClose: () => void;
  onDownload: (note: NoteItem) => void;
}

export function NotePreviewModal({
  note,
  onClose,
  onDownload,
}: NotePreviewModalProps) {
  const [textContent, setTextContent] = useState<string | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  useEffect(() => {
    if (!note) {
      setTextContent(null);
      setBlobUrl(null);
      setPreviewError(null);
      return;
    }

    let active = true;
    let objectUrlToRevoke: string | null = null;

    const isPdf =
      note.fileType === 'application/pdf' ||
      note.fileName.toLowerCase().endsWith('.pdf');
    const isImage = note.fileType.startsWith('image/');
    const isText =
      note.fileType.startsWith('text/') ||
      /\.(txt|md|csv|json)$/i.test(note.fileName);

    const loadPreview = async () => {
      setLoading(true);
      setPreviewError(null);
      setTextContent(null);
      setBlobUrl(null);

      try {
        if (isText) {
          const res = await notesApi.fetchPreviewResponse(note.id);
          const txt = await res.text();
          if (active) setTextContent(txt);
        } else if (isPdf || isImage) {
          const res = await notesApi.fetchPreviewResponse(note.id);
          const rawBlob = await res.blob();
          const typedBlob = isPdf
            ? new Blob([rawBlob], { type: 'application/pdf' })
            : rawBlob;
          objectUrlToRevoke = URL.createObjectURL(typedBlob);
          if (active) setBlobUrl(objectUrlToRevoke);
        }
      } catch (err) {
        if (active) {
          setPreviewError(
            err instanceof Error ? err.message : 'Preview unavailable.'
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadPreview();

    return () => {
      active = false;
      if (objectUrlToRevoke) {
        URL.revokeObjectURL(objectUrlToRevoke);
      }
    };
  }, [note]);

  if (!note) return null;

  const isPdf =
    note.fileType === 'application/pdf' ||
    note.fileName.toLowerCase().endsWith('.pdf');
  const isImage = note.fileType.startsWith('image/');
  const isMarkdown =
    note.fileType === 'text/markdown' ||
    note.fileName.toLowerCase().endsWith('.md');

  return (
    <Modal
      open={Boolean(note)}
      onClose={onClose}
      title={note.title}
      subtitle={`${note.subject} · ${note.classLevel} · Uploaded by ${note.uploaderName} · ${formatBytes(note.fileSize)} · ${formatShortDate(note.createdAt)}`}
      maxWidthClass="max-w-5xl"
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#DCE3DF] pb-3 dark:border-[#23312B]">
          <div className="text-xs text-[#52645B] dark:text-[#94A89E]">
            <span className="font-mono text-[#111916] dark:text-[#F2F6F4]">
              {note.fileName}
            </span>
            <span className="mx-2" aria-hidden="true">
              ·
            </span>
            <span className="font-semibold text-[#9A633A] dark:text-[#D4A373] tabular-nums">
              {note.downloads} downloads
            </span>
          </div>
          <Button size="sm" onClick={() => onDownload(note)}>
            <Download className="h-3.5 w-3.5" />
            <span>Download File</span>
          </Button>
        </div>

        {note.contentText && textContent === null && (
          <div className="rounded-xl border border-[#DCE3DF] bg-white px-4 py-3 text-xs leading-relaxed text-[#2C3A34] dark:border-[#23312B] dark:bg-[#131B18] dark:text-[#DCE6E1]">
            <span className="font-semibold text-[#059669] dark:text-[#34D399]">
              Indexed Summary &amp; Keywords:{' '}
            </span>
            {note.contentText.slice(0, 360)}
            {note.contentText.length > 360 ? '…' : ''}
          </div>
        )}

        {loading && (
          <div className="flex h-72 flex-col items-center justify-center gap-2 text-sm text-[#52645B] dark:text-[#94A89E]">
            <Loader2 className="h-5 w-5 animate-spin text-[#10B981]" />
            <span>Preparing inline document preview...</span>
          </div>
        )}

        {!loading && previewError && (
          <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-xl border border-[#DCE3DF] bg-white p-6 text-center dark:border-[#23312B] dark:bg-[#131B18]">
            <FileText className="h-8 w-8 text-[#9A633A] dark:text-[#D4A373]" />
            <p className="text-sm text-[#52645B] dark:text-[#94A89E]">
              {previewError}
            </p>
            <Button size="sm" onClick={() => onDownload(note)}>
              <Download className="h-3.5 w-3.5" />
              <span>Download to View Locally</span>
            </Button>
          </div>
        )}

        {!loading && !previewError && isPdf && blobUrl && (
          <div className="h-[68vh] w-full overflow-hidden rounded-xl border border-[#DCE3DF] bg-white dark:border-[#23312B] dark:bg-[#0B0F0E]">
            <iframe
              src={blobUrl}
              title={note.title}
              className="h-full w-full border-0"
            />
          </div>
        )}

        {!loading && !previewError && isImage && blobUrl && (
          <div className="flex max-h-[68vh] items-center justify-center overflow-auto rounded-xl border border-[#DCE3DF] bg-white p-4 dark:border-[#23312B] dark:bg-[#131B18]">
            <img
              src={blobUrl}
              alt={note.title}
              referrerPolicy="no-referrer"
              className="max-h-[62vh] w-auto rounded-lg object-contain"
            />
          </div>
        )}

        {!loading && !previewError && textContent !== null && (
          <div className="max-h-[65vh] overflow-y-auto rounded-xl border border-[#DCE3DF] bg-white p-4 sm:p-5 dark:border-[#23312B] dark:bg-[#131B18]">
            {isMarkdown ? (
              <MarkdownRenderer content={textContent} />
            ) : (
              <pre className="whitespace-pre-wrap font-mono text-xs sm:text-sm leading-relaxed text-[#111916] dark:text-[#E6EEEA]">
                {textContent}
              </pre>
            )}
          </div>
        )}

        {!loading && !previewError && !isPdf && !isImage && textContent === null && (
          <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-[#DCE3DF] bg-white py-14 px-6 text-center dark:border-[#23312B] dark:bg-[#131B18]">
            <FileText className="h-9 w-9 text-[#059669] dark:text-[#34D399]" />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-[#111916] dark:text-[#F2F6F4]">
                {note.fileName}
              </p>
              <p className="text-xs text-[#52645B] dark:text-[#94A89E]">
                Download this {note.fileType || 'document'} ({formatBytes(note.fileSize)}) to inspect full formatting on your device.
              </p>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <Button size="sm" onClick={() => onDownload(note)}>
                <Download className="h-3.5 w-3.5" />
                <span>Download File</span>
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

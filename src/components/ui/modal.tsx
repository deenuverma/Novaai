import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils.ts';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  maxWidthClass?: string;
}

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  maxWidthClass = 'max-w-4xl',
}: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#060908]/75 p-3 sm:p-6 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <div
        className={cn(
          'flex max-h-[90vh] w-full flex-col overflow-hidden rounded-2xl border border-[#DCE3DF] bg-[#F4F6F4] text-[#111916] dark:border-[#23312B] dark:bg-[#0F1614] dark:text-[#F2F6F4]',
          maxWidthClass
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[#DCE3DF] bg-white px-4 py-3.5 sm:px-5 sm:py-4 dark:border-[#212E29] dark:bg-[#131B18]">
          <div className="min-w-0">
            <h2 className="truncate font-display text-base font-bold text-[#111916] dark:text-[#F2F6F4]">
              {title}
            </h2>
            {subtitle && (
              <p className="mt-0.5 truncate text-xs text-[#52645B] dark:text-[#94A89E]">
                {subtitle}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#DCE3DF] bg-[#F4F6F4] text-[#4A5B53] hover:border-[#059669] hover:text-[#111916] dark:border-[#263630] dark:bg-[#16201D] dark:text-[#94A89E] dark:hover:border-[#10B981] dark:hover:text-[#F2F6F4] cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">{children}</div>
      </div>
    </div>
  );
}

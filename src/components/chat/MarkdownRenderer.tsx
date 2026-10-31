import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Check, Copy } from 'lucide-react';

function CodeBlock({
  language,
  code,
}: {
  language: string;
  code: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // ignore clipboard errors
    }
  };

  return (
    <div className="my-3 overflow-hidden rounded-xl border border-[#23312B] bg-[#0B100E] text-[#F2F6F4]">
      <div className="flex items-center justify-between border-b border-[#1E2B26] bg-[#121A17] px-3.5 py-2 text-xs text-[#94A89E]">
        <span className="font-mono font-semibold text-[#6EE7B7]">
          {language || 'code'}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#283832] bg-[#17221E] px-2.5 py-1 text-xs font-semibold text-[#E6EEEA] transition-colors hover:border-[#10B981] hover:text-white whitespace-nowrap shrink-0 cursor-pointer"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-[#34D399]" />
              <span>Copied</span>
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="overflow-x-auto p-3.5 font-mono text-xs sm:text-[13px] leading-relaxed text-[#E6EEEA]">
        <code>{code}</code>
      </pre>
    </div>
  );
}

export function MarkdownRenderer({ content }: { content: string }) {
  return (
    <div className="space-y-3 text-sm sm:text-[15px] leading-relaxed text-[#111916] dark:text-[#EDF3F0] break-words">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="mt-4 mb-2 font-display text-xl font-bold text-[#111916] dark:text-[#F2F6F4]">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="mt-4 mb-2 font-display text-lg font-semibold text-[#111916] dark:text-[#F2F6F4]">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="mt-3 mb-1.5 font-display text-base font-semibold text-[#1E2B26] dark:text-[#D5E2DC]">
              {children}
            </h3>
          ),
          p: ({ children }) => <p className="leading-relaxed">{children}</p>,
          ul: ({ children }) => (
            <ul className="list-disc space-y-1.5 pl-5">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal space-y-1.5 pl-5">{children}</ol>
          ),
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-[#059669] underline underline-offset-2 hover:text-[#047857] dark:text-[#34D399] dark:hover:text-[#6EE7B7]"
            >
              {children}
            </a>
          ),
          table: ({ children }) => (
            <div className="my-3 overflow-x-auto rounded-xl border border-[#DCE3DF] dark:border-[#24342E]">
              <table className="w-full border-collapse text-left text-xs sm:text-sm">
                {children}
              </table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border-b border-[#DCE3DF] bg-[#EAEEEC] px-3 py-2 font-semibold text-[#111916] dark:border-[#24342E] dark:bg-[#16201D] dark:text-[#F2F6F4]">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border-b border-[#EAEEEC] px-3 py-2 text-[#2C3A34] dark:border-[#1E2B26] dark:text-[#DCE6E1]">
              {children}
            </td>
          ),
          code({ className, children, ...props }) {
            const rawText = String(children).replace(/\n$/, '');
            const match = /language-(\w+)/.exec(className || '');
            const isBlock = Boolean(match) || rawText.includes('\n');

            if (isBlock) {
              return <CodeBlock language={match?.[1] || ''} code={rawText} />;
            }

            return (
              <code
                className="rounded-md border border-[#DCE3DF] bg-[#EAEEEC] px-1.5 py-0.5 font-mono text-[13px] text-[#047857] dark:border-[#263831] dark:bg-[#15201C] dark:text-[#6EE7B7]"
                {...props}
              >
                {children}
              </code>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

import React from 'react';
import { escapeRegExp } from '../../lib/utils.ts';

export function HighlightText({
  text,
  query,
}: {
  text: string;
  query: string;
}) {
  const trimmed = query.trim();
  if (!trimmed || !text) {
    return <>{text}</>;
  }

  const tokens = Array.from(
    new Set(
      [trimmed, ...trimmed.split(/\s+/).filter((w) => w.length >= 2)].sort(
        (a, b) => b.length - a.length
      )
    )
  );

  if (tokens.length === 0) {
    return <>{text}</>;
  }

  const pattern = tokens.map(escapeRegExp).join('|');
  const regex = new RegExp(`(${pattern})`, 'gi');
  const parts = text.split(regex);
  const lowerTokens = new Set(tokens.map((t) => t.toLowerCase()));

  return (
    <>
      {parts.map((part, idx) =>
        lowerTokens.has(part.toLowerCase()) ? (
          <mark
            key={idx}
            className="rounded-sm bg-[#D1FAE5] px-1 font-semibold text-[#065F46] dark:bg-[#10B981]/25 dark:text-[#6EE7B7]"
          >
            {part}
          </mark>
        ) : (
          <React.Fragment key={idx}>{part}</React.Fragment>
        )
      )}
    </>
  );
}

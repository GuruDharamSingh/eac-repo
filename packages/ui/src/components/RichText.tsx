import React from 'react';
import { sanitizeRichText } from '@elkdonis/utils';

export interface RichTextProps {
  /** Raw rich-text HTML (as stored from the TipTap editor). */
  html: string | null | undefined;
  /** Element to render as. Defaults to `div`. */
  as?: keyof React.JSX.IntrinsicElements;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Renders stored rich-text HTML safely.
 *
 * The HTML is sanitized through `sanitizeRichText` (a broad TipTap-aware
 * allowlist) before being injected, so this is safe to use with user-authored
 * content — including anonymous input. Prefer this over hand-rolling
 * `dangerouslySetInnerHTML` anywhere rich text is displayed.
 */
export function RichText({ html, as = 'div', className, style }: RichTextProps) {
  const clean = sanitizeRichText(html);
  return React.createElement(as, {
    className,
    style,
    dangerouslySetInnerHTML: { __html: clean },
  });
}

'use client';

// The body row for `editor: 'blocks'` in focus (developer, 2026-11-12: "the What line is simple,
// with an additional button to add/edit that pops up the studio editor + blocks"). A clipped,
// read-only preview of the body and one button; the button opens the host's `slots.blocks`
// editor in a dialog over the form. Edits go through the same onChange as the inline Canvas.

import * as React from 'react';
import { createPortal } from 'react-dom';
import { FormRoot, useFormTheme } from '../theme/context';

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'" };

function decode(s: string): string {
  return s.replace(/&(#?\w+);/g, (m, k: string) => ENTITIES[k] ?? m);
}

/** Plain text of the first blocks and the first pictures of a body's HTML. No markup is kept: the preview is built from React nodes. */
export function bodyPreview(html: string): { text: Array<{ t: string; head: boolean }>; images: Array<{ src: string; alt: string }> } {
  const text: Array<{ t: string; head: boolean }> = [];
  let chars = 0;
  const blockRe = /<(p|h[1-6]|li|blockquote)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  for (let m = blockRe.exec(html); m && chars < 400 && text.length < 4; m = blockRe.exec(html)) {
    const t = decode(m[2].replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
    if (t) {
      text.push({ t, head: /^h[1-6]$/i.test(m[1]) });
      chars += t.length;
    }
  }
  if (text.length === 0) {
    const t = decode(html.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
    if (t) text.push({ t: t.slice(0, 400), head: false });
  }
  const images: Array<{ src: string; alt: string }> = [];
  const imgRe = /<img\b[^>]*>/gi;
  for (let m = imgRe.exec(html); m && images.length < 2; m = imgRe.exec(html)) {
    const src = /\ssrc\s*=\s*"([^"]*)"/i.exec(m[0])?.[1] ?? /\ssrc\s*=\s*'([^']*)'/i.exec(m[0])?.[1];
    // Only http(s) and site-relative paths: never a data: or javascript: URL.
    if (!src || !/^(https?:\/\/|\/(?!\/))/i.test(decode(src))) continue;
    const alt = /\salt\s*=\s*"([^"]*)"/i.exec(m[0])?.[1] ?? '';
    images.push({ src: decode(src), alt: decode(alt) });
  }
  return { text, images };
}

/**
 * The body as one line of plain text when it is empty or a single paragraph with no markup
 * inside; null when it holds blocks. The row edits such a body as a simple line (developer,
 * 2026-11-12: "the What line is simple" when the form is new).
 */
export function bodyLine(html: string): string | null {
  const h = html.trim();
  if (!h) return '';
  const m = /^<p>([^<]*)<\/p>$/i.exec(h);
  return m ? decode(m[1]) : null;
}

function escapeHtml(t: string): string {
  return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** One line of text as the body's HTML: a single paragraph, or empty. */
export function lineToHtml(t: string): string {
  return t.trim() ? `<p>${escapeHtml(t)}</p>` : '';
}

export function BlocksRow({
  id,
  label,
  html,
  describedBy,
  disabled,
  line,
  onLine,
  placeholder,
  children,
}: {
  id: string;
  label: string;
  html: string;
  describedBy?: string;
  disabled?: boolean;
  /** The body as one plain line (bodyLine), or null once blocks are in use. */
  line?: string | null;
  /** Writes a typed line back as the body (the caller applies the stale-document rule). */
  onLine?: (text: string) => void;
  placeholder?: string;
  /** The editor, drawn only while the dialog is open. */
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const btnRef = React.useRef<HTMLButtonElement>(null);
  const dialogRef = React.useRef<HTMLDivElement>(null);
  const theme = useFormTheme();
  const preview = React.useMemo(() => bodyPreview(html), [html]);
  const empty = preview.text.length === 0 && preview.images.length === 0;
  const titleId = `${id}-dialog-title`;
  const textSize = typeof document !== 'undefined' && open ? btnRef.current?.closest<HTMLElement>('[data-text-size]')?.dataset.textSize : undefined;

  const close = React.useCallback(() => {
    setOpen(false);
    btnRef.current?.focus();
  }, []);

  React.useEffect(() => {
    if (!open) return;
    dialogRef.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && !e.defaultPrevented) {
      e.stopPropagation();
      close();
      return;
    }
    if (e.key !== 'Tab' || !dialogRef.current) return;
    const items = Array.from(
      dialogRef.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select, textarea, [contenteditable="true"], [tabindex]:not([tabindex="-1"])')
    );
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && (active === first || active === dialogRef.current)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return (
    <div className="frm-bodyrow" data-mode={line != null && onLine ? 'line' : 'blocks'}>
      {line != null && onLine ? (
        // First scene: one simple line, with Blocks for the full editor.
        <div className="frm-bodyrow-linebar">
          <span className="frm-input frm-bodyrow-line">
            <input
              className="frm-input-el"
              aria-describedby={describedBy}
              aria-label={label}
              placeholder={placeholder}
              value={line}
              disabled={disabled}
              onChange={(e) => onLine(e.target.value)}
            />
          </span>
          <button
            ref={btnRef}
            id={id}
            type="button"
            className="frm-btn frm-btn--secondary frm-bodyrow-btn"
            disabled={disabled}
            aria-haspopup="dialog"
            onClick={() => setOpen(true)}
          >
            + Blocks
          </button>
        </div>
      ) : (
        // Blocks in use: the content as it reads, with Edit in its corner (the first canvas version).
        <div className="frm-bodyrow-preview" data-empty={empty ? '' : undefined} aria-describedby={describedBy}>
          <button
            ref={btnRef}
            id={id}
            type="button"
            className="frm-btn frm-btn--secondary frm-bodyrow-btn"
            disabled={disabled}
            aria-haspopup="dialog"
            onClick={() => setOpen(true)}
          >
            {empty ? 'Add' : 'Edit'}
          </button>
          {empty ? (
            <span className="frm-bodyrow-empty">Nothing yet</span>
          ) : (
            <>
              {preview.text.length > 0 && (
                <span className="frm-bodyrow-text">
                  {preview.text.map((x, i) => (
                    <React.Fragment key={i}>
                      {i > 0 && ' '}
                      {x.head ? <b>{x.t}.</b> : x.t}
                    </React.Fragment>
                  ))}
                </span>
              )}
              {preview.images.length > 0 && (
                <span className="frm-bodyrow-pics" data-count={preview.images.length}>
                  {preview.images.map((im, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={i} src={im.src} alt={im.alt} loading="lazy" />
                  ))}
                </span>
              )}
            </>
          )}
        </div>
      )}
      {open &&
        typeof document !== 'undefined' &&
        createPortal(
          <FormRoot theme={theme} className="frm-bodyrow-veil" data-text-size={textSize} onMouseDown={(e) => e.target === e.currentTarget && close()}>
            <div ref={dialogRef} className="frm-bodyrow-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} onKeyDown={onKeyDown}>
              <div className="frm-bodyrow-head">
                <h2 id={titleId} className="frm-bodyrow-title">
                  {label}
                </h2>
                <button type="button" className="frm-btn frm-btn--primary" onClick={close}>
                  Done
                </button>
              </div>
              <div className="frm-bodyrow-editor frm-blocks">{children}</div>
            </div>
          </FormRoot>,
          document.body
        )}
    </div>
  );
}

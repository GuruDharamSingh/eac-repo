'use client';

import * as React from 'react';
import type { FormTier } from '../contract';
import { Icon } from '../theme/context';
import type { FieldTone } from './Field';
import { htmlToLite, liteToHtml, LITE_SUBSET } from './lite-markup';

// ============================================================================
// LiteEditor: the toolbar editor of ./forms (PLAN §1.5; design §4 Description).
// A textarea with B I U H2 H3 • List 1. List Link that writes markdown-lite,
// and hands the form sanitised HTML on every change (lite-markup.ts). No
// tiptap: ./forms/focus and hosts that bundle RichTextEditor pass it through
// the `body` slot instead.
//
// A stored body outside the subset (LITE_SUBSET) is shown read only, as plain
// text, with "Edit in full editor", so a save from here never strips what a
// richer editor wrote.
//
// The toolbar is an ARIA toolbar: one tab stop, ←/→ between buttons. Ctrl/⌘ +
// B, I, U and K work in the text too.
// ============================================================================

export { LITE_SUBSET };

type Cmd = 'bold' | 'italic' | 'underline' | 'h2' | 'h3' | 'bullets' | 'numbers' | 'link';

const TOOLS: Array<{ k: Cmd; glyph: string; label: string; key?: string }> = [
  { k: 'bold', glyph: 'B', label: 'Bold', key: 'b' },
  { k: 'italic', glyph: 'I', label: 'Italic', key: 'i' },
  { k: 'underline', glyph: 'U', label: 'Underline', key: 'u' },
  { k: 'h2', glyph: 'H2', label: 'Heading' },
  { k: 'h3', glyph: 'H3', label: 'Small heading' },
  { k: 'bullets', glyph: '• List', label: 'Bulleted list' },
  { k: 'numbers', glyph: '1. List', label: 'Numbered list' },
  { k: 'link', glyph: 'Link', label: 'Link', key: 'k' },
];

/** The quick tier's shorter bar (design 1g: B I • List Link). */
const QUICK: Cmd[] = ['bold', 'italic', 'bullets', 'link'];

interface Edit {
  text: string;
  start: number;
  end: number;
}

function wrap(t: string, s: number, e: number, mk: string): Edit {
  const sel = t.slice(s, e);
  if (!sel) return { text: t.slice(0, s) + mk + mk + t.slice(e), start: s + mk.length, end: s + mk.length };
  if (t.slice(s - mk.length, s) === mk && t.slice(e, e + mk.length) === mk) {
    return { text: t.slice(0, s - mk.length) + sel + t.slice(e + mk.length), start: s - mk.length, end: e - mk.length };
  }
  return { text: t.slice(0, s) + mk + sel + mk + t.slice(e), start: s + mk.length, end: e + mk.length };
}

function lines(t: string, s: number, e: number, kind: 'h2' | 'h3' | 'bullets' | 'numbers'): Edit {
  const a = t.lastIndexOf('\n', s - 1) + 1;
  const bIdx = t.indexOf('\n', e);
  const b = bIdx === -1 ? t.length : bIdx;
  const block = t.slice(a, b).split('\n');
  const strip = (l: string) => l.replace(/^(#{1,3}\s+|[-*•]\s+|\d+[.)]\s+)/, '');
  const has = (l: string) =>
    kind === 'h2' ? /^##\s/.test(l) && !/^###/.test(l) : kind === 'h3' ? /^###\s/.test(l) : kind === 'bullets' ? /^[-*•]\s/.test(l) : /^\d+[.)]\s/.test(l);
  const allOn = block.every((l) => !l.trim() || has(l));
  let n = 0;
  const next = block.map((l) => {
    if (!l.trim()) return l;
    const bare = strip(l);
    if (allOn) return bare;
    n += 1;
    return (kind === 'h2' ? '## ' : kind === 'h3' ? '### ' : kind === 'bullets' ? '- ' : `${n}. `) + bare;
  });
  const out = next.join('\n');
  return { text: t.slice(0, a) + out + t.slice(b), start: a, end: a + out.length };
}

function link(t: string, s: number, e: number): Edit {
  const sel = t.slice(s, e) || 'link text';
  const before = `${t.slice(0, s)}[${sel}](`;
  const url = 'https://';
  return { text: `${before}${url})${t.slice(e)}`, start: before.length, end: before.length + url.length };
}

function apply(cmd: Cmd, t: string, s: number, e: number): Edit {
  switch (cmd) {
    case 'bold':
      return wrap(t, s, e, '**');
    case 'italic':
      return wrap(t, s, e, '*');
    case 'underline':
      return wrap(t, s, e, '++');
    case 'link':
      return link(t, s, e);
    default:
      return lines(t, s, e, cmd);
  }
}

function plainParas(html: string): string[] {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|li|h\d|blockquote|figcaption|div)>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
}

export interface LiteEditorProps {
  id: string;
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  label?: string;
  tier?: FormTier;
  describedBy?: string;
  tone?: FieldTone | null;
  disabled?: boolean;
  /** Where "Edit in full editor" goes (FormHost.studioHref with focus), or a handler. */
  fullEditor?: { href?: string | null; onOpen?: () => void } | null;
}

export function LiteEditor({ id, value, onChange, placeholder, label = 'Text', tier = 'focus', describedBy, tone, disabled, fullEditor }: LiteEditorProps) {
  // Parsed once per value that comes from OUTSIDE (first render, a preset, a load).
  // Our own echo is never re-judged, so typing can't flip the editor to read only.
  const [first] = React.useState(() => htmlToLite(value ?? ''));
  const [md, setMd] = React.useState(first.editable ? first.md : '');
  const [readOnly, setReadOnly] = React.useState<string | null>(first.editable === false && (value ?? '').trim() ? first.reason : null);
  const emitted = React.useRef<string>(value ?? '');
  const area = React.useRef<HTMLTextAreaElement>(null);
  const pendingSel = React.useRef<[number, number] | null>(null);
  const [focusIdx, setFocusIdx] = React.useState(0);

  React.useEffect(() => {
    if ((value ?? '') === emitted.current) return;
    emitted.current = value ?? '';
    const p = htmlToLite(value ?? '');
    if (p.editable === true) {
      setMd(p.md);
      setReadOnly(null);
    } else if (p.editable === false && (value ?? '').trim()) setReadOnly(p.reason);
  }, [value]);

  React.useLayoutEffect(() => {
    const sel = pendingSel.current;
    if (sel && area.current) {
      area.current.focus();
      area.current.setSelectionRange(sel[0], sel[1]);
      pendingSel.current = null;
    }
  });

  const commit = (next: string) => {
    setMd(next);
    const html = liteToHtml(next);
    emitted.current = html;
    onChange(html);
  };

  const run = (cmd: Cmd) => {
    const el = area.current;
    if (!el || disabled) return;
    const ed = apply(cmd, md, el.selectionStart, el.selectionEnd);
    pendingSel.current = [ed.start, ed.end];
    commit(ed.text);
  };

  if (readOnly) {
    const paras = plainParas(value);
    return (
      <div className="frm-lite" data-mode="readonly" id={id} aria-describedby={describedBy}>
        <div className="frm-lite-ro-note">
          <span>This text has {readOnly}. It is shown here as plain text, unchanged.</span>
          {fullEditor?.href ? (
            <a className="frm-btn frm-btn--ghost frm-btn--sm" href={fullEditor.href} onClick={fullEditor.onOpen}>
              <Icon name="expand" size={14} />
              Edit in full editor
            </a>
          ) : fullEditor?.onOpen ? (
            <button type="button" className="frm-btn frm-btn--ghost frm-btn--sm" onClick={fullEditor.onOpen}>
              <Icon name="expand" size={14} />
              Edit in full editor
            </button>
          ) : null}
        </div>
        <div className="frm-lite-ro">
          {paras.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      </div>
    );
  }

  const tools = tier === 'quick' ? TOOLS.filter((t) => QUICK.includes(t.k)) : TOOLS;

  return (
    <div className="frm-lite" data-state={tone ?? undefined} data-tier={tier}>
      <div
        className="frm-lite-bar"
        role="toolbar"
        aria-label={`${label}: formatting`}
        aria-controls={id}
        onKeyDown={(e) => {
          if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
          e.preventDefault();
          const n = (focusIdx + (e.key === 'ArrowRight' ? 1 : -1) + tools.length) % tools.length;
          setFocusIdx(n);
          (e.currentTarget.querySelectorAll('button')[n] as HTMLButtonElement | undefined)?.focus();
        }}
      >
        {tools.map((t, i) => (
          <button
            key={t.k}
            type="button"
            className="frm-lite-btn"
            data-k={t.k}
            aria-label={t.label}
            title={t.key ? `${t.label} (Ctrl+${t.key.toUpperCase()})` : t.label}
            tabIndex={i === focusIdx ? 0 : -1}
            disabled={disabled}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              setFocusIdx(i);
              run(t.k);
            }}
          >
            {t.glyph}
          </button>
        ))}
      </div>
      <textarea
        ref={area}
        id={id}
        className="frm-lite-text"
        value={md}
        placeholder={placeholder}
        aria-describedby={describedBy}
        aria-invalid={tone === 'error' || undefined}
        disabled={disabled}
        rows={tier === 'quick' ? 3 : 4}
        onChange={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
          const tool = TOOLS.find((t) => t.key === e.key.toLowerCase());
          if (tool) {
            e.preventDefault();
            run(tool.k);
          }
        }}
      />
    </div>
  );
}

'use client';

import * as React from 'react';
import type { FormContext, FormHost, FormKindId, FormKindSchema, FormState } from '../contract';
import { Input } from '../fields/Input';
import { feedName } from '../preview/format';
import { Icon } from '../theme/context';
import { KIND_NOUN, clockIn } from './ui';

// ============================================================================
// After publish, focus mode (design 1j). The form column gives way to a plain
// confirmation: the time, where it went, the link with Copy, View on site,
// Keep editing, and "Make another". No share or Channel step (by request).
// Every link is the host's: viewHref for the page, never a guessed route.
// ============================================================================

const VISIBILITY: Record<string, string> = { PUBLIC: 'Public', ORGANIZATION: 'Members only', INVITE_ONLY: 'Invited people only' };

function slugOf(record: unknown): string | null {
  if (record && typeof record === 'object' && 'slug' in record) {
    const s = (record as { slug: unknown }).slug;
    return typeof s === 'string' ? s : null;
  }
  return null;
}

export interface AfterPublishProps {
  schema: FormKindSchema;
  state: FormState;
  host: FormHost;
  ctx: FormContext;
  /** Kinds "Make another" offers besides this one. */
  kinds: FormKindId[];
  scope?: string;
  onKeepEditing: () => void;
  onMakeAnother?: (o: { kind: FormKindId; withSettings: boolean }) => void;
}

export function AfterPublish({ schema, state, host, ctx, kinds, scope = '', onKeepEditing, onMakeAnother }: AfterPublishProps) {
  const at = state.publishedAt ? clockIn(ctx.timeZone)(state.publishedAt) : '';
  const feed = feedName(state.answers, host, ctx);
  const vis = VISIBILITY[String(state.answers.visibility ?? 'PUBLIC')] ?? 'Public';
  const href = state.id ? host.viewHref?.({ kind: schema.codeKind(state.answers), id: state.id, slug: slugOf(state.record) }) ?? null : null;
  const [copied, setCopied] = React.useState(false);
  const linkRef = React.useRef<HTMLInputElement>(null);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  React.useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const copy = async () => {
    if (!href) return;
    try {
      await navigator.clipboard.writeText(href);
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1600);
    } catch {
      linkRef.current?.select();
    }
  };

  const noun = KIND_NOUN[schema.id];
  const others = kinds.filter((k) => k !== schema.id);

  return (
    <section className="frm-done" aria-labelledby={`frm-${scope}done-h`}>
      <p className="frm-done-stamp">
        <Icon name="done" size={22} />
        {at ? `Published at ${at}` : 'Published'}
      </p>
      <h1 className="frm-done-h" id={`frm-${scope}done-h`}>
        {feed ? `It’s on ${feed}.` : 'It’s published.'}
      </h1>
      <p className="frm-done-sub">{`${vis}, on ${ctx.orgName}.`}</p>
      {href && (
        <div className="frm-done-link">
          <label className="frm-label" htmlFor={`frm-${scope}done-link`}>
            Link
          </label>
          <div className="frm-done-row">
            <Input id={`frm-${scope}done-link`} ref={linkRef} value={href} readOnly onFocus={(e) => e.currentTarget.select()} />
            <button type="button" className="frm-btn frm-btn--secondary" onClick={copy}>
              <Icon name={copied ? 'check' : 'copy'} size={16} />
              <span aria-live="polite">{copied ? 'Copied' : 'Copy link'}</span>
            </button>
          </div>
        </div>
      )}
      <div className="frm-done-row">
        {href && (
          <a className="frm-btn frm-btn--primary" href={href} target="_blank" rel="noopener noreferrer">
            View on site
            <Icon name="external" size={16} />
          </a>
        )}
        <button type="button" className="frm-btn frm-btn--secondary" onClick={onKeepEditing}>
          Keep editing
        </button>
      </div>
      {onMakeAnother && (
        <div className="frm-done-more">
          <span className="frm-eyebrow">Make another</span>
          <div className="frm-done-more-row">
            <button type="button" className="frm-btn frm-btn--ghost" onClick={() => onMakeAnother({ kind: schema.id, withSettings: true })}>
              <Icon name="preset" size={16} />
              {`${noun} with these settings`}
            </button>
            <button type="button" className="frm-btn frm-btn--ghost" onClick={() => onMakeAnother({ kind: schema.id, withSettings: false })}>
              {`Blank ${noun.toLowerCase()}`}
            </button>
            {others.map((k) => (
              <button key={k} type="button" className="frm-btn frm-btn--ghost" onClick={() => onMakeAnother({ kind: k, withSettings: false })}>
                {KIND_NOUN[k]}
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

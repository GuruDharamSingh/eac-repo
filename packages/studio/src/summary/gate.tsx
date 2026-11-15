'use client';

// ============================================================================
// The summary in front of a form (canvas C, 2026-11-14). A form kind opened on
// a piece that is already published shows the piece summary first; Edit opens
// the form. A new item, a draft, or a piece the host's loader does not know
// opens the form as before. Decided once per opened item, so publishing from
// the form never swaps it for the summary.
//
// The host turns it on by providing PieceSummaryHostContext around its
// StudioShell (arts-collective StudioApp.tsx). Without the context the gate
// draws its children and nothing else: other hosts are unchanged.
// ============================================================================

import * as React from 'react';
import type { Answers, FormContext, FormKindSchema } from '@elkdonis/studio-forms';
import { PieceSummary, makeIntoFor, makeIntoHref, type PieceSummaryView } from '@elkdonis/content/summary';
import { StudioFrameContext } from '../frame';

const PERSONAL_ORG_ID = 'oad';

export interface PieceSummaryHost {
  /** The piece's summary, or null when it cannot be drawn (not in the person's Channel). */
  load: (ref: { store: 'thread' | 'artwork'; id: string; orgId: string | null }) => Promise<PieceSummaryView | null>;
  /** The Make into route (`/studio/make`). */
  makeBase: string;
}

export const PieceSummaryHostContext = React.createContext<PieceSummaryHost | null>(null);

/** How long the gate waits for the opened item before it gives the form its place. */
const WAIT_MS = 4000;

/**
 * Out in the world: published, or an artwork that is reserved or sold (the forms session's review,
 * 2026-11-14). Commerce keeps no publish time, so the artwork record's status decides; pending stays a form.
 */
function isOut(publishedAt: string | null, record: unknown): boolean {
  if (publishedAt) return true;
  if (!record || typeof record !== 'object') return false;
  const r = record as { status?: unknown; artworkStatus?: unknown };
  return r.status === 'published' || r.artworkStatus === 'reserved' || r.artworkStatus === 'sold';
}

/** Form sections whose value line reads as a fact on the cover (Places, Hosts, Edition, Booking). */
const FACT_SECTIONS: Record<string, string | null> = { rsvp: 'Places', hosts: null, details: null, edition: null, booking: null };

export function PieceSummaryGate({
  openId,
  id,
  publishedAt,
  record,
  answers,
  store,
  orgId,
  orgName,
  schema,
  ctx,
  children,
}: {
  /** The item the form was opened on (`?id=` or a list click); null for a new one. */
  openId: string | null;
  /** The form's saved record id and first publish time, once loaded. */
  id: string | null;
  publishedAt: string | null;
  /** The loaded record (the form's `state.record`): an artwork's commerce status decides with publishedAt. */
  record?: unknown;
  answers: Answers;
  /** Channel's store for this kind; null when Channel does not cover it. */
  store: 'thread' | 'artwork' | null;
  orgId: string;
  orgName: string;
  schema: FormKindSchema;
  ctx: FormContext;
  children: React.ReactNode;
}) {
  const host = React.useContext(PieceSummaryHostContext);
  const [mode, setMode] = React.useState<'wait' | 'summary' | 'form'>(() => (host && store && openId ? 'wait' : 'form'));
  const loaded = Boolean(openId && id === openId);
  React.useEffect(() => {
    if (mode === 'wait' && loaded) setMode(isOut(publishedAt, record) ? 'summary' : 'form');
  }, [mode, loaded, publishedAt, record]);
  // A load that fails or never lands (the form reports its own error) falls back to the form.
  React.useEffect(() => {
    if (mode !== 'wait') return;
    const t = window.setTimeout(() => setMode((m) => (m === 'wait' ? 'form' : m)), WAIT_MS);
    return () => window.clearTimeout(t);
  }, [mode]);

  const [view, setView] = React.useState<PieceSummaryView | null>(null);
  React.useEffect(() => {
    if (mode !== 'summary' || !host || !store || !id) return;
    let live = true;
    host
      .load({ store, id, orgId: store === 'thread' && orgId !== PERSONAL_ORG_ID ? orgId : null })
      .then((v) => {
        if (!live) return;
        if (v) setView(v);
        else setMode('form');
      })
      .catch(() => live && setMode('form'));
    return () => {
      live = false;
    };
  }, [mode, host, store, id, orgId]);

  // The left column follows the canvas: the piece list beside the summary (C), the rail beside the form (B).
  const setColTab = React.useContext(StudioFrameContext)?.setColTab;
  const shownSummary = React.useRef(false);
  React.useEffect(() => {
    if (!setColTab) return;
    if (mode === 'summary' && view) {
      shownSummary.current = true;
      setColTab('list');
    } else if (mode === 'form' && shownSummary.current) {
      shownSummary.current = false;
      setColTab('piece');
    }
  }, [mode, view, setColTab]);

  // The host's facts (When) first, then the form's own value lines for the fact sections.
  const facts = React.useMemo(() => {
    if (!view) return [];
    const out = [...view.facts];
    for (const s of schema.sections) {
      if (!(s.id in FACT_SECTIONS) || !s.summary) continue;
      if (s.when && !s.when(answers, ctx)) continue;
      let value = '';
      try {
        value = s.summary(answers, ctx).trim();
      } catch {
        value = '';
      }
      const label = FACT_SECTIONS[s.id] ?? s.label;
      if (value && !out.some((f) => f.label === label)) out.push({ label, value });
    }
    return out.slice(0, 4);
  }, [view, schema, answers, ctx]);

  if (mode === 'form' || !host) return <>{children}</>;
  // While the item loads, and then its summary: a loading line, not the form (no flash of the form).
  if (mode === 'wait' || !view) return <p className="frm-loading">Loading…</p>;
  const makeInto = makeIntoFor(view.type).map((t) => ({ ...t, href: makeIntoHref(host.makeBase, view.key, t.to, orgId) }));
  return (
    <div className="ps-page">
      <PieceSummary
        view={{ ...view, facts }}
        layout="page"
        onEdit={() => setMode('form')}
        makeInto={makeInto}
        channelLabel={orgId !== PERSONAL_ORG_ID && orgName ? `Open in ${orgName}’s Channel` : 'Open in your Channel'}
      />
    </div>
  );
}

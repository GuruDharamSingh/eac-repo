'use client';

// ============================================================================
// Parts the kinds share (soft tissue): the reflow row, the hint line, the
// context readers and "Goes on" (Post's essential, Gathering's Publishing).
//
// Every CONTROL is drawn by the shell through SectionProps.field(); what is
// here is only layout (rows that wrap, cells with a flex-basis) and plain
// text lines, coloured with the --frm-* output tokens, so no kind restyles a
// field. Open keys passed through FieldOverride and read by the shell:
//   hideLabel  the control's label is its section's heading; keep it as the
//              accessible name only
//   disabled   a fixed row (the home site in Also show on)
// ============================================================================

import * as React from 'react';
import type { Answers, FormContext, SectionProps, FormIconName } from '../../contract';
import { text } from '../../rules/answers';

// ── reflow ───────────────────────────────────────────────────────────────────

/**
 * What a kind tells the shell about its own layout. The kinds' rows reflow by
 * themselves (flex-wrap + flex-basis, the design's mobile rule "rows wrap and
 * inputs use flex-basis"), so at 390px they need nothing from the shell; this
 * lists them so the shell and the harness know which rows wrap and where.
 */
// KindLayout moved into the contract (review, 2026-11-08); re-exported here for the kinds.
export type { KindLayout } from '../../contract';

const ROW: React.CSSProperties = { display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 10, minWidth: 0 };

/** A row of controls that wraps when there is no room (the design's mobile reflow). */
export function Row({ name, gap, align, children }: { name: string; gap?: number; align?: React.CSSProperties['alignItems']; children: React.ReactNode }) {
  return (
    <div className="frm-k-row" data-row={name} style={{ ...ROW, gap: gap ?? ROW.gap, alignItems: align ?? ROW.alignItems }}>
      {children}
    </div>
  );
}

/** One control in a Row: `flex` is its basis ("1 1 170px", "0 0 96px", "0 1 auto"). */
export function Cell({ flex, children }: { flex: string; children: React.ReactNode }) {
  return (
    <div className="frm-k-cell" style={{ flex, minWidth: 0, maxWidth: '100%' }}>
      {children}
    </div>
  );
}

export function Stack({ gap = 10, indent = 0, children }: { gap?: number; indent?: number; children: React.ReactNode }) {
  return <div style={{ display: 'flex', flexDirection: 'column', gap, minWidth: 0, paddingLeft: indent || undefined }}>{children}</div>;
}

/** A 12px hint line, as under the design's fields. */
export function Hint({ children }: { children: React.ReactNode }) {
  return (
    <p className="frm-k-hint" style={{ margin: 0, fontSize: 12, lineHeight: 1.45, color: 'var(--frm-muted)' }}>
      {children}
    </p>
  );
}

/** Running words between controls ("Every … on Thursdays", "before"). */
export function Words({ children }: { children: React.ReactNode }) {
  return <span style={{ fontSize: 14, lineHeight: '36px', color: 'var(--frm-text)' }}>{children}</span>;
}

/** An inline text action ("Change"): a button that reads as a link, in accent-ink (small cyan text). */
export function TextAction({ onClick, children, pressed }: { onClick: () => void; children: React.ReactNode; pressed?: boolean }) {
  return (
    <button
      type="button"
      className="frm-k-textaction"
      aria-pressed={pressed}
      onClick={onClick}
      style={{ background: 'none', border: 0, padding: 0, font: 'inherit', color: 'var(--frm-accent-ink)', textDecoration: 'underline', cursor: 'pointer' }}
    >
      {children}
    </button>
  );
}

// ── context readers ──────────────────────────────────────────────────────────

export type Feed = { slug: string; name: string };
export type Org = { orgId: string; name: string };
export type Person = { userId: string; displayName: string };

function arrayOf<T>(v: unknown, ok: (x: Record<string, unknown>) => boolean): T[] {
  return Array.isArray(v) ? (v.filter((x) => x && typeof x === 'object' && ok(x as Record<string, unknown>)) as T[]) : [];
}

export function feedsOf(ctx: FormContext): Feed[] {
  return arrayOf<Feed>(ctx.fields.feeds, (x) => typeof x.slug === 'string' && typeof x.name === 'string');
}

export function listingOrgsOf(ctx: FormContext): Org[] {
  return arrayOf<Org>(ctx.fields.listingOrgs, (x) => typeof x.orgId === 'string' && typeof x.name === 'string');
}

export function hostCandidatesOf(ctx: FormContext): Person[] {
  return arrayOf<Person>(ctx.fields.hostCandidates, (x) => typeof x.userId === 'string');
}

export function homeOrgOf(ctx: FormContext): string {
  return text(ctx.fields.homeOrgId) || ctx.orgId;
}

/** Public | Members is drawn only where the binding stores it (network writing pieces can't: canSetVisibility false). */
export function canSetVisibility(ctx: FormContext): boolean {
  return ctx.fields.canSetVisibility !== false;
}

const VISIBILITY_WORD: Record<string, string> = { PUBLIC: 'Public', ORGANIZATION: 'Members', INVITE_ONLY: 'Invited' };

export function visibilityOf(a: Answers): string {
  return text(a.visibility) || 'PUBLIC';
}

/** "Lab work · Elkdonis Arts Collective", or the org alone when it has no feeds. */
export function homeLabel(a: Answers, ctx: FormContext): string {
  const feed = feedsOf(ctx).find((f) => f.slug === a.feed_slug);
  return feed ? `${feed.name} · ${ctx.orgName}` : ctx.orgName;
}

/** The Publishing row's value line: "Public · Lab work · Elkdonis Arts Collective". */
export function placementSummary(a: Answers, ctx: FormContext): string {
  const parts: string[] = [];
  if (canSetVisibility(ctx)) parts.push(VISIBILITY_WORD[visibilityOf(a)] ?? 'Public');
  parts.push(homeLabel(a, ctx));
  if (a.share_to_network === true && ctx.fields.canShareToNetwork === true) parts.push('shared to the network');
  return parts.join(' · ');
}

// ── Goes on ──────────────────────────────────────────────────────────────────

const noop = () => undefined;

function visibilityOptions(a: Answers) {
  const options: Array<{ value: string; label: string; icon?: FormIconName }> = [
    { value: 'PUBLIC', label: 'Public', icon: 'public' },
    { value: 'ORGANIZATION', label: 'Members', icon: 'members' },
  ];
  // Only shown to keep an invite-only record readable; nobody picks it here.
  if (visibilityOf(a) === 'INVITE_ONLY') options.push({ value: 'INVITE_ONLY', label: 'Invited' });
  return options;
}

/**
 * The feed select plus Public | Members. A binding with no feeds (network
 * writing pieces) lives on the acting org, shown fixed. `network` adds
 * share_to_network (center.ts:235: other orgs' network strip, PUBLIC only).
 */
export function GoesOnFields(props: SectionProps & { label: string; visibilityHint?: string; network?: boolean; hideVisibility?: boolean }) {
  const { answers: a, ctx, field, label, visibilityHint, network, hideVisibility } = props;
  const feeds = feedsOf(ctx);
  // hideVisibility: the kind is always public (a series), so there is no choice to offer.
  const showVisibility = canSetVisibility(ctx) && hideVisibility !== true;
  return (
    <Stack gap={8}>
      <Row name="goes-on">
        <Cell flex="1 1 260px">
          {feeds.length > 0
            ? field('feed_slug', {
                input: 'select',
                label,
                hideLabel: true,
                required: true,
                options: feeds.map((f) => ({ value: f.slug, label: `${f.name} · ${ctx.orgName}` })),
              })
            : field('goes_on_org', {
                input: 'select',
                label,
                hideLabel: true,
                options: [{ value: ctx.orgId, label: ctx.orgName }],
                value: ctx.orgId,
                onChange: noop,
                disabled: true,
              })}
        </Cell>
        {showVisibility && (
          <Cell flex="0 1 auto">{field('visibility', { input: 'radio', label: 'Who can see it', hideLabel: true, options: visibilityOptions(a) })}</Cell>
        )}
      </Row>
      {showVisibility && visibilityHint && <Hint>{visibilityHint}</Hint>}
      {network && ctx.fields.canShareToNetwork === true &&
        field('share_to_network', {
          input: 'boolean',
          label: 'Share to the network',
          hint: 'It also shows in the network strip that followers of other organisations see. Public only.',
        })}
    </Stack>
  );
}

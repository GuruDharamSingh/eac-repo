'use client';

// ============================================================================
// Post's own sections (soft tissue): Cover, Goes on, Excerpt, Also show on.
// The Title and Body are cms-ui fields the shell draws itself: the title as
// the headline, the body through the host's slot (the Studio essay Canvas in
// focus mode, the LiteEditor in quick compose). Nothing here imports tiptap.
// ============================================================================

import * as React from 'react';
import type { Answers, FormContext, SectionProps } from '../../contract';
import { clip, list, plainText, text, trimmed } from '../../rules/answers';
import { GoesOnFields, Hint, Stack, homeLabel, homeOrgOf, listingOrgsOf, visibilityOf } from './parts';

const noop = () => undefined;

// ── Cover ────────────────────────────────────────────────────────────────────

export function PostCover({ field }: SectionProps) {
  return field('cover_image_url', {
    label: 'Cover',
    hideLabel: true,
    hint: 'On cards, at the top of the page and in link previews.',
  });
}

// ── Goes on ──────────────────────────────────────────────────────────────────

export function PostGoesOn(props: SectionProps) {
  // forum.ts:12: ORGANIZATION threads are seen by that org's members only.
  return <GoesOnFields {...props} label="Goes on" visibilityHint="Members-only posts are seen only by this organisation’s members." />;
}

// ── Excerpt ──────────────────────────────────────────────────────────────────

export function PostExcerpt({ field }: SectionProps) {
  return field('excerpt', {
    label: 'Excerpt',
    hideLabel: true,
    placeholder: 'One or two lines for cards and link previews. Left empty, it is taken from the body.',
  });
}

export function excerptSummary(a: Answers): string {
  const own = trimmed(a.excerpt);
  return own ? clip(own) : 'From the opening of the body';
}

// ── Also show on ─────────────────────────────────────────────────────────────

/** The other sites a post can be listed on (thread_orgs via setListing): the person's orgs minus home. */
export function otherSites(ctx: FormContext) {
  const home = homeOrgOf(ctx);
  return listingOrgsOf(ctx).filter((o) => o.orgId !== home);
}

/** Shown where the binding can list (studioPostActions supplies listingOrgs), the person has a page, or the network strip is offered. */
export function hasAlsoShowOn(ctx: FormContext): boolean {
  return otherSites(ctx).length > 0 || Boolean(text(ctx.fields.viewerName)) || ctx.fields.canShareToNetwork === true;
}

export function AlsoShowOn({ answers: a, ctx, field }: SectionProps) {
  const viewer = text(ctx.fields.viewerName);
  const others = otherSites(ctx);
  const isPublic = visibilityOf(a) === 'PUBLIC';
  const hasFeeds = Array.isArray(ctx.fields.feeds) && (ctx.fields.feeds as unknown[]).length > 0;
  return (
    <Stack gap={14}>
      {field('also_on_home', {
        input: 'boolean',
        label: homeLabel(a, ctx),
        hint: hasFeeds ? 'Where it lives. Change it under Goes on.' : 'Where it lives.',
        value: true,
        onChange: noop,
        disabled: true,
      })}
      {viewer &&
        field('also_on_profile', {
          input: 'boolean',
          label: `Your profile · ${viewer}`,
          hint: 'Listed with your other writing.',
          value: true,
          onChange: noop,
          disabled: true,
        })}
      {others.length > 0 &&
        field('also_on', {
          input: 'multichoice',
          label: 'Other sites',
          hideLabel: true,
          // thread-listing.ts:145-167: listed at once, no approval; its owners or guides can take it off.
          options: others.map((o) => ({ value: o.orgId, label: o.name, hint: 'Listed there once it’s published. Its organisers can take it off.' })),
          disabled: !isPublic && list(a.also_on).length === 0,
        })}
      {others.length > 0 && !isPublic && <Hint>Members-only posts stay on their own site.</Hint>}
      {ctx.fields.canShareToNetwork === true &&
        field('share_to_network', {
          input: 'boolean',
          label: 'Share to the network',
          // center.ts:235: other orgs' network strip reads share_to_network, PUBLIC threads only.
          hint: 'It also shows in the network strip that followers of other organisations see. Public only.',
        })}
    </Stack>
  );
}

export function alsoShowOnSummary(a: Answers, ctx: FormContext): string {
  const names: string[] = [];
  if (text(ctx.fields.viewerName)) names.push('Your profile');
  const chosen = new Set(list(a.also_on));
  for (const o of otherSites(ctx)) if (chosen.has(o.orgId)) names.push(o.name);
  if (a.share_to_network === true && ctx.fields.canShareToNetwork === true) names.push('the network');
  return names.length ? names.join(', ') : 'Only where it lives';
}

// ── Body ─────────────────────────────────────────────────────────────────────

/**
 * "412 words, about 2 minutes": the design's body meta line, for the shell to
 * print by the editor. The minutes are the card's own (writing.ts:168-172,
 * not exported): characters / 5 / 230, rounded up, and only from 2 minutes.
 */
export function bodyMeta(a: Answers): string {
  const plain = plainText(a.body);
  const words = plain.split(' ').filter(Boolean).length;
  if (!words) return 'Nothing written yet';
  const minutes = Math.ceil(plain.length / 5 / 230);
  return `${words} ${words === 1 ? 'word' : 'words'}${minutes >= 2 ? `, about ${minutes} minutes` : ''}`;
}

// Review queue runners (../hub.ts entries listing-*, submission-review,
// review-switch; 2026-11-08). One queue, three sources, each decided by the
// service that owns it: a member's post (moderation.reviewThread), a store
// panel (user-pages.reviewUserPage), a post from another site asking to show
// here (thread-listing.reviewListing). The services re-check owner-or-guide
// (canModerateOrg); these runners add the site binding: every subject must
// belong to the site's org.
import { z } from 'zod/v4';
import { db } from '@elkdonis/db';
import type { ActionResult } from '../types';
import type { ActorContext, Runner } from './run';

const runner = <I>(r: Runner<I>): Runner<unknown> => r as Runner<unknown>;
const ID = z.string().trim().min(1).max(64);

const done = (r: { ok: boolean; error?: string }): ActionResult =>
  r.ok ? { ok: true } : { ok: false, error: ('error' in r && r.error) || 'That could not be decided.', code: 'forbidden' };

function org(ctx: ActorContext): string {
  if (!ctx.orgId) throw new Error('review runner without an org');
  return ctx.orgId;
}

function listing(decision: 'approve' | 'decline') {
  return runner({
    input: z.object({ threadId: ID }),
    failure: 'Could not record that decision. Try again.',
    async run(ctx, input) {
      const { reviewListing } = await import('@elkdonis/services');
      // reviewListing is scoped by (thread, org): only a request to show on THIS site.
      return done(await reviewListing(ctx.userId, input.threadId, org(ctx), decision));
    },
  });
}

export const REVIEW_RUNNERS: Record<string, Runner<unknown>> = {
  'listing-approve': listing('approve'),
  'listing-decline': listing('decline'),

  'submission-review': runner({
    input: z.discriminatedUnion('source', [
      z.object({ source: z.literal('post'), threadId: ID, decision: z.enum(['approve', 'decline']) }),
      z.object({ source: z.literal('panel'), userId: z.string().trim().uuid(), key: z.string().trim().min(1).max(120), decision: z.enum(['approve', 'decline']) }),
    ]),
    failure: 'Could not record that decision. Try again.',
    async run(ctx, input) {
      const orgId = org(ctx);
      if (input.source === 'post') {
        const [t] = await db<Array<{ org_id: string }>>`SELECT org_id FROM threads WHERE id = ${input.threadId}`;
        if (!t || t.org_id !== orgId) return { ok: false, error: 'That submission isn’t on this site.', code: 'forbidden' };
        const { reviewThread } = await import('@elkdonis/services');
        return done(await reviewThread(ctx.userId, input.threadId, input.decision === 'approve' ? 'approve' : 'reject'));
      }
      const { reviewUserPage } = await import('@elkdonis/services');
      return done(await reviewUserPage(ctx.userId, input.userId, orgId, input.key, input.decision === 'approve' ? 'approve' : 'reject'));
    },
  }),

  'review-switch': runner({
    input: z.object({ which: z.enum(['posts', 'storePanels']), on: z.boolean() }),
    failure: 'Could not change that. Try again.',
    async run(ctx, input) {
      const orgId = org(ctx);
      const { setOrgReview, setOrgStorePanels } = await import('@elkdonis/services');
      const r = input.which === 'posts' ? await setOrgReview(ctx.userId, orgId, input.on) : await setOrgStorePanels(ctx.userId, orgId, input.on);
      return done(r);
    },
  }),
};

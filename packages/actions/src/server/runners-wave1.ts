// Runners of wiring wave 1 (2026-11-27, rails desk lane F), each over the canonical service function. Wired into
// RUNNERS in ./run.ts with one spread. Same rules as run.ts: the actor comes from the host's verified session,
// input is validated here, `performAction` records the audit row.
import { z } from 'zod/v4';
import type { Runner } from './run';

const runner = <I>(r: Runner<I>): Runner<unknown> => r as Runner<unknown>;

/** A picture the person already has on the platform (our media path). Outside addresses are refused (PM review 2026-11-27:
 *  every stored avatar is an /api/media/ path, and an outside URL would let a profile load from any server). */
const PHOTO_URL = z
  .string()
  .trim()
  .max(500)
  .refine((v) => v.startsWith('/api/media/') && !v.includes('..'), 'Choose a picture from your files.');

export const RUNNERS_WAVE1: Record<string, Runner<unknown>> = {
  // Profile photo: the address of a picture already uploaded (the form's image field uploads it first).
  'profile-photo': runner({
    input: z.object({ avatarUrl: PHOTO_URL }),
    failure: 'Could not save your photo. Try again.',
    async run(ctx, input) {
      const { updateProfile } = await import('@elkdonis/services');
      await updateProfile(ctx.userId, { avatarUrl: input.avatarUrl });
      return { ok: true };
    },
  }),

  // Blog or store on the person's own page: services setPresence (row, column page), which re-reads the grid and
  // refuses anything it did not offer (a store switch needs an active store).
  'profile-sections': runner({
    input: z.object({ section: z.enum(['blog', 'store']), on: z.boolean() }),
    failure: 'Could not change that. Try again.',
    async run(ctx, input) {
      const { setPresence } = await import('@elkdonis/services');
      const r = await setPresence(ctx.userId, { row: input.section, column: 'page', on: input.on });
      return r.ok === true ? { ok: true } : { ok: false, error: r.error };
    },
  }),

  // Pen names: scoped to the signed-in account inside the service, so a forged id matches nothing.
  'pen-name-retire': runner({
    input: z.object({ identityId: z.string().trim().min(1, 'Which name?').max(64) }),
    failure: 'Could not retire the pen name. Try again.',
    async run(ctx, input) {
      const { retirePseudonym } = await import('@elkdonis/services');
      const r = await retirePseudonym(ctx.userId, input.identityId);
      return r.ok ? { ok: true } : { ok: false, error: r.error ?? 'No such name.' };
    },
  }),
  'pen-name-restore': runner({
    input: z.object({ identityId: z.string().trim().min(1, 'Which name?').max(64) }),
    failure: 'Could not bring the pen name back. Try again.',
    async run(ctx, input) {
      const { restorePseudonym } = await import('@elkdonis/services');
      const r = await restorePseudonym(ctx.userId, input.identityId);
      return r.ok ? { ok: true } : { ok: false, error: r.error ?? 'No such name.' };
    },
  }),

  // One short post, live at once. `target` is 'blog' (the person's own, homed on the network page) or '<orgId>|<feedSlug>'
  // (createPostAnywhere reads the person's real roles and checks the feed's own post rule). Host door only: it
  // publishes, so it is not offered to the HTTP or agent doors.
  'post-anywhere': runner({
    input: z.object({
      target: z.string().trim().min(1, 'Choose where to post it.').max(200),
      title: z.string().trim().min(2, 'Give it a title.').max(200),
      text: z.string().trim().min(1, 'Write something first.').max(20000),
    }),
    async allowed(ctx) {
      return (ctx.via ?? 'app') === 'app' ? { ok: true } : { ok: false, error: 'Post from the site itself, where you can see it.' };
    },
    failure: 'Could not post it. Try again.',
    async run(ctx, input) {
      const { createPostAnywhere, PERSONAL_ORG_ID } = await import('@elkdonis/services');
      const r = await createPostAnywhere(ctx.userId, { target: input.target, title: input.title, text: input.text, blogOrgId: PERSONAL_ORG_ID });
      return r.ok === true ? { ok: true, data: { threadId: r.threadId, slug: r.slug, kind: r.kind } } : { ok: false, error: r.error };
    },
  }),
};

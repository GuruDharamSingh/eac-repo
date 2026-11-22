// ============================================================================
// Post: writing, news and announcements (pass 1, soft tissue).
// Design: README §3, Publish Form.dc.html renderVals() (rail lists, default open).
//
// Answer keys are cms-ui content-fields' `post` kind (title, body, excerpt,
// cover_image_url, feed_slug, visibility, share_to_network) plus what the
// bindings read: body_doc (the essay Canvas document), layout (presets) and
// also_on (org ids for setListing). Two bindings save them (PLAN §1.6): the
// Studio's network writing pieces (forms/adapters/post-studio.ts) and a site's
// own post threads (the host's own FormActions).
// ============================================================================

import { emptyContentAnswers, type ContentFieldContext } from '@elkdonis/cms-ui/compose';
import type { Answers, FormContext, FormKindSchema } from '../../contract';
import { materialsSummary } from '../../fields/MaterialsRow';
import { POST_RULES } from '../../rules/post';
import type { KindLayout } from './parts';
import { goesOnRowSummary } from './parts';
import { AlsoShowOn, PostCover, PostExcerpt, PostGoesOn, PostMaterials, alsoShowOnSummary, excerptSummary, hasAlsoShowOn } from './sections';

/** The cms-ui context a post's fields are built with. */
export function postFieldContext(ctx: FormContext): ContentFieldContext {
  return { ...(ctx.fields as ContentFieldContext), defaultTimeZone: ctx.timeZone };
}

export function emptyPostAnswers(ctx: FormContext): Answers {
  return { ...emptyContentAnswers('post', postFieldContext(ctx)), also_on: [] };
}

export const POST_LAYOUT: KindLayout = {
  // inline: the Post body is the page's main surface, so its Canvas stays in the row (developer, 2026-11-12: popup is for the Meeting What row).
  body: { section: 'body', field: 'body', editor: 'blocks', inline: true },
  rows: [
    // The feed select takes the line; Public | Members drops under it below ~400px.
    { section: 'goesOn', row: 'goes-on', cells: { feed_slug: '1 1 260px', visibility: '0 1 auto' } },
  ],
};

export const postKind: FormKindSchema & { layout: KindLayout } = {
  id: 'post',
  label: () => 'New post',
  // The Studio's binding saves network writing pieces; a site's own post threads bind 'post'.
  codeKind: () => 'writing',
  sections: [
    // ── Essentials ──
    { id: 'title', label: 'Title', tier: 'essentials', fields: ['title'], quick: true },
    // The host's body slot (POST_LAYOUT.body). In focus mode the Canvas also writes body_doc, which wins on save.
    { id: 'body', label: 'What', tier: 'essentials', fields: ['body'], quick: true },
    { id: 'cover', label: 'Cover', tier: 'essentials', fields: ['cover_image_url'], render: 'postCover', quick: true, rowSummary: (a) => (typeof a.cover_image_url === 'string' && a.cover_image_url ? 'A cover picture' : undefined), rowPlaceholder: 'Add a picture' },
    { id: 'goesOn', label: 'Goes on', tier: 'essentials', fields: ['feed_slug', 'visibility'], render: 'goesOn', rowSummary: (a, ctx) => goesOnRowSummary(a, ctx) },
    // ── More ──
    { id: 'excerpt', label: 'Why', tier: 'more', fields: ['excerpt'], render: 'excerpt', summary: (a) => excerptSummary(a) },
    {
      id: 'alsoOn',
      label: 'Also show on',
      tier: 'more',
      fields: ['also_on', 'share_to_network'],
      render: 'alsoOn',
      summary: alsoShowOnSummary,
      when: (_a, ctx) => hasAlsoShowOn(ctx),
      // The home site and the profile are listed by default, so it already says something.
      done: () => true,
    },
  ],
  components: {
    postCover: PostCover,
    goesOn: PostGoesOn,
    excerpt: PostExcerpt,
    alsoOn: AlsoShowOn,
  },
  rules: POST_RULES,
  defaultOpen: () => ['alsoOn'],
  empty: emptyPostAnswers,
  deferred: [
    {
      id: 'tags',
      label: 'Tags',
      reason:
        'Pieces have no tags to store: StudioPatch has no tags (packages/studio/src/types.ts:125-138), writing.ts reads only the author’s org_profiles.tags (packages/services/src/writing.ts:312,349), and content-fields’ post kind declares none.',
      pass: 4,
    },
    {
      id: 'schedule',
      label: 'Schedule',
      reason:
        'Nothing publishes at a time: a piece is draft or published (StudioPatch.status, packages/studio/src/types.ts:137) and no job flips it later (PLAN §1.6, "schedule publish"). The top bar’s "Schedule…" goes with it.',
      pass: 4,
    },
    {
      id: 'poll',
      label: 'Poll or questions',
      reason:
        'Polls are org-scoped with no thread to attach to (createQuestionPoll inserts org_id, no thread_id: packages/services/src/question-polls.ts:44-51). The attached and standalone add-ons are pass 3.',
      pass: 3,
    },
    {
      id: 'cover-details',
      label: 'Cover alt text and focal point',
      reason:
        'A piece saves its cover URL only (StudioPatch.coverImageUrl, packages/studio/src/types.ts:125-138; content-fields’ media group has cover_image_url alone), so the design’s alt-text input and "Focal point" have nowhere to go.',
      pass: 4,
    },
  ],
  layout: POST_LAYOUT,
};

/**
 * A site's own post (2026-11-14): the post form saved as `threads.kind = 'post'` in one of the
 * site's feeds, through adapters/site-post.ts (services site-post-content.ts). The Studio's
 * postKind saves network writing pieces instead.
 */
export const sitePostKind: FormKindSchema & { layout: KindLayout } = {
  ...postKind,
  codeKind: () => 'post',
  sections: [
    ...postKind.sections,
    // Files attached to the post (services attachMaterials); drawn where the host passes slots.materials.
    {
      id: 'materials',
      label: 'Materials',
      tier: 'more',
      fields: ['materials'],
      render: 'postMaterials',
      summary: (a) => materialsSummary(a.materials),
      when: (_a, ctx) => ctx.fields.canAttachMaterials === true,
    },
  ],
  components: { ...postKind.components, postMaterials: PostMaterials },
};

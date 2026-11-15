// ============================================================================
// Post → a site's own post threads (2026-11-14): the second binding of the post
// kind (post-studio.ts is the first, for network writing pieces).
//
// A site's "post" is a `threads.kind = 'post'` row of that site's org, in one of
// its feeds (`section`), with the site's audience. This is what every org app's
// saveContentAction copy writes today; the shared save is services'
// site-post-content.ts (savePostContent / loadPostContent / removePostContent;
// its PostInput takes these input keys as they are), which the host binds as
// plain server functions below. Nothing here touches the database.
//
// Answer keys (the post kind's; kinds/post/schema.ts):
//   title, excerpt (Why), body (HTML), body_doc (the essay Canvas document, wins
//   over body), cover_image_url, feed_slug (→ section), visibility (+ min_role),
//   share_to_network.
// A field the form leaves out is left out of the input too, so the save keeps
// the stored value (meeting-content.ts made the same rule on 2026-11-14).
// ============================================================================

import type { StudioResult } from '../../types';
import type { Answers, FormActions, FormPreset } from '../contract';
import { presetFromAnswers } from '../presets';
import { readMaterials, type MaterialItem } from '../fields/MaterialsRow';

export type SitePostVisibility = 'PUBLIC' | 'ORGANIZATION' | 'INVITE_ONLY';
export type SitePostRole = 'viewer' | 'member' | 'guide' | 'owner';

/** What the shared save takes (services site-post-content.ts), in the services' camelCase. */
export interface SitePostInputView {
  title: string;
  /** "Why": the line under the title. Null clears it; left out keeps it. */
  excerpt?: string | null;
  /** HTML. Sent without bodyDoc it replaces the body and drops the stored document. */
  body?: string | null;
  /** The essay Canvas document; when set, the body is rendered from it. */
  bodyDoc?: unknown | null;
  coverImageUrl?: string | null;
  /** `org_feeds.slug`. */
  section?: string | null;
  visibility?: SitePostVisibility;
  minRole?: SitePostRole | null;
  /** thread-audience.ts words; the shared save lets it win over visibility and minRole. A loaded post carries it. */
  audience?: SitePostAudience;
  shareToNetwork?: boolean;
  /** media ids attached to the post (services attachMaterials). Left out: the attachments stay. */
  materialIds?: string[];
  /** A loaded post's attached files, for the Materials row (services PostRecord.input.materials). */
  materials?: MaterialItem[];
}

export type SitePostAudience = 'everyone' | 'followers' | 'members' | 'guides' | 'owners' | 'author';

/** A loaded post's audience → the form's visibility + min_role (thread-audience.ts audienceToStorage). */
function storageOf(i: SitePostInputView): { visibility: SitePostVisibility; minRole: SitePostRole | null } {
  if (i.visibility) return { visibility: i.visibility, minRole: i.minRole ?? null };
  switch (i.audience) {
    case 'followers': return { visibility: 'ORGANIZATION', minRole: null };
    case 'members': return { visibility: 'INVITE_ONLY', minRole: 'member' };
    case 'guides': return { visibility: 'INVITE_ONLY', minRole: 'guide' };
    case 'owners': return { visibility: 'INVITE_ONLY', minRole: 'owner' };
    case 'author': return { visibility: 'INVITE_ONLY', minRole: null };
    default: return { visibility: 'PUBLIC', minRole: null };
  }
}

export interface SitePostRecordView {
  id: string;
  orgId: string;
  slug: string;
  status: 'draft' | 'pending' | 'published' | 'archived' | string;
  publishedAt: string | null;
  updatedAt: string;
  /** The post's page on this site, for "View on site"; null when it has none yet. */
  href: string | null;
  input: SitePostInputView;
}

export interface SitePostContextView {
  canEdit: boolean;
  reason?: string | null;
  feeds: Array<{ slug: string; name: string }>;
  /** Whether "Also show on the network" is offered here. */
  canShareToNetwork?: boolean;
  /** Whether the audience can be set (Public | Members …); false hides it. */
  canSetVisibility?: boolean;
  [key: string]: unknown;
}

export interface SitePostActions {
  context(orgId: string): Promise<SitePostContextView>;
  loadPost(id: string): Promise<SitePostRecordView | null>;
  savePost(
    orgId: string,
    input: SitePostInputView,
    intent: 'draft' | 'published',
    id: string | null,
    opts?: { autosave?: boolean }
  ): Promise<StudioResult<{ record: SitePostRecordView; warnings?: string[] }>>;
  listPosts?(orgId: string): Promise<Array<{ id: string; title: string; status: string; updatedAt: string }>>;
}

const s = (v: unknown): string => (typeof v === 'string' ? v : '');
const orNull = (v: unknown): string | null => {
  const t = s(v).trim();
  return t ? t : null;
};
const has = (a: Answers, k: string) => Object.prototype.hasOwnProperty.call(a, k) && a[k] !== undefined;
const VIS: SitePostVisibility[] = ['PUBLIC', 'ORGANIZATION', 'INVITE_ONLY'];
const ROLES: SitePostRole[] = ['viewer', 'member', 'guide', 'owner'];

/** Form answers → the save's input. Keys the form never set stay out, so the save keeps them. */
export function sitePostInput(a: Answers): SitePostInputView {
  const input: SitePostInputView = { title: s(a.title).trim() || 'Untitled' };
  if (has(a, 'excerpt')) input.excerpt = orNull(a.excerpt);
  const doc = a.body_doc && typeof a.body_doc === 'object' ? a.body_doc : null;
  if (doc) input.bodyDoc = doc;
  else if (has(a, 'body')) input.body = s(a.body);
  if (has(a, 'cover_image_url')) input.coverImageUrl = orNull(a.cover_image_url);
  if (has(a, 'feed_slug')) input.section = orNull(a.feed_slug);
  if (has(a, 'visibility') && VIS.includes(a.visibility as SitePostVisibility)) input.visibility = a.visibility as SitePostVisibility;
  if (has(a, 'min_role')) input.minRole = ROLES.includes(a.min_role as SitePostRole) ? (a.min_role as SitePostRole) : null;
  if (has(a, 'share_to_network')) input.shareToNetwork = a.share_to_network === true;
  if (has(a, 'materials')) input.materialIds = readMaterials(a.materials).map((m) => m.id);
  return input;
}

/** A saved post → form answers. */
export function sitePostAnswers(r: SitePostRecordView): Answers {
  const i = r.input;
  return {
    kind: 'post',
    title: i.title,
    excerpt: i.excerpt ?? '',
    body: i.body ?? '',
    body_doc: i.bodyDoc && typeof i.bodyDoc === 'object' ? i.bodyDoc : undefined,
    cover_image_url: i.coverImageUrl ?? '',
    feed_slug: i.section ?? '',
    visibility: storageOf(i).visibility,
    min_role: storageOf(i).minRole,
    share_to_network: i.shareToNetwork === true,
    // Only when the load carried the files: an answer of [] would detach every attachment on save.
    ...(Array.isArray(i.materials) ? { materials: i.materials } : {}),
  };
}

/** The post kind's FormActions for a site's own posts. */
export function sitePostActions(actions: SitePostActions): FormActions<SitePostRecordView> {
  return {
    async context(orgId) {
      const c = await actions.context(orgId);
      // The Goes on row reads feeds and canSetVisibility; Also show on reads canShareToNetwork.
      return { ...c, feeds: c.feeds ?? [] };
    },
    async load(id) {
      const record = await actions.loadPost(id);
      return record ? { answers: sitePostAnswers(record), record } : null;
    },
    async save(orgId, answers, intent, id, opts) {
      const res = await actions.savePost(orgId, sitePostInput(answers), intent, id, { autosave: opts?.autosave === true });
      if (res.ok === false) return res;
      return { ok: true, value: { record: res.value.record, warnings: res.value.warnings ?? [] } };
    },
    async lastSettings(orgId): Promise<FormPreset | null> {
      if (!actions.listPosts) return null;
      const latest = (await actions.listPosts(orgId)).sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))[0];
      if (!latest) return null;
      const record = await actions.loadPost(latest.id);
      if (!record) return null;
      const a = sitePostAnswers(record);
      // Settings only: where it goes and who sees it, never the words.
      return presetFromAnswers('post', { feed_slug: a.feed_slug, visibility: a.visibility, share_to_network: a.share_to_network }, 'Your last post’s settings');
    },
  };
}

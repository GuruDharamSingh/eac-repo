/**
 * Completion checks — "is this done yet?" read from the platform's own tables.
 *
 * Moved from packages/services/src/onboarding-tasks.ts on 2026-11-06 with the
 * queries and wording unchanged; the host-specific hrefs that
 * apps/arts-collective/src/lib/lms/connectors.tsx used to fill in are built
 * here from `links`. Each check answers for ONE person, from live rows, and
 * never writes: a course records the completion, a hub only shows it.
 */
import { db } from '@elkdonis/db';
import { OFF_FEED_KINDS, ARTIST_SPACE_ORG_ID, hasGainedSpace, canManageOrgPeople } from '@elkdonis/services';
import type { ActionLinks, ActionStatus } from '../types';
import type { ChannelNextMove } from '../channel';
import { actionParams } from '../catalogue';
import { getPaathDayStatus, type PaathDayStatus } from '@elkdonis/services/paath-day';

/**
 * Readers a host passes in for entries whose state is computed by the host's own
 * model (2026-11-07). The registry does not import a host, so without the reader
 * the check says it cannot tell, rather than computing a second, different list.
 */
export interface ActionSources {
  /**
   * The next moves on a channel's board, most pressing first (arts-collective:
   * `channelNextSource` in src/lib/channel/next-source.ts, over the /channel loader).
   * `orgId` null = the person's own channel, which carries the orgs they run.
   */
  channelNext?: (q: { userId: string; orgId: string | null; limit: number }) => Promise<ChannelNextMove[]>;
}

export interface StatusContext {
  userId: string;
  /** The organisation an `org` entry reads; the host resolves it. */
  orgId?: string | null;
  links: ActionLinks;
  /** The step's choices (`settings.task.params`); checks read them through `actionParams`. */
  params?: Record<string, unknown> | null;
  /** A `thread` entry's subject: the post's id. */
  subjectId?: string | null;
  /** The day a routine step reads (YYYY-MM-DD); absent = today in the entry's own zone. */
  day?: string | null;
  /** Host readers (`channel-next`). */
  sources?: ActionSources;
}

/** Where the Akhand Path's day pages are (fourthwayBookreaders, basePath /books). */
const PAATH_BASE = (process.env.FOURTHWAY_BOOKREADERS_URL || 'https://elkdonis-arts.org/books').replace(/\/$/, '');
const paathHref = (s: PaathDayStatus) => `${PAATH_BASE}/akhand-path/day/${s.day}`;
const NOT_READER = 'You are not one of the Akhand Path’s readers.';
const dayWord = (s: PaathDayStatus) => (s.dayNumber > 0 ? `Day ${s.dayNumber}` : s.day);

type PostRow = { id: string; org_id: string; author_id: string | null; title: string; status: string; visibility: string; pinned: boolean; kind: string };

/** The named post, when the viewer may see its state: its author, or an owner or guide of its org. */
async function viewerPost(userId: string, subjectId: string | null | undefined): Promise<PostRow | null> {
  if (!subjectId) return null;
  const [t] = await db<PostRow[]>`
    SELECT id, org_id, author_id, title, status, visibility, pinned, kind FROM threads WHERE id = ${String(subjectId).slice(0, 64)} LIMIT 1
  `;
  if (!t || t.kind !== 'post' || t.status === 'archived') return null;
  if (t.author_id !== userId && !(await canManageOrgPeople(userId, t.org_id))) return null;
  return t;
}

/** Compose option id → the `threads.kind` it writes (cms-ui compose/catalogue.ts). */
const COMPOSE_THREAD_KIND: Record<string, string> = { article: 'post', event: 'event', meeting: 'meeting' };
const KIND_WORDS: Record<string, [string, string]> = { article: ['post', 'posts'], event: ['event', 'events'], meeting: ['meeting', 'meetings'] };

/** The marketplace org a person's store and works live in (commerce's journeys). */
const MARKET_ORG = 'market';

type UserRow = {
  display_name: string | null; avatar_url: string | null; headline: string | null; bio: string | null; slug: string | null;
  directory_listed: boolean | null; nextcloud_user_id: string | null; stripe_account_id: string | null; stripe_onboarded_at: Date | null;
  storage_folder: string | null;
};

async function user(userId: string): Promise<UserRow | null> {
  const [u] = await db<UserRow[]>`
    SELECT display_name, avatar_url, headline, bio, slug, directory_listed, nextcloud_user_id, stripe_account_id, stripe_onboarded_at, storage_folder
    FROM users WHERE id = ${userId} LIMIT 1
  `;
  return u ?? null;
}

async function orgSlug(orgId: string): Promise<string | null> {
  const [o] = await db<Array<{ slug: string }>>`SELECT slug FROM organizations WHERE id = ${orgId} LIMIT 1`;
  return o?.slug ?? null;
}

const none = (detail: string): ActionStatus => ({ done: false, detail });
const part = (detail: string): ActionStatus => ({ done: false, partial: true, detail });
const ok = (detail: string, href: string | null = null): ActionStatus => ({ done: true, detail, href });

type Check = (ctx: StatusContext) => Promise<ActionStatus>;

/** Org entries: the check, then where the org's console, mail suite or site is. */
const ORG_HREF: Record<string, (slug: string, links: ActionLinks) => string> = {
  'org-details': (slug, l) => `${l.hub}/hub/organization?org=${encodeURIComponent(slug)}`,
  'org-offering': (slug, l) => `${l.hub}/hub/organization?org=${encodeURIComponent(slug)}`,
  'org-people': (slug, l) => `${l.hub}/hub/organization?org=${encodeURIComponent(slug)}`,
  'org-email': (slug, l) => `${l.hub}/email?org=${encodeURIComponent(slug)}`,
  'org-publish': (slug, l) => `${l.hub}/hub/organization?org=${encodeURIComponent(slug)}`,
  'org-site': (slug, l) => `${l.networkHost.includes('localhost') ? 'http' : 'https'}://${slug}.${l.networkHost}/`,
};

export const CHECKS: Record<string, Check> = {
  async 'paath-read'({ userId, day }) {
    const s = await getPaathDayStatus(userId, day);
    if (!s) return none(NOT_READER);
    const { done, target } = s.read;
    const href = paathHref(s);
    if (done >= target) return ok(`${dayWord(s)}: ${done} ${done === 1 ? 'passage' : 'passages'} read.`, href);
    return { ...(done ? part(`${dayWord(s)}: ${done} of ${target} passages read.`) : none(`${dayWord(s)}: nothing read yet.`)), href };
  },
  async 'paath-record'({ userId, day }) {
    const s = await getPaathDayStatus(userId, day);
    if (!s) return none(NOT_READER);
    const n = s.record.files;
    return n ? ok(`${dayWord(s)}: ${n} ${n === 1 ? 'recording' : 'recordings'}.`, paathHref(s)) : { ...none(`${dayWord(s)}: no recording yet.`), href: paathHref(s) };
  },
  async 'paath-note'({ userId, day }) {
    const s = await getPaathDayStatus(userId, day);
    if (!s) return none(NOT_READER);
    return s.note.written ? ok(`${dayWord(s)}: the note is written.`, paathHref(s)) : { ...none(`${dayWord(s)}: no note yet.`), href: paathHref(s) };
  },
  async 'paath-publish'({ userId, day }) {
    const s = await getPaathDayStatus(userId, day);
    if (!s) return none(NOT_READER);
    const { done, pending, awaiting } = s.send;
    // Approval is in the reading page's admin details (/akhand-path), not on the day page.
    const href = `${PAATH_BASE}/akhand-path`;
    if (done && !pending && !awaiting) return ok(`${dayWord(s)}: on YouTube.`, href);
    if (done || pending) return { ...part(`${dayWord(s)}: ${done} sent, ${pending + awaiting} still to go.`), href };
    if (awaiting) return { ...part(`${dayWord(s)}: ${awaiting} waiting for approval.`), href };
    return { ...none(s.record.files ? `${dayWord(s)}: the recording has not reached the upload queue yet.` : `${dayWord(s)}: record first.`), href };
  },
  async profile({ userId }) {
    const u = await user(userId);
    if (!u) return none('No profile yet.');
    const values = { displayName: u.display_name ?? '', headline: u.headline ?? '', bio: u.bio ?? '' };
    const missing = [!u.display_name?.trim() && 'a name', !u.avatar_url && 'a photo', !u.headline?.trim() && 'a line about what you do'].filter(Boolean) as string[];
    const s = missing.length ? (missing.length === 3 ? none('Nothing filled in yet.') : part(`Still missing ${missing.join(', ')}.`)) : ok(`${u.display_name} — ${u.headline}`);
    return { ...s, values };
  },
  async 'gain-space'({ userId }) {
    if (await hasGainedSpace(userId)) return ok('You have your space: a folder of your own and a place in the directory.');
    return none('Not yet taken.');
  },
  async listing({ userId, links }) {
    const u = await user(userId);
    const values = { listed: u?.directory_listed ? 'true' : 'false' };
    if (!u?.slug) return { ...none('Your page has no address yet.'), values };
    if (!u.directory_listed) return { ...part('Your page exists but is not listed in the directory.'), values };
    return { ...ok(`Listed as /${u.slug}.`, `${links.artdirect.replace(/\/$/, '')}/${u.slug}`), values };
  },
  async studio({ userId }) {
    const [row] = await db<Array<{ n: number; published: number }>>`
      SELECT COUNT(*)::int AS n, COUNT(*) FILTER (WHERE status = 'published')::int AS published
      FROM threads WHERE kind = 'writing' AND author_id = ${userId}
    `;
    if (!row || row.n === 0) return none('Nothing written yet.');
    if (row.published === 0) return part(`${row.n} draft${row.n === 1 ? '' : 's'}, none published yet.`);
    return ok(`${row.published} piece${row.published === 1 ? '' : 's'} published.`);
  },
  async 'show-on'({ userId }) {
    const [row] = await db<Array<{ n: number }>>`
      SELECT COUNT(DISTINCT tt.org_id)::int AS n FROM thread_orgs tt
      JOIN threads t ON t.id = tt.thread_id
      WHERE t.author_id = ${userId} AND t.status = 'published' AND tt.org_id <> t.org_id
        AND tt.status = 'approved' -- migration 261: a pending or declined listing isn't shown there
    `;
    return row?.n ? ok(`Shown on ${row.n} site${row.n === 1 ? '' : 's'} besides your own.`) : none('Your pieces show only on your own page so far.');
  },
  async cloud({ userId }) {
    const u = await user(userId);
    if (u?.nextcloud_user_id) return ok('Your cloud sign-in is linked.');
    if (u?.storage_folder) return part('You have a folder; your cloud sign-in is not linked yet.');
    return none('Not linked yet.');
  },
  async service({ userId }) {
    const [row] = await db<Array<{ n: number; published: number }>>`
      SELECT COUNT(*)::int AS n, COUNT(*) FILTER (WHERE status = 'published')::int AS published
      FROM threads WHERE kind = 'service' AND org_id = ${ARTIST_SPACE_ORG_ID} AND author_id = ${userId}
    `;
    if (!row || row.n === 0) return none('No service offered yet.');
    if (row.published === 0) return part(`${row.n} draft${row.n === 1 ? '' : 's'}, none published.`);
    return ok(`${row.published} service${row.published === 1 ? '' : 's'} on your page.`);
  },
  async store({ userId }) {
    const [s] = await db<Array<{ status: string }>>`SELECT status FROM store WHERE owner_user_id = ${userId} AND org_id = ${MARKET_ORG} LIMIT 1`;
    if (!s) return none('No store yet.');
    if (s.status === 'active') return ok('Your store is open on the market.');
    if (s.status === 'pending') return part('Applied; the store is waiting to be opened.');
    return part(`Your store is ${s.status}.`);
  },
  async artwork({ userId }) {
    const [row] = await db<Array<{ n: number; live: number }>>`
      SELECT COUNT(*)::int AS n, COUNT(*) FILTER (WHERE status IN ('available', 'sold'))::int AS live
      FROM artwork WHERE artist_user_id = ${userId} AND org_id = ${MARKET_ORG}
    `;
    if (!row || row.n === 0) return none('No work listed yet.');
    if (row.live === 0) return part(`${row.n} draft${row.n === 1 ? '' : 's'}; a piece needs a photo to go up.`);
    return ok(`${row.live} work${row.live === 1 ? '' : 's'} on the market.`);
  },
  async payouts({ userId }) {
    const u = await user(userId);
    if (u?.stripe_onboarded_at) return ok('Payouts are set up.');
    if (u?.stripe_account_id) return part('Started with Stripe; not finished yet.');
    return none('Not set up.');
  },
  async org({ userId }) {
    const [o] = await db<Array<{ id: string; name: string; slug: string }>>`
      SELECT o.id, o.name, o.slug FROM organizations o JOIN user_organizations uo ON uo.org_id = o.id
      WHERE uo.user_id = ${userId} AND uo.role = 'owner' ORDER BY uo.joined_at DESC LIMIT 1
    `;
    return o ? ok(`${o.name} — ${o.slug}`) : none('No organisation of your own yet.');
  },
  async 'org-details'({ orgId }) {
    if (!orgId) return none('Start an organisation first.');
    const [o] = await db<Array<{ name: string; headline: string | null; bio: string | null; avatar_url: string | null }>>`
      SELECT o.name, u.headline, u.bio, u.avatar_url FROM organizations o LEFT JOIN users u ON u.id = o.profile_user_id WHERE o.id = ${orgId} LIMIT 1
    `;
    if (!o) return none('Start an organisation first.');
    const values = { headline: o.headline ?? '', bio: o.bio ?? '' };
    const missing = [!o.headline?.trim() && 'a line about it', !o.bio?.trim() && 'a description', !o.avatar_url && 'a logo or image'].filter(Boolean) as string[];
    const s = missing.length ? (missing.length === 3 ? none(`${o.name} has no details yet.`) : part(`Still missing ${missing.join(', ')}.`)) : ok(`${o.name}: ${o.headline}`);
    return { ...s, values };
  },
  async 'org-offering'({ orgId }) {
    if (!orgId) return none('Start an organisation first.');
    const [t] = await db<Array<{ title: string; pinned: boolean }>>`
      SELECT title, pinned FROM threads WHERE org_id = ${orgId} AND status = 'published' AND visibility = 'PUBLIC' AND kind <> ALL(${OFF_FEED_KINDS})
      ORDER BY pinned DESC, COALESCE(published_at, created_at) DESC LIMIT 1
    `;
    return t ? ok(`Leading with “${t.title}”${t.pinned ? ' (pinned)' : ''}.`) : none('Nothing published on the site yet.');
  },
  async 'org-people'({ userId, orgId }) {
    if (!orgId) return none('Start an organisation first.');
    const [row] = await db<Array<{ n: number }>>`
      SELECT COUNT(*)::int AS n FROM user_organizations WHERE org_id = ${orgId} AND role IN ('member', 'guide', 'owner') AND user_id <> ${userId}
    `;
    return row?.n ? ok(`${row.n} other ${row.n === 1 ? 'person' : 'people'} in it.`) : none('Just you so far.');
  },
  async 'org-email'({ orgId }) {
    if (!orgId) return none('Start an organisation first.');
    const [row] = await db<Array<{ from_name: string | null; reply_to: string | null }>>`
      SELECT value->>'fromName' AS from_name, value->>'replyTo' AS reply_to FROM site_config WHERE org_id = ${orgId} AND key = 'email:identity' LIMIT 1
    `;
    const values = { fromName: row?.from_name ?? '', replyTo: row?.reply_to ?? '' };
    if (!row) return { ...none('Mail from your organisation still goes out under the network’s name.'), values };
    if (row.from_name && row.reply_to) return { ...ok(`Sends as “${row.from_name}”, replies to ${row.reply_to}.`), values };
    return { ...part(row.from_name ? `Sends as “${row.from_name}”; no reply-to address yet.` : 'A reply-to address, but no sending name yet.'), values };
  },
  async 'org-publish'({ orgId, params }) {
    if (!orgId) return none('Start an organisation first.');
    const { kind } = actionParams('org-publish', params);
    const threadKind = COMPOSE_THREAD_KIND[kind];
    const [one, many] = KIND_WORDS[kind];
    const [row] = await db<Array<{ n: number; published: number }>>`
      SELECT COUNT(*)::int AS n, COUNT(*) FILTER (WHERE status = 'published')::int AS published
      FROM threads WHERE org_id = ${orgId} AND kind = ${threadKind} AND status IN ('draft', 'published')
    `;
    if (!row || row.n === 0) return none(`No ${one} on the site yet.`);
    if (row.published === 0) return part(`${row.n} draft ${row.n === 1 ? one : many}, none published yet.`);
    return ok(`${row.published} ${row.published === 1 ? one : many} published on the site.`);
  },
  async 'thread-publish'({ userId, subjectId }) {
    const t = await viewerPost(userId, subjectId);
    if (!t) return none('No post of yours is named.');
    return t.status === 'published' ? ok(`“${t.title}” is published.`) : none(`“${t.title}” is a ${t.status === 'draft' ? 'draft' : t.status}.`);
  },
  async 'thread-pin'({ userId, subjectId }) {
    const t = await viewerPost(userId, subjectId);
    if (!t) return none('No post of yours is named.');
    if (t.pinned) return ok(`“${t.title}” leads the site.`);
    return none(t.status === 'published' && t.visibility === 'PUBLIC' ? `“${t.title}” does not lead the site.` : 'Only a published public post can lead the site.');
  },
  async 'org-site'({ orgId }) {
    if (!orgId) return none('Start an organisation first.');
    const [o] = await db<Array<{ slug: string; subdomain_confirmed: boolean }>>`SELECT slug, subdomain_confirmed FROM organizations WHERE id = ${orgId} LIMIT 1`;
    if (!o) return none('Start an organisation first.');
    return o.subdomain_confirmed ? ok(`${o.slug} is live.`) : part(`${o.slug} is being set up; the collective confirms the address.`);
  },
  // Channel setup (2026-11-07): the three steps an onboarder like Katie takes before a first post.
  async 'channel-connect'({ userId, links }) {
    const href = `${links.hub}/channel/outlets?tab=instagram`;
    const rows = await db<Array<{ provider: string }>>`
      SELECT DISTINCT provider FROM user_connections
      WHERE user_id = ${userId} AND status = 'connected' AND provider IN ('meta', 'instagram', 'threads')
    `;
    if (rows.length === 0) return { ...none('No Instagram, Facebook or Threads account connected yet.'), href };
    const names = rows.map((r) => (r.provider === 'meta' ? 'Facebook and Instagram' : r.provider === 'instagram' ? 'Instagram' : 'Threads'));
    return ok(`Connected: ${names.join(', ')}.`, href);
  },
  async 'channel-org-channel'({ orgId, links }) {
    if (!orgId) return none('Start an organisation first.');
    const href = `${links.hub}/channel/outlets?org=${encodeURIComponent(orgId)}&tab=facebook`;
    const rows = await db<Array<{ label: string }>>`SELECT label FROM org_channels WHERE org_id = ${orgId} ORDER BY created_at LIMIT 3`;
    if (rows.length === 0) return { ...none('No Page or account is the organisation’s channel yet.'), href };
    return ok(`Posts go out through ${rows.map((r) => r.label || 'a connected account').join(', ')}.`, href);
  },
  async 'channel-first-post'({ userId, orgId, links }) {
    const href = `${links.hub}/channel/new${orgId ? `?org=${encodeURIComponent(orgId)}` : ''}`;
    const [row] = await db<Array<{ n: number }>>`
      SELECT COUNT(*)::int AS n FROM publish_jobs
      WHERE requested_by = ${userId} AND status = 'done' ${orgId ? db`AND org_id = ${orgId}` : db``}
    `;
    return row && row.n > 0 ? ok(`${row.n} post${row.n === 1 ? '' : 's'} sent.`, href) : { ...none('Nothing sent yet.'), href };
  },
  // The board's next moves, read through the host's reader (ActionSources). `orgId` is
  // the org channel settled by actionOrgId (owners and guides); null = the person's own.
  async 'channel-next'({ userId, orgId, links, sources }) {
    const href = `${links.hub}/channel${orgId ? `?org=${encodeURIComponent(orgId)}` : ''}`;
    if (!sources?.channelNext) return { ...none('This site cannot read the channel; open Channel to see what is next.'), href };
    const moves = await sources.channelNext({ userId, orgId: orgId ?? null, limit: 5 });
    if (!moves.length) return ok('Nothing is waiting in the channel.', href);
    const top = moves[0];
    const more = moves.length > 1 ? ` (and ${moves.length - 1} more)` : '';
    return { done: false, partial: true, detail: `Next: ${top.title}${top.reason ? ` · ${top.reason}` : ''}${more}`, href, next: moves };
  },
};

/**
 * One entry's status for one person. Unknown ids are never done, so a course
 * can name an entry before this installation has it. Never throws.
 */
export async function actionStatus(id: string, ctx: StatusContext): Promise<ActionStatus> {
  const check = CHECKS[id];
  if (!check) return none('This step is not known to this site yet.');
  try {
    const s = await check(ctx);
    const orgHref = ORG_HREF[id];
    if (orgHref && ctx.orgId) {
      const slug = await orgSlug(ctx.orgId);
      if (slug) s.href = orgHref(slug, ctx.links);
    }
    return s;
  } catch (err) {
    console.error('[actions] status:', id, err);
    return { done: false, detail: null };
  }
}

/** Every entry with a check at once, for a checklist. */
export async function actionStatuses(ids: readonly string[], ctx: StatusContext): Promise<Record<string, ActionStatus>> {
  const entries = await Promise.all(ids.map(async (id) => [id, await actionStatus(id, ctx)] as const));
  return Object.fromEntries(entries);
}

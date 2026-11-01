/**
 * Onboarding tasks — "is this done yet?" read from the platform's own tables.
 *
 * One vocabulary of task ids, shared by the getting-started course (a `task`
 * step in @elkdonis/lms carries one of these ids) and any checklist a hub
 * wants to draw. Each lookup answers for ONE person, from live rows, and
 * never writes: the course records the completion; the hub only shows it.
 * Org tasks take the organisation the person owns (getOwnedOrgId) unless the
 * caller names one they may manage.
 *
 * Add a task here, then teach the host's task box how to open it; the
 * course text only needs the id. (claude, 2026-10-29)
 */
import { db } from '@elkdonis/db';
import { OFF_FEED_KINDS } from './thread-kinds';
import { ARTIST_SPACE_ORG_ID, hasGainedSpace } from './artist-membership';

export const ONBOARDING_TASK_IDS = [
  'profile', 'gain-space', 'listing', 'studio', 'show-on', 'cloud',
  'service', 'store', 'artwork', 'payouts',
  'org', 'org-details', 'org-offering', 'org-people', 'org-email', 'org-site',
] as const;
export type OnboardingTaskId = (typeof ONBOARDING_TASK_IDS)[number];
export const ORG_TASK_IDS = new Set<string>(['org-details', 'org-offering', 'org-people', 'org-email', 'org-site']);

export interface OnboardingTaskStatus {
  done: boolean;
  /** Begun, not finished. */
  partial?: boolean;
  /** One line for the person: what is there, or what is missing. */
  detail?: string | null;
  /** Where the finished thing lives. Hosts fill in the origin. */
  href?: string | null;
}

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

const none = (detail: string): OnboardingTaskStatus => ({ done: false, detail });
const part = (detail: string): OnboardingTaskStatus => ({ done: false, partial: true, detail });
const ok = (detail: string, href: string | null = null): OnboardingTaskStatus => ({ done: true, detail, href });

/**
 * One task for one person. `orgId` is the organisation an org task reads;
 * callers resolve it (getOwnedOrgId, or a `?org=` the person may manage).
 * Unknown ids are never done, so a course can name a task before it exists.
 */
export async function getOnboardingTaskStatus(taskId: string, userId: string, opts: { orgId?: string | null } = {}): Promise<OnboardingTaskStatus> {
  const orgId = opts.orgId ?? null;
  switch (taskId as OnboardingTaskId) {
    case 'profile': {
      const u = await user(userId);
      if (!u) return none('No profile yet.');
      const missing = [!u.display_name?.trim() && 'a name', !u.avatar_url && 'a photo', !u.headline?.trim() && 'a line about what you do'].filter(Boolean) as string[];
      return missing.length ? (missing.length === 3 ? none('Nothing filled in yet.') : part(`Still missing ${missing.join(', ')}.`)) : ok(`${u.display_name} — ${u.headline}`);
    }
    case 'gain-space': {
      if (await hasGainedSpace(userId)) return ok('You have your space: a folder of your own and a place in the directory.');
      return none('Not yet taken.');
    }
    case 'listing': {
      const u = await user(userId);
      if (!u?.slug) return none('Your page has no address yet.');
      if (!u.directory_listed) return part('Your page exists but is not listed in the directory.');
      return ok(`Listed as /${u.slug}.`, `/${u.slug}`);
    }
    case 'studio': {
      const [row] = await db<Array<{ n: number; published: number }>>`
        SELECT COUNT(*)::int AS n, COUNT(*) FILTER (WHERE status = 'published')::int AS published
        FROM threads WHERE kind = 'writing' AND author_id = ${userId}
      `;
      if (!row || row.n === 0) return none('Nothing written yet.');
      if (row.published === 0) return part(`${row.n} draft${row.n === 1 ? '' : 's'}, none published yet.`);
      return ok(`${row.published} piece${row.published === 1 ? '' : 's'} published.`);
    }
    case 'show-on': {
      const [row] = await db<Array<{ n: number }>>`
        SELECT COUNT(DISTINCT tt.org_id)::int AS n FROM thread_orgs tt
        JOIN threads t ON t.id = tt.thread_id
        WHERE t.author_id = ${userId} AND t.status = 'published' AND tt.org_id <> t.org_id
      `;
      return row?.n ? ok(`Shown on ${row.n} site${row.n === 1 ? '' : 's'} besides your own.`) : none('Your pieces show only on your own page so far.');
    }
    case 'cloud': {
      const u = await user(userId);
      if (u?.nextcloud_user_id) return ok('Your cloud sign-in is linked.');
      if (u?.storage_folder) return part('You have a folder; your cloud sign-in is not linked yet.');
      return none('Not linked yet.');
    }
    case 'service': {
      const [row] = await db<Array<{ n: number; published: number }>>`
        SELECT COUNT(*)::int AS n, COUNT(*) FILTER (WHERE status = 'published')::int AS published
        FROM threads WHERE kind = 'service' AND org_id = ${ARTIST_SPACE_ORG_ID} AND author_id = ${userId}
      `;
      if (!row || row.n === 0) return none('No service offered yet.');
      if (row.published === 0) return part(`${row.n} draft${row.n === 1 ? '' : 's'}, none published.`);
      return ok(`${row.published} service${row.published === 1 ? '' : 's'} on your page.`);
    }
    case 'store': {
      const [s] = await db<Array<{ status: string }>>`SELECT status FROM store WHERE owner_user_id = ${userId} AND org_id = ${MARKET_ORG} LIMIT 1`;
      if (!s) return none('No store yet.');
      if (s.status === 'active') return ok('Your store is open on the market.');
      if (s.status === 'pending') return part('Applied; the store is waiting to be opened.');
      return part(`Your store is ${s.status}.`);
    }
    case 'artwork': {
      const [row] = await db<Array<{ n: number; live: number }>>`
        SELECT COUNT(*)::int AS n, COUNT(*) FILTER (WHERE status IN ('available', 'sold'))::int AS live
        FROM artwork WHERE artist_user_id = ${userId} AND org_id = ${MARKET_ORG}
      `;
      if (!row || row.n === 0) return none('No work listed yet.');
      if (row.live === 0) return part(`${row.n} draft${row.n === 1 ? '' : 's'}; a piece needs a photo to go up.`);
      return ok(`${row.live} work${row.live === 1 ? '' : 's'} on the market.`);
    }
    case 'payouts': {
      const u = await user(userId);
      if (u?.stripe_onboarded_at) return ok('Payouts are set up.');
      if (u?.stripe_account_id) return part('Started with Stripe; not finished yet.');
      return none('Not set up.');
    }
    case 'org': {
      const [o] = await db<Array<{ id: string; name: string; slug: string }>>`
        SELECT o.id, o.name, o.slug FROM organizations o JOIN user_organizations uo ON uo.org_id = o.id
        WHERE uo.user_id = ${userId} AND uo.role = 'owner' ORDER BY uo.joined_at DESC LIMIT 1
      `;
      return o ? ok(`${o.name} — ${o.slug}`) : none('No organisation of your own yet.');
    }
    case 'org-details': {
      if (!orgId) return none('Start an organisation first.');
      const [o] = await db<Array<{ name: string; headline: string | null; bio: string | null; avatar_url: string | null }>>`
        SELECT o.name, u.headline, u.bio, u.avatar_url FROM organizations o LEFT JOIN users u ON u.id = o.profile_user_id WHERE o.id = ${orgId} LIMIT 1
      `;
      if (!o) return none('Start an organisation first.');
      const missing = [!o.headline?.trim() && 'a line about it', !o.bio?.trim() && 'a description', !o.avatar_url && 'a logo or image'].filter(Boolean) as string[];
      return missing.length ? (missing.length === 3 ? none(`${o.name} has no details yet.`) : part(`Still missing ${missing.join(', ')}.`)) : ok(`${o.name}: ${o.headline}`);
    }
    case 'org-offering': {
      if (!orgId) return none('Start an organisation first.');
      const [t] = await db<Array<{ title: string; pinned: boolean }>>`
        SELECT title, pinned FROM threads WHERE org_id = ${orgId} AND status = 'published' AND visibility = 'PUBLIC' AND kind <> ALL(${OFF_FEED_KINDS})
        ORDER BY pinned DESC, COALESCE(published_at, created_at) DESC LIMIT 1
      `;
      return t ? ok(`Leading with “${t.title}”${t.pinned ? ' (pinned)' : ''}.`) : none('Nothing published on the site yet.');
    }
    case 'org-people': {
      if (!orgId) return none('Start an organisation first.');
      const [row] = await db<Array<{ n: number }>>`
        SELECT COUNT(*)::int AS n FROM user_organizations WHERE org_id = ${orgId} AND role IN ('member', 'guide', 'owner') AND user_id <> ${userId}
      `;
      return row?.n ? ok(`${row.n} other ${row.n === 1 ? 'person' : 'people'} in it.`) : none('Just you so far.');
    }
    case 'org-email': {
      if (!orgId) return none('Start an organisation first.');
      const [row] = await db<Array<{ from_name: string | null; reply_to: string | null }>>`
        SELECT value->>'fromName' AS from_name, value->>'replyTo' AS reply_to FROM site_config WHERE org_id = ${orgId} AND key = 'email:identity' LIMIT 1
      `;
      if (!row) return none('Mail from your organisation still goes out under the network’s name.');
      if (row.from_name && row.reply_to) return ok(`Sends as “${row.from_name}”, replies to ${row.reply_to}.`);
      return part(row.from_name ? `Sends as “${row.from_name}”; no reply-to address yet.` : 'A reply-to address, but no sending name yet.');
    }
    case 'org-site': {
      if (!orgId) return none('Start an organisation first.');
      const [o] = await db<Array<{ slug: string; subdomain_confirmed: boolean }>>`SELECT slug, subdomain_confirmed FROM organizations WHERE id = ${orgId} LIMIT 1`;
      if (!o) return none('Start an organisation first.');
      return o.subdomain_confirmed ? ok(`${o.slug} is live.`) : part(`${o.slug} is being set up; the collective confirms the address.`);
    }
    default:
      return none('This step is not known to this site yet.');
  }
}

/** Every task at once, for a checklist. */
export async function getOnboardingTaskStatuses(userId: string, opts: { orgId?: string | null } = {}): Promise<Record<OnboardingTaskId, OnboardingTaskStatus>> {
  const entries = await Promise.all(ONBOARDING_TASK_IDS.map(async (id) => [id, await getOnboardingTaskStatus(id, userId, opts)] as const));
  return Object.fromEntries(entries) as Record<OnboardingTaskId, OnboardingTaskStatus>;
}

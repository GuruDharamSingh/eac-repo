// "Which one?" readers of wiring wave 1 (2026-11-27, rails desk lane F): the lists a pick field shows, for one person.
// Each reader returns the person's own things only. Lane E registers these in server/forms.ts `FORM_READERS`
// (adapt the wrapper if its signature differs; the bodies are the part that matters).
import { db } from '@elkdonis/db';

export interface Wave1PickItem { id: string; label: string; hint?: string }
export type Wave1Reader = (ctx: { userId: string; orgId?: string | null }) => Promise<{ items: Wave1PickItem[] }>;

async function penNames(userId: string, retired: boolean): Promise<Wave1PickItem[]> {
  const rows = await db<Array<{ id: string; display_name: string; slug: string | null }>>`
    SELECT u.id, u.display_name, u.slug FROM identity_control c JOIN users u ON u.id = c.identity_id
    WHERE c.account_id = ${userId} AND c.relation = 'pseudonym' AND (c.retired_at IS NOT NULL) = ${retired}
    ORDER BY u.display_name
  `;
  return rows.map((r) => ({ id: r.id, label: r.display_name, ...(r.slug ? { hint: `/${r.slug}` } : {}) }));
}

export const READERS_WAVE1: Record<string, Wave1Reader> = {
  'pen-names-active': async ({ userId }) => ({ items: await penNames(userId, false) }),
  'pen-names-retired': async ({ userId }) => ({ items: await penNames(userId, true) }),
  // Where the person may post: their own blog, and each feed they may post in (services listPostTargets).
  'post-targets': async ({ userId }) => {
    const { listPostTargets, PERSONAL_ORG_ID } = await import('@elkdonis/services');
    const targets = await listPostTargets(userId, { blogOrgId: PERSONAL_ORG_ID });
    return { items: targets.map((t) => ({ id: t.value, label: t.kind === 'blog' ? 'My own blog' : `${t.orgName}: ${t.feedName}` })) };
  },
};

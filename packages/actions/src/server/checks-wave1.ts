// Status checks of wiring wave 1 (2026-11-27, rails desk lane F): "is this done yet?" for one person, from live
// rows, never writing. Spread into CHECKS in ./status.ts. `values` prefill the form.
import { db } from '@elkdonis/db';
import type { ActionStatus } from '../types';
import type { StatusContext } from './status';

type Check = (ctx: StatusContext) => Promise<ActionStatus>;
const none = (detail: string): ActionStatus => ({ done: false, detail });
const ok = (detail: string): ActionStatus => ({ done: true, detail });

export const CHECKS_WAVE1: Record<string, Check> = {
  async 'profile-photo'({ userId }) {
    const [u] = await db<Array<{ avatar_url: string | null }>>`SELECT avatar_url FROM users WHERE id = ${userId} LIMIT 1`;
    const values = { avatarUrl: u?.avatar_url ?? '' };
    return u?.avatar_url ? { ...ok('You have a profile photo.'), values } : { ...none('No profile photo yet.'), values };
  },
  // Done once the blog or the store is switched on for the person's own page (users.profile_sections).
  async 'profile-sections'({ userId }) {
    const [u] = await db<Array<{ s: Record<string, unknown> | null }>>`SELECT profile_sections AS s FROM users WHERE id = ${userId} LIMIT 1`;
    const on = (k: string) => u?.s?.[k] === true || u?.s?.[k] === 'true';
    const values = { blog: on('blog') ? 'true' : 'false', store: on('store') ? 'true' : 'false' };
    const shown = ['blog', 'store'].filter(on);
    return shown.length ? { ...ok(`On your page: ${shown.join(' and ')}.`), values } : { ...none('Neither the blog nor the store is on your page.'), values };
  },
  // Retire: done when the person has a retired pen name. Restore: done when they have pen names and none is waiting.
  async 'pen-name-retire'({ userId }) {
    const [row] = await db<Array<{ active: number; retired: number }>>`
      SELECT COUNT(*) FILTER (WHERE retired_at IS NULL)::int AS active, COUNT(*) FILTER (WHERE retired_at IS NOT NULL)::int AS retired
      FROM identity_control WHERE account_id = ${userId} AND relation = 'pseudonym'
    `;
    if (row?.retired) return ok(`${row.retired} pen ${row.retired === 1 ? 'name' : 'names'} retired.`);
    return none(row?.active ? `${row.active} active pen ${row.active === 1 ? 'name' : 'names'}; none retired.` : 'You have no pen name to retire.');
  },
  async 'pen-name-restore'({ userId }) {
    const [row] = await db<Array<{ active: number; retired: number }>>`
      SELECT COUNT(*) FILTER (WHERE retired_at IS NULL)::int AS active, COUNT(*) FILTER (WHERE retired_at IS NOT NULL)::int AS retired
      FROM identity_control WHERE account_id = ${userId} AND relation = 'pseudonym'
    `;
    if (row?.retired) return none(`${row.retired} retired pen ${row.retired === 1 ? 'name' : 'names'} you can bring back.`);
    return row?.active ? ok('Every pen name you have is showing.') : none('You have no pen name to bring back.');
  },
  async 'post-anywhere'({ userId }) {
    const [row] = await db<Array<{ n: number }>>`
      SELECT COUNT(*)::int AS n FROM threads WHERE author_id = ${userId} AND kind = 'post' AND status = 'published'
    `;
    return row?.n ? ok(`${row.n} post${row.n === 1 ? '' : 's'} published.`) : none('No post published yet.');
  },
};

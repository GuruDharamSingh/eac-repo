/**
 * nc-forum.mts — operate the Nextcloud Forum ↔ org forum mirror (migration 144).
 *
 * Run inside an app container (needs NEXTCLOUD_* and DATABASE_URL):
 *   docker compose exec innergathering node node_modules/.pnpm/tsx@4.20.6/node_modules/tsx/dist/cli.mjs scripts/nc-forum.mts <cmd>
 *
 *   categories                         list NC forum categories
 *   provision <orgId> [--public]       give an org its self-titled, Team-scoped category
 *   move <orgId> <catIds> [threadIds]  move NC threads (by category, and/or by id) into the org's
 *   sync [orgId]                       run the inbound sync now (all linked orgs if omitted)
 */
import {
  ensureOrgNcCategory,
  listNcCategories,
  moveNcThreadsToOrg,
  runNcForumSyncTick,
  syncOrgNcForum,
} from '../packages/services/src/nc-forum.ts';

const [cmd, a, b] = process.argv.slice(2);
const out = (x: unknown) => console.log(JSON.stringify(x, null, 2));

switch (cmd) {
  case 'categories': out(await listNcCategories()); break;
  case 'provision': out(await ensureOrgNcCategory(a, { isPublic: process.argv.includes('--public') })); break;
  case 'move': {
    const ids = (v?: string) => (v && v !== '-' ? v.split(',').map(Number) : []);
    out(await moveNcThreadsToOrg(a, { fromCategoryIds: ids(b), threadIds: ids(process.argv[5]) }));
    break;
  }
  case 'sync': out(a ? await syncOrgNcForum(a) : await runNcForumSyncTick()); break;
  default:
    console.error('usage: nc-forum.mts categories | provision <orgId> [--public] | move <orgId> <catIds> | sync [orgId]');
    process.exit(1);
}
process.exit(0);

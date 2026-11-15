// Refusals of the site Channel door (2026-11-14). Every case here is refused before
// performAction runs, so nothing is written (no action_events row, no Channel rows).
import { performSiteChannelAction } from '../src/server/site-channel-door';

const site = { orgId: 'katie-the-potter' };
const stranger = { userId: '00000000-0000-4000-8000-000000000000', email: 'nobody@test.invalid' };
const cases: Array<[string, Promise<{ ok: boolean; code?: string }>, string]> = [
  ['no actor', performSiteChannelAction(site, null, 'channel-plan', {}), 'auth'],
  ['org entry', performSiteChannelAction(site, stranger, 'org-publish', {}), 'unknown'],
  ['channel read entry', performSiteChannelAction(site, stranger, 'channel-next', {}), 'unknown'],
  ['outside host allow', performSiteChannelAction(site, stranger, 'channel-suggestion-dismiss', {}, { allow: ['channel-plan'] }), 'unknown'],
  ['not an owner or guide', performSiteChannelAction(site, stranger, 'channel-plan', {}), 'forbidden'],
  ['personal org', performSiteChannelAction({ orgId: 'oad' }, stranger, 'channel-plan', {}), 'forbidden'],
];
let fail = 0;
for (const [name, p, want] of cases) {
  const r = await p;
  const ok = r.ok === false && r.code === want;
  if (!ok) fail++;
  console.log(ok ? 'PASS' : 'FAIL', name, JSON.stringify(r));
}
console.log(`${cases.length - fail}/${cases.length}`);
process.exit(fail ? 1 : 0);

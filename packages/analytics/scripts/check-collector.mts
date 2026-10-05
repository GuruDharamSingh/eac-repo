// Drives the collector and the dashboard queries against a SCRATCH database.
// Refuses to run unless the database name contains "scratch": the collector
// writes rows, and elkdonis_dev is the production database.
//
//   DATABASE_URL=postgres://…/analytics_scratch INTER_APP_JWT_SECRET=x pnpm check:collector
import assert from 'node:assert/strict';

const url = process.env.DATABASE_URL ?? '';
if (!/scratch/.test(new URL(url).pathname)) {
  console.error('check-collector: DATABASE_URL must point at a database whose name contains "scratch".');
  process.exit(2);
}
process.env.INTER_APP_JWT_SECRET ||= 'check-collector-secret';

const { db } = await import('@elkdonis/db');
const { recordCollect, getDashboardData, visitorId, getAnalyticsAccess, chooseScope, getAuthorInsights, getFunnel, getJourneys } = await import('../src/server');

const CHROME = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const HOST = 'amritcanada.ca';
const uuid = () => crypto.randomUUID();

const suffix = Math.random().toString(36).slice(2, 8);
const org = `t_org_${suffix}`;
const privOrg = `t_priv_${suffix}`;
const userId = uuid();
const authId = userId; // users.auth_user_id must equal users.id

await db`INSERT INTO organizations (id, name, slug) VALUES (${org}, 'Test Org', ${org}), (${privOrg}, 'Private Org', ${privOrg})`;
await db`INSERT INTO org_domains (domain, org_id, is_primary, verified_at) VALUES (${HOST}, ${org}, true, now())
         ON CONFLICT (domain) DO UPDATE SET org_id = ${org}`;
await db`INSERT INTO users (id, auth_user_id, email, display_name) VALUES (${userId}, ${authId}, ${`t_${suffix}@example.test`}, 'Test Person')`;
const pubThread = `pub${suffix}`.slice(0, 21);
const privThread = `prv${suffix}`.slice(0, 21);
for (const [id, vis] of [[pubThread, 'PUBLIC'], [privThread, 'ORGANIZATION']] as const) {
  await db`INSERT INTO threads (id, org_id, author_id, kind, title, slug, status, visibility)
           VALUES (${id}, ${org}, ${userId}, 'blog', ${`Post ${id}`}, ${id}, 'published', ${vis})`;
}

const opts = { defaultOrgId: org, privateOrgIds: [privOrg] };
const base = { host: HOST, ip: '203.0.113.7', userAgent: CHROME, userId: null as string | null };
const send = (over: Record<string, unknown>, req: Partial<typeof base> = {}) =>
  recordCollect({ ...base, ...req, payload: { type: 'pageview', id: uuid(), path: '/', ...over } as never }, opts);
const rows = (where = '') => db<Array<Record<string, any>>>`SELECT * FROM analytics_events WHERE org_id IN (${org}, ${privOrg}) ORDER BY occurred_at, id`;

let failures = 0;
const check = async (name: string, fn: () => Promise<void>) => {
  try { await fn(); console.log('ok   ', name); } catch (e) { failures++; console.error('FAIL ', name, '\n     ', (e as Error).message); }
};

try {
  await check('bot user agents are ignored', async () => {
    assert.equal(await send({ path: '/' }, { userAgent: 'Googlebot/2.1 (+http://www.google.com/bot.html)' }), 'ignored');
    assert.equal(await send({ path: '/' }, { userAgent: '' }), 'ignored');
  });

  await check('management and sign-in paths are ignored', async () => {
    for (const p of ['/manage', '/manage/people', '/login', '/api/x', '/hub/admin/ledger']) assert.equal(await send({ path: p }), 'ignored', p);
  });

  const firstId = uuid();
  await check('first page view starts a visit with source, device and org', async () => {
    assert.equal(await send({ id: firstId, path: '/about/?utm_x=1', referrer: 'https://www.google.com/', search: '?utm_source=news&utm_campaign=fall' }), 'recorded');
    const [r] = await db`SELECT * FROM analytics_events WHERE id = ${firstId}`;
    assert.equal(r.org_id, org);
    assert.equal(r.path, '/about');
    assert.equal(r.is_entry, true);
    assert.equal(r.session_id, firstId);
    assert.equal(r.source_kind, 'search');
    assert.equal(r.referrer_host, 'google.com');
    assert.equal(r.utm_source, 'news'); assert.equal(r.utm_campaign, 'fall');
    assert.equal(r.device, 'desktop'); assert.equal(r.browser, 'Chrome'); assert.equal(r.os, 'Linux');
    assert.ok(!('ip' in r));
  });

  await check('a second page view continues the same visit', async () => {
    const id = uuid();
    await send({ id, path: '/events', referrer: `https://${HOST}/about` });
    const [r] = await db`SELECT * FROM analytics_events WHERE id = ${id}`;
    assert.equal(r.is_entry, false);
    assert.equal(r.session_id, firstId);
    assert.equal(r.source_kind, 'direct', 'own-site referrer is not a source');
    assert.equal(r.referrer_host, null);
  });

  await check('leave records the largest visible duration', async () => {
    await send({ type: 'leave', id: firstId, duration: 4000 });
    await send({ type: 'leave', id: firstId, duration: 9000 });
    await send({ type: 'leave', id: firstId, duration: 2000 });
    const [r] = await db`SELECT duration_ms FROM analytics_events WHERE id = ${firstId}`;
    assert.equal(r.duration_ms, 9000);
  });

  await check('a public thread is attributed; a non-public thread drops its path', async () => {
    const a = uuid(); const b = uuid();
    await send({ id: a, path: '/posts/hello', thread: pubThread, referrer: 'https://arts-collective.com/' }, { ip: '192.0.2.9' }); // own visit: sources count visit entries only
    await send({ id: b, path: '/posts/members-only', thread: privThread, referrer: 'https://example.org/x', search: '?utm_source=leak' });
    const [pa] = await db`SELECT * FROM analytics_events WHERE id = ${a}`;
    const [pb] = await db`SELECT * FROM analytics_events WHERE id = ${b}`;
    assert.equal(pa.thread_id, pubThread); assert.equal(pa.path, '/posts/hello'); assert.equal(pa.source_kind, 'network');
    assert.equal(pb.is_private, true); assert.equal(pb.thread_id, null); assert.equal(pb.path, null);
    assert.equal(pb.referrer_host, null); assert.equal(pb.utm_source, null);
  });

  await check('a private-by-default org records no path', async () => {
    const privHost = `priv-${suffix}.example.test`;
    await db`INSERT INTO org_domains (domain, org_id, is_primary, verified_at) VALUES (${privHost}, ${privOrg}, true, now())`;
    const id = uuid();
    await recordCollect({ ...base, host: privHost, payload: { type: 'pageview', id, path: '/inner/page', referrer: 'https://example.org/' } }, opts);
    const [r] = await db`SELECT * FROM analytics_events WHERE id = ${id}`;
    assert.equal(r.org_id, privOrg); assert.equal(r.is_private, true);
    assert.equal(r.path, null); assert.equal(r.referrer_host, null);
    assert.equal(r.device, 'desktop', 'device still recorded');
  });

  await check('named events keep clean props only', async () => {
    const id = uuid();
    await send({ type: 'event', id, path: '/events', name: 'rsvp', props: { seats: 2, note: 'x'.repeat(500), nested: { a: 1 } as never } });
    const [r] = await db`SELECT * FROM analytics_events WHERE id = ${id}`;
    assert.equal(r.kind, 'event'); assert.equal(r.name, 'rsvp');
    assert.equal(r.props.seats, 2); assert.equal(r.props.note.length, 200); assert.ok(!('nested' in r.props));
    assert.equal(await send({ type: 'event', path: '/', name: 'bad name!<script>' }), 'ignored');
  });

  await check('signed-in visits update users and user_site_visits', async () => {
    const ua = { userAgent: IPHONE, userId, ip: '198.51.100.4' };
    await send({ path: '/one' }, ua); await send({ path: '/two' }, ua);
    const [u] = await db`SELECT last_seen_at FROM users WHERE id = ${userId}`;
    assert.ok(Date.now() - new Date(u.last_seen_at).getTime() < 60_000);
    const [v] = await db`SELECT * FROM user_site_visits WHERE user_id = ${userId} AND org_id = ${org}`;
    assert.equal(v.visit_count, 1); assert.equal(v.page_count, 2);
  });

  await check('visitor ids are stable within a day, differ by ip, host and secret', async () => {
    const a = visitorId('1.1.1.1', CHROME, 'a.test');
    assert.equal(a, visitorId('1.1.1.1', CHROME, 'a.test'));
    assert.notEqual(a, visitorId('1.1.1.2', CHROME, 'a.test'));
    assert.notEqual(a, visitorId('1.1.1.1', CHROME, 'b.test'));
    assert.notEqual(a, visitorId('1.1.1.1', CHROME, 'a.test', new Date(Date.now() + 86_400_000)));
    assert.ok(!a!.includes('1.1.1.1'));
  });

  await check('dashboard queries return consistent totals', async () => {
    const d = await getDashboardData({ scope: { orgId: org }, range: '7d', includePeople: true });
    const pv = (await db`SELECT count(*)::int c FROM analytics_events WHERE org_id = ${org} AND kind = 'pageview'`)[0].c;
    assert.equal(d.totals.pageviews, pv);
    assert.ok(d.totals.visits >= 2 && d.totals.visitors >= 2, 'd.totals.visits >= 2 && d.totals.visitors >= 2');
    assert.ok(d.totals.bounceRate >= 0 && d.totals.bounceRate <= 1, 'd.totals.bounceRate >= 0 && d.totals.bounceRate <= 1');
    assert.equal(d.daily.reduce((s, r) => s + r.pageviews, 0), pv);
    assert.equal(d.hours.length, 24); assert.equal(d.weekdays.length, 7);
    assert.ok(d.pages.some((p) => p.threadId === pubThread && p.title === `Post ${pubThread}`), 'd.pages.some((p) => p.threadId === pubThread && p.title === `Post ${pubThread}`)');
    assert.ok(!d.pages.some((p) => p.path === '/posts/members-only'), "!d.pages.some((p) => p.path === '/posts/members-only')");
    assert.ok(d.privateViews >= 1, 'd.privateViews >= 1');
    assert.ok(d.sources.some((s) => s.kind === 'search') && d.sources.some((s) => s.kind === 'network'), "d.sources.some((s) => s.kind === 'search') && d.sources.some((s) => s.kind === 'network')");
    assert.ok(d.campaigns.some((c) => c.campaign === 'fall'), "d.campaigns.some((c) => c.campaign === 'fall')");
    assert.ok(d.events.some((e) => e.name === 'rsvp'), "d.events.some((e) => e.name === 'rsvp')");
    assert.ok(d.devices.some((x) => x.label === 'mobile'), "d.devices.some((x) => x.label === 'mobile')");
    assert.equal(d.people?.[0]?.name, 'Test Person');
    const net = await getDashboardData({ scope: { network: true }, range: '30d' });
    assert.ok(net.totals.pageviews >= d.totals.pageviews, 'net.totals.pageviews >= d.totals.pageviews');
    assert.equal(net.people, null);
  });

  await check('access: owner sees own org only; admin sees the network; others see nothing', async () => {
    await db`INSERT INTO user_organizations (user_id, org_id, role) VALUES (${userId}, ${org}, 'owner')`;
    const own = await getAnalyticsAccess(userId);
    assert.equal(own.network, false);
    assert.deepEqual(own.orgs.map((o) => o.id), [org]);
    assert.deepEqual(chooseScope(own, null), { orgId: org });
    assert.equal(chooseScope(own, privOrg), null, 'not an owner of that org');
    await db`UPDATE user_organizations SET role = 'guide' WHERE user_id = ${userId} AND org_id = ${org}`;
    const guide = await getAnalyticsAccess(userId);
    assert.equal(chooseScope(guide, null), null, 'a guide sees nothing');
    await db`UPDATE users SET is_admin = true WHERE id = ${userId}`;
    const admin = await getAnalyticsAccess(userId);
    assert.equal(admin.network, true);
    assert.deepEqual(chooseScope(admin, null), { network: true });
    assert.deepEqual(chooseScope(admin, privOrg), { orgId: privOrg });
    assert.equal(chooseScope(admin, 'no_such_org'), null);
  });

  await check('author insights: own posts only, views from analytics, replies from others', async () => {
    const other = uuid();
    await db`INSERT INTO users (id, auth_user_id, email, display_name) VALUES (${other}, ${other}, ${`o_${suffix}@example.test`}, 'Other Reader')`;
    try {
      await db`INSERT INTO replies (id, thread_id, user_id, content) VALUES (${`r1${suffix}`.slice(0, 21)}, ${pubThread}, ${other}, '<p>Nice piece</p>'), (${`r2${suffix}`.slice(0, 21)}, ${pubThread}, ${userId}, 'my own reply')`;
      await db`INSERT INTO reactions (id, thread_id, user_id, kind) VALUES (${`x1${suffix}`.slice(0, 21)}, ${pubThread}, ${other}, 'like')`;
      const ins = await getAuthorInsights({ authorIds: [userId], range: '7d' });
      const mine = ins.posts.find((p) => p.threadId === pubThread);
      assert.ok(mine, 'public post listed');
      assert.ok(mine!.views >= 1 && mine!.visitors >= 1, 'views counted');
      assert.equal(mine!.repliesTotal, 1, 'own reply excluded');
      assert.equal(mine!.reactionsTotal, 1);
      assert.ok(ins.activity.some((a) => a.type === 'reply' && a.who === 'Other Reader' && a.text === 'Nice piece'), 'reply in feed, tags stripped');
      assert.ok(!ins.activity.some((a) => a.text === 'my own reply'));
      const nobody = await getAuthorInsights({ authorIds: [other], range: '7d' });
      assert.equal(nobody.posts.length, 0, 'another author sees none of these posts');
      assert.equal(nobody.totals.views, 0);
      const priv = ins.posts.find((p) => p.threadId === privThread);
      assert.ok(priv && priv.views === 0, 'non-public post has no views');
    
  await check('progression: ordered funnel and common routes by visit', async () => {
    const aw = uuid(); const aw2 = uuid();
    const buyer = { ip: '10.9.0.1' }; const browser = { ip: '10.9.0.2' }; const backwards = { ip: '10.9.0.3' };
    // buyer: home > artwork > add_to_cart > checkout > order_placed
    await send({ path: '/' }, buyer); await send({ path: `/artworks/${aw}` }, buyer);
    await send({ type: 'event', path: `/artworks/${aw}`, name: 'add_to_cart' }, buyer);
    await send({ path: '/checkout' }, buyer); await send({ type: 'event', path: '/checkout', name: 'order_placed' }, buyer);
    // browser: home > artwork (different id) and stops
    await send({ path: '/' }, browser); await send({ path: `/artworks/${aw2}` }, browser);
    // backwards: order_placed event BEFORE any browsing page => must not count past step 1 ordering
    await send({ type: 'event', path: '/checkout', name: 'order_placed' }, backwards); await send({ path: '/' }, backwards);
    const steps = [
      { label: 'Browsed', path: '^/$' },
      { label: 'Opened an artwork', path: '^/artworks/[0-9a-f-]{36}$' },
      { label: 'Added to cart', event: 'add_to_cart' },
      { label: 'Checkout', path: '^/checkout$' },
      { label: 'Ordered', event: 'order_placed' },
    ];
    const f = await getFunnel({ scope: { orgId: org }, range: '7d', steps });
    assert.ok(f[0].sessions >= 3, 'three or more visits browsed (earlier checks add more)');
    assert.equal(f[1].sessions, 2); assert.equal(f[2].sessions, 1); assert.equal(f[3].sessions, 1); assert.equal(f[4].sessions, 1);
    assert.ok(Math.abs(f[2].fromPrevious - 0.5) < 1e-9 && f[4].fromPrevious === 1);
    const j = await getJourneys({ scope: { orgId: org }, range: '7d' });
    assert.ok(j.journeys.some((r) => r.steps.join(' ') === '/ /artworks/:id /checkout'), 'buyer route with ids normalised');
    assert.ok(j.journeys.some((r) => r.steps.join(' ') === '/ /artworks/:id' && r.sessions >= 1));
  });
} finally {
      await db`DELETE FROM reactions WHERE thread_id IN (${pubThread}, ${privThread})`;
      await db`DELETE FROM replies WHERE thread_id IN (${pubThread}, ${privThread})`;
      await db`DELETE FROM users WHERE id = ${other}`;
    }
  });
} finally {
  await db`DELETE FROM analytics_events WHERE org_id IN (${org}, ${privOrg})`;
  await db`DELETE FROM user_organizations WHERE user_id = ${userId}`;
  await db`DELETE FROM user_site_visits WHERE user_id = ${userId}`;
  await db`DELETE FROM threads WHERE org_id = ${org}`;
  await db`DELETE FROM org_domains WHERE org_id IN (${org}, ${privOrg})`;
  await db`DELETE FROM users WHERE id = ${userId}`;
  await db`DELETE FROM organizations WHERE id IN (${org}, ${privOrg})`;
  await db.end();
}

if (failures) { console.error(`${failures} check(s) failed`); process.exit(1); }
console.log('all checks passed');

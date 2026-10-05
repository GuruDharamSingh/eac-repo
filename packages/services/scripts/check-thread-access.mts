// Audience rules (migration 188) against a SCRATCH database: the JS check
// (canViewThread), the SQL fragment (restrictedReadSql through listTopics) and
// the storage mapping must agree for every viewer role and audience. Refuses a
// database whose name lacks "scratch".
//
//   DATABASE_URL=postgres://…/analytics_scratch pnpm --filter @elkdonis/services check:thread-access
import assert from 'node:assert/strict';

if (!/scratch/.test(new URL(process.env.DATABASE_URL ?? '').pathname)) {
  console.error('check-thread-access: DATABASE_URL must point at a database whose name contains "scratch".');
  process.exit(2);
}
const { db } = await import('@elkdonis/db');
const { listTopics } = await import('../src/forum');
const { AUDIENCES, audienceToStorage, storageToAudience, canViewThread } = await import('../src/thread-access');
type Audience = (typeof AUDIENCES)[number]['value'];

const sfx = Math.random().toString(36).slice(2, 7);
const org = `ta_${sfx}`; const other = `tb_${sfx}`;
const uuid = () => crypto.randomUUID();
const people = {
  author: uuid(), owner: uuid(), guide: uuid(), member: uuid(), follower: uuid(), outsider: uuid(), admin: uuid(), ownerElsewhere: uuid(),
} as const;
type Who = keyof typeof people;
const roleIn: Partial<Record<Who, string>> = { owner: 'owner', guide: 'guide', member: 'member', follower: 'viewer' };

// Who should read which audience (author handled separately: reads all of their own).
const expect: Record<Audience, Who[]> = {
  everyone: ['author', 'owner', 'guide', 'member', 'follower', 'outsider', 'admin', 'ownerElsewhere'],
  followers: ['author', 'owner', 'guide', 'member', 'follower', 'admin'],
  members: ['author', 'owner', 'guide', 'member', 'admin'],
  guides: ['author', 'owner', 'guide', 'admin'],
  owners: ['author', 'owner', 'admin'],
  author: ['author', 'admin'],
};

let failures = 0;
const check = async (name: string, fn: () => Promise<void>) => {
  try { await fn(); console.log('ok   ', name); } catch (e) { failures++; console.error('FAIL ', name, '\n     ', (e as Error).message); }
};

try {
  await db`INSERT INTO organizations (id, name, slug) VALUES (${org}, 'Org A', ${org}), (${other}, 'Org B', ${other})`;
  for (const [who, id] of Object.entries(people)) {
    await db`INSERT INTO users (id, auth_user_id, email, display_name) VALUES (${id}, ${id}, ${`${who}_${sfx}@example.test`}, ${who})`;
  }
  await db`UPDATE users SET is_admin = true WHERE id = ${people.admin}`;
  for (const [who, role] of Object.entries(roleIn)) {
    await db`INSERT INTO user_organizations (user_id, org_id, role) VALUES (${people[who as Who]}, ${org}, ${role!})`;
  }
  await db`INSERT INTO user_organizations (user_id, org_id, role) VALUES (${people.ownerElsewhere}, ${other}, 'owner')`;

  const titles: Record<string, Audience> = {};
  for (const a of AUDIENCES) {
    const { visibility, minRole } = audienceToStorage(a.value);
    const id = `${a.value}${sfx}`.slice(0, 21);
    const title = `T-${a.value}-${sfx}`;
    titles[title] = a.value;
    await db`INSERT INTO threads (id, org_id, author_id, kind, title, slug, status, visibility, min_role)
             VALUES (${id}, ${org}, ${people.author}, 'post', ${title}, ${id}, 'published', ${visibility}, ${minRole})`;
  }

  await check('storage mapping round-trips', async () => {
    for (const a of AUDIENCES) {
      const s = audienceToStorage(a.value);
      assert.equal(storageToAudience(s.visibility, s.minRole), a.value);
    }
    assert.equal(storageToAudience('ORGANIZATION', null), 'followers', 'existing members-visible posts read as followers and above');
    assert.equal(storageToAudience('INVITE_ONLY', null), 'author', 'existing invite-only posts stay author-only');
  });

  for (const who of Object.keys(people) as Who[]) {
    await check(`${who}: SQL (listTopics) and JS (canViewThread) agree with the table`, async () => {
      const roles: Record<string, string> = {};
      if (roleIn[who]) roles[org] = roleIn[who]!;
      if (who === 'ownerElsewhere') roles[other] = 'owner';
      const viewer = { userId: people[who], roles, isGlobalAdmin: who === 'admin' };
      const got = await listTopics({ kind: 'org', orgId: org }, viewer, { limit: 100 });
      const seen = new Set(got.rows.map((r) => r.title));
      for (const [title, aud] of Object.entries(titles)) {
        const should = expect[aud].includes(who);
        assert.equal(seen.has(title), should, `${who} ${should ? 'should' : 'must not'} see "${aud}" in the list`);
        const s = audienceToStorage(aud);
        const js = canViewThread(
          { visibility: s.visibility, minRole: s.minRole, authorId: people.author, status: 'published' },
          { userId: people[who], role: (roleIn[who] as never) ?? null, isGlobalAdmin: who === 'admin' }
        );
        assert.equal(js, should, `${who} JS check for "${aud}"`);
      }
    });
  }

  await check('unpublished: only author, admin and editors who meet the minimum', async () => {
    const draft = (minRole: string | null) => ({ visibility: 'INVITE_ONLY', minRole, authorId: people.author, status: 'draft' });
    const v = (who: Who) => ({ userId: people[who], role: (roleIn[who] as never) ?? null, isGlobalAdmin: who === 'admin' });
    assert.equal(canViewThread({ visibility: 'PUBLIC', authorId: people.author, status: 'draft' }, v('member')), false);
    assert.equal(canViewThread({ visibility: 'PUBLIC', authorId: people.author, status: 'draft' }, v('guide')), true);
    assert.equal(canViewThread(draft('owner'), v('guide')), false, 'a guide cannot open an owners-only draft');
    assert.equal(canViewThread(draft('owner'), v('owner')), true);
    assert.equal(canViewThread(draft(null), v('admin')), true);
  });
} finally {
  await db`DELETE FROM threads WHERE org_id IN (${org}, ${other})`;
  await db`DELETE FROM user_organizations WHERE org_id IN (${org}, ${other})`;
  await db`DELETE FROM users WHERE id = ANY(${Object.values(people)}::uuid[])`;
  await db`DELETE FROM organizations WHERE id IN (${org}, ${other})`;
  await db.end();
}
if (failures) { console.error(`${failures} check(s) failed`); process.exit(1); }
console.log('all checks passed');

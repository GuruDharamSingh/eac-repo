/**
 * seed-akhand-path.mts — create the private "Akhand Path" reading circle: a
 * complete reading of the Sri Guru Granth Sahib, one passage at a time.
 *
 * The passages come from the WSL chunker (chunker/sggs.py, chunks.jsonl): the
 * Thind / Sant Singh Khalsa Gurmukhi-English edition, chunked along the
 * Granth's own structure (section > raag > heading > shabad; a Vaar's saloks
 * with their pauri). One circle unit per passage, text in unit metadata.
 *
 * Run inside the app container, the passages on stdin (the file stays out of
 * the repo, in ~/sggs-corpus on eris):
 *   sudo -n docker compose exec -T -w /app fourthway-bookreaders node \
 *     node_modules/.pnpm/tsx@4.20.6/node_modules/tsx/dist/cli.mjs \
 *     apps/fourthwayBookreaders/scripts/seed-akhand-path.mts \
 *     --author <email> --reader <email> [--reader <email>] [--start YYYY-MM-DD] [--dry-run] \
 *     < ~/sggs-corpus/chunks.jsonl
 *
 * Private: the thread is INVITE_ONLY, which every listing, feed, forum and
 * calendar query on the network already hides from everyone but its author.
 * The /akhand-path page admits the author and the circle's readers (a `yes`
 * RSVP, the site's rule for joining a group). It has no schedule, so the org
 * calendar sync never pushes it; each day's entry is keyed by the date.
 *
 * Idempotent: an existing circle (slug akhand-path) is reused, its folder and
 * Talk room are only completed, readers are only added, and passages are
 * inserted only when it has none.
 */
import { db } from '@elkdonis/db';
import { createThread } from '../../../packages/services/src/posts.ts';
import { createOrgFolder } from '../../../packages/services/src/org-storage.ts';
import { createTalkRoom } from '../../../packages/services/src/nextcloud.ts';
import { setRsvpStatus } from '../../../packages/services/src/thread-rsvp.ts';

const ORG = 'fourth_way_book_readers';
const SLUG = 'akhand-path';
const TITLE = 'Akhand Path';
const FOLDER = `Private/Circles/${SLUG}`;
const RECORDINGS = 'Meeting Recordings';

const argv = process.argv.slice(2);
const opt = (name: string) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] ?? null : null;
};
const opts = (name: string) => argv.flatMap((a, i) => (a === `--${name}` && argv[i + 1] ? [argv[i + 1]] : []));
const DRY = argv.includes('--dry-run');

const authorEmail = opt('author');
if (!authorEmail) {
  console.error('--author <email> is required');
  process.exit(1);
}
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto' }).format(new Date());
const startedOn = opt('start') ?? today;

interface Chunk {
  id: string;
  chunk_index: number;
  ang: number;
  ang_end: number;
  section: string;
  section_gurmukhi: string;
  section_kind: string;
  subsection: string | null;
  vaar: string | null;
  heading: string;
  authors: string[];
  mehl: number[];
  ghar: number | null;
  form: string;
  part: number;
  parts: number;
  verses: string[];
  aligned: boolean;
  english: string;
  gurmukhi: string;
}

let raw = '';
for await (const part of process.stdin) raw += part;
const chunks = raw.split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l) as Chunk).sort((a, b) => a.chunk_index - b.chunk_index);
if (chunks.length === 0) {
  console.error('No passages on stdin (pipe chunks.jsonl in)');
  process.exit(1);
}

const users = async (email: string) =>
  (await db<{ id: string; nextcloud_user_id: string | null }[]>`
    SELECT id, nextcloud_user_id FROM users WHERE lower(email) = lower(${email})
  `)[0] ?? null;
const author = await users(authorEmail);
if (!author) {
  console.error(`No user with email ${authorEmail}`);
  process.exit(1);
}
const readers = [];
for (const email of opts('reader')) {
  const u = await users(email);
  if (!u) {
    console.error(`No user with email ${email}`);
    process.exit(1);
  }
  readers.push(u);
}

let [circle] = await db<{ id: string; nextcloud_talk_token: string | null; metadata: Record<string, unknown> | null }[]>`
  SELECT id, nextcloud_talk_token, metadata FROM threads WHERE org_id = ${ORG} AND kind = 'reading_group' AND slug = ${SLUG}
`;
console.log(circle ? `circle exists: ${circle.id}` : `circle missing: would create "${TITLE}" (INVITE_ONLY)`);
console.log(`${chunks.length} passages, Ang ${chunks[0].ang}-${chunks.at(-1)!.ang_end}; readers: author + ${readers.length}; started on ${startedOn}`);
if (DRY) process.exit(0);

if (!circle) {
  const t = await createThread({
    kind: 'reading_group',
    orgId: ORG,
    authorId: author.id,
    title: TITLE,
    slug: SLUG,
    status: 'published',
    visibility: 'INVITE_ONLY',
    section: 'groups',
    format: 'online',
    isRsvpEnabled: false,
    excerpt: 'A complete reading of the Sri Guru Granth Sahib, passage by passage, day by day.',
    metadata: {
      book: { title: 'Sri Guru Granth Sahib', author: null },
      circle: { pace: 3, private: true },
      paath: {
        kind: 'akhand-path',
        startedOn,
        totalAngs: 1430,
        edition: 'Gurmukhi with English translation (Kulbir S Thind; English by Dr. Sant Singh Khalsa)',
      },
    },
  } as never);
  circle = { id: t.id, nextcloud_talk_token: null, metadata: null };
  console.log(`created circle ${circle.id}`);
}

// Folder for the recordings, one segment at a time (MKCOL does not create parents).
for (const s of ['Private', 'Private/Circles', FOLDER, `${FOLDER}/${RECORDINGS}`]) {
  await createOrgFolder(ORG, s).catch((err) => console.warn(`  folder ${s}: ${(err as Error).message}`));
}
await db`
  UPDATE threads
  SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{circle,folder}', ${db.json(FOLDER)})
  WHERE id = ${circle.id} AND org_id = ${ORG}
`;

// Talk room: public type so a reader without a Nextcloud account joins by link,
// unlisted so nobody else finds it.
if (!circle.nextcloud_talk_token) {
  const token = await createTalkRoom(TITLE, 'public', { moderator: author.nextcloud_user_id, listable: 0 });
  if (token) {
    await db`UPDATE threads SET nextcloud_talk_token = ${token} WHERE id = ${circle.id} AND org_id = ${ORG}`;
    console.log(`talk room ${token}`);
  } else {
    console.warn('  the Talk room could not be created');
  }
}

for (const u of [author, ...readers]) await setRsvpStatus(circle.id, u.id, 'yes');
console.log(`readers: ${1 + readers.length}`);

const [{ n }] = await db<{ n: number }[]>`SELECT COUNT(*)::int AS n FROM circle_units WHERE thread_id = ${circle.id}`;
if (n > 0) {
  console.log(`passages already loaded (${n}); not touched`);
  process.exit(0);
}

const angLabel = (c: Chunk) => (c.ang_end > c.ang ? `Ang ${c.ang}–${c.ang_end}` : `Ang ${c.ang}`);
await db.begin(async (tx) => {
  for (const [i, c] of chunks.entries()) {
    const title = c.heading || c.subsection || c.section;
    await tx`
      INSERT INTO circle_units (org_id, thread_id, position, title, label, kind, length_unit, status, metadata)
      VALUES (${ORG}, ${circle!.id}, ${i + 1}, ${title}, ${angLabel(c)}, 'chapter', 'pages', 'planned', ${tx.json({
        ang: c.ang,
        angEnd: c.ang_end,
        section: c.section,
        sectionGurmukhi: c.section_gurmukhi,
        sectionKind: c.section_kind,
        subsection: c.subsection,
        vaar: c.vaar,
        heading: c.heading,
        authors: c.authors,
        mehl: c.mehl,
        ghar: c.ghar,
        form: c.form,
        part: c.part,
        parts: c.parts,
        verses: c.verses,
        aligned: c.aligned,
        english: c.english,
        gurmukhi: c.gurmukhi,
        sourceId: c.id,
      } as never)})
    `;
  }
});
console.log(`loaded ${chunks.length} passages`);
process.exit(0);

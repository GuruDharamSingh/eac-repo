-- ============================================================================
-- 133: the group's living documents become threads.
--
-- `site_config.living_documents` was a hand-rolled table living inside a JSONB
-- array: no author foreign key, no index, no revision history, a documented
-- lost-update race on every write that was not an append, and — the tell — an
-- `ideaId` field that is a thread edge somebody wrote by hand because there
-- was nowhere to put one.
--
-- `threads` was already built for this. `document_url`, `nextcloud_doc_url`
-- and `nextcloud_file_id` have been columns on it since long before anything
-- used them. A document has a title, an author, a date and a visibility, which
-- is what a thread is; keeping it in a config blob bought nothing and cost the
-- revision history, the search index and the ability to be gathered.
--
-- ── Two things this deliberately does NOT do ───────────────────────────────
--
-- The files are untouched. Everything stays exactly where it is in
-- `EAC_Network/<org>/Media/Documents/`; this migration moves the INDEX, and
-- the index was always the only thing Postgres held.
--
-- `site_config.living_documents` is left in place and simply stops being read.
-- It is the rollback: if a document comes through wrong, the original entry is
-- still there, verbatim, with its share token. A DELETE here would make this
-- migration one-way for no gain.
--
-- ── Visibility ─────────────────────────────────────────────────────────────
--
-- Every document lands ORGANIZATION, never PUBLIC, and that is now the whole
-- rule for whether outsiders may know a document exists. It also separates two
-- questions that used to be tangled together:
--
--   visibility      may you know this document is here
--   documentLinks   may you be handed the URL that opens it
--
-- The second stays a caller's explicit assertion of membership (see
-- gather.ts), because `createOrgDocument` shares by a public WRITABLE link —
-- an unauthenticated URL granting edit and delete. Visibility alone has never
-- been sufficient for that and still is not.
-- ============================================================================

-- The legacy document id becomes the thread id. Every one ever minted is
-- either a nanoid (21 chars) or `doc_<base36><random>` (19), so all of them
-- fit VARCHAR(21) unchanged — which makes this migration idempotent, keeps any
-- link that already pointed at a document id working, and lets the
-- `thread_gathers` re-pointing below be a straight swap rather than a lookup.
INSERT INTO threads (
  id, org_id, author_id, kind, title, slug, body, excerpt,
  status, visibility, section,
  document_url, nextcloud_doc_url, nextcloud_file_id,
  metadata, created_at, published_at, updated_at, last_activity_at
)
SELECT
  d->>'id',
  s.org_id,
  -- `createdBy` was never one thing. Across the rows in this database it is
  -- variously NULL, a user uuid, and an email address — the field's own type
  -- calls it a display name. Each is tried in turn, then the org's owner, then
  -- anyone who has already authored for the org, because author_id is NOT NULL
  -- and dropping a document for want of a name would be the worse outcome.
  COALESCE(
    (SELECT u.id FROM users u
      WHERE (d->>'createdBy') ~ '^[0-9a-fA-F-]{36}$' AND u.id = (d->>'createdBy')::uuid),
    (SELECT u.id FROM users u WHERE u.email = d->>'createdBy'),
    (SELECT uo.user_id FROM user_organizations uo
      WHERE uo.org_id = s.org_id AND uo.role = 'owner' LIMIT 1),
    (SELECT uo.user_id FROM user_organizations uo
      WHERE uo.org_id = s.org_id AND uo.role = 'guide' LIMIT 1),
    (SELECT t.author_id FROM threads t WHERE t.org_id = s.org_id LIMIT 1)
  ),
  'document',
  COALESCE(NULLIF(btrim(d->>'title'), ''), 'Untitled document'),
  -- Slug carries the id. Documents are off every feed so nothing routes by
  -- this, but two scrap docs made on the same day share a title exactly, and a
  -- slug that silently collides is a trap for whatever routes by it later.
  left(
    COALESCE(
      NULLIF(btrim(lower(regexp_replace(d->>'title', '[^a-zA-Z0-9]+', '-', 'g')), '-'), ''),
      'document'
    ) || '-' || (d->>'id'),
  255),
  NULL,
  NULL,
  'published',
  -- Never PUBLIC. See the header.
  'ORGANIZATION',
  -- No section: a document is not a feed item. It is reached from the
  -- documents surface and from whatever gathered it.
  NULL,
  d->>'url',
  d->>'editUrl',
  -- NULL, not the path: the legacy index never recorded Nextcloud's numeric
  -- file id, and putting a DAV path in a column named for an id is how the
  -- next person reads it wrong. The path goes in metadata, below.
  NULL,
  jsonb_strip_nulls(jsonb_build_object(
    'legacyDocumentId', d->>'id',
    'documentPath',     d->>'path'
  )),
  COALESCE((d->>'createdAt')::timestamptz, NOW()),
  COALESCE((d->>'createdAt')::timestamptz, NOW()),
  COALESCE((d->>'createdAt')::timestamptz, NOW()),
  COALESCE((d->>'createdAt')::timestamptz, NOW())
FROM site_config s, jsonb_array_elements(s.value) d
WHERE s.key = 'living_documents'
  AND jsonb_typeof(s.value) = 'array'
  AND COALESCE(d->>'id', '') <> ''
  AND length(d->>'id') <= 21
ON CONFLICT (id) DO NOTHING;

-- ── `documents[].ideaId` becomes a real edge ────────────────────────────────
-- This field was the clearest evidence that `thread_gathers` was the missing
-- primitive: a thread reference stored as a string inside a JSON array,
-- because there was no table for one. The idea GATHERS the document.
INSERT INTO thread_gathers (id, thread_id, target_type, target_thread_id, relation, position)
SELECT
  left('gth' || md5(s.org_id || (d->>'id') || (d->>'ideaId')), 21),
  d->>'ideaId',
  'thread',
  d->>'id',
  'gathers',
  0
FROM site_config s, jsonb_array_elements(s.value) d
WHERE s.key = 'living_documents'
  AND COALESCE(d->>'ideaId', '') <> ''
  AND EXISTS (SELECT 1 FROM threads t WHERE t.id = d->>'ideaId')
  AND EXISTS (SELECT 1 FROM threads t WHERE t.id = d->>'id')
ON CONFLICT DO NOTHING;

-- ── Edges written against the old addressing follow the document ────────────
-- migration 131 said promotion would be an independent change because an edge
-- to ('document', '<id>') could be re-pointed at a real row without the
-- gathering model moving. This is that promise being kept. The id is the same
-- string, so it is a straight swap.
UPDATE thread_gathers g
SET target_type = 'thread',
    target_thread_id = g.target_ref,
    target_ref = NULL
WHERE g.target_type = 'document'
  AND EXISTS (SELECT 1 FROM threads t WHERE t.id = g.target_ref AND t.kind = 'document')
  -- Never collapse two edges into one violating row: skip any that would
  -- collide with an equivalent thread edge already present.
  AND NOT EXISTS (
    SELECT 1 FROM thread_gathers x
    WHERE x.thread_id = g.thread_id
      AND x.target_thread_id = g.target_ref
      AND x.relation = g.relation
  );

-- The documents surface reads newest-first per org, and nothing else queries
-- this kind.
CREATE INDEX IF NOT EXISTS idx_threads_documents
  ON threads (org_id, created_at DESC)
  WHERE kind = 'document';

-- 252 · Channel: deliveries, plans (plan.md) with an event log, to-dos, routines.
-- 2026-11-07. Brief: docs/open/channel.md. Design: docs/open/channel-handoff/README.md.
--
-- Owner: a person (owner_kind 'user', owner_id = users.id as text) or an org
-- (owner_kind 'org', owner_id = organizations.id). Rows a person owns carry
-- org_id 'oad', the personal org "Just me" posts are stored under.
--
-- History (what already went out) is NOT copied here: it is read from its own
-- tables (threads, social_posts.shares, threads.metadata.shares,
-- publish_jobs, artwork, email_sends). channel_deliveries holds what Channel
-- itself plans: drafts, scheduled posts, accepted suggestions, and
-- suggestions the person dismissed.

CREATE TABLE IF NOT EXISTS channel_routines (
  id           varchar(21) PRIMARY KEY,
  org_id       varchar(50) NOT NULL REFERENCES organizations(id),
  owner_kind   text NOT NULL CHECK (owner_kind IN ('user', 'org')),
  owner_id     text NOT NULL,
  name         text NOT NULL,
  -- site | page | market | instagram | facebook | threads | youtube | newsletter | live | video | writing
  outlet       text NOT NULL,
  -- {"weekdays":["tue","fri"],"time":"10:00"} or {"monthDay":1,"time":"09:00"}
  -- or {"nthWeekday":{"n":2,"weekday":"sun"},"time":"14:00"}
  cadence      jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- 'channel' = made here; 'sophia' = from an LMS routine course (later).
  source       text NOT NULL DEFAULT 'channel' CHECK (source IN ('channel', 'sophia')),
  source_ref   text,
  created_by   uuid REFERENCES users(id) ON DELETE SET NULL,
  archived_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS channel_routines_owner_idx ON channel_routines (owner_kind, owner_id) WHERE archived_at IS NULL;

CREATE TABLE IF NOT EXISTS channel_deliveries (
  id            varchar(21) PRIMARY KEY,
  org_id        varchar(50) NOT NULL REFERENCES organizations(id),
  owner_kind    text NOT NULL CHECK (owner_kind IN ('user', 'org')),
  owner_id      text NOT NULL,
  -- The name it goes out under: 'user:<uuid>' or 'org:<org id>'.
  identity_id   text,
  subject_kind  text NOT NULL CHECK (subject_kind IN ('thread', 'artwork')),
  subject_id    text NOT NULL,
  outlet        text NOT NULL,
  status        text NOT NULL DEFAULT 'draft'
                CHECK (status IN ('draft', 'scheduled', 'published', 'failed', 'dismissed')),
  scheduled_at  timestamptz,
  published_at  timestamptz,
  external_id   text,
  permalink     text,
  -- Per-outlet caption and overrides: {"title","text","link","linkInBio","quote","note","suggestion"}.
  payload       jsonb NOT NULL DEFAULT '{}'::jsonb,
  routine_id    varchar(21) REFERENCES channel_routines(id) ON DELETE SET NULL,
  actor_kind    text NOT NULL DEFAULT 'user' CHECK (actor_kind IN ('user', 'agent')),
  created_by    uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS channel_deliveries_owner_idx ON channel_deliveries (owner_kind, owner_id, scheduled_at);
CREATE INDEX IF NOT EXISTS channel_deliveries_subject_idx ON channel_deliveries (subject_kind, subject_id);

CREATE TABLE IF NOT EXISTS channel_plans (
  id                varchar(21) PRIMARY KEY,
  org_id            varchar(50) NOT NULL REFERENCES organizations(id),
  owner_kind        text NOT NULL CHECK (owner_kind IN ('user', 'org')),
  owner_id          text NOT NULL,
  subject_kind      text NOT NULL CHECK (subject_kind IN ('thread', 'artwork')),
  subject_id        text NOT NULL,
  body_md           text NOT NULL DEFAULT '',
  -- created_at = the day the piece was added to the queue.
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  updated_by        uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_by_actor  text NOT NULL DEFAULT 'user' CHECK (updated_by_actor IN ('user', 'agent')),
  UNIQUE (owner_kind, owner_id, subject_kind, subject_id)
);

-- Append-only: written in the same transaction as every change to a plan,
-- so an agent's edit is always attributable (lms/SYNTHESIS.md event-log rule).
CREATE TABLE IF NOT EXISTS channel_plan_events (
  id          bigserial PRIMARY KEY,
  plan_id     varchar(21) NOT NULL REFERENCES channel_plans(id) ON DELETE CASCADE,
  org_id      varchar(50) NOT NULL REFERENCES organizations(id),
  actor_kind  text NOT NULL CHECK (actor_kind IN ('user', 'agent')),
  actor_id    text NOT NULL,
  -- created | edited | step_added | step_checked | step_unchecked
  verb        text NOT NULL,
  diff        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS channel_plan_events_plan_idx ON channel_plan_events (plan_id, created_at);

CREATE TABLE IF NOT EXISTS channel_todos (
  id            varchar(21) PRIMARY KEY,
  org_id        varchar(50) NOT NULL REFERENCES organizations(id),
  owner_kind    text NOT NULL CHECK (owner_kind IN ('user', 'org')),
  owner_id      text NOT NULL,
  date          date,
  text          text NOT NULL,
  done          boolean NOT NULL DEFAULT false,
  done_at       timestamptz,
  subject_kind  text CHECK (subject_kind IN ('thread', 'artwork')),
  subject_id    text,
  created_by    uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS channel_todos_owner_idx ON channel_todos (owner_kind, owner_id, date);

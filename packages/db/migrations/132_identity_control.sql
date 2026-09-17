-- ============================================================================
-- 131: identity_control — one account, several names.
--
-- The network already separates ACCOUNT from IDENTITY, it just never said so
-- out loud. A login is a row in auth.users; an identity is a row in
-- public.users. Of the 54 identities on this database only 20 have a login
-- behind them — the other 34 are unclaimed ArtDirect dossiers and the
-- organisations' own profile rows from migration 099. Every content table
-- points at the IDENTITY: threads.author_id, media.uploaded_by,
-- store.owner_user_id, user_organizations.user_id. None of them has ever
-- referenced an account.
--
-- That is why a pseudonym needs no change to any content table. It is an
-- ordinary users row that happens to have no login, exactly like an org's
-- profile row, plus one fact this schema could not previously record: which
-- account is allowed to speak as it.
--
-- WHY A TABLE AND NOT A COLUMN ON users
-- `users` is read through wide column lists — USER_COLS in
-- packages/services/src/profiles.ts already carries claim_status, claimed_by
-- and created_by into every profile read, and from there to the browser. A
-- `controlled_by` column would join that list the first time someone added it
-- for convenience, and the link between a person and their pseudonym is the
-- one fact in this design that must never travel by accident. A separate
-- table cannot leak by accident: it has to be joined on purpose.
--
-- This is also NOT users.claimed_by. That column means "this account asserts
-- it is the same person as this sentinel row", and it is consumed by the
-- claim/merge flow, which ends by DELETING the sentinel. Control is the
-- opposite relation: the second row is meant to persist, separately, forever.
--
-- ONE CONTROLLER, NO CHAINS
-- identity_id is the PRIMARY KEY, so an identity answers to exactly one
-- account — shared pseudonyms are a different feature (that is what an
-- organisation is for) and allowing them here would make "who posted this"
-- unanswerable. The trigger forbids chaining in both directions: a pseudonym
-- may not own a pseudonym, and an identity that already owns one cannot
-- become one. Without it, `identityIds` resolution is a graph walk instead of
-- one query, and the depth limit lives nowhere.
--
-- RETIREMENT, NOT DELETION
-- retired_at ends the ability to act as an identity while leaving its
-- authorship standing. Actually folding a pseudonym back into its owner —
-- reassigning every thread and deleting the row — is mergeProfile in
-- packages/services/src/profiles.ts, which already refuses when any of
-- sixteen uncarried tables holds rows. Retirement is the cheap, reversible
-- half; the merge is the irreversible one, and they should stay separate.
--
-- NO CAP HERE. How many names one account may hold is policy, not structure
-- (MAX_PSEUDONYMS in @elkdonis/services/identities). A CHECK would have to be
-- migrated every time that number moved.
-- ============================================================================

CREATE TABLE IF NOT EXISTS identity_control (
  identity_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  account_id  UUID NOT NULL     REFERENCES users(id) ON DELETE CASCADE,
  relation    TEXT NOT NULL DEFAULT 'pseudonym',
  label       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  retired_at  TIMESTAMPTZ,
  CONSTRAINT identity_control_not_self CHECK (identity_id <> account_id),
  CONSTRAINT identity_control_relation_check CHECK (relation IN ('pseudonym'))
);

COMMENT ON TABLE identity_control IS
  'Which account may act as which identity. Server-side only: this link is never selected into a public profile read — see migration 131 for why it is not a column on users.';
COMMENT ON COLUMN identity_control.identity_id IS
  'The users row being spoken as. PRIMARY KEY: exactly one account controls it.';
COMMENT ON COLUMN identity_control.account_id IS
  'The users row of the real, logged-in person behind it (users.id = auth.users.id).';
COMMENT ON COLUMN identity_control.label IS
  'Private note the owner writes for themself ("the poetry one"). Never public.';
COMMENT ON COLUMN identity_control.retired_at IS
  'Set to stop the account acting as this identity while its authorship stands. Folding it back in is mergeProfile, not a delete.';

-- The lookup every request makes: account → the identities it may speak as.
CREATE INDEX IF NOT EXISTS idx_identity_control_account
  ON identity_control (account_id) WHERE retired_at IS NULL;

CREATE OR REPLACE FUNCTION identity_control_no_chaining() RETURNS trigger AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM identity_control WHERE identity_id = NEW.account_id) THEN
    RAISE EXCEPTION 'identity_control: % is itself a controlled identity and cannot control others', NEW.account_id;
  END IF;
  IF EXISTS (SELECT 1 FROM identity_control WHERE account_id = NEW.identity_id) THEN
    RAISE EXCEPTION 'identity_control: % already controls identities and cannot become one', NEW.identity_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS identity_control_no_chaining_trg ON identity_control;
CREATE TRIGGER identity_control_no_chaining_trg
  BEFORE INSERT OR UPDATE ON identity_control
  FOR EACH ROW EXECUTE FUNCTION identity_control_no_chaining();

-- ─── organizations.created_by ───────────────────────────────────────────────
-- The other half of the question this migration answers: the schema could say
-- a person OWNS an org (user_organizations.role='owner') but not that they
-- STARTED it. Those read identically today, so the hub cannot tell "the org I
-- founded, which is really just me" from "the collective that made me an
-- owner" — which is precisely the distinction a member needs when deciding
-- whether to speak as themself, as a pen name, or as a body.
--
-- organizations.confirmed_by is not this: that is the staff member who
-- approved the subdomain.
--
-- Backfill is an INFERENCE, not a record — the founding act was never logged,
-- so the earliest owner is the best available guess and rows where that is
-- wrong can only be fixed by hand. New orgs should write it truthfully at
-- creation.

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL;

COMMENT ON COLUMN organizations.created_by IS
  'Who started this organisation. Distinct from confirmed_by (staff approval) and from holding owner in user_organizations (which any later grant also gives). Pre-131 rows are backfilled from the earliest owner and are an inference.';

UPDATE organizations o
SET created_by = (
  SELECT uo.user_id FROM user_organizations uo
  WHERE uo.org_id = o.id AND uo.role = 'owner'
  ORDER BY uo.joined_at ASC LIMIT 1
)
WHERE o.created_by IS NULL;

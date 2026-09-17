-- 129: un-double-encode email_template_settings.config, and drop a dead link.
--
-- Every row in this table was written as `${JSON.stringify(config)}::jsonb`.
-- The postgres.js driver already serialises the JavaScript string, so `::jsonb`
-- then parses it into a jsonb STRING containing JSON rather than into an
-- object. `jsonb_typeof(config)` returns 'string' for all four rows.
--
-- Nothing ever noticed because the only reader, auth-server's
-- loadWelcomeEmailSettings, handed the value to a sanitiser that returned {}
-- for anything unrecognised — so an org's customisations were silently ignored
-- rather than failing. The new reader in @elkdonis/email parses either shape,
-- but leaving the rows mis-typed means `config->'links'` and every other jsonb
-- operator keeps returning NULL, which is a trap for the next person.
--
-- Idempotent: rows already stored as objects are left alone.

UPDATE email_template_settings
SET config = (config #>> '{}')::jsonb
WHERE jsonb_typeof(config) = 'string';

-- With the rows readable, remove a link that has been mailed to every person
-- who signed up with Google since the inner-gathering app was retired:
-- http://localhost:3004/feed?welcome=1 — a localhost address, on the port of
-- an app that no longer runs. It was the only button in that email.
UPDATE email_template_settings
SET config = jsonb_set(
      config,
      '{links}',
      COALESCE(
        (SELECT jsonb_agg(link)
           FROM jsonb_array_elements(config -> 'links') AS link
          WHERE link ->> 'url' NOT LIKE 'http://localhost%'),
        '[]'::jsonb
      )
    )
WHERE jsonb_typeof(config -> 'links') = 'array'
  AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(config -> 'links') AS link
    WHERE link ->> 'url' LIKE 'http://localhost%'
  );

COMMENT ON COLUMN email_template_settings.config IS
  'An org''s override for one template: bodyText/links/media (typed into a form) and html/project (laid out in the newsletter editor). Write it with db.json() — NOT JSON.stringify(x)::jsonb, which double-encodes it (see migration 129).';

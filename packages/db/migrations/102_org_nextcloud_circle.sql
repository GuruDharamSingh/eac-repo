-- 102_org_nextcloud_circle.sql
--
-- Records the Nextcloud Circle (Team) that represents an org's membership.
--
-- Why Circles rather than Nextcloud groups: creating a group, and attaching
-- anything to a Team folder, goes through endpoints annotated
-- #[PasswordConfirmationRequired] (non-strict), which reads a
-- `last-password-confirm` value that only a live browser session ever has.
-- No API credential can satisfy it — not the login password, not an app
-- password. Circles are the exception: an ordinary account can create one and
-- manage its members over OCS with no admin rights and no password gate,
-- which is what makes per-org membership sync automatable from the platform.
--
-- Attaching that Circle to the Team folder and setting its ACLs still needs
-- `occ` on the host, but that is one-time per org, whereas membership changes
-- constantly. This column is what lets the two halves find each other.
--
-- Nullable: an org has no Circle until it is provisioned, and orgs that never
-- need shared Nextcloud storage never get one.

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS nextcloud_circle_id VARCHAR(64);

COMMENT ON COLUMN public.organizations.nextcloud_circle_id IS
  'Nextcloud Circle (Team) id representing this org''s membership. Created via '
  'OCS by the service account; attached to the Team folder via occ. NULL until provisioned.';

-- One org per Circle, but many orgs may legitimately have none yet.
CREATE UNIQUE INDEX IF NOT EXISTS idx_organizations_circle
  ON public.organizations (nextcloud_circle_id)
  WHERE nextcloud_circle_id IS NOT NULL;

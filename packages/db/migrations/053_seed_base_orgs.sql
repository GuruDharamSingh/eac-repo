-- ============================================================================
-- Migration 052: Seed base organizations
-- ============================================================================
-- The fixed, app-backed organizations were previously only created by the
-- db:seed / setupDatabase() script, which is easy to skip on a fresh bootstrap
-- (and src/seed.ts no longer exists). When the organizations table is empty,
-- every content insert fails the org_id foreign key (e.g. creating a /forum
-- thread → threads_org_id_fkey violation).
--
-- This migration makes the base orgs part of the schema history so a fresh DB
-- (or one reset with `docker-compose down -v`) is self-contained. It is
-- idempotent: ON CONFLICT DO NOTHING preserves any admin-edited names/slugs.
--
-- Note: arts-collective orgs are created dynamically per-subdomain at runtime
-- and are intentionally NOT seeded here. ifac and fourth_way_book_readers are
-- included because their owning migrations (041, 043) only run once and won't
-- re-insert if the organizations table is later wiped.
-- ============================================================================

INSERT INTO organizations (id, name, slug, description) VALUES
  ('elkdonis',    'Elkdonis Arts Collective',     'elkdonis',        'Central admin hub for the collective'),
  ('inner_group', 'InnerGathering',               'inner-gathering', 'Mobile-first community for spiritual gatherings and connection'),
  ('sunjay',      'Sunjay''s Teaching Circle',    'sunjay',          'Inner teaching organization led by Sunjay'),
  ('guru-dharam', 'Guru Dharam''s Practice Group','guru-dharam',     'Spiritual practice and teachings'),
  ('amrit_canada','Amrit Vela Toronto',           'amrit-canada',    'Monthly 4 AM sadhana — Jap Ji, Yoga and Kirtan in Toronto'),
  ('ifac',        'International Fine Art Collectors', 'ifac',        'Online gallery and artist community representing independent fine artists and art dealers.')
ON CONFLICT (id) DO NOTHING;

INSERT INTO organizations (id, name, slug, description, nextcloud_folder_path) VALUES
  ('fourth_way_book_readers', '4th Way Book Readers', '4th-way-book-readers', 'Reading circles for weekly book study, meetings, notes, and recaps.', 'EAC-Network/fourth_way_book_readers')
ON CONFLICT (id) DO NOTHING;

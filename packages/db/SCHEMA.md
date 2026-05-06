# EAC Database Schema

Single PostgreSQL database (`elkdonis_dev`), multi-tenant via `org_id`. All content tables carry an `org_id` column — always filter by it.

**Current migration: `040`** — next file should be `041_<name>.sql`

---

## Migration Index

| File | What it adds |
|------|-------------|
| `002_forum_tables.sql` | reactions, watches, notifications, bookmarks, flags, moderation_log |
| `003_forum_enhancements.sql` | last_activity_at, forum columns on posts/meetings |
| `004_availability_polls.sql` | availability_polls, availability_responses, availability_slots |
| `005_nextcloud_enhancements.sql` | Nextcloud Talk tokens, recording fields on meetings |
| `006_nextcloud_user_credentials.sql` | nextcloud_app_password, nextcloud_synced on users |
| `007_oidc_sso.sql` | oidc_subject, oidc_issuer on users |
| `008_standardize_scheduled_at.sql` | Removes start_time/end_time, standardises scheduled_at |
| `009_add_auth_user_id.sql` | auth_user_id UUID on users |
| `010_oidc_provider.sql` | oidc_codes table for custom OIDC bridge |
| `011_oidc_codes_pkce.sql` | nonce + PKCE columns on oidc_codes |
| `012_unify_user_ids_with_auth.sql` | public.users.id == auth.users.id, auth_user_id NOT NULL |
| `013_realtime_setup.sql` | Supabase Realtime publication + tenants/extensions tables |
| `014_meeting_recurrence.sql` | recurrence_pattern, recurrence_custom_rule on meetings |
| `015_event_pages.sql` | event_pages table (meeting sidecar), recurrence_until |
| `016_user_comment_color.sql` | comment_color VARCHAR(7) on users |
| `017_event_page_drawing.sql` | drawing JSONB on event_pages (Excalidraw) |
| `018_question_polls.sql` | question_polls, poll_options, poll_votes |
| `019_show_in_live_feed.sql` | show_in_live_feed on meetings |
| `020_contacts.sql` | contacts table (pre-auth lead capture) |
| `021_section_rsvp.sql` | section CHECK on meetings, rsvp_responses table |
| `022_workshop_showcase.sql` | show_on_workshops_page, workshop_order, subtitle, card_colour on meetings |
| `023_drift_capture.sql` | Captures out-of-band schema additions from live DB |
| `024_meeting_min_attendees.sql` | min_attendees, notify_on_min_attendees on threads (post-030 target) |
| `025_posts_talk_token.sql` | nextcloud_talk_token, document_url on threads (post-030 target) |
| `030_unified_threads_schema.sql` | **threads** table — consolidates posts + meetings + workshops under a `kind` discriminator |
| `031_content_form_foundation.sql` | content_drafts table, is_meeting flag, integration_settings on threads |
| `032_artist_profiles.sql` | **artist_profiles** table — one row per user per org, from arts-collective wizard |
| `033_artist_profiles_v2.sql` | Revises artist_profiles: removes years_active, adds medium[], website, social_links |
| `034_business_onboarding.sql` | Business workbook fields on artist_profiles (income_goal, pricing_model, etc.) |
| `035_layout_mode.sql` | layout_mode + silex_published_at on organizations |
| `036_business_onboarding_v2.sql` | Simplified/novice-friendly business fields on artist_profiles |
| `037_workshop_cms_extras.sql` | price_tier, sessions JSONB on threads (workshop CMS) |
| `038_workshop_pages.sql` | **workshop_pages** table (thread sidecar), threads.format enum |
| `039_theme_overrides.sql` | theme_overrides JSONB on workshop_pages (CSS var overrides) |
| `040_signup_details.sql` | signup_details JSONB on users + extended handle_new_user trigger |

> Migrations 026–029 are intentionally skipped — the jump to 030 marked the unified threads refactor.

---

## Tables

### Identity

**`organizations`**
```
id VARCHAR(50) PK
name, slug UNIQUE
description
nextcloud_folder_id, nextcloud_folder_path, nextcloud_public_share_token
blog_password_hash, blog_password_salt
layout_mode                  -- (035) 'classic' | 'silex'
silex_published_at           -- (035) when Silex layout last published
created_at
```

**`users`**
```
id UUID PK  (= auth.users.id)
auth_user_id UUID NOT NULL UNIQUE  (enforced equal to id by CHECK)
email UNIQUE
display_name, avatar_url, bio
is_admin, trust_level (0–4)
comment_color VARCHAR(7)     -- (016) hex color for comment display
nextcloud_user_id, nextcloud_app_password, nextcloud_synced, nextcloud_oidc_synced
oidc_subject, oidc_issuer
signup_details JSONB         -- (040) onboarding metadata (interests, etc.)
last_seen_at, created_at, updated_at
```

**`user_organizations`**
```
(user_id, org_id) PK
role  CHECK IN ('owner','guide','member','viewer')
joined_at
```

**`topics`** — hierarchical tags, `parent_id` self-ref

---

### Content (legacy — still live)

**`posts`** (org_id, author_id)
```
id, org_id, author_id, title, slug UNIQUE(org_id,slug)
body, excerpt, status, visibility
nextcloud_file_id, nextcloud_synced, nextcloud_talk_token, document_url
is_rsvp_enabled
reaction_count, reply_count, view_count, last_activity_at
is_pinned, is_locked
published_at, created_at, updated_at
```

**`meetings`** (org_id, guide_id)
```
id, org_id, guide_id, title, slug UNIQUE(org_id,slug)
meeting_type CHECK IN ('sitting','theatrical','discussion','other')
description, notes, location, is_online, meeting_url
scheduled_at, duration_minutes, time_zone
recurrence_pattern, recurrence_custom_rule, recurrence_until
section CHECK IN ('amrit_vela','yoga','gurdwara')   -- amrit-canada specific
show_in_live_feed            -- (019)
show_on_workshops_page, workshop_order, subtitle    -- (022)
card_colour, card_accent_colour                     -- (022)
is_rsvp_enabled, rsvp_deadline, attendee_limit
min_attendees, notify_on_min_attendees, min_attendees_notified
nextcloud_talk_token, nextcloud_recording_id, nextcloud_calendar_event_id
nextcloud_poll_id, nextcloud_poll_synced, nextcloud_calendar_synced
status, visibility
reaction_count, reply_count, view_count, last_activity_at
is_pinned, is_locked
published_at, created_at, updated_at
```

**`replies`** — polymorphic comments
```
id, parent_type CHECK IN ('post','meeting','reply'), parent_id
user_id, content
reaction_count, edited_at
created_at, updated_at
```

**`event_pages`** — one-to-one sidecar for meetings
```
id, meeting_id UNIQUE, org_id
content JSONB, colors JSONB, table_data JSONB
drawing JSONB                -- (017) Excalidraw data
layout, is_published
created_at, updated_at
```

**`post_topics`** / **`meeting_topics`** — m2m tag pivots

---

### Content (unified — migration 030+)

**`threads`** — replaces posts + meetings long-term
```
id, org_id, author_id, title, slug UNIQUE(org_id,slug)
kind CHECK IN ('post','meeting','workshop')
format                       -- (038) enum e.g. 'standard' | 'flyer'
body, excerpt, status, visibility
scheduled_at, duration_minutes, time_zone
recurrence_pattern, recurrence_custom_rule, recurrence_until
min_attendees                -- (024)
nextcloud_talk_token         -- (025)
document_url                 -- (025)
price_tier VARCHAR            -- (037) e.g. 'free' | 'paid' | 'donation'
sessions JSONB               -- (037) array of session objects
is_meeting BOOLEAN           -- (031)
integration_settings JSONB   -- (031)
metadata JSONB
reaction_count, reply_count, view_count, last_activity_at
is_pinned, is_locked
published_at, created_at, updated_at
```

**`workshop_pages`** — one-to-one sidecar for workshop threads
```
id, thread_id UNIQUE, org_id
content JSONB
theme_overrides JSONB        -- (039) CSS custom property overrides
is_published
created_at, updated_at
```

**`content_drafts`** — WIP state saved by the unified content form
```
id, user_id, org_id
content_type CHECK IN ('post','meeting')
title, slug, body, excerpt, visibility
meeting_data JSONB, media_refs JSONB, integration_settings JSONB
current_step INTEGER
created_at, updated_at
```

---

### Arts-Collective Onboarding (032–036)

**`artist_profiles`**
```
id, user_id, org_id  UNIQUE(user_id, org_id)
-- Identity
display_name, bio, avatar_url
-- Practice (033)
medium TEXT[]                -- e.g. ['painting','sculpture']
statement TEXT
website, social_links JSONB
-- Business workbook (034 / 036)
income_goal TEXT
pricing_model TEXT
target_audience TEXT
unique_value TEXT
short_term_goals TEXT[]
long_term_vision TEXT
biggest_challenge TEXT
-- Meta
onboarding_completed BOOLEAN
created_at, updated_at
```

---

### Scheduling / Polls

**`availability_polls`** — time-slot scheduling polls (org_id, creator_id)
**`availability_responses`** — per-user response to a poll
**`availability_slots`** — individual time slot availability (yes/no/maybe)

**`question_polls`** — single/multi-choice polls (org_id, creator_id)
**`poll_options`** — answer choices with vote_count
**`poll_votes`** — individual votes (unique per user per poll)

---

### Community

**`rsvp_responses`** — guest (no-auth) RSVP for amrit-canada meetings
```
id, meeting_id, org_id
name, email, phone, message
wants_reminder, created_at
```

**`contacts`** — pre-auth lead capture
```
id, org_id, email, name, message
status CHECK IN ('new','contacted','joined')
source, user_id (nullable FK → users)
created_at
```

**`meeting_attendees`** — registered authenticated attendees
**`media`** — Nextcloud-backed file attachments (image/video/audio/document)

---

### Forum / Engagement

| Table | Purpose |
|-------|---------|
| `reactions` | likes/upvote/love/insightful on posts, meetings, replies |
| `watches` | thread subscriptions |
| `bookmarks` | saved posts/meetings |
| `notifications` | user alerts (reply, mention, reaction, etc.) |
| `flags` | content reports with reason + status |
| `moderation_log` | audit trail for mod actions |

---

### System

| Table | Purpose |
|-------|---------|
| `events` | Wide-net audit log — every significant action. See `EVENT_SYSTEM.md` |
| `nextcloud_events` | Webhook queue from Nextcloud |
| `oidc_codes` | Short-lived auth codes for the custom OIDC bridge (Nextcloud SSO) |
| `app_schema_migrations` | Migration runner tracking — filename + SHA-256 checksum |
| `tenants` / `extensions` | Supabase Realtime internals |
| `schema_migrations` | Supabase GoTrue internal migration tracking |

**View: `user_profiles`** — joins `public.users` with `auth.users` for admin display (includes last_sign_in_at, raw_user_meta_data).

---

## Triggers

| Trigger | Table | Function |
|---------|-------|---------|
| `trigger_update_reply_count` | replies | increments reply_count + last_activity_at on parent post/meeting |
| `trigger_update_thread_activity` | replies | updates last_activity_at on parent |
| `trigger_update_reaction_count` | reactions | increments/decrements reaction_count on parent |
| `trigger_event_pages_updated_at` | event_pages | sets updated_at |
| `trigger_polls_updated_at` | availability_polls | sets updated_at |
| `trigger_responses_updated_at` | availability_responses | sets updated_at |
| `trigger_question_polls_updated_at` | question_polls | sets updated_at |
| `trigger_update_poll_response_count` | availability_responses | updates response_count on poll |
| `trigger_poll_vote_count` | poll_votes | updates vote_count on option + question_poll |
| `handle_new_user` (auth trigger) | auth.users | inserts row into public.users on signup; populates signup_details (040) |

---

## Key Patterns

**Always filter by org_id:**
```typescript
const posts = await db`SELECT * FROM posts WHERE org_id = ${orgId}`;
```

**Migration naming:** `NNN_snake_case_description.sql` — runner applies in lexicographic order, tracks via `app_schema_migrations`. Use `IF NOT EXISTS` / `IF EXISTS` for idempotency.

**Schema snapshot:** `schema-snapshot-2026-04-11.sql` is a pg_dump taken before migrations 030–040. For tables added by those migrations, the `.sql` files are the source of truth.

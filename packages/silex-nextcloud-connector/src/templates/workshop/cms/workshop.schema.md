# Workshop Template — CMS Field Contract

This is the authoritative field map between DB columns, template sections,
and the Silex trait names. It is not a migration file.

## Naming conventions

- Table references use `table.column` notation (dot separated).
- All column names are snake_case.
- Trait names in the Silex editor are camelCase (data-trait attribute values).
- `spots_remaining` is computed at render time (`attendee_limit − rsvp_count`); it has no DB column.
- `discipline` is free-text varchar for now; enum taxonomy is deferred.

## Author / facilitator

Workshop pages use `threads.author_id → artist_profiles` as the facilitator source.
EAC is the publisher; the thread author is the facilitator.
`workshop_pages.author_note` overrides `artist_profiles.bio` for this workshop only.
No separate `facilitator_id` column is needed unless guest facilitators are added later.

## Where fields live

### `threads` (existing, shared across kinds)

| Column | Type | Template section | Trait |
|---|---|---|---|
| `title` | text | hero H1 | `title` |
| `body` | text (rich) | about | `descriptionLong` |
| `excerpt` | text | auto-generated fallback | — |
| `scheduled_at` | timestamptz | detail strip, register | `startDate`, `startsIn` |
| `location` | text | hero pill, detail strip | `locationName`, `locationText` |
| `format` | enum in_person\|online\|hybrid | detail strip | `format` |
| `attendee_limit` | integer | hero spots, register | `spotsText`, `spotsRemaining` |
| `price` | decimal | hero CTA, register | `priceFull` |
| `currency` | varchar(3) | register | _(combined with price)_ |
| `sessions` | jsonb array | schedule | `sessionList` |
| `tags` | jsonb array | about pills | — |
| `rsvp_deadline` | timestamptz | register | `deadlineNote` |

**Read-more expand in About:** CSS clamp on `threads.body` only. No second body field.

### `workshop_pages` sidecar (migration 038)

| Column | Type | Template section | Trait |
|---|---|---|---|
| `subtitle` | text | hero (below H1) | — |
| `description_short` | text | cards, meta, SEO | — |
| `discipline` | varchar(80) | hero eyebrow | `eyebrowText` (combined with `series_label`) |
| `series_label` | varchar(80) | hero eyebrow | `eyebrowText` (combined with `discipline`) |
| `level` | enum all_levels\|beginner\|intermediate\|advanced | detail strip | `level` |
| `language` | varchar(60) | detail strip | `language` |
| `session_count` | integer | detail strip | `sessionCount` |
| `session_duration_hrs` | decimal(4,2) | detail strip | `sessionDuration` |
| `recurrence_label` | text | hero pill | `recurrence` |
| `location_address` | text | detail strip (full address) | — |
| `accessibility_notes` | text | about (collapsed) | `accessibilityNotes` |
| `price_sliding_min` | decimal(10,2) | register | `priceSlidingMin` |
| `price_member` | decimal(10,2) | register | — |
| `sliding_scale_note` | text | register | `slidingScaleNote` |
| `registration_url` | text | nav, hero CTA, register | `registrationUrl`, `ctaHref` |
| `registration_deadline` | date | register | `deadlineNote` |
| `registration_status` | enum open\|waitlist\|full\|closed | hero, register | controls CTA label/state |
| `author_note` | text | facilitator (overrides bio) | `bio` |
| `cover_image_url` | text | hero background, OG | — |
| `gallery_image_urls` | jsonb [{url,alt,caption}] | gallery | `galleryItems` |
| `promo_video_url` | text | gallery | — |
| `seo_title` | varchar(70) | `<title>` tag | — |
| `seo_description` | varchar(160) | meta description | — |
| `og_image_url` | text | social share | — |
| `optional_sections` | jsonb {sectionId: boolean} | template editor | — |

### `artist_profiles` (via `threads.author_id`)

| Column | Trait |
|---|---|
| `display_name` | `fullName` |
| `bio` | `bio` (overrideable by `workshop_pages.author_note`) |
| `photo_url` | `photoPath` |
| `pronouns` | `pronouns` |

### `threads.sessions[]` JSONB shape

```json
{
  "id": "abc123",
  "title": "Opening circle",
  "scheduled_at": "2026-05-12T18:00:00Z",
  "duration_minutes": 90,
  "location": "Online",
  "meeting_url": null
}
```

## Optional sections

Sections with `required: false` in the manifest are omitted from public output when:
1. Their backing data is empty, AND
2. `workshop_pages.optional_sections[sectionId]` is not explicitly `true`.

The template editor stores overrides in `optional_sections` JSONB.
Missing keys fall back to `manifest.defaultVisible`.

## Fields deferred / future sessions

| Item | Notes |
|---|---|
| Registration / checkout feature | `registration_url` is an external link for now. A shared `/register/[slug]` component with internal checkout is a dedicated future session. |
| Testimonials | `workshop_testimonials` child table — filtered by `thread_id`. Not yet created. |
| Related workshops | Computed query: same discipline or overlapping tags, `status=published`. Not yet implemented. |
| Co-facilitators | `threads.co_host_ids` JSONB exists. Template rendering of co-author profiles is future work. |
| `discipline` enum | Free text varchar for now. Will be formalized (writing\|movement\|sound\|visual\|hybrid\|other) once taxonomy is agreed. User note: "discipline" as a label may be revisited. |
| `og_image_url` / `cover_image_url` | Nextcloud media picker integration is future work. |


## Template Rules

- Required sections: nav, hero, detail strip, about, facilitator, register.
- Optional sections: schedule, gallery/past sessions, testimonials, related workshops.
- Optional sections should be omitted from public output when their backing data is empty.
- Accessibility notes are optional and collapsed by default.
- Long about copy is split into visible intro copy plus optional read-more copy.

## Workshop Fields

| Field | Type | Used by | Notes |
| --- | --- | --- | --- |
| `workshop.title` | string | hero | Primary public title. |
| `workshop.discipline` | string | hero | Example: Creative writing. |
| `workshop.format_label` | string | hero | Example: 6-week series. |
| `workshop.recurrence` | string | hero, detail strip | Human display text for date cadence. |
| `workshop.start_date` | date | detail strip, register | Date-only value where possible. |
| `workshop.end_date` | date | detail strip | Optional for multi-session offerings. |
| `workshop.time_label` | string | detail strip | Human display text, avoids overfitting timezone rules early. |
| `workshop.location_name` | string | hero, detail strip | Venue or online location label. |
| `workshop.cover_image` | media path | hero | Optional visual asset. |
| `workshop.description_long` | rich text | about | Visible about copy. |
| `workshop.description_long_extra` | rich text | about | Hidden until Read more. |
| `workshop.tags` | string[] | about | Topic tags/pills. |
| `workshop.accessibility_notes` | rich text | about | Optional collapsed note. |
| `workshop.facilitator_name` | string | facilitator | Display name. |
| `workshop.facilitator_bio` | rich text | facilitator | Short biography/context. |
| `workshop.facilitator_image` | media path | facilitator | Optional image. |
| `workshop.capacity_max` | number | detail strip | Optional public capacity. |
| `workshop.spots_remaining` | number | hero, register | Prefer remaining count over filled progress bar. |
| `workshop.price_full` | money/string | hero, detail strip, register | Keep as display-safe string until pricing model is formalized. |
| `workshop.price_sliding_min` | money/string | register | Optional sliding-scale floor. |
| `workshop.registration_url` | URL | nav, hero, schedule, register | CTA target. |
| `workshop.starts_in_label` | string | register | Example: Begins in 12 days. Computed later if useful. |
| `workshop.status` | enum | hero, register | Suggested: `draft`, `open`, `waitlist`, `sold_out`, `closed`. |

## Child Collections

### `workshop_sessions`

Optional. If empty, omit the schedule section.

| Field | Type | Notes |
| --- | --- | --- |
| `session_number` | number | Sort order. |
| `date` | date | Session date. |
| `time_start` | time/string | Display start time. |
| `title` | string | Public session title. |
| `description` | rich text | Short public summary. |
| `public_preview` | boolean | Whether the session details can appear before registration. |

### `workshop_testimonials`

Optional. If empty, omit the testimonials section.

| Field | Type | Notes |
| --- | --- | --- |
| `quote` | rich text/string | Quote body. |
| `name` | string | Attribution name. |
| `role` | string | Optional context, e.g. past participant. |
| `sort_order` | number | Display order. |

### `workshop_gallery_items`

Optional. If empty, omit the past sessions/media section.

| Field | Type | Notes |
| --- | --- | --- |
| `image_path` | media path | Image from Nextcloud/media store. |
| `caption` | string | Optional caption. |
| `alt_text` | string | Required before publishing if image is meaningful. |
| `sort_order` | number | Display order. |

### `related_workshops`

Optional. This can be computed from other workshop rows later.

| Field | Type | Notes |
| --- | --- | --- |
| `title` | string | Related workshop title. |
| `date` | date/string | Human display date. |
| `url` | URL/path | Public link. |

## Silex Trait Notes

The current Silex registration exposes manifest traits as text traits for section-level editing. More specific trait types should come later, once we connect these fields to the CMS/editor bridge:

- URLs for `registrationUrl`/`ctaHref`.
- Booleans for `showLongDescription`, `showAccessibilityNotes`, and optional section visibility.
- Repeatable collection editors for sessions, testimonials, gallery items, and related workshops.
- Media pickers for cover/facilitator/gallery images.

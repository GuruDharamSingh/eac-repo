# Form naming convention, proposed (2026-11-14)

**Not pursued (developer, 2026-11-14: "dont worry about naming").** Only the commerce unit mismatches (price in major vs minor units, duration in minutes vs hours) are being fixed, inside the booking work. The rest of this document is reference only.

This proposes one name per content concept across the platform's forms, at every layer (database column, service input, form answer key, people-facing label) and in every tier (Quick-Form, Norm-Form, Deep-Form). It is based on a read-only survey of the same date: form schemas in `packages/studio-forms/src/forms/kinds/*/schema.ts`, `packages/cms-ui/src/compose/content-fields.ts`, the adapters, `meeting-content.ts`, `service-offerings.ts`, `artist-offerings.ts`, the commerce artwork types and the live schema. Status: proposed. Nothing has been renamed. The developer asked for "good practices, the best", plain and self-explanatory, and consistent across the light, medium and heavy forms.

## 1. Rules

1. **One concept, one name per layer.** Casing follows the layer: database columns and form answer keys in snake_case, service inputs in camelCase, `threads.metadata` keys in camelCase. The words stay the same, so `duration_minutes` ↔ `durationMinutes` ↔ "How long".
2. **Tiers choose fields, never names.** Quick-Form, Norm-Form and Deep-Form draw the same schema. A tier shows fewer fields or adds fields (flags `quick`, `deep`); it never renames one or gives it a second label. A value typed in Quick-Form appears under the same label in Deep-Form.
3. **Units live in the name.** Money in storage and service input is an integer in minor units, named `*_minor` / `*Minor`. Durations are integer minutes, named `*_minutes`. A form may show major units or hours, but the adapter converts and the key still says what it holds.
4. **Instants vs wall clock.** A service input takes an ISO instant (`scheduledAt`, `startsAt`). Wall-clock form values are named `*_local` and convert in the adapter, never in the service.
5. **People words are plain and fixed.** One label per concept, no synonyms: "Picture", never "Photo" or "Image". Labels use the developer's chosen words where they exist ("Why", "What").
6. **A concept lives in one place.** It is either a column or a `metadata` key, never a column for one kind and metadata for another. Every new metadata key is listed in `docs/reference/data-model.md`.
7. **Pictures always carry alt text**, as `{ url, alt }`.

## 2. The names

| Concept | Column | Service input | Form key | Label | Change from today |
|---|---|---|---|---|---|
| Title | `title` | `title` | `title` | Title | none |
| Short summary | `excerpt` | `excerpt` | `excerpt` | Why | service `descriptionShort` → `excerpt`; series `lede` → `excerpt`; cms-ui "Summary" → "Why" |
| Body | `body` (+ `body_doc`) | `body`, `bodyDoc` | `body` | What | artwork `description`/`descriptionHtml` → `body`; labels "Description"/"Body" → "What" |
| Cover picture | `cover_image_url` | `coverImageUrl` | `cover_image_url` | Cover picture | one place: a column for every kind (today metadata for meeting/post/tour, a column for service) |
| More pictures | `images` (table or jsonb `[{url, alt}]`) | `images` | `images` | Pictures | form `pictures` → `images`; `gallery_image_urls` → `images` with alt |
| Alt text | `alt` | `alt` | `images[].alt`, `cover_image_alt` | Describe the picture | add for the cover and for every kind |
| Price | `price_minor` (integer) | `priceMinor` | `price` (shown in major units) | Price | `threads.price` numeric major → `price_minor`; the adapter converts, as artwork does now |
| Lowest price (sliding scale) | `price_min_minor` | `priceMinMinor` | `price_min` | Lowest price | `price_sliding_min` → `price_min_minor` |
| Currency | `currency` | `currency` | `currency` | Currency | none |
| Starts | `scheduled_at` | `scheduledAt` (instant) | `scheduled_at_local` | When | form `scheduled_at`/`start_time` → `scheduled_at_local`; `artist-offerings` takes an instant like the others |
| Length | `duration_minutes` | `durationMinutes` | `duration_minutes` | How long | service `session_duration_hrs` → `duration_minutes` |
| Time zone | `time_zone` | `timeZone` | `time_zone` | Time zone | `metadata.timeZone` → a column |
| Place | `location` | `location` | `location` | A place | `workshop_pages.location_address` → `location` |
| Join link | `join_url` | `joinUrl` | `join_url` | A link | `meeting_url` → `join_url` (the word is also right for an offering or a class); drop the redundant `is_online` |
| Talk room | `nextcloud_talk_token` | `createTalkRoom` (action) | `create_talk_room` | Talk room | none |
| Format | `format` | `format` | derived from the Where boxes | — | none |
| Places | `capacity` | `capacity` | `capacity` | Places | `attendee_limit` → `capacity`, matching `tour_departures.capacity` and the booking module |
| RSVP | `is_rsvp_enabled`, `rsvp_deadline`, `min_attendees` | same, camelCase | same | Take RSVPs, RSVPs close, Needs at least | none |
| Who can see it | `visibility` + `min_role` (storage) | `audience` | `audience` | Who can see it | forms move from `visibility` to the `audience` words (everyone, followers, members, guides, owners); `audienceToStorage` keeps the two columns |
| Where it goes | `section` | `section` | `section` | Goes on | form `feed_slug` → `section`; labels "Publish to"/"feed" → "Goes on" |
| Also on the network | `share_to_network` | `shareToNetwork` | `share_to_network` | Also show on | none |
| Repeats | `recurrence_pattern`, `recurrence_until` | same, camelCase | same | Repeats, Until | service `recurrence_label` (free text) replaced by the shared recurrence or by series sessions |
| Kind | `meeting` | `meeting` | `meeting` | Meeting | done 2026-11-14 |

## 3. Order of work (proposed)
1. **Forms layer only, no database change.** Form keys and labels in `studio-forms` and `cms-ui/compose/content-fields.ts`: `pictures` → `images`, `feed_slug` → `section`, `scheduled_at` → `scheduled_at_local`, `audience`, the labels Why / What / Cover picture / Goes on / Places, and alt text on the cover. The adapters map to today's service inputs, so no save changes. This is low risk and makes every tier read the same now.
2. **Service inputs.** `excerpt`, `body`, `durationMinutes`, `priceMinor`, `joinUrl`, `capacity`, instants only, with the old names accepted for one release.
3. **Database**, one migration per concept with a backfill:
   - `cover_image_url` and `time_zone` columns;
   - `price_minor`;
   - `duration_minutes` on `workshop_pages`;
   - `join_url`;
   - `capacity`;
   - `location`.
   Each migration lands with its readers, and the old column is dropped later. The booking module (`docs/open/BOOKING_MODULE_2026-11-14.md`) uses `capacity`, `price_minor` and instants from its start.

## 4. Open questions for the developer
- "Why" and "What" as the labels on every kind, artwork included? Or "Description" on artwork?
- "Cover picture" or just "Cover"?
- `join_url` for the column, or keep `meeting_url`? `join_url` reads better on an offering or a class.
- Step 3 touches live tables on every site. Do it now, or after steps 1 and 2 have settled?

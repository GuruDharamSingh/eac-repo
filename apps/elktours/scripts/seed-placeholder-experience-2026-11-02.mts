// Run: docker exec eac-elktours sh -c "cd /app/apps/elktours && node /app/node_modules/.pnpm/tsx@4.20.6/node_modules/tsx/dist/cli.mjs --tsconfig tsconfig.json scripts/seed-placeholder-experience-2026-11-02.mts"
//
// Seeds ONE placeholder experience so the experience screens have something to show to
// editors. It never appears publicly:
//   - status 'draft' (forced on every run), so no public read shows it. Visibility is PUBLIC:
//     members-only (ORGANIZATION) stays in the model but is unused for now (Justin, 2026-11-02);
//   - linked to the catalogue place "Place du Tertre" through metadata.experience.placeId
//     (the place's coordinates), NOT added as a stop to any tour;
//   - title and copy say PLACEHOLDER.
// Idempotent: fixed thread id; a re-run restores the placeholder fields and the safety
// flags and leaves anything else alone. Delete it with:
//   DELETE FROM threads WHERE id = 'elkPlaceholderExp0001';
import { db } from "@elkdonis/db";

const ORG = "elktours";
const ID = "elkPlaceholderExp0001";
const SLUG = "placeholder-sketching-at-place-du-tertre";
const PLACE_SLUG = "place-du-tertre";
const HOST_EMAIL = "justin.gillisb@gmail.com";

const [place] = (await db`
  SELECT id, lat, lng FROM places WHERE org_id = ${ORG} AND slug = ${PLACE_SLUG} AND archived_at IS NULL
`) as unknown as { id: string; lat: number | null; lng: number | null }[];
if (!place) throw new Error(`Catalogue place ${PLACE_SLUG} not found (migration 235 backfill).`);
const [host] = (await db`SELECT id FROM users WHERE lower(email) = ${HOST_EMAIL}`) as unknown as { id: string }[];

const metadata = {
  experience: {
    format: "in_person",
    placeId: place.id,
    highlights: ["PLACEHOLDER: replace with the real artist's highlights"],
    ...(place.lat != null && place.lng != null ? { lat: Number(place.lat), lng: Number(place.lng) } : {}),
  },
  placeholder: true,
};
const title = "[Placeholder] Sketching at Place du Tertre with a Montmartre painter";
const body =
  "<p><strong>PLACEHOLDER: not a real offering.</strong> Seeded on 2026-11-02 so the experience pages can be built and tested. " +
  "Replace the text, link a real artist and their service, or delete it.</p>" +
  "<p>An hour with a painter from the square: how the Place du Tertre artists work, then a short sketch of your own.</p>";

await db.begin(async (tx) => {
  await tx`
    INSERT INTO threads (
      id, org_id, author_id, kind, section, title, slug, body, excerpt, status, visibility,
      metadata, price, currency, duration_minutes, location, is_online, format, published_at
    ) VALUES (
      ${ID}, ${ORG}, ${host?.id ?? null}, 'experience', 'experiences', ${title}, ${SLUG}, ${body},
      'PLACEHOLDER: a sketching hour with a Place du Tertre painter.', 'draft', 'PUBLIC',
      ${tx.json(metadata)}, NULL, 'EUR', 60, 'Place du Tertre, 75018 Paris', false, 'in_person', NULL
    )
    ON CONFLICT (id) DO UPDATE SET
      status = 'draft', published_at = NULL,
      metadata = COALESCE(threads.metadata, '{}'::jsonb) || jsonb_build_object('placeholder', true,
        'experience', COALESCE(threads.metadata->'experience', '{}'::jsonb) || ${tx.json({ placeId: place.id })}),
      updated_at = NOW()
  `;
  if (host) {
    await tx`
      INSERT INTO experience_people (thread_id, user_id, role, position) VALUES (${ID}, ${host.id}, 'host', 0)
      ON CONFLICT DO NOTHING
    `;
  }
});

// Safety check: never a stop, never public.
const [check] = (await db`
  SELECT t.status, t.visibility, (SELECT COUNT(*) FROM tour_stops s WHERE s.experience_id = t.id)::int AS stops
  FROM threads t WHERE t.id = ${ID}
`) as unknown as { status: string; visibility: string; stops: number }[];
console.log(`SEEDED ${JSON.stringify({ id: ID, slug: SLUG, placeId: place.id, ...check })}`);
await db.end();

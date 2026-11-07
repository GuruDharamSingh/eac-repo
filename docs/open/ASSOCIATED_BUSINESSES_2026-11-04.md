# Associated businesses and stewarded shells (2026-11-04)

Senior Code Officer, read-only research for the Platform Engineer. Paths are relative to `~/eac`. "Verified" means it was read or queried
on 2026-11-04. **The next free migration is 242** (241 `241_elktours_place_operating.sql` is the latest applied).

## 1. What exists: "a business on the platform"

There is **no business, venue or listing table**. A business is represented in one of two ways, and both use a `users` row.

### A. Associated organisation: an unowned directory entry (the closest match to Justin's idea)
- Model:
  - a `users` row with `entity_type = 'organization'` (migration `093_entity_type.sql`, which calls itself 092; no CHECK);
  - `claim_status = 'unclaimed'`, `auth_user_id = id` (a sentinel that never logs in), `created_by`, `source_note`;
  - published per sponsoring org through `org_profiles(org_id, user_id, role_title, tags, is_public)`.
  The header of `apps/arts-collective/src/lib/associated-orgs.ts` says: *"External businesses (galleries, curator collectives, auction
  houses) the network has a relationship with … Not an account with access: purely a directory/display entry, staff-edited."*
- Creation: `createAssociatedOrg` → `createUnclaimedProfile({ entityType: 'organization', createdBy })` (`packages/services/src/profiles.ts:747`)
  + `upsertOrgProfile`. UI: arts-collective `/hub/admin/directory` (`app/hub/admin/directory/page.tsx`, `components/hub/AssociatedOrgManager.tsx`,
  `app/api/hub/admin/associated-orgs/route.ts`). **Global admins only.**
- Fields available on `users` (verified): `display_name, headline, bio, avatar_url, city, region, country, postal_code, lat, lng, phone,
  email, social_links (the website lives here), slug, verified, verified_at, directory_listed, source_note, oad_dossier jsonb, profile_sections`.
  **Missing:** street address, opening hours, business category, OSM/Wikidata refs, and "listed by" / steward.
- **It can exist without an owner.** That is its default state.
- In use today: **0 rows.** All 19 `entity_type='organization'` rows are tenant org identity rows (see B). The manager has never been used.
- Directory visibility: `listPublicProfiles` (`profiles.ts:1215`) requires `slug` **and** `directory_listed`. But `artdirect /[slug]`
  renders any `users` slug (`getProfileBySlug`), so every shell gets a public page at `directory.arts-collective.com/<slug>`.

### B. Tenant organisation (an owned org with a site)
- `organizations` row + identity row `organizations.profile_user_id` (099) + the creator as `owner`, via `createOrganization`
  (`packages/services/src/org-create.ts`). It is reached from arts-collective `POST /api/org/create` and the Center's "create a collective" journey.
  Intake: `subdomain_confirmed = false` until an admin confirms. It also provisions a Nextcloud folder. The identity row is stamped
  `claim_status='claimed', claimed_by = owner`.
- Acting as the business: `resolveActor` (`packages/services/src/identities.ts:141`, `:162`) lets owners and guides of the org whose
  `profile_user_id` is that identity publish under it. **This is the mechanism a claimed business needs.**
- Stewardship already exists at org level: `organizations.steward_org_id` (138; a steward's owners count as forum guides, not as org
  editors). The precedent for a managed third party is `payee.managed_by_org_id` (209, charities/beneficiaries; ledger-only).
- 7 tenant identity rows are still `unclaimed` (ifac, market, oad, sunjay, fourth_way_book_readers, elkdonis, guru-dharam). They are seeded orgs
  and harmless, but they show that `claim_status` on org identities is not kept accurate.

### C. Not a business, despite the names
- `/wizard/business` (arts-collective) holds a person's own business-plan answers in `users.biz_*` columns (034/036). It does not create a separate entity.
- ArtDirect dossiers (`apps/artdirect/src/lib/oad-actions.ts`: `createDossier`, `claimDossier`, `vouchForDossier`, `reviewDossier`; `/new`,
  `/[slug]`, `components/oad/DossierActions.tsx`) are person sentinels opened by any signed-in user. Vouches are in `profile_vouches` (2 rows) and the
  `verified` badge is set by OAD stewards (`isOadSteward`).
- Classifieds are a visual ad generator, not listings. IFAC "dealers" are `org_profiles.tags` on person or org rows (`apps/ifac/src/lib/directory-admin.ts`).
- There is no venue anywhere. `threads.location` is free text, and `art_installation` (213) has no venue reference.

### The claim flow, and why it does not fit businesses
- `requestClaim` (`profiles.ts:802`) sets `claim_status='pending', claimed_by=<claimant>` (one claimant only, no evidence). `approveClaim`
  (`:1169`, global admin) and `adminAssignProfile` (`:1194`, caller-gated) both run **`mergeProfile`** (`:917`). That **folds the sentinel into the
  claimant's personal account and deletes the sentinel row.**
- That is correct for "this dossier is me". It is **wrong for a business**: the bakery would become the baker's personal profile, its slug and
  org_profiles would move onto a person, and a second staff member could never claim it. **Do not reuse `approveClaim` for businesses.**

## 2. Recommendation: how elktours places link to it

- **Link to the platform-wide record, never to an elktours copy.** The place stays elktours-local (`places.org_id`, private notes, Street View
  pose). The business is network-wide: one Boucherie Tribolet for every org and tour that mentions it.
- **Cardinality: many-to-many with history, at most one current primary per place.**
  - A building can hold several businesses (a café inside a museum), and a business can have several branches/places.
  - Shops change hands, so keep past operators instead of overwriting them.
  - The UI default is "0..1 current business" per place.
- Seed: `places.operating / operating_kind / classification` (241; all 85 places are still `NULL`, so `scripts/classify-places.mts` has not been
  run) and `place_links` (source `wikidata|osm|manual|web`) give the facts for a shell: name, address, website, OSM `opening_hours`.
  **No automatic creation.** An editor confirms each one.

## 3. Stewarded shells

**Definition.** A shell is the business's own identity row, created and kept by a **steward** (an org such as `elktours`, or the platform),
holding factual data only, until the real business **claims** it. On claim, the shell becomes a tenant org's identity (model B): the business
gets control and the record keeps its slug, links and history.

### What exists
- An unowned identity row: `users` (`entity_type`, `claim_status`, `created_by`, `source_note`, `verified`).
- Per-org publishing: `org_profiles`.
- Social proof: `profile_vouches`.
- Org stewardship of an org: `organizations.steward_org_id`.
- A managed third party with ledger-only money: `payee.managed_by_org_id`.
- Owner control of an org identity: `resolveActor`.
- Person removal: `data_deletion_requests` (216; `packages/services/src/data-deletion.ts`, form `/data/delete` in innergathering; network-wide `org_id` NULL).

### What is missing
- A business sidecar for the factual fields: address, hours, category, refs, steward, "listed by".
- A non-merging claim with evidence, several claimants, and decision history.
- **Adoption**: `createOrganization` cannot reuse an existing identity row. It always creates a new one.
- A public "unclaimed · listed by X" treatment and a claim/removal call to action on the business page.
- A removal state that keeps a tombstone, so a removed shell is not recreated by the next import.
- Access rules for stewards. Today only global admins can create associated orgs.

### Rules (proposed defaults; Justin to confirm the starred ones)
1. **What a shell may show publicly:** name, category, street address, map position, website, public phone, opening hours, and a photo of the
   **street front** only if the steward took it or it is openly licensed.
   - Every fact carries its source: OSM facts need "© OpenStreetMap contributors" (ODbL), Wikidata is CC0.
   - No bio written in the business's voice, no logo, no prices or offers, no "partner" or "recommended by" claims, and no email
     addresses of individual people.
2. **Marking:** every surface showing a shell says **"Unclaimed listing · listed by Elkdonis Tours & Experiences"** (the steward's name) plus
   "Is this your business?" and "Ask us to remove it".
   - The shell never signs content. `resolveActor` must refuse a shell identity, which it already does because there is no org row and
     therefore no owner.
   - It never appears as an author, a seller or a payee.
3. **No fake engagement:**
   - Reviews stay on the **place** (`org_reviews` target `place`), not on the business. `*` Decide whether the business page shows them.
   - No vouches on a shell.
   - `verified` stays false until a claim is approved.
   - A shell cannot be bookable, sell anything, or receive money.
4. **Claim and verification:**
   - A signed-in person submits a claim with a method: website-domain email, phone call-back, document, in person (a steward
     met them), or vouched by the steward org.
   - Approvals: a **platform admin** approves (by default). `*` The steward org's owners could approve their own shells when the method is in person.
   - On approval: an `organizations` row is created that **adopts** the shell as its `profile_user_id`, with the claimant as `owner`
     (`subdomain_confirmed=false`, `tier='free'`, no subdomain proxy).
   - The steward's links stay. The business can then edit its facts, add staff as guides, and later onboard payouts (the payee is still a person; never a connected account for an org).
   - Several claims on one business are kept; approving one rejects the others, with a reason.
5. **Stewardship transfer:** a steward org may hand a shell to another org, or to the platform (`steward_org_id` change, logged).
   - On claim, stewardship ends (`steward_org_id` stays as history in `listed_by`).
   - If the steward org closes, stewardship falls to the platform (`ON DELETE SET NULL` → the platform).
6. **Opt-out and removal:** anyone can ask for removal from the shell page or the data-deletion form.
   - The steward or a platform admin must act within a set time (`*` 30 days by default).
   - Removed means: `status='removed'`, the public page answers 410, and links from places are hidden. The row is kept as a tombstone
     (name + refs) so imports skip it.
   - A business owner asking **before** a claim gets immediate removal, with no proof needed.
7. **Directory:** shells are `directory_listed = false`. ArtDirect `/[slug]` shows the shell variant (rule 2). A separate "Businesses"
   listing uses `listPublicProfiles({ entityType: 'organization' })` once it filters on shell status.

### Where else shells add value
- **artdirect:** venues and galleries where an artist shows ("Exhibited at …" on the person page), dealers (IFAC's tag). This is the original
  purpose of the associated-orgs manager.
- **Events:** `threads.location` is text. An optional venue link (`metadata.venueId` first, a column later) gives a map, hours and the
  venue's own page for a meeting, workshop or reading.
- **Gallery parlour / hallway installations** (`art_installation`, 213/218): "installed at <venue>" for a real-world showing.
- **Tours and experiences:** stops (via places), experience hosts (a café hosting a sketching session), commission partners later.
- **Art auction:** a beneficiary charity could be a shell (unify `payee` with business identity later; it is ledger-only today).
- **Classifieds:** an ad placed by or about a business could point at its record (later; classifieds is a visual project).

## 4. Data model and phased plan

### Migration 242 `242_business_listings.sql` (network-wide; not org-owned)
```sql
-- business_listings: the business facts sidecar for a users row with entity_type='organization'.
CREATE TABLE IF NOT EXISTS business_listings (
  user_id          uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  category         text,                       -- reuse places.operating_kind vocabulary
  street_address   text, postal_code text, city text, country text,
  lat double precision, lng double precision,
  website          text, phone text,
  opening_hours    text,                       -- OSM opening_hours syntax, as sourced
  osm_ref          text, wikidata_ref text,
  facts_source     jsonb NOT NULL DEFAULT '{}', -- per field: {source, ref, fetched_at}
  status           text NOT NULL DEFAULT 'shell'
                   CHECK (status IN ('shell','claimed','removed')),
  steward_org_id   varchar(50) REFERENCES organizations(id) ON DELETE SET NULL, -- NULL = platform
  listed_by_org_id varchar(50) REFERENCES organizations(id) ON DELETE SET NULL, -- who first listed it (kept after claim)
  listed_by_user   uuid REFERENCES users(id) ON DELETE SET NULL,
  claimed_org_id   varchar(50) REFERENCES organizations(id) ON DELETE SET NULL, -- the tenant that adopted it
  removal_requested_at timestamptz, removed_at timestamptz, removed_reason text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS business_listings_osm ON business_listings (osm_ref) WHERE osm_ref IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS business_listings_wikidata ON business_listings (wikidata_ref) WHERE wikidata_ref IS NOT NULL;

CREATE TABLE IF NOT EXISTS business_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  claimant_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  method   text NOT NULL CHECK (method IN ('domain_email','phone','document','in_person','steward_vouch')),
  evidence jsonb NOT NULL DEFAULT '{}',          -- Private/ media paths only
  status   text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','withdrawn')),
  decided_by uuid REFERENCES users(id), decided_at timestamptz, reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS business_claims_one_open
  ON business_claims (business_user_id, claimant_user_id) WHERE status = 'pending';

-- place_businesses: org-owned (follows places.org_id); add to the eac_tenant tenant_isolation loop as 227 does.
CREATE TABLE IF NOT EXISTS place_businesses (
  place_id uuid NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  business_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  org_id varchar(50) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  relation text NOT NULL DEFAULT 'operates' CHECK (relation IN ('operates','hosts','former')),
  is_primary boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (place_id, business_user_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS place_businesses_one_primary ON place_businesses (place_id) WHERE is_primary AND relation <> 'former';
```
- Keep `users.claim_status` in step (shell → `unclaimed`, claimed → `claimed`), so existing readers stay correct.
- The shell row itself: `createUnclaimedProfile({ entityType: 'organization', createdBy, sourceNote: 'business:<steward>' })` with
  `directory_listed = false`.
- Not in the tenant RLS loop: `business_listings` and `business_claims` are network-wide, so writes go through services with explicit steward/admin checks.

### Services: new `packages/services/src/businesses.ts` (shared, source-exported; coordinate, then type-check every live app)
- `createBusinessShell(input, { stewardOrgId, userId })`. It dedupes on `osm_ref`/`wikidata_ref`/name+postcode and refuses tombstoned refs.
- `getBusinessBySlug` and `listBusinessesForPlaces(placeIds[])` (batched).
- `linkPlaceBusiness`, `unlinkPlaceBusiness`.
- `requestBusinessClaim`, `decideBusinessClaim`. Approve = `createOrganization({ adoptProfileUserId })` (a **new option** in `org-create.ts`
  that skips identity creation), then claimant as owner, `status='claimed'`, `claimed_org_id`, and `verified=true`.
- `transferStewardship`, `requestBusinessRemoval`, `removeBusiness`.
- `canStewardBusiness(viewer, business)` is true for owners/guides of `steward_org_id`, or a global admin.

### UI ownership
- **elktours** (`/manage/places`, the place detail, the tour builder): link an existing business, or "Create a business listing from this place"
  (prefilled from place, `place_links`, `classification`). Public: a small factual line on stops/popups with the rule-2 marking. Steward = `elktours`.
- **artdirect** `/[slug]`: the shell variant of the business page (facts, sources, marking, Claim, Remove). After claim, the normal org page.
- **arts-collective** `/hub/admin/directory`: extend `AssociatedOrgManager` into the network console with shells, claims queue, removals and
  stewardship transfer. It already holds the associated-orgs code.

### Phases
- **P1, schema and services, nothing public.** Migration 242, `businesses.ts`, and the elktours manage UI to create and link shells for the Rue
  Montorgueil stops (nysa, La Fermette, Boucherie Tribolet, Stohrer). Run `classify-places.mts` first.
- **P2, public display.** The marked factual line on elktours stops, the ArtDirect shell page with removal requests (no claims yet), and the
  410 on removal. Check signed out that no shell signs or sells anything.
- **P3, claims and adoption.** `business_claims`, the `createOrganization` adoption option, the claims queue in arts-collective, verification
  methods, stewardship transfer.
- **P4, beyond tours.** Venue links on events (`metadata.venueId`), installations, "exhibited at" on ArtDirect, a business filter in the
  directory, and possibly unifying `payee` charities.

### Questions for Justin
1. Who approves a claim: platform admins only, or the steward org's owners too (for in-person claims)?
2. Can any org steward shells, or only orgs at some tier (`organizations.tier`)? Can members of the steward org create shells, or only owners and guides?
3. Does a claimed business always become a tenant org (an `organizations` row, owner, Nextcloud folder), or can it stay a light, owned listing without a site?
4. Should place reviews show on the business page, before and after claim?
5. What is the removal deadline (30 days by default), and does a removal before claim need any check at all (immediate by default)?
6. Are shells listed in the ArtDirect directory at all (default: own page only, `directory_listed=false`), or in a separate "Businesses" listing?
7. Can a shell carry a street-front photo taken by the steward (default yes, attributed), or text and map only?

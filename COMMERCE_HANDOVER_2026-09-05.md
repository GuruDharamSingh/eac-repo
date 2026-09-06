# Commerce & Stores — handover brief

**Written 2026-09-05.** Everything under "Verified state" was checked against the
live database and code on that date. Everything under "Open questions" is
genuinely undecided — do not guess these; they change the schema.

---

## 1. Verified state

### The store exists and is now per (person, org)

`marketplace_artists` **is** the store table. It holds commerce config only:

```
user_id · org_id              PRIMARY KEY (user_id, org_id)   ← migration 092
payout_email · payout_method · commission_rate (default 30.00) · default_currency
status  pending | active | rejected
applied_at · reviewed_at · reviewed_by · rejection_reason
```

* Was `PRIMARY KEY (user_id)` with `org_id NOT NULL` — the same contradiction
  `artist_profiles` had before 084. Fixed while the table had **0 rows**.
* `applyAsArtist` is now gated on collective membership (`canClaimStore` — any
  org role anywhere). Previously any signed-in account could enter the seller
  queue with payout details attached.
* Identity is no longer duplicated into the store row. `display_name`,
  `headline`, `city`, `photo_url` are written to `users`; the store row keeps
  `bio_html` and `links` only. **`packages/commerce` now has 0 references to
  `artist_profiles`** (9 dead joins removed from queries, 1 from server).
* Store slugs were raw UUIDs (`ma.user_id::text`); now `COALESCE(u.slug, uuid)`.

**Still assumes one store per person** (harmless while `market` is the only
marketplace org, but must change before a second exists):
`getMarketplaceArtist(userId)`, and the updates at `server/index.ts` ~655 / ~675
/ ~694 scope by `user_id` alone.

The identity columns still exist on the table, marked DEPRECATED in the
migration comment. Nothing reads them any more; dropping them touches ~90
references and is cleanup, not correctness.

### Orders and the split

```
commerce_order        no store/org reference; payment config lives on the order
commerce_order_line   artist_user_id · org_id · thread_id
                      artist_share_minor · gallery_share_minor
```

* The split is computed **per line**, from that seller's `ma.commission_rate`
  (`server/index.ts` ~179, ~247). A cart spanning several sellers already
  splits correctly.
* `thread_id` on the line means products-as-threads is already half-wired.
* The split is **two-way only**. A curator/referrer share (see §3) has nowhere
  to go without a schema change.

### Payments

`packages/payments` is a provider registry (`initiate` / `confirm` /
`webhookHandler`). eTransfer is implemented. Stripe is a **stub with the correct
shape** and this comment:

> *"This file exists so the abstraction is concrete: when we add Stripe, we drop
> in the implementation here without rewiring callers."*

There are **no Stripe fields anywhere in the schema** — no `stripe_account_id`,
no customer or payment-intent columns.

### Associated organizations (built by another session, 2026-09-05)

* `users.entity_type` = `'person' | 'organization'` (no CHECK; validated in app
  code, following the 073/091 data-not-DDL precedent). Currently 34 person, 0
  organization.
* An external business is a `users` row, reusing the profile/`org_profiles`
  machinery. Console at arts-collective `/hub/admin/directory`; surfaced on
  ArtDirect as a Yellow Pages entry. **Display only — listing implies no
  access.**

### Other commerce facts

* `organizations` has **no** payout/commission/currency columns. An org-owned
  store does not exist.
* Only collection-ish table is `artwork_favorite`.
* Row counts: `marketplace_artists` 0, `artwork` 0, `auction_lot` 0,
  `commerce_order` 1, `commerce_order_line` 1.

---

## 2. Two decisions already made — read before building

**A. Duplicate migration number 092 — RESOLVED 2026-09-05.** There were briefly
two. `entity_type` sorted first (`e` < `m`) but was applied second, so a fresh
database would have replayed them in a different order than the live one.

Fixed by renumbering to `093_entity_type.sql` **and** updating its row in
`app_schema_migrations` (tracking is by filename, PK, with a content checksum —
renaming the file alone would have made the runner treat it as pending and
re-apply it). Content unchanged, so checksums still validate:
`--verify` reports 0 drifted, `--status` 0 pending. **Next number is 094.**

**B. Stripe: Express *and* the core account — DECIDED 2026-09-05.** Memory
`project_payments_stripe` recorded "one core NFP account". The user's reasoning
for changing: a single account means every sale lands in the NFP's account and
someone at the NFP then has to transfer funds to each seller by hand. Express is
faster and moves that work to Stripe.

**Both, routed per payee.** This is the standard shape, not a compromise:

* Payee **has** a connected account → destination charge with
  `application_fee_amount`; Stripe pays them on its own schedule and the money
  never sits in NFP books as seller revenue.
* Payee **has not onboarded** (or KYC stalled) → charge to the platform account
  and record what is owed; the NFP settles manually as today.

The fallback is not optional — Express onboarding is KYC and some payees will
never finish it. A store therefore needs a nullable `stripe_account_id`, and
payout mode is derived from whether it is set rather than being a separate
setting to keep in sync.

**Micro-shares should accrue regardless.** A $5 curator cut on a $1,000 sale is
0.5%; a per-sale Stripe transfer of $5 costs a material fraction of itself. Hold
small shares as a balance and pay out at a threshold, whichever mode the payee
is on.

**Out of scope for an agent:** becoming a platform that takes application fees
carries obligations (disputes, refunds, tax reporting) and changes how money
appears in an NFP's books. That is a conversation for whoever does the
collective's accounting, not a coding decision.

---

## 3. What the user described (2026-09-05), and what it needs

### a. Org owners may have a shop / act as the organization

> *"it's the organizations owners who may have a shop or act as the
> organization. a more official publication say than just the user within."*

Needs a store whose owner is an **org**, not a person. `marketplace_artists`
can't express it (`user_id` is NOT NULL and part of the PK). Shape:

```
store          owner_kind ('user' | 'org') · owner_user_id | owner_org_id
               payout config · currency · status
               stripe_account_id    ← NULL = settle via the core NFP account
store_member   store_id · user_id · role
```

`marketplace_artists` becomes the `owner_kind='user'` case. Still cheap: 0 rows.

*Temporary / alternative stores were explicitly deferred (2026-09-05) — do not
build `closes_at` yet. Commission defaults were also deferred; leave the flat
30% in place.*

### b. Associated orgs as Yellow Pages

Already built (§1). Their listings are outbound links to the business's own
site, not sellable threads.

**DECIDED 2026-09-05 — an associated org can only sell once a real person joins
that org as its owner, i.e. claims it.** Until then it stays a display-only
directory entry with no store and no payout account. This gives the record a
clean lifecycle — admin-created stub → claimed by a member → becomes a selling
org — and means "can this sell?" is answered by whether it has an owner, not by
a separate flag.

### c. Curators / collections with a share

> *"perhaps we can have curators or people showing their collection and they can
> either get a smaller or larger percentage as low as $5 from a 1000 dollar
> painting just cause a person bought it from their virtual collection."*

This is the most structurally novel idea here. It needs three things that do not
exist:

1. **A collection** — a curated set of other people's works. `artwork_favorite`
   is the seed but is a private favourite, not a public curated collection.
2. **Attribution** — the order line must record *which collection the buyer came
   through*. Nothing carries this today.
3. **A third share.** `artist_share_minor` + `gallery_share_minor` is two-way.
   A curator cut needs either a third column or (better) a general
   `order_line_share(order_line_id, party_kind, party_id, amount_minor, reason)`
   table, which also future-proofs referrals, affiliates and split collaborations.

**Economic caveat worth raising with the user:** a $5 share on a $1,000 sale is
0.5%. Under Stripe Express, a separate transfer/payout of $5 can cost a material
fraction of itself. Consider accruing curator shares to a balance with a minimum
payout threshold rather than transferring per sale.

### d. Money held until something resolves

> *"we need a way for money to be held for the org until resolved"* — 2026-09-05

**Nothing supports this today.** There is a `payout` table (1 row), but it is a
record of a transfer already decided on, not a held balance:

```
payout   artist_user_id uuid NOT NULL → users     ← an org's share cannot be held
         amount_minor · currency · method · reference
         status  pending | sent | received | failed
```

Four gaps: it cannot name an **org** as payee; every status describes a transfer
in flight rather than *"owed but not yet payable"*; there is no field for **why**
something is held; and there is no accrual side, so no balance exists to hold.

**Shape to build — an append-only ledger, with balance derived rather than
stored.** Never mutate a running total; record entries and sum them. That gives
an audit trail, which matters once this feeds an NFP's books.

```
payout_ledger
  party_kind ('user' | 'org' | 'platform') · party_id
  order_line_id (nullable — adjustments and payouts have none)
  entry_type ('accrual' | 'release' | 'payout' | 'adjustment' | 'refund')
  amount_minor (signed) · currency
  hold_reason (nullable)   why it is not payable yet
  released_at · paid_at · payout_id
```

`payout` then becomes the record of an actual transfer referencing the ledger
entries it settles, rather than the only record that money is owed.

Known reasons money would sit held — each is a real case already visible in the
codebase, and they want distinguishing because they resolve differently:

| `hold_reason` | resolves when |
|---|---|
| `no_payout_account` | the payee finishes Stripe Express onboarding (§2B) |
| `below_threshold` | accrued balance passes the micro-share floor (§2B) |
| `org_unowned` | a member claims the org as owner (§3b) |
| `dispute_window` | the refund/dispute period elapses |

**Do not build the ledger with `artist_user_id`.** Making the party polymorphic
from the start is the whole point — it is what lets an org, a curator and the
platform each hold a balance, and retrofitting it later means rewriting every
payout query.

---

## 4. Questions — answered 2026-09-05 unless marked open

1. ~~Stripe Express or one core account?~~ **Both, routed per payee.** See §2B.
2. ~~Do curators need their own Stripe account?~~ Same rule as any payee: use
   their connected account if they have one, otherwise accrue and settle
   manually. **Micro-shares accrue to a threshold either way.**
3. ~~For an org-owned store, whose Stripe account receives payout?~~
   **Either — recorded per store.** An org store may settle to the org's own
   connected account or to the claiming member's personal one, so the party is
   stored rather than inferred from ownership (ownership can change without
   the money having changed hands). Built in migration 094 as
   `stripe_account_user_id` / `stripe_account_org_id`, with
   `stripe_account_kind` generated from them.
4. ~~Can an associated organization sell?~~ **Only once a member claims it as
   owner.** See §3b.
5. ~~Does a cart span stores?~~ **No — separate carts per store.** Simplifies
   checkout and payout, and makes destination charges straightforward since one
   order maps to one payee. `commerce_order` gains `store_id`.
6. ~~Commission defaults~~ **Deferred.** Leave the flat 30%.

7. ~~What does "resolved" mean for held org money?~~ **Two release paths, and
   only two:** the payee's payout account completing KYC (automatic, on the
   Stripe webhook), and an admin releasing it manually (the escape hatch that
   also covers a dispute window elapsing without building a timer).

   Explicitly **not** automatic releases: reaching a payout threshold, and a
   member claiming an unowned org. Micro-shares still *accrue* to a balance
   (§2B) — crossing the floor just does not release it by itself. Keep
   `hold_reason` as a column so the four reasons stay distinguishable in the
   ledger; only the release trigger set is narrowed.

   `store.stripe_onboarded_at` (migration 094) is the signal for the first
   path. It exists separately from `stripe_account_id` because a connected
   account exists from the moment onboarding *starts*, so the id alone cannot
   answer "is this payee payable yet".

**Also still open:** whether the split rewrite (§5.6) should land before or
after Stripe. Doing it first means Stripe is written once against the final
shape; doing it after means Stripe lands sooner but gets revisited.

---

## 5. Suggested roadmap

Ordered so each step is useful alone and none block on Stripe keys.

1. ~~Resolve the 092 collision + confirm Q1.~~ **Both done 2026-09-05.** Next
   migration number is **094**.
2. ~~**`store` + `store_member`**~~ **DONE — migration 094, 2026-09-05.** See
   §7 for exactly what landed and what it changed in the code.
3. ~~**Finish the composite-key work**~~ **DONE — migration 095, 2026-09-05.**
   See §8.
4. ~~**`commerce_order.store_id` + one cart per store**~~ **DONE — migration
   095, 2026-09-05.** See §8.
5. **Product as a thread kind** — `commerce_order_line.thread_id` already
   exists, `threads` already has `price`/`currency`, and `kind='service'` is
   already sold this way in hidden-enneagram. This is what lets one checkout
   serve artwork, services and workshops. See memory
   `project_thread_kind_expansion`.
6. ~~**`payout_ledger` + `order_line_share`**~~ **DONE — migration 098,
   2026-09-05.** See §11. `order_line_share` turned out to be unnecessary: an
   accrual against an `order_line_id` *is* a share.
7. **Collections + attribution** — public curated collections, and a
   `via_collection_id` on the cart/order line.
8. **Stripe** — fill in `packages/payments/src/providers/stripe.ts` (the
   registry seam already exists; eTransfer is the working reference). Express
   connected accounts where `store.stripe_account_id` is set, platform account
   otherwise. See §2B.
9. **Central commerce surface** — the ArtDirect equivalent for stores: one page
   showing a person's store, listings, orders and balances across every org.

---

## 6. Conventions this repo expects

* **Data, not DDL.** Prefer a table or a validated-in-app column to a CHECK enum
  — see migrations 073 (`org_feeds`), 091 (`profile_layout`), 092
  (`entity_type`).
* **Shared packages, not per-app copies.** This repo has repeatedly built a good
  shared thing and then had one or two apps adopt it while others kept copies —
  five slug helpers, five excerpt helpers, three content forms, four poll
  systems. Check `packages/` before writing.
* **Barrel hazard.** `pnpm check-barrels` (also runs inside `check-types`).
  Anything in a client-reachable package that imports `@elkdonis/db` or
  `@elkdonis/services` needs its own subpath export, not a line in `index.ts`.
  `nextcloud` and `silex-render` are currently flagged as at-risk-but-not-broken.
* **Identity lives on `users`;** an org controls only how it *presents* someone
  (`org_profiles`). See the header of `packages/services/src/profiles.ts`.
* **art-auction compiles without `strict`** — discriminated unions do not narrow
  there. Use flat `{ ok, error? }` result shapes.
* Verify against the live DB before asserting; several "existing" features here
  are complete code with zero rows.

---

## 7. What migration 094 actually did (2026-09-05)

Applied and verified against the live database; `--verify` reports 0 drifted.
The tables were still empty when it ran, so nothing was reconciled.

### Schema

`marketplace_artists` was **renamed to `store`** — table, indexes, constraints
and trigger, so nothing in the schema still carries the old name. Then:

* Surrogate `id uuid` primary key. The old `(user_id, org_id)` PK cannot
  address an org-owned store, and `commerce_order.store_id` (step 4) and the
  payout ledger (step 6) both need one column to point at.
* `user_id` → **`owner_user_id`, now nullable**; new `owner_org_id`.
  `owner_kind` is a **generated** column (`STORED`), not a maintained one — a
  discriminator that can be derived is one that will eventually disagree with
  the columns it describes.
* `CHECK store_one_owner`: exactly one of the two owner columns. This is a
  shape invariant, not an enum — the data-not-DDL convention is about open
  value sets, and does not ask us to let a store have two owners or none.
* Two **partial** unique indexes: one store per person per marketplace, one per
  org per marketplace. Partial so the NULL half of the polymorphic pair does
  not collide with itself. `applyForStore` / `openOrgStore` use them as
  `ON CONFLICT` targets, index predicate included.
* `org_id` and `owner_org_id` are deliberately **different things**: which
  marketplace the store trades in vs. who takes the revenue. An IFAC-owned
  store selling on `market` is `(org_id='market', owner_org_id='ifac')`.
* Stripe: `stripe_account_id`, `stripe_account_user_id`,
  `stripe_account_org_id`, generated `stripe_account_kind`, and
  `stripe_onboarded_at`. `CHECK store_stripe_account_party` — no account means
  no party; an account means exactly one party owns it.
* `payout_method`'s CHECK was **dropped** rather than extended to include
  `stripe`. That list grows with every provider in `packages/payments`, and
  the provider registry there is its real source of truth.
* New `store_member (store_id, user_id, role, added_at, added_by)`.
  Deliberately **not** the same as `user_organizations`: being a member of
  IFAC should not let you price its work.

### Code (`packages/commerce`)

Domain type is now `Store`; `MarketplaceArtist` survives as a deprecated type
alias, as do `listMarketplaceArtists`, `getMarketplaceArtist`,
`listPendingArtistApplications` and `applyAsArtist`.

New: `getStore` · `getStoreForUser(userId, orgId?)` · `getStoreForOrg` ·
`listStores({orgId})` · `listStoreMembers` · `openOrgStore` · `canOrgSell` ·
`canActForStore` · `addStoreMember` · `removeStoreMember` ·
`setStoreStripeAccount` · `updateStore(storeId, …)` ·
`approveStore(storeId, …)` / `rejectStore(storeId, …)`.

Three things worth knowing:

* **The owner join had to become a LEFT JOIN.** Store identity was
  `JOIN users` — an inner join, which would have dropped every org-owned store
  out of every listing. It now LEFT JOINs both `users` and `organizations` and
  COALESCEs across them.
* **The slug fallback is the *owner's* id, not the store's.** `/artists/[id]`
  resolves a person by user id, so falling back to `store.id` would 404 every
  seller without a `users.slug`.
* **The artwork joins are now org-scoped** —
  `s.owner_user_id = a.artist_user_id AND s.org_id = a.org_id`. Joining on
  user id alone fans out the moment one person holds stores in two
  marketplaces, which 092 already made possible.

`approveStore` / `rejectStore` key off `store.id` rather than a user id, since
a user id no longer names one store. art-auction's admin queue, studio actions
and auth guard were updated to match (`requireApprovedArtist` now returns the
store as well as the user id).

### Verified

Each invariant was exercised against the live database inside a rolled-back
transaction, and the whole TypeScript surface was run end-to-end (fixtures:
person `Steph`, owned org `saw`, unclaimed org `elkdonis`):

* Two owners, no owner, an account with no party, and an account with two
  parties are all rejected.
* An org store and a person's store coexist in one marketplace.
* `openOrgStore` on an **unclaimed** org is refused; on a claimed one it lands
  `active` and records the actor as a store `owner`.
* An org store settling to the **claiming member's personal** account round-
  trips with `stripe_account_kind = 'user'` — the §4 Q3 decision working.
* `canReceiveDestinationCharge` is false with an account but no
  `stripe_onboarded_at`, true once set.
* `removeStoreMember` refuses to remove the last owner.
* Both tables were left at **0 rows**.

`pnpm check-barrels` exits 0 (the two pre-existing at-risk warnings for
`nextcloud` / `silex-render` are unchanged). `tsc --noEmit` is clean for
`packages/commerce` and adds no new errors to art-auction — its one error,
`api/upload/route.ts:121` (`Property 'reason' does not exist on
UploadValidation`), predates this work and is the no-`strict` union-narrowing
problem §6 warns about.

### Left for step 3

Addressed by migration 095 — see §8. The one carry-over: the deprecated
identity columns on `store` (`display_name`, `headline`, `city`, `photo_url`)
are still written by `updateStore`. Unchanged from 092 — cleanup, not
correctness.

---

## 8. Migration 095 + the art-auction audit (2026-09-05)

Roadmap steps 3 and 4, done together because they are one idea: address
commerce by **store**, not by `(artist, org)`.

### The bug this was really fixing

094 gave an organization a store it could own, be approved for and attach a
payout account to — and then it could do nothing. Every table downstream was
keyed on `artist_user_id`, which an org does not have. An org store could exist
and could not hold a single listing.

### Schema

```
artwork.store_id          who SELLS it        NOT NULL
artwork.artist_user_id    who MADE it         now NULLABLE
cart.store_id             one cart per store  NULL only while empty
commerce_order.store_id   the payee           NULL for service orders
```

Splitting maker from seller is the point, not a side effect. An org selling a
member's work has both and they are different people; a collective print with
no individual attribution has only a seller. The old schema could say neither.

* The backfill matched existing artwork on `(artist_user_id, org_id)` — exactly
  the natural key of a person's store — then a `DO` block **raises** if any row
  is left unmatched, rather than silently orphaning artwork nobody can be paid
  for.
* `store` gained `UNIQUE (id, org_id)` so `artwork` can carry a **composite FK**
  on `(store_id, org_id)`. `artwork.org_id` is denormalised from the store and
  `artwork_org_id_slug_key` scopes slugs by it, so the two drifting apart was a
  live hazard; now it is impossible rather than merely unlikely.
* `commerce_order.store_id` is nullable because service orders (the no-cart
  "book now" rail) are not sold by a store at all — they are a thread plus the
  selling org's configured payout email. NULL there means "settle via the org's
  configuration", not "unknown". The one pre-existing order in the database is
  exactly this case and correctly backfilled to NULL.

### One cart per store

Enforced in `addToCart`, which pins an empty cart to the first line's store and
refuses a line from another. This **replaces** the old guard in
`createEtransferOrder`, which discovered the problem at checkout — after the
buyer had built a basket that could not be sold to them. `removeCartLine` now
releases the pin when the basket empties, or removing the last line would lock
a buyer to a seller they have nothing from.

### Ownership moved off `artist_user_id`

`updateArtwork` / `setArtworkMedia` / `publishArtwork` / `archiveArtwork` all
checked `WHERE artist_user_id = $actor`. That cannot express an org store: its
artwork has no maker to compare against, and the people entitled to edit it are
its store members. All four now go through `requireArtworkAccess`, which
resolves through the store's owner **or** its `store_member` roll.

### The art-auction audit — one real bug found

`/artists/[id]` resolved its param as a **user id**, while every artwork card
links to `/artists/${artistSlug}`, which is `COALESCE(u.slug, u.id::text)`.
Once profile unification (084) started giving people slugs, every artwork card
on the marketplace pointed at a page that **threw a 500** — the slug reached
Postgres as a uuid comparison, so it was not even a 404. Verified by setting a
slug on a real user and following the link the page emitted.

Fixed with `getStoreByHandle(handle, orgId?)`, which accepts a person's slug,
an org's slug, or a raw id, and only compares against the uuid columns when the
handle is uuid-shaped. This is worth reusing wherever ArtDirect and the org
sites resolve a profile from a URL — the same mismatch is easy to reintroduce.

Two further things the audit turned up, both consequences of the maker becoming
nullable and both fixed:

* **Four `JOIN users ON u.id = a.artist_user_id` were inner joins.** They would
  have hidden every org-store piece from browse, from a buyer's favourites, and
  from the admin inventory view — the last being the worst place to hide it.
  Same failure mode as the store identity join in 094.
* **`listArtworks({artistUserId: undefined})` means "no filter", not "none".**
  The org store page would have shown every artist's work. Now scoped by
  `storeId`.
* Artwork credit falls back maker → selling store, so an org's piece reads
  "SAW" rather than showing a card with no name, which looks like a bug rather
  than a collective piece.
* "Ask the artist" resolved `userB: artwork.artistUserId`, which is null for
  unattributed work. `getArtworkContactUserId` now falls back to the store
  owner, then to its longest-standing owner-role member.

### Verified end-to-end

Against the live database, through the real server functions, with an org store
and a person's store in the same marketplace:

* An org store creates and publishes artwork **with no maker at all**, and it
  appears in public browse credited to the org.
* Store-scoped listings are correctly separated; neither store shows the
  other's work.
* A stranger cannot edit or archive either store's artwork.
* A cart pins to the first line's store and refuses a second seller; emptying
  it releases the pin.
* The resulting order carries `store_id` and eTransfer instructions naming the
  **org's** payout email — one payee, which is what a destination charge needs.
* Buying an org store's piece reserves it correctly (it dropped out of the
  `available` listing, which is how the reservation path was confirmed).

Then HTTP-checked against the running app: `/artists/<slug>`, `/artists/<uuid>`,
`/artists/<org-slug>` all 200, an unknown handle 404s (previously 500), and
`/artists/saw` lists the org's print and nothing else.

**All test data was removed**: `store`, `store_member`, `artwork` and `cart` are
back to 0 rows, the single pre-existing order is untouched, and the `users.slug`
set as a fixture was reverted to NULL. `--verify` 0 drifted, `check-barrels`
exits 0, `tsc` clean for commerce and no new errors in art-auction.

### Next

* **Step 5, product as a thread kind** is now the natural one — the store is the
  payee seam it needs, and `commerce_order_line.thread_id` already exists.
* Service orders should eventually be sold *by a store* rather than by org
  config, which would let `commerce_order.store_id` become NOT NULL.
* art-auction's studio is still a single-store UI. An org store can be created,
  approved, listed and sold from through the service layer, but there is no
  screen for a store member to manage one — that is the next piece of UI, and
  the one whose shape ArtDirect and the org sites will copy.

---

## 9. CORRECTION — the maker is the payee (migration 096, 2026-09-05)

**Read this before §2, §3 or §7.** Sections 094 and 095 built toward a store
that *receives* money. That was wrong, and the user corrected it:

> *"artists are main recipients of all transactions, stores are just fronts,
> when something is purchased through a store it is just a log of where its
> presented through"*

### The model, settled

* **The maker is the payee.** A front never is. `commerce_order.store_id` and
  `commerce_order_line.presented_store_id` stay exactly what they are — a log
  of *through whom*, never *to whom*.
* **A split exists only where the artist accepted an agreement with that org.**
  No accepted agreement means **no claim**: the artist takes 100% and the org
  keeps only the record that it presented the work. A split on terms nobody
  agreed to is not a split, it is a deduction.
* **An org's share is not a Stripe destination.** It accrues to the host
  account, earmarked to that org. **Orgs never hold connected accounts** and
  never face KYC. This supersedes §2B's "routed per payee" as it applied to
  orgs — it still holds for people.
* **Work with no maker** — an org's own print or merch — earmarks the whole
  amount to the org. `artwork.artist_user_id` stays nullable (095).

All three were confirmed by the user on 2026-09-05, closing §4 entirely.

### What 096 changed

**Payout identity moved to the person.** `users.payout_email`,
`payout_method`, `stripe_account_id`, `stripe_onboarded_at`. An artist selling
through three orgs onboards once and is paid once. The five Stripe columns 094
put on `store` were dropped — including `stripe_account_org_id`, which the
correction made meaningless. `store.payout_email` and `store.commission_rate`
are now DEPRECATED and decide nothing.

**Agreements are a real, versioned layer** — `org_agreements` +
`org_agreement_acceptances`, shaped after `questionnaires` (088/089), the
repo's existing org-authored precedent. In `packages/services/src/agreements.ts`
with its own subpath export (`@elkdonis/services/agreements`), because the
layer is org-agnostic: the same records will govern workshops and services, not
just artwork.

**An order line explains its own split** — `agreement_id`, `org_share_percent`,
`payee_org_id`, `presented_store_id`. A NULL `agreement_id` is meaningful: it
records that nothing authorised a split. A settlement can be re-derived years
later without trusting rows that have been edited since.

### The semantics that took two attempts

**An acceptance binds to one version, and that version governs until the person
accepts another or withdraws.** Getting this right is the whole point of the
layer, and the first implementation got it backwards:

* `resolveOrgShare` originally required the agreement to still be `active`. But
  `publishAgreement` retires the previous version — so publishing v2 orphaned
  every v1 acceptance and **silently dropped the org's cut to zero.** The fix
  is that retirement stops *new* acceptances (`acceptAgreement` refuses a
  retired version); it cannot void one already given, any more than either side
  can void a signed contract by discarding their own copy.
* Conversely, accepting a version now **supersedes** any other live acceptance
  of the same `(org, key)`, or a person would hold two live acceptances of one
  contract at different rates with tie-break order deciding which applied.
* Revocation is recorded, never deleted, so a sale settled while an agreement
  was live stays explained by it afterwards.
* Where an org holds several *different* accepted agreements with one person,
  the **smallest** cut wins — if the org's records are ambiguous, the artist
  should not be the one who pays for it.

### Verified end-to-end

Through the real server functions, on a $1,000 piece by an artist, presented
through an org's front:

| step | artist | org |
|---|---|---|
| no agreement | $1,000 | $0 |
| org publishes 30% terms, artist has not accepted | $1,000 | $0 |
| artist accepts | $700 | $300, earmarked to `saw`, traced to the agreement |
| org publishes v2 at 50%, artist has not accepted it | $700 | $300 — still v1 |
| artist accepts v2 | — | rated 50% |
| artist withdraws | $1,000 | $0; the earlier sale still names v1 |
| org's own tote, no maker | $0 | $40 earmarked |

Re-accepting a retired version is refused. The maker-less sale routes the
buyer's eTransfer to `HOST_PAYOUT_EMAIL` — the host account — because the org's
claim is the ledger entry, not the transfer.

Cleanup left `store`, `artwork`, `cart`, `org_agreements` and acceptances at 0
rows, the one pre-existing order untouched, and no `users.payout_email` set.
`--verify` 0 drifted, `check-barrels` 0, `tsc` clean for commerce and services'
own sources, no new errors in art-auction.

### What this leaves for the ledger (step 6)

The design in §3d still stands and is now *more* clearly right: `payout_ledger`
with a polymorphic party, balance derived by summing. What changed is that
`party_kind = 'org'` is no longer an edge case — **it is the only way an org
ever holds money**, since it has no connected account. `hold_reason` should
gain nothing for agreements: a missing agreement produces no accrual at all
rather than a held one.

Also still to do: `packages/commerce/src/money/splitCommission` still names its
outputs `artistShareMinor` / `galleryShareMinor`. The arithmetic is right and
the caller renames them (`makerShareMinor` / `orgShareMinor`), but the shared
helper should follow.

### The org-site UI, not yet built

The user asked for "the ability to ask members to agreements and create them
through an org site based ui". The service layer is complete and org-agnostic —
`draftAgreement` / `updateDraftAgreement` / `publishAgreement` /
`listAgreementsForMember` / `acceptAgreement` / `listAcceptances` — but no app
renders any of it yet. That is the next piece, and it belongs on the org hub
(arts-collective `/hub/admin`), not in art-auction, since agreements govern far
more than the marketplace.

---

## 10. Every purchasable thing, and the agreements UI (migration 097, 2026-09-05)

### The audit

Asked to check that products, workshops and events go through the same commerce
logic. They did not. Three rails answered "who gets paid" three different ways:

| rail | order? | payee | split |
|---|---|---|---|
| artwork | `commerce_order` | the store's `commission_rate` | store-configured |
| **service threads** | `commerce_order` | **the selling app's config email** | **hardcoded 0** |
| **workshop threads** | **none at all** | **an environment variable** | **none** |

The service rail meant a practitioner's booking fee went to the *site's* inbox
rather than to them. The workshop rail had no order, no line, no split, and no
way to be marked paid — `workshop_join_requests.status` had never left
`'pending'` anywhere in the codebase, which the 3 rows in the database confirm.

### One resolver

`packages/commerce/src/server/settlement.ts` — `resolveSettlement({ makerUserId,
orgId, amountMinor })` is now the single answer to "where does this money go",
and all three rails call it. It throws when a maker has no payout email rather
than falling back to the host account: silently redirecting an artist's money to
the collective is the worst available failure mode, and it is exactly what the
service rail was doing.

### `createServiceOrder` → `createThreadOrder`

Generalised to any purchasable thread kind, with `PURCHASABLE_THREAD_KINDS =
['service', 'workshop', 'event', 'product']` living in commerce rather than the
database. Migration 097 **dropped `threads_kind_check`** — the last CHECK enum
of its kind, which 073/091/093 had already moved away from everywhere else, and
which would otherwise need a migration to add `product`. Which kinds are
*purchasable* is a commerce decision, not a schema one.

`workshop_join_requests` gained `order_id`, and inner-gathering's join route now
creates a real order. Orders record where the buyer was told to pay in
`payment_metadata`, so a caller renders its confirmation from the order instead
of from a constant it happens to hold.

**Verified** on a seeded $150 workshop: no agreement → guide keeps $150; with a
20% hosting agreement accepted → guide $120, org $30 earmarked and traced to the
agreement; buying a `post` is refused; and a guide with no payout email cannot
be sold on behalf of at all.

### The agreements console

`/hub/agreements` in arts-collective, linked from `/hub/admin` and from the
organisation tab (owners only).

* **Owner side** — draft terms, publish them as a separate confirmed step,
  retire them, and see who has accepted each version. Publishing is not one
  keystroke from a half-written draft, because a live agreement is what
  authorises another party to take a cut of someone's sale.
* **Member side** — what each org you belong to is asking of you, with accept
  and withdraw. Deliberately lists orgs you *cannot* edit: a plain member is
  exactly who gets asked.
* Server actions re-check org ownership on every call rather than trusting the
  org id from the form.
* On the org hub rather than in art-auction, because agreements govern
  workshops and services as much as artwork, and art-auction is only one front.

### Still open

* `splitCommission` still names its outputs `artistShareMinor` /
  `galleryShareMinor`; callers rename to maker/org.
* No `product` threads exist yet — the kind is accepted by the purchase rail and
  by `threads.kind`, but nothing creates one.
* The payout ledger (step 6) remains the big missing piece. `payee_org_id` +
  `gallery_share_minor` on the line now record what an org is owed, but nothing
  accrues, holds or releases it.
* Rows in `workshop_join_requests` created before 097 have no `order_id` and can
  only be resolved by hand.

---

## 11. The payout ledger (migration 098, 2026-09-05)

Roadmap step 6. Two things were broken without it, both live:

1. **`payout.artist_user_id` was NOT NULL**, so confirming payment on an
   org-owned piece — which has had no maker since 095 — would have **thrown**.
2. **The org's share went nowhere.** `gallery_share_minor` was computed,
   written to the line, and then lost. "Earmarked inside the host account" was
   a comment, not a record.

### Shape

`payout_ledger`, append-only, with the party polymorphic from the start —
`user | org | platform`. That was the one thing the brief insisted on and it is
what makes an org balance expressible at all; an org has no connected account
and receives no transfer, so a ledger row is the *only* form its money takes.

Balances are **derived by summing**, never stored. A reversal is a new negative
entry. A release is a new zero-amount row pointing at the accrual it frees, so
nothing is ever mutated: the accrual keeps saying why it was held, and the
release keeps saying who decided otherwise.

**`order_line_share` is not needed.** The brief proposed it for the third-party
(curator, referrer) case. An accrual against an `order_line_id` already *is*
that party's share of the line, so a curator's cut is another accrual row on the
same line. One table, no dual-write, no second place for a split to disagree
with itself.

`payout` becomes what it should always have been: the record of a transfer that
actually happened. `artist_user_id` is now nullable with a `party_org_id`
alongside it.

### Guards worth knowing

* `payout_ledger_one_accrual_per_line` — a partial unique index on (line, party)
  for accruals only. Re-confirming a payment cannot pay twice.
* `payout_ledger_release_is_zero` — a release changes payability, not the
  balance.
* `payout_ledger_one_party` — a party is exactly one thing, or the platform,
  which is neither.

### Releases: two triggers, as decided

* **KYC completing** — `setPayoutIdentity` calls `releaseOnPayoutAccountReady`
  when `stripeOnboardedAt` lands, so every route to "this person is now payable"
  passes through one place rather than a webhook handler knowing the rule.
  It releases only `no_payout_account` holds: an amount held for a dispute
  window is not freed by the payee finishing onboarding.
* **An admin releasing** — `releaseHold`, exposed at
  `/hub/admin/ledger`. Network admin only: an org cannot free its own held
  balance, or the hold means nothing.

Reaching a payout threshold and a member claiming an unowned org still do **not**
auto-release. `hold_reason` keeps all four reasons distinguishable.

### Verified end-to-end

A $1,000 sale under an accepted 30% agreement, plus the org's own $50 tote:

* Maker's ledger shows **accrual $700 then payout −$700** — netting to zero
  because eTransfer pays them directly, with both halves on the record. "It was
  owed and then it was paid" is the history an audit needs; a net of zero
  appearing from nowhere is not.
* Org balance: $350 total, $0 payable, $350 held under `dispute_window`.
* Releasing one entry → $300 payable, $50 held. Releasing it **again** is a
  no-op, and the accrual still records `dispute_window` as why it was held.
* A `no_payout_account` hold on a second person was released automatically the
  moment `stripeOnboardedAt` was set.
* A refund is a new negative entry; the balance moves, nothing is edited.
* Confirming the same order twice is refused by the order status guard.

### A process note

The KYC-release wiring silently did not apply on the first attempt: a
`str.replace()` whose target had the wrong indentation no-opped, so the import
landed and the call site never did, and `tsc` was perfectly happy. The e2e test
caught it. Every scripted edit in this work asserts its target is present —
except that one.

### Consoles

* `/hub/agreements` — org owners author terms and see acceptances; every member
  sees what they have been asked to agree to (§10).
* `/hub/admin/ledger` — what the collective is holding, why, and the release
  action. Network admin only.

Both on the arts-collective hub, because agreements and held funds span every
org and every purchasable kind, not just the marketplace.

### What is left

* **Stripe itself** (step 8) — `packages/payments/src/providers/stripe.ts` is
  still the stub. The seam it needs now exists on both sides: `resolveSettlement`
  says who and how much, `users.stripe_account_id` +
  `canReceiveDestinationCharge` say whether a destination charge is possible,
  and the ledger holds whatever cannot be sent.
* **Collections and curator attribution** (step 7) — now a small job: a curator
  share is one more accrual on the line, and `via_collection_id` on the cart.
* `splitCommission` still names its outputs `artistShareMinor` /
  `galleryShareMinor`; callers rename them to maker/org.
* No `product` threads exist yet — the kind is accepted by the purchase rail
  and by `threads.kind`, but nothing creates one.
* art-auction still has no UI for managing an org-owned store.
* Pre-097 `workshop_join_requests` rows have no `order_id` and can only be
  resolved by hand.

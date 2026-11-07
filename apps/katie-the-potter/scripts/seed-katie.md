# Seeding Katie's store and first pieces

> Editing the site (Studio, smart Piece blocks, the look layer, site style,
> the piece-detail template): see `docs/editor.md`.

## Handing the shop to Katie (the claim link) — the way to do it now

The site was set up on a placeholder account (katie@katiethepotter.example):
it owns the org `katie-the-potter` and the store on Collect Art. Katie
does not need that address or any env change. To hand everything over:

1. Sign in as an owner of the site (the placeholder) or as a network admin,
   open **/manage/people → Hand the shop to its owner → Create a hand-over
   link**, and copy the link (`https://pottery.arts-collective.com/claim/<token>`).
   It is shown once (only a SHA-256 of it is stored, table
   `org_claim_tokens`, migration 247), works once, and expires after 7 days.
   Creating a new link revokes the older unused one; "Stop the open link"
   revokes it.
2. Send it to Katie. She opens it, signs in or creates an account (sign-up
   is offered first), and presses **Yes, make me the owner**.
3. In one transaction (`src/lib/manage-claim.ts` redeemClaim): she becomes
   `owner` of the org; the store moves to her (`store.owner_user_id`, a
   `store_member` owner row for her, the placeholder's store_member row
   removed); the store's pieces credit her as maker (`artwork.artist_user_id`);
   the placeholder drops to `viewer` (the account is kept); the token is
   consumed with a record of what moved (`org_claim_tokens.result`).
   Past orders and ledger lines stay with the placeholder: they are history.
   If she already owns a store on Collect Art, the claim refuses (one
   person-owned store per marketplace) and an admin merges by hand.
4. The site follows the new owner within a minute (owner/store caches have a
   60 s TTL), with no env change. Afterwards set `KATIE_THE_POTTER_OWNER_EMAIL`
   in .env to her address only if you want the email fallback to match.
5. She then sets up **/manage/payouts** (country first; eTransfer email or
   Stripe Express onboarding). Card sales pay her directly once Stripe is done.

Tested 2026-11-07 with a throwaway account (claim-test+…@example.com): claim,
verify, then REVERTED with `scripts/claim-test.ts MODE=revert` (store owner,
pieces and org role back to the placeholder; the throwaway's
user_organizations and users rows deleted; GoTrue user deleted). Baseline
before the test had no store_member rows, and that is what it was put back to.


## What was actually run (2026-11-06) — placeholder account + six sample pieces

So the live `/` renders cards before Katie exists, a placeholder was seeded the
platform way. Secrets are not recorded here.

1. GoTrue account `katie@katiethepotter.example` (random password, email
   confirmed) via `POST http://supabase-auth:9999/admin/users` from a one-off
   `admin` container using its own `SUPABASE_SERVICE_KEY`. `handle_new_user`
   made `users` row `54b78c63-51ca-4836-8ca9-542854eb614e` (slug / storage
   folder `katie`).
2. Migration `244_katie_the_potter_owner.sql` (the owner insert again, now
   that the row exists) → role `owner` in `katie-the-potter`.
3. `scripts/gain-space.ts` → `gainSpace(userId)`: `oad` member, storage ready.
4. `scripts/seed-katie.ts` (see its header for the exact command): uploaded
   `.seed-images/*.png` (gitignored renders of `public/samples/*.svg`) to
   `EAC_Network/users/katie/Media/Images/katie-sample-*.png`; `applyForStore`
   + `approveStore` → store `632bb16f-fe37-45e9-9611-2de298bed2ad` (org
   `market`, active); six artworks via `createArtwork` + `publishArtwork`,
   each `metadata.sample = true`, two pictures each; one at price 0 (on
   request), one set `sold` and one `reserved` with the same status update
   the order flow uses; `users.payout_email` = the placeholder address and
   `profile_sections.store = true`. No Stripe objects.
5. `DEFAULT_HOME`'s hero now points at
   `/api/media/EAC_Network/users/katie/Media/Images/katie-sample-hero.png`.

### Retiring the samples later

Once real pieces exist (or Katie's real account replaces the placeholder):

```sql
UPDATE artwork SET status = 'archived'
WHERE store_id = '632bb16f-fe37-45e9-9611-2de298bed2ad' AND metadata->>'sample' = 'true';
```

(Through a migration or app code — guru has no psql.) The pictures can be
deleted from her Nextcloud folder by hand; the store itself stays and becomes
hers. If a different account becomes the owner, re-run `gainSpace` and the
seed script's store step for that user, or transfer the store in the admin.

---

## Original plan (kept for reference)

Nothing about the store is in SQL. Migration `243_katie_the_potter.sql` creates
only the site org (`katie-the-potter`) and an `owner` membership row keyed by
her email, which stays a no-op until a `users` row with that address exists.
The store and the listings go through the real server functions so every guard
(collective membership, approval, publish requirements) is exercised.

## Order of operations

1. **Katie signs up** on the site (`/login` → Create account) with her real
   address, or is provisioned through GoTrue/admin. This creates `users` and,
   via the signup route, a `viewer` row in `katie-the-potter`.
2. **Owner role.** If her address matches the migration's placeholder it is
   already `owner`; otherwise a new migration repeats the insert with the real
   address (never edit 243 once applied), or the role is set from the admin app.
   Also set `NEXT_PUBLIC_KATIE_THE_POTTER_OWNER_EMAIL` in `.env` for the
   `katie-the-potter` service and recreate it (`docker compose up -d`): the
   address is baked into the build.
3. **Collective membership (`oad`).** `applyForStore` refuses anyone who is not
   a member of the collective (`canClaimStore`). `gainSpace(userId)` from
   `@elkdonis/services` (packages/services/src/artist-space.ts) gives her the
   `oad` membership, the artist roster row and her storage folder in one call.
4. **Store + first piece** with the commerce seed script, which is idempotent per
   person: an existing store is reused and approved if pending; a piece is only
   created when no artwork with the same title exists in that store.

## The command

Run from the host, once her account exists. `art-auction` is used because it is
a running container with the commerce package available; nothing here touches
Stripe (no keys are read by these functions).

```sh
cd ~/eac

# 3. collective membership — one-off, through the service function
sudo -n docker compose exec -T -e SENDGRID_API_KEY= art-auction sh -c \
  "cd /app/packages/services && node /app/node_modules/.pnpm/tsx@4.20.6/node_modules/tsx/dist/cli.mjs -e \
   \"import { db } from '@elkdonis/db'; import { gainSpace } from './src/artist-space.ts';
     const [u] = await db\\\`SELECT id FROM users WHERE lower(email) = lower('KATIE_EMAIL')\\\`;
     if (!u) throw new Error('no user'); console.log(await gainSpace(u.id)); process.exit(0);\""

# 4. store (applied + approved) and the first listed piece
sudo -n docker compose exec -T -e SENDGRID_API_KEY= art-auction sh -c \
  "cd /app/packages/commerce && \
   SEED_EMAIL=KATIE_EMAIL \
   SEED_APPROVER_EMAIL=justin.gillisb@gmail.com \
   SEED_TITLE='Tenmoku tea bowl' SEED_PRICE=95 \
   SEED_KIND=original SEED_MEDIUM='Stoneware, tenmoku glaze' \
   SEED_IMAGE_URL=/api/media/EAC_Network/users/<her-slug>/Media/Images/<file>.jpg \
   SEED_PAYOUT_EMAIL=KATIE_EMAIL SEED_SHOW_ON_PROFILE=1 \
   node /app/node_modules/.pnpm/tsx@4.20.6/node_modules/tsx/dist/cli.mjs scripts/seed-listing.ts"
```

Replace `KATIE_EMAIL`, `<her-slug>` (`users.slug`, created by `gainSpace`) and
the image file (upload it first from the studio's image picker, or copy it
into her Nextcloud folder). `SEED_PRICE=0` publishes as "price on request".
Further pieces: either rerun with another `SEED_TITLE`/`SEED_IMAGE_URL`, or
have Katie list them herself in the Collect Art studio once she has a store —
the site reads the store live (`src/lib/artworks.ts`), so nothing here needs
redeploying.

## Portfolio pieces (shown, not for sale)

A draft or archived artwork with `metadata.site = 'portfolio'` appears on the
site as a picture only. Set it from the marketplace studio, or:
`UPDATE artwork SET metadata = metadata || '{"site":"portfolio"}' WHERE id = '…'`
(through a migration or app code — guru has no psql).

## Stripe

Not part of seeding. Her payouts need Express onboarding, done by her from the
marketplace (`/manage` → payouts) once the store is active. Never create Stripe
objects from scripts: the keys are live.

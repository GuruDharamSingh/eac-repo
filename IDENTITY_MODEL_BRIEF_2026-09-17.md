# Identity model: one account, several names

**2026-09-17.** Foundation and UI built. Migration `132_identity_control.sql`
is **written and dry-run verified but NOT applied** — see *Applying it* below.
Nothing has run end-to-end, because the table does not exist yet.

---

## The finding the design rests on

The network already separated **account** from **identity**; it just never said
so. A login is a row in `auth.users`. An identity is a row in `public.users`.

```
 entity_type  | claim_status | rows | have_gotrue_login
--------------+--------------+------+-------------------
 organization | claimed      |    8 |                 0
 organization | unclaimed    |    7 |                 0
 person       | claimed      |   21 |                20
 person       | unclaimed    |   18 |                 0
```

**34 of 54 identities have no login behind them** — unclaimed ArtDirect
dossiers, and the organisations' own profile rows from migration 099.

And every content table points at the *identity*, never the account:
`threads.author_id`, `media.uploaded_by`, `store.owner_user_id`,
`user_organizations.user_id`.

So a pen name is not a new kind of object. It is an ordinary `users` row with
no login, plus one fact the schema could not record: **which account may speak
as it**. No content table changes.

## Why a table and not a column

`users_auth_user_id_matches_id CHECK (auth_user_id = id)` forbids the obvious
"two rows, one account" move, so the link must be explicit. It is
`identity_control`, not `users.controlled_by`, because
`USER_COLS` in `packages/services/src/profiles.ts` already carries
`claim_status, claimed_by, created_by, source_note` into every profile read and
on to the browser. A column would join that list the first time someone added
it for convenience. **A separate table cannot leak by accident — it has to be
joined on purpose.**

It is also not `users.claimed_by`: that means "this account asserts it is the
same person as this sentinel," and its flow ends by *deleting* the sentinel.
Control is the opposite — the second row is meant to persist.

## A pen name and a solo org are the same object

Both are "a named identity one account speaks as." The difference is only what
the identity may *hold* — a pen name holds authorship; an org additionally
holds membership, a feed, storage, a domain, a store. Since an org's identity
is already a `users` row (`organizations.profile_user_id`), **one resolver
serves both**: `resolveActor()` returns `self | pseudonym | organization`.

## What was built

| | |
|---|---|
| `packages/db/migrations/132_identity_control.sql` | `identity_control` + no-chaining trigger + `organizations.created_by` |
| `packages/services/src/identities.ts` | `getIdentityIds`, `listActingIdentities`, `resolveActor`, `createPseudonym`, `retire`/`restore`, `accountForIdentity` |
| `forum.ts` | `ForumViewer.identityIds` + `viewerIdentityIds()` |
| `forum.ts`, `forum-search.ts`, `forum-people.ts`, `forum-write.ts`, `media-authz.ts` | `author_id = viewer` widened to `= ANY(identity set)` |
| `forum-write.ts` | rate limit now per **account**; `createTopic` takes `actingAs` |
| `apps/forum`, `ifac`, `amrit-canada`, `hidden-enneagram` | viewers populate `identityIds` |

### The bug this had to avoid

`author_id = viewer.userId` is **not only an ownership test in this codebase —
it is a visibility grant**. It is what lets someone see their own unpublished
and org-only threads (`forum-write.ts:98`, `forum-people.ts:93`,
`forum-search.ts:40`, `forum.ts:232`, `media-authz.ts:255`). Un-widened, the
first post under a pen name would have gone invisible to its own author.

### Three landmines closed

1. **Directory.** `directory_listed` defaults `TRUE`, and the listing rule
   (`slug IS NOT NULL AND directory_listed`) has no `entity_type` filter — a
   new row would have walked straight into ArtDirect. `createPseudonym` writes
   `FALSE`; the owner opts in later.
2. **Back-references.** The row is created with `created_by`, `claimed_by` and
   `source_note` all NULL, because all three are public. `identity_control` is
   the only record of the link.
3. **Rate limits.** Were counted per `author_id`, so every pen name got a fresh
   quota. Now counted across the account's whole identity set.

## Verified

Dry-run in a transaction, rolled back (`ON_ERROR_STOP=1`, exit 0):

- a pen name cannot own a pen name, and an owner cannot become one — refused
- two accounts cannot claim one identity — refused (PK)
- self-control — refused (CHECK)
- identity set resolves to 2, and back to 1 after retirement
- the pen name is excluded by the directory rule and carries no `created_by`
- `packages/services` type-checks clean from source (`src/`; the pre-existing
  `../utils` and `../nextcloud` DOM-lib errors are untouched and not from this)

**Not** verified: no UI exists, so nothing has been rendered or posted
end-to-end.

## Orgs a user made, vs the user

`user_organizations.role='owner'` could not distinguish *"the org I founded,
which is really just me"* from *"the collective that made me an owner"* — and
that is exactly the distinction someone needs when choosing whether to speak as
themself, a pen name, or a body. `organizations.created_by` records it.
`confirmed_by` is not this (that is staff approval of the subdomain).

**The backfill is an inference** — the founding act was never logged, so it
takes the earliest owner. **7 of 17 orgs have no owner row at all**, so
`created_by` stays NULL for them and must be set by hand:

```
elkdonis · fourth_way_book_readers · guru-dharam · ifac · market · oad · sunjay
```

The second axis — whether an org is a *vehicle for one person* or a *body with
plural membership* — is derivable today (count non-owner members) but is not
declared, so the hub cannot state it and the org cannot choose it. Deferred.

## Open decisions

1. **`MAX_PSEUDONYMS = 2`** — a service constant, deliberately not a CHECK.
2. **Are pen names revealable to org owners?** `accountForIdentity()` exists and
   is documented server-side-only. Nothing calls it. Whether a moderator may is
   a policy call, not a technical one.
3. **Can a pen name hold an org, a store, or a workshop?** Currently nothing
   stops it structurally except the no-chaining trigger.
4. **Money must not be pseudonymous.** `users.payout_email`,
   `stripe_account_id` and `store.owner_user_id` sit on the identity row, so a
   pen name would carry its own payout fields. Under the settled model (maker
   is payee, migrations 096–098) payouts must resolve to the controlling
   account. **Not yet enforced.**
5. **Nextcloud has no pen name.** Storage is keyed on `nextcloud_user_id`.
   Intended: pen-name media lives in the account's tree, served under the pen
   name. Not yet implemented.

## Known gap

`packages/services/src/gather.ts:122` has the same visibility clause and was
**not** widened — it is another session's uncommitted file with its own
`GatherViewer` type. Its failure mode is under-visibility (an author not seeing
their own thread), never a leak. Fix when that work lands: add `identityIds` to
`GatherViewer` and swap the clause for `t.author_id = ANY(${mine}::uuid[])`.

## Applying it

The migration was blocked by this session's sandbox, so it is still pending.
`129_email_template_config_decode.sql` is also pending and belongs to another
session — the runner applies *all* pending migrations in order, so check with
`--status` first.

```bash
docker compose exec forum sh -c "cd /app/packages/db && node scripts/migrate.mjs --status"
```

## The UI layer

Built on the existing face → surface pattern, so it is furniture the hub
already knows how to host rather than a new screen.

| | |
|---|---|
| `cms-ui/surface/types.ts` | `identities` descriptor, `SurfaceIdentity`, `SurfaceIdentityConnectors`; `compose` gains `actingAs` |
| `cms-ui/surface/surfaces/IdentitiesSurface.tsx` | the panel: list, open a name, retire/restore |
| `cms-ui/hub/IdentitiesFace.tsx` | the tile — draws the names as chips, not a description of the feature |
| `cms-ui/surface/surfaces/ComposeSurface.tsx` | a **Signed** picker above the fields |
| `cms-ui/hub/connectors.ts` | `identities` is host-supplied (no default route — only the host knows where its account lives) |
| `arts-collective /api/hub/identities` | GET / POST / PATCH, all scoped to the signed-in account |
| `arts-collective` console host + `ConsoleFaces` | connector wired, face mounted |
| `arts-collective/lib/cms/actions.ts` | `createThreadAction(input, { actingAs })` → `resolveActor` → `author_id` |

Three decisions worth keeping:

- **The byline sits above the fields, not beside Save.** Which name signs a
  piece changes how it gets written, so it is a decision before typing rather
  than a switch to find afterwards. It is drawn only when there is more than
  one option — a select showing one name implies a choice that isn't there.
- **Re-signing is not offered on an edit.** Changing the byline of something
  already published rewrites history under a different name; that is a
  different act from choosing how to sign what you are writing now.
- **Permission follows the person, the byline follows the identity.**
  `canEditOrgSite` still runs against the real account. A pen name earns no
  access, and holding a role does not by itself let you sign as the org.

The surface reads only in one direction — what *you* may write as. Nothing it
fetches carries a mapping from a name back to its holder.

## Verified (UI layer)

- `packages/cms-ui` type-checks clean; `apps/arts-collective` type-checks with
  **0 errors** (after rebuilding `@elkdonis/services`, which resolves to `dist`
  — its `dist` is root-owned, so the rebuild runs in a container)
- `GET /api/hub/identities` answers **401** signed-out; the app serves 200

**Not** verified: nothing has been rendered signed-in or posted under a pen
name, because `identity_control` does not exist until the migration runs. That
is the one remaining gate.

## Next

1. Apply the migration, then exercise it signed-in: open a name, see the face
   draw it, post under it, confirm the byline and that you can still see your
   own draft.
2. Decide 4 (payouts) before any pen name can sell anything.
3. The other hosts (amrit-canada, innergathering, IFAC) get the face by wiring
   one connector and one route — the surface is already in the shared package.

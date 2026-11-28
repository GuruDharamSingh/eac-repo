# Adding people, orgs and paid work to the one search

For the agent extending search (Justin, 2026-11-26: "add users, orgs, paid work… it may make users and orgs the basis for threads, which is fine"). Read CONTRACT.md (§1–§6, §11, §13, §14) and the end of LEDGER.md first. This page gives the shape, the checklist and the rules that have kept the tree safe.

## 1. Where each thing goes

| Thing | Shape in the index | Why |
|---|---|---|
| **People** (directory profiles) | New store `person`, key `person:<identityId>`. One row per **public identity**: a pseudonym is its own row, never its account. | Proposed by the WorkingArts/ArtDirect session (v1.3); approved with conditions (below). |
| **Orgs** | New store `org`, key `org:<orgId>`. Public orgs only (`join_policy <> 'private'`, `subdomain_confirmed`, not `oad`, which is the same rule as `suggestContent`). | Same mechanics as person. **Widen the store CHECK for `person` and `org` in ONE migration**, so two sessions don't race two CHECK changes. |
| **Paid work (time)** | **Not a new store.** Time offers are already `threads` (service, tour, experience, workshop, series, meeting). Add the missing kinds to the thread-type mapping (`THREAD_TYPES` / `KINDS` in `services/content-index.ts`; `service`, `tour` and `experience` are skipped today), and add offer columns to the index: `offer_price_minor`, `offer_currency`, `offer_when` (once, recurring, sessions, appointment, departures), `offer_takeup` (rsvp, booked, paid). See PAID_WORK_MODEL_2026-11-24.md. | One offer with settings, per the paid-work model; the kind is a label. |
| **Paid work (objects)** | Already in: artwork (store `artwork`), with sale state and price. | — |

**"People and orgs as the basis for threads"** works with the existing key scheme. A thread *about* or *by* a person or an org carries that key: `threads.metadata.about = "person:<id>" | "org:<id>"`, or a proper `subject_kind/subject_id` pair like the Channel tables use. `searchContent` can then offer scopes `person:<id>` (already exists) and `org:<id>` (already exists). A profile or org page becomes one search, with facets per kind (posts, offers, works).

## 2. Checklist for a new store

1. **Migration.** Use the next free number (check `ls packages/db/migrations` just before). Widen `content_index.store` CHECK, and add nullable columns only. Add queue triggers limited to the columns that matter (`AFTER INSERT OR UPDATE OF … OR DELETE`), so logins and last-seen writes don't churn the queue. **Apply it ALONE**: the file plus its `app_schema_migrations` row in one transaction under the migrate lock (the recipe used for 293, 294 and 296 is in LEDGER). **263 stays pending; never run a plain migrate.**
2. **Indexer** (`packages/services/src/content-index.ts`): `indexPerson(id)` / `indexOrg(id)` upsert a row, or delete it when the thing is no longer public. Wire them into `drainContentQueue`, `reconcileContentIndex` and `content-reindex.mts` (`--stores`). Never throw into a write path (`safely()`).
3. **Types** (`packages/content/src/model.ts`, PM-owned, additive only): add to `ContentStore`, `ContentType` and `ContentView` (e.g. `"people"`, `"orgs"`). The existing views `published`, `files` and `all` keep their stores, so no current caller sees the new rows unless it asks.
4. **Rights** (`server/access.ts`, `contentReadSql`): an **explicit** clause per store. Person and org rows are PUBLIC/published only. Don't rely on defaults. Facets use the same predicate.
5. **Search and hydrate** (`server/search.ts`, `hydrate.ts`): add the view to store mapping, a sort if needed (e.g. `listed`), facets (place, entity type, offer kind) returned only for that view, and hydration (name, headline, avatar, place, href).
6. **Host** (`host.ts`): hrefs come from new optional `urls.person?(…)` / `urls.org?(…)`. A host without them gets `null`. Never hard-code a site.
7. **Suggest** (`server/suggest.ts`): it reads `users` and `organizations` directly today. Move it onto the index only as a separate, later change, and keep its rules identical.
8. **MCP** (`packages/mcp/src/server/content-tools.ts`): `content.search` takes the new views through the same org lock and fencing.
9. **Checks** (`packages/content/scripts/check-search.mts`): an unlisted person or private org never appears. A pseudonym row carries no account id. The new facets appear only in their view. Existing views return the same results as before.

## 3. Rules that kept the tree safe today

- **Work in a git worktree** (or branch) and merge into the main checkout only when `tsc` is clean across `packages/{content,services,commerce,mcp,actions,hub,channel}` and `apps/{art-auction,arts-collective,sunjay,artdirect,elktours}`. Other lanes build from the main checkout at any time. Twice today an export or type landed before its implementation and turned the tree red.
- **Additive only.** Never rename or remove an export. Old views and old callers must return exactly what they did.
- **Privacy is a hard line.** Never read `identity_control`, never store or return an email, never link a pseudonym to its account, and only list `directory_listed` identities with a slug.
- **No builds, restarts or commits without Justin.** Announce "green, building" and "live, BUILD_ID" to the other lanes (the market lane builds art-auction often).
- Append to LEDGER.md and add a CONTRACT.md v1.3 note (append only). Label claims verified, assumed or unknown.

## 4. Who to ask

The cornerstone PM session (system32-43) owns the contract and `model.ts`. Message it with questions, or with anything that needs a contract change.

## 5. Notes after v1.3 went live (2026-11-26, ~23:40)

- People are live: migration 298, ArtDirect build `n8JeJ02hbMgXY78qPd3Qs`, 73 person rows (27 people, 46 `entity_type='organization'` directory profiles). check-search passes 64 of 64.
- **Before the `org` store:** 46 directory profiles are org-type *users*. Indexing the `organizations` table as well would list an org twice where both exist. Settle the link first (an `org_id` on the profile user, or a `users.id` on `org_profiles`), then index one row per real org, or mark the pair so search and suggest de-duplicate.

## 6. Correction (2026-11-27): orgs are listed through their org-users

CONTRACT §16 (revised) replaces the "Orgs: new store `org`" row in §1 above. **There is no listed org store.**
- The directory lists identities: artists, org-users (organizations) and associated businesses or places. All are `person` rows, with a `listing_kind` facet.
- `org:<orgId>` stays a scope for an org's pieces, and displays as its org-user.
- Paid-work rows carry booking and payout references.
- The rest of the checklist applies unchanged.

## 7. Rule learned from the 2026-11-27 incident

Every trigger function on a table other services write to (`users` above all, which GoTrue writes) must schema-qualify its tables (`public.content_index_queue`), or be created with `SET search_path = public, pg_temp`. GoTrue's `search_path` excludes `public`. 298's person trigger broke sign-ups across the network for about 77 minutes until 299 pinned it. Add a check for this in any new migration that creates a trigger.

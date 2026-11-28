# Content cornerstone: what was built, and what it makes possible

Written 2026-11-26 by the cornerstone PM session (system32-43). The detailed record is in LEDGER.md and the contract is CONTRACT.md. This page is the short version: what exists now, why it matters, and where it helps next.

## 1. What exists now

| Layer | What it is | Where |
|---|---|---|
| **One index** | `content_index`, one row per thread, artwork and file. It holds title, text, owner, org, visibility, status, sale state, store and cover. It has full-text, trigram and per-scope indexes. Migrations 293 and 294. | `packages/db/migrations`, `packages/services/src/content-index.ts` |
| **Kept fresh three ways** | Write-path hooks (shared thread and artwork saves). Triggers that queue keys on `threads`, `artwork` and `auction_lot`, drained on each search. A nightly reconcile plus a file re-list at 03:40. | `content-index.ts`, `scripts/content-reindex-nightly.sh` |
| **One search** | `searchContent(viewer, query, host)`. Scopes: mine (optionally with managed orgs), org, site, person, network. Text query, facets, keyset paging, hydrated items (marks, sale, storefront, images, owner name, `can.*`). | `packages/content/src/server/search.ts` |
| **One rights rule** | `contentReadSql`: thread rules (matching `threadReadSql` on every real thread), artwork hide and sale rules, file rules at least as strict as `canReadMedia`, and the site-keeper rule. Facets use the same predicate. | `packages/content/src/server/access.ts` |
| **References that check themselves** | `resolveContentRefs`. A borrowed image or essay shows only while its piece is still public; otherwise "No longer shared by its owner". | `server/search.ts`, `routes.ts` |
| **One component** | `ContentLibrary`. A library, a file browser (`view="files"`) and a picker (pick/pickMany), with remote search, large tiles, and grouping by site or store. `MediaLibrary` is now a thin wrapper over it. | `packages/content/src/ui` |
| **Routes each app mounts in about 3 lines** | `contentRoutes(host)`: search, folders, upload, resolve (and suggest, in progress). Rights always come from the session. | `packages/content/src/routes.ts` |
| **Hub cards** | One card mount (`HubCardMount`), the Content/Artworks card, and the Channel card moved out of Sunjay. The round 2 surface look is in progress. | `packages/hub/src/mount`, `packages/content/src/hub`, `packages/channel/src/hub` |
| **Assistant and registry reach** | MCP `content.search` and `content.resolve` (suggest in progress), and registry entries `artwork-hide` and `artwork-show` (human only). | `packages/mcp`, `packages/actions` |
| **Live** | art-auction `/center/work`, the `/hub` cards and the Add-a-work file picker. Sunjay's shared Channel card. arts-collective's MCP content tools. | builds in LEDGER |

Numbers on 2026-11-26: 198 threads, 66 artworks and 1,859 files indexed. Search p95 is under 20 ms with hydration. The file re-list takes about 12 s for 130 roots. check-search passes 56 of 56 (plus 19 file checks), and check-library 25 of 25.

## 2. Why it matters (the principles that paid off)

1. **Search on the server, read once from the database.** Before this, every library loaded everything and filtered in the browser (Channel loaded 160 threads and 120 artworks to show one page). Now one indexed query returns one page of keys, and only that page is hydrated. A page is the same size whether the network has a hundred pieces or a hundred thousand.
2. **One rights rule, in SQL.** Drafts, hidden pieces, members-only posts and private files are decided in one place, and the facet counts use the same rule, so nothing leaks through a count. Six helpers used to disagree (`canViewThread`, `threadReadSql`, the forum's `visible()`, `mayManageOrg`, `isMarketKeeper`, `canReadMedia`). They now have one SQL expression to agree with, and a check script proves it.
3. **A stable key for everything:** `thread:<id>`, `artwork:<id>`, `file:<fileid>`. Pickers, deep links, references, registry inputs and the index all speak the same key. That is why public reuse (a borrowed image with its credit) cost almost nothing.
4. **A host adapter instead of hard-coded URLs.** The market, Sunjay and arts-collective each describe themselves once (`ContentHost`), and the same package serves all three.
5. **Additive and checked at every step.** Most apps are built images, and any rebuild ships the shared tree. So every change stayed additive and type-clean, migrations went in one at a time, and each claim in the LEDGER is marked verified, assumed or unknown.

## 3. Where it helps next

- **Any picker on the platform.** The Puck/canvas editor already has a `piece` source (`contentRecordSource`). Blocks that show "a gathering", "a piece" or "a picture" can take a content key instead of a pasted id, and render credit and freshness through `resolveContentRefs`. That is House-editor row H.
- **The assistant and dock.** `content.search`, `content.resolve` and (soon) `content.suggest` give the MCP assistant one way to answer "what has this person made", "find the moonstone necklace" or "is this still shared". The same registry entries the hub buttons call are what the dock and assistant can propose.
- **Network search everywhere.** The same scopes power the market's "The collective" view, arts-collective's network search tab, and any site's "More by this artist" (scope `person`).
- **Files without duplicates.** With files indexed by their Nextcloud id, the next upload work (UPLOADS_ONE_PATH) can de-duplicate, show "where this picture is used", and let any form pick from a person's or org's folders. The Add-a-work picker is the first example.
- **The passport (detail model).** `ContentDetailModel` can now be filled per item on the server (`loadContentDetail`, the old plan's pass 2) from the same index and hydration, ending Channel's whole-channel loader.
- **Analytics and the hub faces.** Counts by type, status, store and sale come free from the facets, so a hub face never needs its own query.
- **Themes.** Round 2 scopes the dark look to the popup through `--sf-*`/`--ec-*` tokens. That is the same mechanism the five-colour theme work (THEME_SYSTEM_2026-11-22) will use to give each site its own surface colours.

## 4. Open, honestly

- The market Channel lists only stores the market org owns or pins (1 piece). A market-wide view needs a loader option in `packages/channel`.
- The five `content-row-actions.tsx` copies, the `/admin/artworks` table (until `/admin` becomes `/hub`), the `MediaLibrary` wrapper (once elktours switches) and `packages/studio/src/channel/` still need retiring.
- Searching inside the direct-edit drawer needs an optional `search` on `RecordSources` (shared editor code, through the house-editor PM).
- An owner opt-out from reuse: Justin said not for now. Its home would be `content_prefs.never`.
- ops.md says database backups run from guru's crontab, but they moved to root's TrueNAS cron on 2026-10-14. The doc needs updating, and that job is worth confirming.

## 5. Lessons for the next round

- **Agents on a live, shared tree must work on a copy.** Twice an agent added a type or an export before the code behind it, and the shared tree went type-red for a few minutes. Each time, another lane was about to build, and a red build takes a live site down. The instruction "keep the tree green after every edit" was not enough. Next time each agent works in its own git worktree (or branch), and the PM merges into the shared tree only after `tsc` is clean across the importing apps.
- **One build at a time, by whoever is ready, after a 10-minute quiet check.** The market lane and this lane took turns building art-auction, with each build carrying the other's work. That worked because both lanes announced "green, building" and "live, BUILD_ID" in messages.
- **Light checks were enough when they were the right ones.** A rolled-back-transaction rights check, a harness render, and one signed-in look per build caught every real issue (noise in `missing`, facets, store names, owner's hidden pieces, popup headings and overflow) without long test rounds.
- **Policy questions surfaced by the code** belong to Justin, not to an agent's guess. Examples: whether a keeper may edit another seller's artwork (today, no: the commerce save allows only the store's owner or roll), and whether raw cloud files are network-visible (decided: no, §14).

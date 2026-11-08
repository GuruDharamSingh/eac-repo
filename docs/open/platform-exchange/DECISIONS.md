# Platform exchange: owner decisions

Format: the question, the options, the recommendation, and why. All open on 2026-11-08; for
Justin through the PM. The first three block phase 0 and phase 1. References: `EXCHANGE.md`,
`VERSIONING.md`, `CONTRIBUTING.md`, `PLAN.md` by §.

## Open, blocking (decide first)

### D-1 · Licence for the platform code
- Today: no `LICENSE`, no `license` field; the public repo is all rights reserved by default.
- Options: (a) MIT; (b) Apache-2.0 (patent grant); (c) MPL-2.0 (file-level copyleft);
  (d) AGPL-3.0-or-later; (e) stay unlicensed.
- **Recommend (d) AGPL-3.0-or-later**, copyright the Elkdonis Arts Collective. The platform
  runs as a network service, so only AGPL keeps a hosted fork's changes open; Nextcloud and
  Silex, which the platform extends, are AGPL (assumed, check before adoption); MIT and Apache
  dependencies and the `NOTICE` code are compatible. Leaf packages useful alone (`tokens`,
  `gradients`) can take MIT in their own folder later. Choose now: every contribution so far
  is the collective's own, so relicensing costs nothing yet.

### D-2 · Licence for user-made exchange items
- Options: (a) CC0; (b) CC-BY-4.0; (c) CC-BY-SA-4.0; (d) the author chooses per item from
  (a)–(c); (e) no licence, network members only.
- **Recommend (b) CC-BY-4.0 as the default for network items, `org-only` for org items, the
  author may pick CC0 instead.** Credit is required, which the item page and `/credits` give;
  SA would bind every page built from a template; (e) leaves forks legally unclear. Publishing
  to the network grants this licence, stated on the "Offer to the network" dialog.

### D-3 · Who reviews network submissions
- Options: (a) Justin only; (b) Justin plus named staff reviewers; (c) any guide of another
  org (the prototype's rota idea).
- **Recommend (a) to start, (b) when submissions exceed about five a week.** Needs a
  network-level capability; `org_grants` allows only `nextcloud_access` (mig 139 CHECK), so
  this rides on the `org_capabilities` proposal already on the PM board's blocker list.

### D-4 · Storage: one envelope over existing stores, or one new store
- Options: (a) add envelope columns to `site_page_templates` (fast, page only);
  (b) `exchange_items` + `exchange_versions` + `exchange_uses`, with `site_page_templates`
  kept as the page payload store (`PLAN.md` §3.1); (c) as (b) but move page payloads out and
  retire `site_page_templates`.
- **Recommend (b).** Additive, keeps the Site Builder save and apply code working
  (`sb-runners.ts:103,164`), and gives presets, routines and looks the same envelope without
  moving their payloads. (a) dead-ends at the second kind; (c) churns a table applied today.

## Open, needed by phase 2

### D-5 · Pictures and words in network page templates
- Options: (a) keep everything; (b) replace pictures with placeholders, keep words;
  (c) placeholders for pictures and words; (d) (b) by default, the author may tick "these
  pictures may travel".
- **Recommend (d).** Layout is what travels well; an artist's photos on another org's page
  are a consent problem, and `Private/` media must never reach a network item.

### D-6 · Credits shown on sites
- Options: (a) a line in every footer; (b) an opt-in `/credits` page per site from its uses;
  (c) item pages only.
- **Recommend (b)**, plus item pages. Meets CC-BY attribution without changing designs.

### D-7 · Usage signals and ranking
- Options: (a) distinct orgs, applies, forks, picks; (b) add stars or likes; (c) add views.
- **Recommend (a)** for phases 1–4. Stars and views reward placement, not design.

### D-8 · Secret scanning
- Options: (a) `gitleaks` on eris, run by the PM before each push and on the snapshot;
  (b) a pre-push hook for every session; (c) GitHub secret scanning only.
- **Recommend (a) now, (c) switched on as well** (free for public repos, catches what slips).
  A hook (b) is fragile with many sessions in one tree.

## Open, later

### D-9 · Updates to network items
- Options: (a) every new version reviewed; (b) `fix` versions from the author org go live,
  `structural` ones are reviewed.
- **Recommend (b)**, matching the LMS `change_kind` rule (mig 140); a reviewer can revert.

### D-10 · Package versions
- Options: (a) leave versions meaningless; (b) semver on the nine exchange-facing packages,
  bumped per train, with changelogs (`VERSIONING.md` §1, §5.3); (c) semver everywhere.
- **Recommend (b)**, plus `"private": true` on the 15 packages without it.

### D-11 · Release tags
- **Recommend** an annotated tag `train-YYYYMMDD-N` per successful train listing apps and
  build ids (`VERSIONING.md` §5.4). No alternative proposed; the cost is one command.

### D-12 · May assistants apply items
- Options: (a) read only; (b) draft apply (an unpublished page) through a registry entry;
  (c) apply and publish.
- **Recommend (b) in phase 3's second step**, under the MCP rule that a person publishes.

### D-13 · Outside contributions
- Options: (a) none yet, repo public for reading; (b) issues and PRs welcome under DCO.
- **Recommend (a) until D-1 and the root `CONTRIBUTING.md` are in, then (b).** PRs would land
  in a tree shared with live containers, so the PM merges them into a day branch.

# Block contract: page, scan and contract (2026-11-23)

## Real scan (192 blocks, read from source today; 0 blocks found in source that the 2026-11-20 index lacks)
Stages, passes this stage / stops here: 1 Written 192 / 86; 2 Declared 106 / 7; 3 Themed 170 / 57; 4 Editable in place 48 / 3; 5 Hosts and guests 0 (not built; 13 blocks have a place, 0 say what they offer); 6 Listed 170 / 39.
Rules, fail (cannot tell): settings declared 1; parts declared 86; theme only 22; words in place 50; height has one home 3 (of 9 with a height setting); record named 5 (84 cannot tell); in the manifest 1 (tour-cards: manifest still lists 0 parts); not on the deny list 12 (9 "no declaration", 3 "part of its settings could not be read"; 9 more closed on purpose are counted not applicable).

## What the scan cannot tell
Whether a part selector matches real markup; colours from global sheets, Tailwind names or run-time styles (only hex, rgb/hsl and font-family typed into the block's own file, its imported stylesheets and imported component files are counted; font-family found 0 times, so that count is weak); settings built by a call or spread from another file (falls back to the 2026-11-20 index and says so); a data-driven block not flagged dataDriven; whether a hex is deliberate; whether the checked-in manifest is the one assistants see. Listed on the page under "What this scan cannot see".

## Where the outline was wrong
See CONTRACT.md section 7: slots (places) already exist, only offers/wants are new; tokens, manipulate, draws, part prop were missing; morph is for sealed blocks, canvas boxes use look; manifest can be stale; E5 is not kept by the Site style drawer; the role statement is a proposal.

## Files created (only these)
apps/development/scripts/refresh-block-contract.mjs; apps/development/src/data/block-contract.json; apps/development/src/ideas/block-contract.tsx; apps/development/src/ideas/block-contract/{BlockContract.tsx, data.ts, block-contract.css}; one import and first entry in apps/development/src/ideas/index.ts (five-colour-theme entry kept); docs/open/BLOCK_CONTRACT_2026-11-23/{CONTRACT.md, PAGE.md}.

## Verification
- tsc, apps/development in a one-off eac-dev container (node typescript/bin/tsc --noEmit): 0 errors.
- Script run in a one-off node:22 container with the repo mounted read-only and only src/data writable; 10 blocks checked by hand (tour-cards 6 repeating parts and reads; banner 9 settings and no parts; m-masthead coverHeight without resize at discover.tsx:35; TourIntro var(--brass,#c9a25c) at tour/blocks.tsx:24; box #ececea/#55554f at direct-edit puck/blocks.tsx:110; contact-form closed by id; au-hero manifest stale; home-stage 14 parts no settings; card-grid 4 settings no parts). Two scan faults found and fixed that way (stale-manifest count with unreadable settings; a block that only has parts counted as undeclared).
- Driver (esbuild bundle, headless Chromium, harness ~/scratch/manjushri/contract/h): 55 pass, 0 fail, zero console errors. Covers stage filter, search, app and rule filters, show more, code disclosure, pins and answers, four toolbar targets, pencils by role, Notes switch, reload, Copy my answers, storage blocked, no horizontal scroll at 1440 and 390.
- Not a signed-in dev copy: the page is a client component and the admin gate sits outside it.
- Screenshots: eris ~/scratch/manjushri/contract/h/shots/; local scratchpad\manjushri\contract\.

## Decided myself
Declared = settings or places or parts present, and parts present for stage 2. Words-in-place is judged by inlineEditable, richtext or a part with `prop`. Closed-on-purpose deny reasons (id, secret, person, markup) count as not applicable. Stage filter for stage 5 lists blocks that have a place. Added a "Viewing as" role picker to the pencil mock (author sees pencils on words and picture, not the record field): a guess for C7. The toolbar opens above the pointer. Index file blocks.json (2026-11-20) is used to find blocks; source is re-read for each.

## Not done
No signed-in check; no manifest rebuild (tour-cards manifest still stale); stage 5 has no measure because nothing is declared; app CSS reached through global sheets is not scanned; no commit.

# Build plan, stone 1: a block's own settings, with sample data (2026-11-02)

Plan by the Coding Team Lead for two coding subagents and one integration pass. It covers stone 1 of `3-synthesis.md` (section 11) after the platform review. No file in the tree, container or row was changed in this pass. Scratch runs are in `/tmp/claude-3003/-mnt-pool1-home-guru-eac/7236b31a-7646-4e28-8b29-be60fa6c575f/scratchpad/team/lead-baseline/`.

Labels: [V:run] executed in this pass (repo mounted read-only, Chromium with `--network none`), [V:read] code or image read, [A] assumed, [U] unknown. The scratchpad path above is `$T/..` below, with `T=/tmp/claude-3003/-mnt-pool1-home-guru-eac/7236b31a-7646-4e28-8b29-be60fa6c575f/scratchpad/team`.

## 1. Result in brief

Stone 1 makes a sealed block's declared props editable in the right column on the private test page, draws data blocks from `sample()` without storing rows, and stops one failing block from blanking the canvas. It is additive: `TreeEditorOptions.contract` is optional, and a host that does not pass it (innergathering today) behaves as before. No migration, install, production rebuild, commit, `packages/blocks/src/index.ts` change or exports change.

**Nothing blocks coding technically.** Two questions for the developer change the order of work and have defaults (section 13). The review's three blocking objections concern stones 8 and later; stone 1 forecloses none of them, and they are carried to the synthesis (section 3).

## 2. Baselines measured in this pass

| Check | Result | How |
|---|---|---|
| `tsc --noEmit` `packages/direct-edit` | exit 0, 0 errors | [V:run] read-only `eac-dev` container |
| `tsc --noEmit` `packages/blocks` | exit 2, 2 errors, both `../services/src/gather.ts:704,706` | [V:run]. That file has mtime 2026-10-03 and no entry in `git status`. So "check-types 0 in blocks" in stone 1's done-when cannot pass today; the criterion becomes no new errors |
| `tsc --noEmit` `apps/arts-collective`, `apps/innergathering` | exit 0, 0 errors each | [V:run] |
| `drive`, `drive4`, `drive5`, `drive6`, `drive7`, `drive8`, `drive9`, `drive10`, `drive11`, `drive12` | 43, 39, 14, 35, 18, 29, 54, 46, 56, 20 passes, 0 failures | [V:run], logs in `lead-baseline/baseline-drivers.log`. Same counts as the handover's section 5 |
| Test page assembled from current source by the cut in A6 (no Blocks tab yet) | 2,966,334 bytes. `smoke.cjs`: all five views mount, 0 errors | [V:run] |
| Draft contract (section 6) over `SHARED_BLOCKS` | 30 blocks, 0 throw under `createRoot`, 0 page errors | [V:run] `lead-baseline/h3/probe.ts` |
| Draft `contractOf` return assigned to direct-edit's structural type | `tsc` exit 0 | [V:run] `lead-baseline/typecheck/check.ts` |

Harness facts found while measuring:

- `runall.sh` as stored fails: `docker: Error response from daemon: invalid mode: /w` [V:run]. The volume argument is in single quotes, so `${S:?...}` is not expanded (`harness/runall.sh:1,4`).
- `/tmp` is mounted noexec: a script there exits 126 unless run as `bash script.sh` [V:run].
- `drive5` needs `snapshot.html` and `drive12` needs `landing.html`. Neither is in the harness. Both pass when assembled from the land data in the published test page (`land.css` + `visual.css` + body + `live.js`, and the same with `blocks.css` + `landing.js`) [V:run].
- The admin container is stopped, but check-types does not need it: `docker run --rm -u 3003 --network none -e HOME=/tmp -v /mnt/pool1/home/guru/eac:/app:ro --entrypoint sh eac-dev -c 'cd /app/packages/direct-edit && ./node_modules/.bin/tsc --noEmit --incremental false'` [V:run].

Findings that shape the work:

| Finding | Evidence | Consequence |
|---|---|---|
| No shared block throws on the test page | Probe above | The stand-in cannot be tested with a real block. A harness-only `test-throw` block is needed |
| 13 of 30 blocks draw nothing on Add until filled: `cycle-badge`, `card-grid`, `prose`, `figure`, `text-image`, `quote`, `faq`, `video`, `feature-card`, `entry-list`, `picture-wall`, `link-button`, `store-header` | Probe (`html: 0`) | The empty label is a main path, not an edge case. Rows-only blocks (`faq`, `picture-wall`, `entry-list`) stay empty until stone 3. The developer is told in the stone's report |
| 63 of 175 prop labels exceed 13 characters; the label column is 82px and truncates (`direct-edit.css:36,38`) | Probe | Prop rows wrap the label to two lines and keep the row grid. No reference covers this; it is named in the hand test |
| `panel.ts:574` splits `data-pop` on `:` and keeps two parts | [V:read] | A slot id may not contain a colon or the colour popover breaks. Key is `p:<name>`, id is `p-<name>` |
| `History` coalesces only within 800 ms (`model/history.ts:23`) | [V:read] | A pause while typing a title would make two undo steps. Text fields need a typing session (section 8, B4) |
| Ctrl+Z inside a field is the browser's own undo (`edit-shell.ts:170`) | [V:read] | "One undo" is asserted through the Undo pill and through Ctrl+Z after focus leaves. A browser undo inside the field fires `input` and stays consistent |
| `adopt.ts` would copy an empty label or stand-in text into the document | `tree-editor.ts:481-493`, `TreeCanvas.tsx:73` [V:read] | Detach is refused on those elements, as well as on sample rows |
| `safeSrc` refuses `data:` (`block/bind.ts:66`) | [V:read] | Seed pictures draw, but a typed `data:` address is not kept, and Detach on the seed wall loses its pictures. Test page limit only; named in the report |
| An esbuild entry named `blocks.ts` would emit `blocks.css` over the copied stylesheet | `lead-baseline/h3/tree.css`, `test.css` exist beside their bundles [V:run] | The entry is `view-blocks.ts`, not `blocks.ts` |
| Published test page's inlined CSS is `editor.css` + newline + `blocks.css`, not `visual.css` | [V:run] string containment on the recovered page | `pack-test.cjs` uses `editor.css`, which also carries the classifieds CSS |

## 3. Review items

Applied to this plan:

| Review item | What the plan does |
|---|---|
| Stone 1 hand test has gaps | Seed document in section 5; empty wall behaviour stated (a labelled box, selectable, panel says "None yet"); Code tab shows the node's props as read-only JSON; wrapper kept as `harness/test.html`; "Show as published" button added now, so stone 2 does not need `window.published` |
| Detach copies sample rows | Stone 1 part applied: Detach refused on a node drawing sample rows, in the menu and in the panel. Also refused on stand-ins and empty labels (found in this pass) |
| `look` prop defect | Guards at `tree-editor.ts:648,684,692`, plus `writeLook` refusing a sealed node. `faq` and `pt-link` keep their setting |
| `groupOf` colour case (synthesis 3.3) | In the contract |
| Media privacy note | Image rows refuse `Private/` paths with `isPrivatePicture` and anything `safeSrc` refuses. Real pickers (`shell.openPicture`) stay for stone 3 |
| "check-types 0 in blocks" | Replaced by no new errors, with the measured baseline |
| D4 lacks "now, before stone 1" | Put to the developer (section 13). Timing does not change the code |

Could not apply here, because they are outside stone 1. Owner: chief platform officer and senior advisor, in the synthesis.

| Severity | Item | Earliest stone | Effect on stone 1 |
|---|---|---|---|
| Blocking | Split stone 8 into 8a, 8b, 8c | 8 | None |
| Blocking | Named stone for what must exist before the first artist; roll-out stone; named first artist | 8 and later | None |
| Blocking | Stone for editing code-built pages (sunjay, IFAC series) with innergathering's visual-mode host files | After the gate | None. The stone does not touch `visual-editor.ts` or `layers.ts` |
| Should-change | "Seen as" must drop `userId` and `isGlobalAdmin`; candidates through `canViewThread`; kind allow-list; sanitise replies; split stone 5; RSVP retirement rule; secret check on values | 5, 8 | None |
| Should-change | Detach at Visitor tier on a real host; add both Detach rules to synthesis section 5.5 | 8b | Stone 1's part is done; the sentence in 5.5 is the synthesis's to add |
| Should-change | Phone width in the popup | 4 | None |
| Should-change | Cheap dog-ear gesture; lighter first-round Data section; which door Edit opens | 4, 5, 6, 8 | None. `blockEditorHref` is left as it is |
| Should-change | Stone 13's HTML comparison; `renderFieldsFor` opt-in | 13 | None |
| Should-change | Two orphan runs (fence log with every block; `next dev` with a stored morph) | Gate or 8a | Neither has anything to run against until stones 2 and 5 |
| Note | Merged install list; font link before the marker; `cleanMorph` positional limit | 2, 5 | None |

Repair R-a (`safeDecls`) stays independent and is not part of this stone.

## 4. Scope after the review

In:
1. `packages/blocks/src/contract.ts` (`contractOf`, `groupOf`, `dataOf`), imported by path from the harness.
2. Selecting a sealed block lists its props in sections from `groupOf`, in the rows a box uses. Controls: `text`, `textarea`, `readout` (new), and `number`, `select`, `chips`, `color` (existing).
3. Rows (`rows`, `list`) shown by count, read-only. Slots have no row.
4. `url` and `image` values stored only when `safeLink` or `safeSrc` passes, and not when `isPrivatePicture`.
5. The canvas draws `sample` under data blocks. A per-node boundary draws a named stand-in. Rows never reach the document.
6. Detach refused on sample rows, stand-ins and empty labels. Reset, Copy and Hide do not touch a sealed block's `look` prop.
7. Code tab: read-only JSON of the node's props. It holds no sample rows.
8. Test page view Blocks with seed document, "Show saved document" and "Show as published".
9. Harness repairs: `runall.sh` quoting, `harness/test.html`, `harness/pack-test.cjs`.

Out: `parts`, `morph`, editing rows, `group`/`part`/`when`/`more` on `PropDef` (stone 3), Data section, Tweaks, popup, Try it, any host wiring, any change to `page-builder`.

## 5. Step 0, done by the Lead before either coder starts

1. Re-run the mtime check in section 7. If any assigned file is newer than the table, stop and report.
2. Snapshot, because `packages/direct-edit` is untracked: `mkdir -p ~/eac-backups/direct-edit && tar -czf ~/eac-backups/direct-edit/direct-edit-$(date +%Y%m%d-%H%M).tgz -C /mnt/pool1/home/guru/eac --exclude=node_modules packages/direct-edit`. Also unpack a copy to `$T/baseline-tree/` for `diff -ru`. If the developer answers D5 with a commit, this is the fallback only.
3. Write the two contract files of section 6 verbatim. Make the seam edits of section 6. Confirm `tsc` exit 0 in `direct-edit`.
4. Write the harness starting set below. Fix `runall.sh`. Add one line to `hb.sh`.
5. Write `harness/drive13.cjs` (the shell in section 9). Each coder then has a working page, today's panel and today's canvas, from the first minute.

`harness/hb.sh`, added at the end:

```sh
NODE_PATH=/app/packages/page-builder/node_modules:/app/apps/innergathering/node_modules $ES /w/h3/view-blocks.ts --bundle --format=iife --jsx=automatic --outfile=/w/h3/view-blocks.js --log-level=error --define:process.env.NODE_ENV=\"development\" --external:node:*
```

`harness/runall.sh`, replaced:

```sh
docker run --rm -u 3003 --network none -v /mnt/pool1/home/guru/eac:/app:ro -v "${S:?set S to a scratch folder holding h3/}:/w" --entrypoint sh eac-dev /w/h3/hb.sh >/dev/null
for d in "$@"; do
  N=shot-ct-$$; docker run -d --name $N --network none --shm-size=512m --entrypoint chromium-browser zenika/alpine-chrome --headless --no-sandbox --disable-gpu --disable-dev-shm-usage --remote-debugging-address=127.0.0.1 --remote-debugging-port=9222 --remote-allow-origins='*' about:blank >/dev/null; sleep 3
  echo "== $d"; docker run --rm -u 3003 --network container:$N -e ONLY="$ONLY" -v "$S/h3:/h" -w /h node:24-alpine timeout 170 node $d 2>&1 | grep -E '^(FAIL|ERR|pass |parity|published|sequence|TRACE)'
  docker rm -f $N >/dev/null
done
```

`harness/view-blocks.html`:

```html
<!doctype html><meta charset=utf-8><title>Blocks</title><link rel=stylesheet href=visual.css><link rel=stylesheet href=blocks.css><link rel=stylesheet href=view-blocks.css><style>body{margin:0;font:15px Georgia,serif;background:#fbf7ef;color:#1d1a16}#host{padding:50px 16px 80px}</style><div id=host></div><script src=view-blocks.js></script>
```

`harness/blocks-fixture.ts`, starting version (WP-A owns it afterwards):

```ts
import { createElement } from "react";
import { SHARED_BLOCKS } from "/app/packages/blocks/src/index";
import { defineBlock } from "/app/packages/blocks/src/registry";
import { contractOf } from "/app/packages/blocks/src/contract";
import { buildPuckConfig } from "/app/packages/page-builder/src/config";
import { mountTreePage, BOX_BLOCKS, BOX_ROOT } from "/app/packages/direct-edit/src/puck/index";

// Harness only: no shared block throws on this page, so the stand-in needs one that does.
const testThrow = defineBlock(
  { id: "test-throw", label: "Test: breaks on purpose", description: "Harness only.", props: [] as const, memberSafe: true, styling: "tokens", category: "content" },
  function Broken() { if ((globalThis as any).__healed) return createElement("div", null, "Healed"); throw new Error("Broken on purpose"); },
);
const blocks: any[] = [...SHARED_BLOCKS, testThrow];
export const blocksConfig: any = buildPuckConfig({ blocks: [...blocks, ...(BOX_BLOCKS as any)] as any, root: BOX_ROOT as any });
export const blocksContract = contractOf(blocks);

const pic = (fill: string, name: string) => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><rect width="400" height="300" fill="${fill}"/><text x="20" y="44" font-family="Georgia,serif" font-size="26" fill="#ffffff">${name}</text></svg>`)}`;
const picture = (fill: string, caption: string) => ({ src: pic(fill, caption), alt: caption, caption, href: "", at: "", color: "" });

export const BLOCKS_SEED: any = {
  root: { props: { title: "Blocks test" } },
  content: [
    { type: "hero-banner", props: { id: "hero", title: "The Ambrosial Hours", subtitle: "Rise with the sun", imageUrl: "", imageAlt: "", align: "center", height: 0 } },
    { type: "section-heading", props: { id: "head", title: "Recent work", eyebrow: "This season", subtitle: "", level: "h2", align: "start", rule: true } },
    { type: "picture-wall", props: { id: "wall", min: 220, shape: "auto", gap: "regular", captionPlace: "below", captionAt: "bottom-left", captionShow: "always", captionWeight: "regular", captionFont: "caption", captionSize: "theme", captionColor: "", captionScrim: "soft",
      pictures: [picture("#39475a", "Nightjar"), picture("#6d5a44", "Three Vessels"), picture("#8c6f5a", "Low Winter Sun"), picture("#44604f", "Fen Road"), picture("#5a4660", "Tide Table"), picture("#7a4a3c", "Kiln Door")] } },
    { type: "faq", props: { id: "faq", look: "divided", openFirst: true, items: [
      { question: "Is there a fee?", answer: "No. Bring paper and charcoal." },
      { question: "Can I come once?", answer: "Yes. Come when you can." },
      { question: "Where do we meet?", answer: "The address goes out by mail the day before." },
    ] } },
    { type: "grid", props: { id: "grid1", columns: "2", minWidth: 220, gap: "regular", align: "stretch", items: [
      { type: "prose", props: { id: "prose1", body: "A text block inside a grid." } },
      { type: "quote", props: { id: "quote1", text: "A quote block inside a grid." } },
    ] } },
    { type: "box", props: { id: "box1", tag: "section", look: { layout: "stack", dir: "column", gap: 10, padding: 16, fill: "#ddeeff" }, items: [
      { type: "words", props: { id: "w1", tag: "h2", html: "An own box, to compare its rows" } },
      { type: "words", props: { id: "w2", tag: "p", html: "Select this box, then the hero. The rows should look the same." } },
    ] } },
  ],
};

export function mountBlocksView(host: HTMLElement, o: { doc: any; onSave(d: any): Promise<{ ok: boolean }>; onDone?(): void }) {
  return mountTreePage({ host, config: blocksConfig, doc: o.doc, contract: blocksContract as any, pageName: "Blocks test", onSave: o.onSave, onDone: o.onDone });
}
```

Prop names and values in the seed were read from the block files [V:read]. `globalThis.__healed` exists for check C7 only.

`harness/view-blocks.ts`, starting version:

```ts
import { BLOCKS_SEED, blocksConfig, blocksContract, mountBlocksView } from "./blocks-fixture";
const w = window as any;
w.kit = { config: blocksConfig, contract: blocksContract };
w.saved = [];
let doc = BLOCKS_SEED;
const slot = document.getElementById("host")!;
function open() {
  const host = document.createElement("div");
  slot.replaceChildren(host);
  w.ed = mountBlocksView(host, { doc, onSave: async (d) => { doc = d; w.saved.push(d); return { ok: true }; } });
}
w.remount = () => { w.ed.dispose(); open(); };
open();
```

## 6. The shared contract

Both coders build to this. Step 0 writes the files; WP-A owns the first file, WP-B owns the second afterwards. A change to either goes through the Lead.

### 6.1 `packages/blocks/src/contract.ts` (new)

```ts
// ============================================================================
// What a block says about itself, as an editor reads it (2026-11-02). Data
// only: no component, no Puck, no database. Not exported from ./index until a
// host needs it; the direct-edit harness imports this file by path.
// ============================================================================

import type { Block, BlockDef, PropDef } from "./types";

export type OptionGroup = "content" | "layout" | "look" | "behaviour";

const CONTENT_KINDS: ReadonlySet<string> = new Set(["string", "text", "richtext", "url", "image", "rows", "list"]);

/** The section an option sits in. A slot is in the tree, not the panel. */
export function groupOf(p: PropDef): OptionGroup | null {
  if (p.kind === "slot") return null;
  if (p.kind === "string" && p.format === "color") return "look";
  return CONTENT_KINDS.has(p.kind) ? "content" : "layout";
}

/** What sample() adds that the block does not declare: rows a resolver would fetch. Drawn in an editor, never stored. */
export function dataOf(def: Pick<BlockDef, "props">, sample: unknown): Record<string, unknown> {
  if (!sample || typeof sample !== "object") return {};
  const declared = new Set(def.props.map((p) => p.name));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(sample as Record<string, unknown>)) if (!declared.has(k)) out[k] = v;
  return out;
}

export type ContractProp = PropDef & { group: OptionGroup | null };

export interface BlockContract {
  id: string;
  label: string;
  description: string;
  dataDriven: boolean;
  interactive: boolean;
  props: readonly ContractProp[];
  /** From dataOf. Empty for a block with no data of its own. */
  sample: Readonly<Record<string, unknown>>;
}

export type BlocksContract = Readonly<Record<string, BlockContract>>;

export function contractOf(blocks: readonly Block<never>[]): BlocksContract {
  const out: Record<string, BlockContract> = {};
  for (const { def, sample } of blocks) {
    let rows: Record<string, unknown> = {};
    // A sample that throws must not take the catalogue with it.
    if (sample) { try { rows = dataOf(def, sample()); } catch { rows = {}; } }
    out[def.id] = {
      id: def.id, label: def.label, description: def.description,
      dataDriven: !!def.dataDriven, interactive: !!def.interactive,
      props: def.props.map((p) => ({ ...p, group: groupOf(p) })),
      sample: rows,
    };
  }
  return out;
}
```

Run in a scratch copy: 30 blocks, type-checked, `sampleKeys` as expected (`thread-feed`: `items`; `store-shelf`: `marketplaceUrl`, `store`, `artworks`; `hero-banner`: none) [V:run].

### 6.2 `packages/direct-edit/src/block/contract.ts` (new)

```ts
// What the editor reads about a sealed block (2026-11-02). Structural:
// @elkdonis/blocks' contractOf() satisfies it, and direct-edit does not depend on
// blocks. Pure and server-safe. Not re-exported from block/index.ts yet.

export type ContractKind = "string" | "text" | "richtext" | "number" | "boolean" | "select" | "list" | "url" | "image" | "slot" | "rows";
export type OptionGroup = "content" | "layout" | "look" | "behaviour";

export interface ContractProp {
  name: string;
  kind: ContractKind;
  label: string;
  description?: string;
  default?: string | number | boolean | readonly string[];
  options?: readonly { value: string; label: string }[];
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  format?: "color";
  binds?: string;
  group: OptionGroup | null;
}

export interface BlockContract {
  id: string;
  label: string;
  description: string;
  dataDriven: boolean;
  interactive: boolean;
  props: readonly ContractProp[];
  sample: Readonly<Record<string, unknown>>;
}

export type EditorContract = Readonly<Record<string, BlockContract>>;

/** Panel key of a block's prop: routes the change to node.props, not to the look. */
export const propKey = (name: string) => `p:${name}`;
/** Panel slot id. No colon: panel.ts:574 splits data-pop on ":". */
export const propSlotId = (name: string) => `p-${name}`;
export const propNameOf = (key: string): string | null => (key.startsWith("p:") ? key.slice(2) : null);
/** Rows the canvas draws for this type that are not in the document. */
export const sampleKeysOf = (c: EditorContract | undefined, type: string): string[] => Object.keys(c?.[type]?.sample ?? {});
```

### 6.3 Seam edits

`packages/direct-edit/src/canvas/tree-editor.ts`, added to `TreeEditorOptions` (`:32`), plus the type import:

```ts
  /** What each sealed block declares. Absent: a sealed block offers no settings here, as before. */
  contract?: EditorContract;
  /** This node is drawn with sample rows. Anything that copies what it drew must refuse. */
  drawsSample?(node: PuckNode): boolean;
```

`packages/direct-edit/src/puck/mount.ts`, added to `TreePageOptions` (`:17`), and in `mountTreePage`:

```ts
  /** What each sealed block declares (contractOf). Absent: as before. */
  contract?: EditorContract;
```

```ts
  const drawsSample = (n: PuckNode) => sampleKeysOf(o.contract, n.type).length > 0 && !o.resolved?.[n.props.id];
  // and in the mountTreeEditor call at :60: contract: o.contract, drawsSample,
```

### 6.4 What crosses between the packages at run time

| Item | Written by | Read by |
|---|---|---|
| `data-tree-standin` on the stand-in element | WP-A, `TreeCanvas.tsx` | WP-B, Detach guard and notice; both drivers |
| `data-tree-empty` on the empty label (exists, `TreeCanvas.tsx:73`) | WP-A | WP-B, Detach guard |
| `.de-sec[data-section="content" \| "layout" \| "appearance" \| "behaviour"]` | WP-B, `panel.ts` | Both drivers |
| `[data-f="p-<name>"]` on a field; `[data-sync="row-p-<name>"]` on its row | WP-B | Both drivers |
| `[data-f="notice"]`, text exactly `Sample rows. Not saved.` | WP-B | WP-A's driver |
| `[data-tree-act="detach"]`, `disabled` when refused | WP-B | Both drivers |
| `.de-sheet-json` on the Code tab | WP-B | Both drivers |
| `#tt-acts [data-tt="saved-doc"]`, `#tt-acts [data-tt="published"]`, overlay `#tt-show`, close `[data-tt="close"]` | WP-A | WP-A's driver; the hand test |
| `window.ed`, `window.saved`, `window.remount()`, `window.kit` on `view-blocks.html` | WP-A | Both drivers |

## 7. Constraints of this checkout

- **`packages/direct-edit` is untracked** (`git status`: `?? packages/direct-edit/`), so a git worktree would not contain it. Both coders work in the shared tree and own disjoint files.
- Use the Edit tool. Keep every file syntactically valid at each save: each coder's bundle and any other session's rebuild read the live tree.
- Do not run `git add`, `checkout`, `stash` or `commit`, `pnpm install`, `docker compose`, a rebuild, or anything in a `.next`. Edit only your own files. Ask the Lead for a change elsewhere.
- Each coder uses its own scratch folder: `S=$T/wp-a` or `S=$T/wp-b`, with `h3/` copied from `harness/` and `node_modules` copied from `$T/lead-baseline/h3/node_modules`. Run with `S=$S bash $S/h3/runall.sh drive13.cjs`. Bundles read `/app` read-only.
- Comments and notes follow `.claude/rules/01-writing-register.md`.

Mtimes on 2026-11-02 21:30 EST [V:run]. Before the first edit of a file, compare; a newer file means another session is in it: stop and tell the Lead.

| File | mtime | Owner | Other sessions |
|---|---|---|---|
| `packages/blocks/src/contract.ts` | Does not exist | Step 0, then WP-A | New file. `packages/blocks` has no uncommitted change |
| `packages/direct-edit/src/block/contract.ts` | Does not exist | Step 0, then WP-B | New file |
| `packages/direct-edit/src/puck/mount.ts` | 11-02 18:21 | Step 0, then WP-A | Editor path of innergathering at its next rebuild |
| `packages/direct-edit/src/puck/TreeCanvas.tsx` | 11-02 18:18 | WP-A | Same |
| `packages/direct-edit/harness/test.ts` | 11-02 18:55 | WP-A | Test page only |
| `packages/direct-edit/harness/hb.sh`, `runall.sh`, `smoke.cjs` | 11-02 18:55 | Step 0, then WP-A | Harness only |
| `packages/direct-edit/src/model/schema.ts` | 11-01 21:17 | WP-B | Shared with classifieds on arts-collective |
| `packages/direct-edit/src/panel/panel.ts` | 11-02 18:02 | WP-B | Shared with classifieds and cards on arts-collective |
| `packages/direct-edit/src/canvas/tree-editor.ts` | 11-02 18:23 | Step 0, then WP-B | innergathering `CanvasEditor` and `open-page` |
| `packages/direct-edit/src/direct-edit.css` | 11-02 18:41 | WP-B | Loaded by every direct-edit editor |

Other sessions:
- An elktours session was active until at least 19:42 EST today: 37 files changed after 18:56, all in `apps/elktours` or `docs/`, plus migrations 239 and 240 (both applied) [V:run, `find -newermt`; V:sql]. None is in this plan. No file in `packages/direct-edit` or `packages/blocks` changed after 18:56 [V:run].
- `docs/open/ELKTOURS_CONVERGENCE_2026-11-02.md:87` says direct-edit is "still being edited today"; its later lines plan to add a dependency, not to edit it. Other Claude processes are running under this user [V:run, `ps`]. A session may still start on these files, which is what the per-file mtime check and the `diff -ru` against the snapshot catch.
- `packages/page-builder/src/editor.tsx` and `package.json` hold another session's uncommitted edit. Stone 1 does not touch `page-builder`.
- Importers of the edited files: `apps/arts-collective` (panel, classifieds, cards) and `apps/innergathering` (tree editor) [V:run, grep]. A rebuild of either during the coding window ships work in progress in those editors. Additions are optional fields and new cases only, and files stay compile-clean, but a half-finished panel could reach production. The Lead asks that neither app is rebuilt until integration ends (section 13).

## 8. Work packages

### WP-A: contract data, canvas, test page

Owns: `packages/blocks/src/contract.ts`, `packages/direct-edit/src/puck/mount.ts`, `packages/direct-edit/src/puck/TreeCanvas.tsx`, and in `packages/direct-edit/harness/`: `blocks-fixture.ts`, `view-blocks.ts`, `view-blocks.html`, `test.ts`, `test.html` (new), `pack-test.cjs` (new), `hb.sh`, `runall.sh`, `smoke.cjs`, `drive13-canvas.cjs` (new).

A1. `TreeCanvas.tsx`: add `samples?: Record<string, Record<string, unknown>>` and `version: number` to the props and to `Ctx`. In `NodeView` (`:82-88`) merge in the order `node.props`, `samples[type]`, `resolved[id]`. Rows are only in the drawn props, never written back.

A2. `TreeCanvas.tsx`: a class `NodeBoundary` around `Component.render` (`:91`), inside `NodeMark`, so the mark lands on the stand-in:
```ts
class NodeBoundary extends Component<{ label: string; version: number; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  // A later draw may have fixed what broke it.
  componentDidUpdate(prev: { version: number }) { if (this.state.failed && prev.version !== this.props.version) this.setState({ failed: false }); }
  render() { return this.state.failed ? createElement("div", { className: "de-tree-empty", "data-tree-standin": "" }, `${this.props.label}: this block cannot draw here. It runs on the real site.`) : this.props.children; }
}
```
Node objects are mutated in place by the editor (`tree-editor.ts:218-222`), so `version`, not node identity, is what resets it. No router stub.

A3. `TreeCanvas.tsx:73`: the empty label reads `${label}: nothing to show yet`.

A4. `mount.ts`: build `samples` from `o.contract` once per mount (entries with a non-empty `sample`). Keep a `version` counter in `draw` (`:57-59`), and pass `samples` and `version`.

A5. `blocks-fixture.ts`, `view-blocks.ts`, `view-blocks.html`: add a bar `<div id="tt-acts" data-de-ui>` with "Show saved document" and "Show as published". Both open one overlay `#tt-show` with attributes `data-de-ui data-de-menu`, focus its close button, and first call `ed.select(null)`. Those two attributes stop the canvas's clicks and the tree editor's keys with no engine change (`clickthrough.ts:19`, `tree-editor.ts:762,770`). "Show saved document" is the last saved doc, or the seed, as indented JSON. "Show as published" is `cleanBoxDoc(ed.doc())` through `Render` from `@puckeditor/core/rsc` (as `harness/t-page.tsx:3`; the main entry is the fallback), in its own root, unmounted on close.

A6. `test.html` (new): the wrapper recovered from the published page, verbatim except for placeholders and one tab. Cut by markers from `$T/../artifact-files/f2d861c3-540c-4f46-8089-74bfd82ff703/index.html`: from `<title>Click-Through Test</title>` up to `/* @elkdonis/direct-edit:` is the head; `/*__EDITOR_CSS__*/`, `/*__BLOCKS_CSS__*/` and `</style>` follow; then the original from `<div class="tt-tabs"` up to `<script id="land-data"`; then `<script id="land-data" type="application/json">__LAND_DATA__</script>` and `<script>__TEST_JS__</script>`. Add `<button type="button" data-v="blocks">Blocks</button>` as the first tab, `<div id="tt-acts" data-de-ui hidden></div>`, and its CSS beside `.tt-tabs`, at the left, on a phone above the tabs.

A7. `test.ts`: add `"blocks"` to `views` and make it the default when the hash names none. In `show`: `stage.innerHTML = '<div id="treehost" class="tt-tree"></div>'`, `mountBlocksView`, a module-level `blocksDoc` that `onSave` replaces, and un-hide `#tt-acts` only in this view. No other view changes.

A8. `pack-test.cjs` (new, run with `docker run --rm -u 3003 -v "$S/h3:/h" -w /h node:24-alpine node pack-test.cjs <mode>`):
- `land <published.html>`: cuts the JSON between `<script id="land-data" type="application/json">` and the next `</script>`, byte for byte, because its `<\/` escapes must survive. Writes `land-data.json`, `land.css`, `land-body.html`, and assembles `landing.html` and `snapshot.html` as measured in section 2.
- `page`: fills `test.html` to `click-through-test.html` with `editor.css`, `blocks.css`, `land-data.json`, `test.js`. Use `split`/`join` or a replacer function, not `String.replace(str, str)`, since `$&` and `$'` in a bundle would corrupt the output (the trap in the handover's section 7). Refuse if `test.js` holds an unescaped `</script` or the page is over 16 MB.

A9. `smoke.cjs`: add `blocks` to the loop, report through `ok()` and a `pass N fail M` line, so `runall.sh`'s filter shows it.

A10. `drive13-canvas.cjs`: checks C1 to C11 in section 9. Take screenshots `s13-feed.png`, `s13-empty.png`, `s13-standin.png`, `s13-published.png`.

### WP-B: right column and editor

Owns: `packages/direct-edit/src/block/contract.ts`, `packages/direct-edit/src/model/schema.ts`, `packages/direct-edit/src/panel/panel.ts`, `packages/direct-edit/src/canvas/tree-editor.ts`, `packages/direct-edit/src/canvas/block-fields.ts` (new), `packages/direct-edit/src/direct-edit.css`, `packages/direct-edit/harness/drive13-panel.cjs` (new).

B1. `schema.ts`: `SectionId` gains `content`, `behaviour`. `SECTION_ORDER` becomes `layers, content, align, size, layout, link, text, appearance, behaviour, effects, advanced`, as in synthesis 4.2. Titles "Content", "Behaviour". `Control` gains `text`, `textarea`, `readout`. `SlotSpec` gains `hint?: string` (tooltip on the label) and `readout?: string`.

B2. `panel.ts`, new cases only:
- `control()`: `text` as `<input type="text" id data-k data-text value placeholder spellcheck="false" data-f>`, `textarea` likewise with `rows="3"`, `readout` as `<span class="de-readout" data-f>`.
- `onInput`, before the `d.num` branch at `:629`: `if (d.text !== undefined) { this.h.change(d.k!, t.value, true); return; }`.
- `row()` (`:335`): `title="${esc(s.hint)}"` on the label when `s.hint` is set; a class `de-prop` on the row when the slot's key starts with `p:`.
- `PanelContext` gains `notice?: string`, drawn under the head as `<p class="de-note" data-f="notice" data-sync="notice">`, with a `data-sync` placeholder when absent, so the soft render stays stable.
- `PanelContext.code` gains `config?: { tag: string; hint?: string; json: string }`. In `codeTab` (`:491`), when set, draw `.de-sheet-tag` as `sheet()` does, then `<pre class="de-sheet-json" data-sync="sheet-json">`. Read-only, so no textarea and no `Your CSS`.

B3. `block-fields.ts` (new, plain functions):
```ts
export function blockSlots(def: BlockContract, props: Record<string, unknown>): ResolvedSlot[];
export function blockValues(def: BlockContract, props: Record<string, unknown>): { values: Record<string, unknown>; overridden: Record<string, boolean> };
export function cleanPropValue(p: ContractProp, v: unknown): { ok: true; value: unknown } | { ok: false; message: string };
export function resetProp(p: ContractProp, props: Record<string, unknown>): void;
```
Group to section: `content` → `content`, `layout` → `layout`, `look` → `appearance`, `behaviour` → `behaviour`, `null` → no row. Kind to control:

| Kind | Control | Details |
|---|---|---|
| `string`, `binds` | `text` | Binds shows the id, as `types.ts:219-220` says |
| `string` with `format: "color"` | `color` | `allowed: {}`. Same popover as a box |
| `url` | `text` | Placeholder `https://… or #anchor`, as `attrRows` |
| `image` | `text` | Placeholder `Paste a picture address`, as `pictureRow`. Real pickers are stone 3 |
| `text`, `richtext` | `textarea` | `richtext` holds HTML here; `RichText` sanitises at render. Typing in place comes with parts |
| `number` | `number` | `bounds` and `allowed.range` from `min`, `max` when present; `step`, `unit` |
| `boolean` | `chips` | `list(false, true)`, labels Off and On |
| `select` | `select` | `allowed.list` and `labels` from `options` |
| `rows`, `list` | `readout` | `None yet`, `1 row`, `N rows`. One `.de-note` in `extra.content`: rows cannot be changed here yet |

Key `propKey(name)`, id `propSlotId(name)`, `hint` the prop's description. `overridden` is true when the stored value differs from the default, and an unset value with no default is not overridden. `resetProp` writes the default back, or deletes the key when there is none. `cleanPropValue`: `url` through `safeLink`; `image` through `isPrivatePicture` and `safeSrc`; empty is allowed; others pass.

B4. `tree-editor.ts`:
- In `context()`, before the fallback at `:308`: when `o.contract?.[node.type]` exists, return heading `def.label`, the slots and values above, `notice` when `o.drawsSample?.(node)`, `extra.content`, the same `bottom` buttons, and `code.config` with `tag: node.type`, `hint: def.label`, and JSON of `node.props` without `id`. With no contract entry the existing branch stays as it is.
- `panel.change` (`:385`): first line `const name = propNameOf(key); if (name) return changeProp(...)`. `changeProp` runs `cleanPropValue`, stores only on `ok`, and on a refusal keeps the field's text.
- Typing session: for `text` and `textarea`, call `history.remember(null)` once when the field changes, then skip it until `focusout` on `side` or an undo or redo. Clear the session in the `History` set callback at `:127`. This makes one undo step regardless of the 800 ms window.
- `focusout` on `side`: if the last refusal is for this field, `shell.drawTop(message)` and redraw the panel fully, so the field shows what is stored.
- `panel.reset` (`:400`): `p:` keys go to `resetProp` inside `change`.
- `detach` (`:481`): return with a `shell.drawTop` message when `o.drawsSample?.(f.node)`, or `el.dataset.treeStandin !== undefined`, or `el.dataset.treeEmpty !== undefined`. Message for samples: "This block is showing sample rows. Detach would keep them as if they were yours."
- `menuTools` (`:644-668`): `const look = isOwn ? f.node.props.look as PartStyle | undefined : undefined`. `detach` is also disabled by the three conditions above. In the panel's `bottom`, the Detach button is `disabled` under the same conditions, with a one-line note. `runTool` `copy-style` and `reset` (`:683,692`) return when not `own`. `writeLook` (`:376`) returns when not `own`.
- The foot note, when a contract entry exists, drops "Its settings still shape it" and says what Detach does.

B5. `direct-edit.css`: `.de-readout`; `.de-row.de-prop .de-label { white-space: normal; line-height: 1.2 }`; `.de-row.c-textarea { align-items: start }` and the textarea in the field style of `.de-row input[type="text"]` (`:53,61`); `.de-sheet-json` as `.de-sheet-attrs` (`:357`).

B6. `drive13-panel.cjs`: checks P1 to P16 in section 9. Take screenshots `s13-hero.png`, `s13-wall.png`, `s13-colour.png`, `s13-faq-menu.png`, `s13-code.png`, and compare them with section 10 before reporting.

While developing, WP-B has the Feed notice and Detach refusal from Step 0's `drawsSample` before WP-A's rows draw. WP-A has today's panel until WP-B lands. Neither waits for the other.

## 9. Harness view, driver and checks

- View: "Blocks" on the test page (`data-v="blocks"`, default tab). Standalone page for drivers: `view-blocks.html`, with development React, unminified.
- Driver: `harness/drive13.cjs`, written by the Lead in Step 0: the server and `ok` helpers of `drive11.cjs:1-4`, then `require("./drive13-canvas.cjs")(ctx)` and `require("./drive13-panel.cjs")(ctx)`, each from a fresh `goto`, filtered by `process.env.ONLY` (`canvas` or `panel`). It ignores only the logged "Broken on purpose" error and ends with `pass N fail M`.
- `ctx` holds `{ p, ok, errs, open(hash), pick(name), rowFor(name), menu(selector) }`, with `pick` and `rowFor` as in `drive11.cjs:12-13`.

Canvas module (WP-A):

| # | Check |
|---|---|
| C1 | Seed nodes `hero`, `head`, `wall`, `faq`, `grid1`, `prose1`, `box1` carry `data-tree-node`. Six `.blk-wall-img` with `naturalWidth > 0` |
| C2 | Right-click, Add, Feed: "Morning Sadhana" is in `#host`. `JSON.stringify(ed.doc())` holds neither "Morning Sadhana" nor `"items"` on the new node |
| C3 | Save: the last `window.saved` holds no "Morning Sadhana" and no `sample-1` |
| C4 | Every Add row in turn (29 insertable shared blocks plus own and test block): node count rises, no `pageerror`, the panel still present, and `[data-tree-standin]` on none but `test-throw`. Prints the list that drew an empty label |
| C5 | `test-throw`: stand-in names the block, neighbours still drawn, click selects it, Delete removes it, Undo returns it. A throw does not blank the canvas |
| C6 | Add Picture wall: `[data-tree-empty]` reads "Picture wall: nothing to show yet" and can be selected |
| C7 | A later draw retries a failed node: set `globalThis.__healed = true`, make an edit elsewhere, and the block draws "Healed" with no stand-in. Reset the flag afterwards |
| C8 | `tree.html` (no contract): Add Feed draws no "Morning Sadhana", no `[data-section="content"]`, and the old note text. Hosts without a contract are unchanged |
| C9 | "Show as published": the overlay holds the hero title and `.blk-wall`, no `[data-tree-node]`, no `.de-`-prefixed element, no "Morning Sadhana". Close returns to the editor and `ed.doc()` is unchanged |
| C10 | "Show saved document": JSON text with no rows on the Feed. `window.remount()` keeps the Feed node, still with no rows in the document |
| C11 | `window.kit.contract`: `thread-feed.sample.items.length === 2`; `picture-wall` `captionColor` group `look`; `faq` `look` group `layout`; `grid` `items` group `null`; `hero-banner.sample` empty |

Panel module (WP-B):

| # | Check |
|---|---|
| P1 | Hero: `.de-sec[data-section]` order `content`, `layout`. Labels Title, Subtitle, Background image, Image description, then Text position, Height. `.de-row` `grid-template-columns` and control height equal those of a Box's row |
| P2 | Type in Title with a pause over 800 ms: `.blk-hero-title` changes per letter, `document.activeElement` stays, `selectionStart` at the end. Undo pill once returns the original. Redo restores it |
| P3 | Hero align moves `.blk-hero-copy`. Wall `gap`, `shape` change `data-gap`, `data-shape`. FAQ `look` changes `data-look`. Focus returns to the select |
| P4 | Caption colour: swatch opens `.de-colorpop` with Palette and Custom tabs, as a Box's Fill. Custom hex colours `.blk-wall-caption`. A reset arrow appears. Reset returns to empty and the inline colour is gone |
| P5 | Hero height: typing 99999 stores 1200. ArrowUp steps 10. `min-height` applied |
| P6 | FAQ `openFirst` chips: Off closes the first `details`; On opens it |
| P7 | Wall row reads `6 rows`; an empty wall reads `None yet`. Neither holds an input |
| P8 | Add Text: the empty label shows. Type in Body: the label goes, the block draws, the selection holds. Clear it: the label returns |
| P9 | Right-click FAQ: Copy style, Reset style, Hide disabled. `ed.doc()` `faq.props.look === "divided"` after the menu. On a Box the same rows are enabled |
| P10 | Feed: `[data-f="notice"]` reads `Sample rows. Not saved.`. Detach disabled in panel and menu; the document is unchanged. Hero: Detach still works and Undo brings it back |
| P11 | Stand-in and empty wall: Detach disabled. No "nothing to show yet" text can enter the document |
| P12 | Hero image: `javascript:alert(1)` and `/api/media/x/Private/a.jpg` are not stored and blur shows the message; `/pic.png` is stored. Button link: `javascript:x` not stored; `#top` stored |
| P13 | Code tab on Hero: tree above, `.de-sheet-json` holds `"title"`, no textarea. On Feed: no "Morning Sadhana". On a Box: the editable sheet, as `drive11` expects |
| P14 | Box: section list has no `content` or `behaviour`; a Fill change still writes `look` |
| P15 | Save, `window.remount()`: hero title, wall gap, caption colour and FAQ look are all there |
| P16 | `tree.html#classifieds`: no `data-section="content"`; a Row's sections are as before |

Plus, unchanged from section 2: `drive`, `drive4` to `drive12` at the same counts, and `smoke.cjs` with six views.

## 10. Reference images the UI must match

Read on 2026-11-02 [V:read]. All in `packages/direct-edit/harness/reference/`.

| Image | What stone 1 takes from it |
|---|---|
| `text chosen, box around it shownabletoexpand.png` | Row anatomy for every prop row: muted label at left, grey rounded field, unit inside, reset column at right. Section titles bold, one line, a rule between sections. `Destination https://…` is the model for the `text` control. `Color` swatch and hex is the model for the colour row |
| `rowlayer4.png` | Code tab: tree on top, `<div>` tag line in muted mono, then the monospace sheet. The config JSON sits where the declarations sit. There is no "From" group in this stone |
| `rightclickmenuplusresizeablecornersonheader.png` | Rows that cannot be used stay listed and grey ("Move to first", "Ungroup", "Detach instance"). So "not offered" means disabled, not removed, for Reset style, Copy style and Detach |
| `c_right.png`, `c_tools.png` | Pills unchanged. Regression only |

`textarea`, the notice line and the two new sections have no reference. They take the field style and the section-title style above, and the hand test settles them. `s1-probes/out/part-selected.png` is the same panel with parts and belongs to stone 2.

## 11. Rebuilding the private test page

Page: https://claude.ai/artifact/WzHAvvUd4tPGMqsvpfeaev. What the handover leaves missing, and how it is closed:

| Missing | State | Closed by |
|---|---|---|
| The wrapper, `click-through-test.html` | Not in the repo. Only copy outside the artifact: `$T/../artifact-files/f2d861c3-540c-4f46-8089-74bfd82ff703/index.html`, not durable | `harness/test.html` (A6) |
| Assembly | By hand, not recorded | `harness/pack-test.cjs page` (A8) |
| Land data (1.5 MB of captured landing HTML and CSS) | Inside the published page only. `preview-snap.sh` would regenerate it, at the cost of a `next dev` against production | `pack-test.cjs land <published.html>`. Not put in the repo, as the handover already decided; the published page is its durable copy |
| `landing.html`, `snapshot.html` for `drive12`, `drive5` | Not in the repo | Same `land` mode. Rehearsed by hand in this pass, both pass [V:run] |
| `runall.sh` | Broken as stored | Step 0 |
| `playwright-core` | Not in the repo | `npm i` per the handover, or copy `$T/lead-baseline/h3/node_modules` |

Procedure at integration:

```bash
T=/tmp/claude-3003/-mnt-pool1-home-guru-eac/7236b31a-7646-4e28-8b29-be60fa6c575f/scratchpad/team
S=$T/pack; mkdir -p $S/h3/shots
cp -r /mnt/pool1/home/guru/eac/packages/direct-edit/harness/. $S/h3/ && cp -r $T/lead-baseline/h3/node_modules $S/h3/
# Artifact action "read" on the page URL names the saved file holding the full page; copy it to $S/h3/published.html
docker run --rm -u 3003 -v "$S/h3:/h" -w /h node:24-alpine node pack-test.cjs land published.html
docker run --rm -u 3003 --network none -v /mnt/pool1/home/guru/eac:/app:ro -v "$S:/w" --entrypoint sh eac-dev /w/h3/hb.sh
docker run --rm -u 3003 -v "$S/h3:/h" -w /h node:24-alpine node pack-test.cjs page
S=$S bash $S/h3/runall.sh smoke.cjs
```

Then publish with the Artifact tool. In the integrating session: load `artifact-design` first, since the tool requires it before a page is written; call `action: "read"` on the URL, since a publish to an artifact this conversation has not read is refused; then `action: "publish"` with `url` set to the page and `file_path` set to `$S/h3/click-through-test.html`, `label: "Stone 1: block settings"`. Only the page is sent; saves stay in the page, as today.

Assumed, not run: the claude.ai sandbox allows `data:` images on this page. The tool's own text counts `data:` URIs toward its size limit, which implies they are allowed [A]. If not, the seed pictures show their alt text and steps 4 and 5 of the hand test still work.

## 12. Integration and the hand test

Lead, after both coders report:
1. `diff -ru $T/baseline-tree/packages/direct-edit /mnt/pool1/home/guru/eac/packages/direct-edit` and `git status --short packages/blocks`: only owned files. Anything else means another session; stop and ask.
2. Read both diffs. Confirm there is no change to `block/style.ts`, `visual-editor.ts`, `layers.ts`, `page-builder`, `blocks/src/index.ts` or any app.
3. `tsc` in `direct-edit`, `blocks`, `apps/arts-collective`, `apps/innergathering`: 0, 2 (the same two), 0, 0.
4. `drive13` full, then every regression driver at the counts in section 2.
5. Read every `s13-*.png` and compare with section 10. A UI piece is not done until a screenshot was looked at.
6. Compile `check.ts` once with the real files, for structural assignability (as in `lead-baseline/typecheck/`).
7. Assemble, smoke, publish (section 11).
8. Update, in the neutral register and after `git diff` on shared files: `docs/open/CANVAS_FRAMEWORK_2026-11-02.md` Progress; the handover's section 7 on the harness; one line in `CLAUDE.md`'s Canvas framework entry. Propose moving `1-cpo-survey.md`, `2-specialist-*.md`, `3-synthesis.md` and this file to `docs/open/` once the developer accepts the direction. No commit unless asked.
9. Short report, with one choice: try it and say what is wrong, or go on to stone 2.

Hand test for the developer, on the test page, tab Blocks:
1. Right-click, Add, Feed: it draws sample rows, not an empty box. The right column says "Sample rows. Not saved."
2. Click Hero banner: Content (Title, Subtitle, Background image, Image description) and Layout (Text position, Height), in the rows a box uses. Then click the blue box lower down and compare.
3. Type in Title: the hero changes per letter and the cursor stays. Press Undo once: all of the typing goes back.
4. On the picture wall, change Space between, Shape and Caption colour. Colour opens the same popover as a box. The reset arrow returns the default.
5. Add, Picture wall: a labelled empty box. Its Picture row says "None yet". Adding pictures comes with stone 3.
6. Press Save, switch tab, come back: the settings are there. "Show saved document" shows the Feed with no rows in it. "Show as published" shows the page with no editor marks and an empty Feed.
7. Right-click the questions block: Reset style is grey, and its Look setting stays.
8. Feed: Detach is grey, with the reason. Hero: Detach works and Undo brings it back.
9. Code tab on any block: its settings, read-only.
10. Add, "Test: breaks on purpose": that block shows a named box and the rest of the page stays.

Things to tell the developer in the report: labels wrap to two lines where they are long, and they should say if they want the column wider; 13 of 30 blocks draw nothing on Add until filled, three of them (questions, picture wall, dated list) until stone 3; Detach on the seed wall loses its pictures because seed pictures are `data:` addresses; none of this has run signed in or on a real site.

Not verified by this stone: a real host, signed in, against stored documents; Firefox, Safari, touch.

## 13. Needs the developer before coding starts

Nothing blocks stone 1 technically. Two answers change the order of work:

1. **D4, revised by the review: when does the innergathering rebuild run, for the first signed-in trial?** Options: now, before stone 1 (recommended by the review, and by this plan: the newest migration, 240, is applied [V:sql, 2026-11-03 02:35 UTC], innergathering's build is dated 2026-11-02 19:36 by its `BUILD_ID` [V:run], and every later stone adds source on a base that has never run signed in); or after stone 1. Only the developer can run it (handover section 6). It must not run while stone 1 is being written, because it would deploy half-written editor source. Default with no answer: coding proceeds, and innergathering and arts-collective are held from rebuilds until integration ends. If "now", coding waits for the signed-in checks.
2. D5: baseline commit of `packages/direct-edit`? A commit of that directory only gives durable diffs and rollback. Default with no answer: no commit, and the `~/eac-backups/direct-edit/` snapshot of Step 0 serves. Neither blocks coding.

Everything else, including D1, D2 and D3, is not needed until stones 4 and 8.

## 14. Risks and open items

| Item | Effect | Handling |
|---|---|---|
| Rebuild of arts-collective or innergathering by another session mid-work | Half-finished panel reaches a production editor. Published pages are not on this path | Compile-clean saves; optional fields only; asked in section 13 |
| Another session edits `packages/direct-edit` | Lost work; no git history | Mtime check per file; snapshot; `diff -ru` at integration |
| Labels wrapped to two lines differ from the reference's one line | Developer may reject the look | Named in the hand test. One CSS rule to change |
| `richtext` shown as HTML in a textarea | Poor for an artist on `prose` and similar | Test page only until a host is wired. Stone 2's typing in place, or a decision at the hand test |
| `coerce.ts` is not run on panel values | A value a block cannot draw reaches it | Stored values stay within `options`, `min`, `max` by control. The boundary covers a throw |
| Sample rows on a `profile-*` block use `/api/media/sample/...` paths | Broken pictures on the test page, alt text shown | Accepted on the test page. C4 prints the list |
| Effort | [U] | Reported at integration; no estimate offered |

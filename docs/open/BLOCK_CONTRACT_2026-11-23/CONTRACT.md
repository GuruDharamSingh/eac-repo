# The block contract (2026-11-23)

Status: proposal, for Justin's answers (pinned questions C1 to C7 on the development app page "The block contract"). Numbers come from `apps/development/src/data/block-contract.json`, written by `apps/development/scripts/refresh-block-contract.mjs`. Marked **NEW** means not built yet.

## 1. A block is code

A block is a component that draws part of a page. The editor adjusts and arranges it. It never replaces it. The contract is what the code says about itself (section 2) and what the editor may do to it (sections 3 to 5).

## 2. What a block tells the editor (declarations)

All of these are data on the block's definition, `BlockDef` in `packages/blocks/src/types.ts`. Declaring changes no markup.

- **Settings.** Each has a name, a kind (string, text, richtext, number, boolean, select, list, rows, url, image, slot), a default and a range (`PropDef`, types.ts:134-200).
- **Parts.** Named inner elements a page may restyle: a label, one selector, `repeat` if it is drawn more than once, `draws` if it shows only under some settings, and `prop`, the setting the part shows (types.ts:252-280). Part names are stored in page JSON, so they are not renamed casually. Declared in `parts`.
- **Words.** A setting of kind `string`, `text` or `richtext`. `inlineEditable: true` (types.ts:173) or a part with `prop` lets the words be typed on the page. Rich words need the host's sanitiser, or the door refuses (`steps/types.ts:60-64`).
- **Pictures.** A setting of kind `image`. A picture declaration means the editor can offer upload of a new photo and choice from the library there. A photo uploaded for a site or tour goes into the organisation's media, stored once and referenced everywhere; credit is optional.
- **Records it can be tied to (`binds`).** A setting that holds a record id names the kind of record (types.ts:204-222). The page stores the id only, never a copy.
- **What can be resized (`resize`).** The number setting, in pixels, that a drag handle on the bottom edge writes (types.ts:410-413). `manipulate` is the same idea for a picture's place, size and offset (types.ts:391).
- **What it reads from its surroundings (`reads`).** The record in the address, the site's org, theme or menu, who is looking, where it sits, a step of a journey (`BlockRead`, types.ts:234-245; `reads` at :432).
- **Style tokens.** `tokens` lists the custom properties a page may set on one block (types.ts:311).
- **Places inside it that can receive another block.** Exists: a `slot` setting with `allow` (types.ts:195). 13 blocks have one today.
- **NEW: what a place offers.** For a place: this thread, its people, its media, its org. And **what a guest block looks for**. Neither exists. The first trial proposed: a meeting-thread card as host, a profile and a cover picture as guests (question C5).

## 3. What the editor remembers

Settings, looks per part (`props.morph` for a sealed block; `props.look` for a canvas box), record ties (a record id in a bound setting). All of it in the saved page document. Nothing else. (`LOOK_PROPS`, `steps/types.ts:83`.)

## 4. How the editor may change a block

Only through the one checked door, `packages/house-editor/src/steps`. Nine steps exist (`steps/types.ts:20-29`):

`set_prop`, `unset`, `bind`, `set_look`, `set_token`, `insert`, `move`, `duplicate`, `remove`.

Each answers with a code and a plain sentence (`StepResult`, :69-81). A refused step returns the page unchanged.

**Who may change what follows their role** (**NEW** as a stated rule; the editor checks sign-in and role today, host by host). An author changes their own things. A guide changes their tours. An owner or admin changes the site. A pencil or toolbar appears only for a thing the person may change; if they click something they may not, it says why in one line. Open question C7: when pencils show, and whether an author sees them only on their own posts. Open question C6: who may rename a record from a page.

## 5. Rules

Editor toward block:

- **E1** Touch only what is declared.
- **E2** One home per value.
- **E3** Every change through the door.
- **E4** Never silent: if it cannot, it says why in one line.
- **E5** Nothing reaches visitors until it is put on the page.

Block toward editor:

- **B1** Everything meant to be changeable is declared.
- **B2** Undeclared means fixed, on purpose. (Open question C4: or should the editor always offer a way in?)
- **B3** Colours and text styles come from the theme's roles, never typed in (`docs/open/THEME_SYSTEM_2026-11-22/STRUCTURE.md`).
- **B4** A height or other size that is a setting has that setting as its only home.
- **B5** Words that come from a record say which record.

One real example of each kept and broken is on the page, section "The rules".

## 6. The pipeline: stages a block passes

A block has reached stage N when it passes every earlier stage. Stage 5 is skipped in that count until it exists.

1. **Written.** The code exists and draws.
2. **Declared.** Settings and parts are named.
3. **Themed.** No typed-in colours or fonts.
4. **Editable in place.** Parts selectable, words typed in place, records tied, a height setting is a `resize`.
5. **Hosts and guests.** **NEW.** Places, offers, wants.
6. **Listed for assistants.** In the block manifest, matching the source, and not on the deny list (`packages/mcp/src/manifest/deny.ts`).

Assistants have a second, narrower list: settings they may read but not set, because the switch decides who sees or joins something (`READ_ONLY_SETTINGS`, deny.ts).

## 7. Where the first outline was wrong against the code

- "Places that can receive another block: NEW." Half wrong. A `slot` with `allow` already exists. Only what a place offers, and what a guest looks for, is new.
- It left out `tokens`, `manipulate`, `draws` and a part's `prop`, all declared and read today. Added.
- "Parts: which repeat." Right, and also `prop`, which is what makes in-place typing possible. Added to Words.
- "Looks per part (`props.morph`)." True for sealed blocks only. Canvas boxes keep their look in `look`. Both are look keys the content steps never write.
- Stage 6 ("in the manifest") is not enough: the manifest is a checked-in generated copy and can be out of date. Elktours' tour cards declare six parts in source and none in the manifest. The scan reports that as a failure of "In the manifest".
- E5 is a rule the code keeps for the page editor (stale-save guard) but not for the Site style drawer, which saves theme values straight to the live org (INVENTORY.md section 0). Written as a rule to be met, not a description.
- The "who may change what follows their role" statement in section 4 is a proposal. No single role table exists in the steps.

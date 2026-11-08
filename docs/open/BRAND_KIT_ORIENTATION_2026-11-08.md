# Brand kit: orientation (first iteration)

2026-11-08. Light scan only, read-only on code. Not a design: it sets up one shared shape (a "family shell") for brand kits so Justin's step-setup iteration has something to land on. Expect revision.

Owner's words: brand kit is branding assets at artist/user, org and content levels; the presets they like; threads and artworks become content when introduced to the board and activated for a campaign the kit suits; a choice of which takes precedence where; managed more by Channel and Studio; assets in cloud storage per user and org, and sometimes content has its own storage.

## 1. Already brand-kit-ish today

- **Site look per org/page/user:** `site_themes(org_id, page_key, vars jsonb)` plus `users.theme`; merge site < page < user. `packages/db/migrations/090_themes.sql`, `packages/services/src/themes.ts`.
- **Site Builder Theme tab:** colour roles (paper, surface, ink, line, accent, accent2, frame), heading/body fonts, a "look" note. `packages/hub/src/site-builder/ThemeTab.tsx`, `model.ts`. Edits go to the host's theme editor.
- **Site Builder Profile tab / identity kinds:** org identity is a `users` row; `identity_kind` + `identity_also_kinds`. Migration `260_identity_kinds.sql`, `ProfileTab.tsx`. No logo field found there.
- **Hub card tokens:** `--hc-*` resolve through `--eac-hub-bg` / `--sf-bg` / `--paper` fallbacks. `packages/hub/src/theme/hub-cards.css`.
- **Forms theme contract:** `FormTheme` = `[data-form-theme]` attr redefining `--frm-*`, plus an icon map. `packages/studio/src/forms/contract.ts` (theme section, ~l.328). The host passes `themeVars` (the org's `site_themes`) to the preview.
- **Forms presets:** `FormPreset` with `source: item | org | person | platform | last`; settings only, never content. Platform presets are in code. `packages/studio/src/forms/presets.ts`.
- **Colour engine:** OKLCH ramps, `harmony()` palette from one colour, `LOGO_INK`, shaders, safe CSS. `packages/gradients/src/{generate,palettes,ramps,css}.ts`.
- **Design tokens:** DTCG 2025.10 import to theme vars; typography tokens expand; quoted font stacks rejected. `packages/tokens/` (README).
- **Artist wizard:** `palette_preference` / `template_preference` asked since early on, never read (migration 090 header says 0 rows). `032_artist_profiles.sql`.
- **Storage:** `packages/nextcloud/src/org-folders.ts` creates `EAC_Network/<org>/{Media/*, Private/Media/*}`; per-user `users/<slug>` folder and a team folder come from the sync (`packages/services/src/org-nextcloud-access.ts`, gated by the `nextcloud_access` org grant); also `packages/services/src/org-storage.ts`.
- **Planned, not built:** `content_prefs` (item/org/person) and the Lane A2 preset store (see 3).
- **Grep result:** no per-org logo, mark or voice setting exists. "Logo" hits are the EAC logo ramps, email templates and pipeline UI. The PM board says plainly: no brand-kit code anywhere yet.

## 2. Family-shell sketch

One record shape, instantiated at each level; every field optional, so a level only states what it overrides.

**Levels:** network default (platform) > org > person/artist > content item (thread, artwork, campaign-activated piece). The network default is today's `PLATFORM_PRESETS` plus the base theme.

**Contents (the shell):**
- marks: logo, wordmark, avatar, cover (references to files)
- palette: the seven colour roles above, or a seed colour that `harmony()` expands
- type: heading font, body font (from the sanitised list)
- voice: caption style, tone words, sign-off, hashtags, outlets to skip
- preset picks: ids or `nc:` refs per type (caption, clip, music, look of a forum-question share, live, daily practice)
- asset folder: a Nextcloud path

Each value should carry its origin, so the UI can say "from Katie the Potter's brand kit" (the phrase the content library doc already uses).

**Precedence candidates** (situation: an artist posts under an org on a campaign board; do not pick yet):
- **A. Nearest wins:** item > person > org > network. The most specific choice always overrides.
- **B. Org frames, artist fills:** org wins on marks and palette (the public face); the artist wins on voice and preset picks; the item may override only voice. Per field, not per level.
- **C. Campaign-scoped:** when the item is active on a campaign board, the campaign's kit (an item-level kit) wins whole; otherwise A. Artists can opt out per post.

Note the planned `content_prefs` cascade is item > org > person > default (org above person), which is closer to B/C than to A. Also, an artist posting on their own channel has no org level; the rule must say what happens then.

**Storage (proposed paths, not existing ones):**
- network: platform assets in code or a platform folder
- org: `EAC_Network/<org>/Brand/` (marks, fonts, caption sheets, preset bodies)
- person: `users/<slug>/Brand/`
- content item: its own folder when it has independent storage, e.g. `.../<item>/Brand/`, else a reference into the owner's folder.

The DB holds an index and references only; bodies stay in Nextcloud (as Lane A2 already plans).

**Who manages it:**
- Channel: setting the kit in the steps flow, choosing which level wins, activating on a campaign.
- Studio: the preset builder (Lane A2), applying the kit to a piece, the "What it likes" panel.
- Hub Site Builder: the site-facing slice only (Theme and Profile tabs); it should read the same record, not keep its own.

## 3. How it plugs into current work

- **`content_prefs`:** one `brand` slot beside `ladder`, `tuner`, `presets` (planned columns), or kit refs inside `presets`. The loader's cascade is where the kit appears "without a separate UI".
- **Forms presets:** `FormActions.presets()` is the feed point; `SOURCE_ORDER` in `presets.ts` is the precedence hook. Presets stay settings-only, so marks and palette should not be forced into `FormPreset.values`.
- **Theme tokens:** kit palette/type should map onto the `site_themes` var bag, then `--frm-*` and `--hc-*` pick it up with no component change. `users.theme` already covers the person level.
- **Palette helpers:** `packages/gradients` (`harmony`) and `packages/tokens` (DTCG import) can derive and ingest palettes.
- **Platform exchange (in design):** a kit is a natural exportable unit (kit file plus assets). Versioning and sharing rules belong to that workspace, `docs/open/platform-exchange/`.
- **MCP:** `packages/mcp` slice 1 lists `content_passport` as "later"; a `brand_kit` read (resolved, with origins) would sit beside it.

## 4. Open questions for Justin

1. Is a kit one bundle, or separate pieces (marks, palette, voice) that each cascade independently?
2. Which precedence rule (A, B or C), and can it differ per field?
3. For an artist posting under an org, who owns and edits the org kit, and can the artist keep a personal kit that applies only off-org?
4. Does a content item get its own kit only when activated for a campaign, or any time (thread/artwork "what it likes")?
5. Are kit assets always files in Nextcloud, or may a kit point at a Photon/Remotion-made asset or a URL?
6. Should the Site Builder look and the brand kit be one record (site look = the org kit's web slice), or two that sync?

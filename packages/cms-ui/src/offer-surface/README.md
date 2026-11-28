# Offer surfaces: the single-offer site's UI kit

`packages/cms-ui/src/offer-surface/`. Written 2026-11-27 for people and for agents (including backend ones). Checked against the files named below on that date; if a line number here has moved, the file is right.

The same facts, as one machine-readable document, are served by the development app at `/development/offer-templates/catalogue.json` (network admins) and drawn as pages at `/development/offer-templates/catalogue` (also the Catalogue tab of `/development/offer-templates`). Their source is `apps/development/src/offer-templates/catalogue.ts`.

## 1. What this is

A free-tier site (`<org>.arts-collective.com`) shows **one offer at a time** on its one offer page, laid out by a **template**, plus a profile page. The look comes from the design packet "Single page publication template mockups" (`apps/development/designs/publication-surfaces-2026-11-27/`).

The system in five sentences:

- Everything except the page itself is a **surface**: a popup on desktop, a bottom sheet on a phone. Surfaces **stack** on the page (offer, then RSVP, then done).
- **Nothing redirects.** The only things that leave the page are the header **Profile** link (the site's other page) and outside links (Website, Instagram, an artist's own site). Another offer, a piece of writing, a person, a transaction: all open as surfaces over the page.
- **Templates follow the featured piece.** Each featured piece carries its own template; changing what is featured changes the layout (Justin's decision 2, `docs/open/OFFER_SURFACES_2026-11-27/DECISIONS.md`).
- A template's secondary pieces never leave the page: they open through the surface flows.
- A **layer** is one surface (`evt-offer`, `pay`, `done`, ...). Layers ride the existing cms-ui surface system (`../surface/`) as `custom` descriptors with key `"offer"`, so its stack, Esc, crumb, scrim and `?surface=` handling apply unchanged.

## 2. File map

In this folder (`packages/cms-ui/src/offer-surface/`):

| File | What it is |
|---|---|
| `index.ts` | the public exports (`@elkdonis/cms-ui/offer-surface`) |
| `types.ts` | the data contract: `SurfaceSiteData`, `SurfaceOffer`, `SurfaceProfile`, `SurfaceWritingPiece`, `SurfaceLook`, `SurfaceActions`, `CheckoutRequest` |
| `descriptor.ts` | layer ids (`OfferLayerId`, `OFFER_LAYERS`), flows (`OfferFlow`), `OfferCtx`, `offerDescriptor()`, `layerFor()`, `offerSurfaceValue()`; the stack rule is written at the top |
| `OfferSurfaceRoot.tsx` | client root: look scope, fonts `<link>`, site data and actions, the surface stack with the layers registered |
| `OfferLayer.tsx` | descriptor to layer (a `switch` over `OfferLayerId`) |
| `OfferFrame.tsx` | the head / body / foot every layer draws inside (`gk`, `kicker`, `title`, `status`, `primary`, `quiet`, `headAction`) |
| `layers.tsx` | `EventOffer`, `ServiceOffer`, `ArtworkOffer`, `ArtworkOrder` |
| `layers-flow.tsx` | `EventRsvp`, `Pay`, `Done`, `Follow`, `Share`, `ProfileLayer` (pf-owner and pf-guest) |
| `layers-read.tsx` | `WrRead`, `Talk`, and the docked `WritingStage` |
| `layers-series.tsx` | `SeriesOffer`, `SeriesSub`, `SeriesSession` |
| `layers-join.tsx` | `Join` (the one sign-up layer) and `useJoinGate`, `GUEST_RSVP` |
| `layers-people.tsx` | `MemberProfile`, `ProfileHoverCard`, `PersonName`, `profileLayerFor()` |
| `stack.tsx` | stack navigation: `popTo`, `useFinish`, `useBackToTalk`, `STEP_LAYERS` |
| `cancelled.tsx` | the "payment was cancelled" line |
| `env.tsx` | `OfferEnvProvider` and `useOfferEnv()`: data, actions, `findOffer`, `findProfile`, follow flags |
| `page.tsx` | page pieces for the profile page (`OfferProfilePage`, `OfferTopBar`, `OnNowCard`, `AlsoOffered`, `WritingShelf`) and `useOpenOffer()` |
| `parts.tsx`, `format.ts`, `icons.tsx` | small shared pieces, formatting (`fmtMoney`, dates, `.ics`), `SurfaceIcon` (sets: things, marks, stamps, glyph) |
| `fonts.ts` | `OFFER_FONTS_HREF`, the Google Fonts request for all six font templates |
| `look.css` | tokens (`--os-*`) and the six font templates (`[data-ft]`); contrast table in its header |
| `offer.css` | layout for surfaces and page pieces; imports `look.css`, `layers-read.css`, `layers-series.css`, `layers-people.css` |

In `templates/` (the eleven page templates; `@elkdonis/cms-ui/offer-templates/<name>`):

| File | What it is |
|---|---|
| `types.tsx` | `TemplateId`, `TemplateData`, `OfferExtras`, `TemplatePiece`, `TemplateProps`, and `TEMPLATES` (id, name, kinds, mock, blurb) |
| `<id>.tsx`, `<id>.css`, `<id>.meta.tsx` | one template: component, styles, catalogue entry. Ids: event, announcement, note, service, artwork, series, essay, feature, document, gazette, profile |
| `meta.tsx` | the `TemplateMeta` and `PatternMeta` types every `.meta.tsx` follows |
| `shell.tsx`, `shell.css`, `shell.meta.tsx` | `TemplateShell` (top bar, main, gateway strip) that every template draws in |
| `sample.tsx` | `sampleData(templateId, look)` and `sampleActions`: packet copy, placeholder pictures, no backend |
| `stage.tsx` | sandbox view of the docked writing stage (not a catalogue template) |

Outside this folder:

- `packages/cms-ui/src/surface/url.ts`: serialises and parses `?surface=offer:<layer>:<key>[:<flow>]` (the `"offer"` case in `parseDescriptor`; `custom` in `serializeDescriptor`).
- `packages/cms-ui/package.json` `exports`: `./offer-surface`, `./offer-surface.css`, `./offer-templates/*` (to `templates/*.tsx`), `./offer-templates/*.css`.
- `apps/development/src/app/offer-templates/` and `src/offer-templates/`: the sandbox (routes `t/<id>`, the gallery, the catalogue).
- `apps/arts-collective/src/components/sites/OfferSitePage.tsx` and `offer-actions.ts`: the live host. Since lane L (board, 2026-11-27 17:25) the real page draws the featured piece through that piece's template (event, service, series, artwork, writing) and `/profile` through the profile template.

## 3. The data contract

Types only; read them in the files, not here. One line each:

- `SurfaceSiteData` (`types.ts`): `site`, `owner`, `featured` (the one offer, or null), `offers` (the others), `writing`, `people` (everyone else named, by id), `viewer`, `look`.
- `SurfaceOffer`: `key` (`thread:<id>` or `artwork:<id>`), `kind` (event, service, series, artwork, writing), `title`, `takeUp` (rsvp, pay, order, subscribe, enquire, none; decides the primary button), `hostId`, `coHostIds`, and optional `standfirst`, `description`, `poster`, `images`, `when`, `venue`, `price` (minor units), `sliding`, `capacity`, `tags`, `slots`, `durationMinutes`, `artwork`, `href`, `featured`.
- `SurfaceProfile`: `id`, `name`, optional `role`, `bio`, `portrait`, `links`, `followers`, `following`, `siteHref` (its presence makes a person a co-host with a page, layer `pf-guest`), `directoryHref`.
- `SurfaceLook`: `font` (para, gazette, quiet, marquee, ledger, rite), `icons` (things, marks, stamps, glyph), `mark` (inline, thumb, box), `tint`, and optional `sheet` (natural or level: phone sheet height).
- `TemplateData` (`templates/types.tsx`) = `SurfaceSiteData` plus `extras: OfferExtras` (category, program, attendees, photos, talkCount, map, replyNote, facts, ribbon, sessions) and `pieces: TemplatePiece[]` (the featured piece first, then the rest; `bodyHtml`, `sections`, `pullQuote`, `replies`, `footnotes`, ...). A host that passes plain `SurfaceSiteData` has no `extras` or `pieces`; the layers that read them (`EventOffer`, `WrRead`, `Talk`) tolerate that and draw less.
- `SurfaceActions` (`types.ts`): what the host gives the surfaces to act: `rsvp`, `follow`, `checkout`. Each is a fetch to a route on the host; rights come from the session or the checkout, never from the arguments.
- `OfferCtx` and `OfferProps` (`descriptor.ts`): the state handed from layer to layer (flow, slot, amount, delivery, address, follows, from). Only the flow reaches the URL.
- Per-template needs are in each `<id>.meta.tsx` (`reads`: every data path, required first; `missing`: fields the contract lacks).
- One field is read but is in no type: `data.memberReplies[personId]` (`layers-people.tsx`).

Full field-by-field table with file and line: the catalogue's "Data contract" section or the JSON's `contract` key.

## 4. Mount a page

The live host (`apps/arts-collective/src/components/sites/OfferSitePage.tsx`) is the working example. In short:

```tsx
"use client";
import "@elkdonis/cms-ui/offer-surface.css";
import "@elkdonis/cms-ui/offer-templates/shell.css";
import "@elkdonis/cms-ui/offer-templates/event.css";
import { OfferSurfaceRoot, type SurfaceActions } from "@elkdonis/cms-ui/offer-surface";
import { EventTemplate } from "@elkdonis/cms-ui/offer-templates/event";
import type { TemplateData } from "@elkdonis/cms-ui/offer-templates/types";

export function Page({ data, actions }: { data: TemplateData; actions: SurfaceActions }) {
  return (
    <OfferSurfaceRoot data={data} actions={actions} signInHref="/login">
      <EventTemplate data={data} />
    </OfferSurfaceRoot>
  );
}
```

- The profile page is `OfferProfilePage` (from `@elkdonis/cms-ui/offer-surface`) or the `ProfileTemplate` (`.../offer-templates/profile`).
- `OfferSurfaceRoot` props: `data`, `actions`, `signInHref` (the sign-in links are hidden without it), `syncUrl` (read and write `?surface=`, default true).
- It is a client component: the surface stack lives in the browser. The server builds `data`; the host's `actions` are plain fetches to its own routes.
- `OfferSurfaceRoot` renders the fonts `<link>` itself (React 19 hoists it). Import the CSS files; templates need `offer-surface.css`, `shell.css` and their own `<id>.css`.
- Open a layer from code: `useSurface().open(offerDescriptor("evt-offer", offer.key), originElement)` or `useOpenOffer()(offer, element)` (it picks the layer by kind).
- Sample data for tests and demos: `sampleData("event", look)` and `sampleActions` from `@elkdonis/cms-ui/offer-templates/sample`. `sampleActions` never leave the browser and refuse checkout. Stripe keys are live: never wire a real action in the sandbox.

## 5. Add a template

1. `templates/<id>.tsx`: export `<Name>Template(props: TemplateProps)`; render `<TemplateShell data={data} template="<id>">...</TemplateShell>`. Mark it `"use client"` if it uses hooks.
2. `templates/<id>.css`: classes `ost-<id>-*` only; set `.ost-page[data-template="<id>"] { --ost-base: <design width in px>; }` at the foot (see section 7).
3. `templates/types.tsx`: add the id to `TemplateId` and a row to `TEMPLATES` (name, kinds, mock id or `"derived"`, blurb). Add it to `FEATURED` in `templates/sample.tsx` (the sample offer it features, or null for writing templates).
4. `templates/<id>.meta.tsx`: export `meta: TemplateMeta` (type in `meta.tsx`). Plain data, no JSX: the component name and files, every data path it reads, fields the contract lacks, what each control opens (a layer id or "inert"), the patterns inside it (mark `shared: true` when another template draws the same thing), where it departs from the mock, and the measured phone height. Write it last.
5. Sandbox route `apps/development/src/app/offer-templates/t/<id>/page.tsx` and `client.tsx`. Copy `t/event/`: `page.tsx` calls `requireNetworkAdmin`, imports the three CSS files plus `@/offer-templates/frame.css`; `client.tsx` renders `<TemplateFrame template="<id>">{(data) => <<Name>Template data={data} />}</TemplateFrame>`.
6. Catalogue: in `apps/development/src/offer-templates/catalogue.ts` add the meta import, its entry in `METAS` and its `--ost-base` in `SCALE_BASE`. The Catalogue tab and the JSON then include it (the catalogue also lists any disagreement between the meta and `TEMPLATES` under `problems`).
7. Checks: type-check `packages/cms-ui` and `apps/development` (section 8); look at it at 1280x800 and 1440x900 and 390x844 in para, marquee and rite; put it next to the mock frame (section 8); no sideways overflow, no console errors. Desktop may scroll; phone is at most two phone heights (board, fit rules).

## 6. Add a layer

1. `descriptor.ts`: add the id to the `OfferLayerId` union **and** to the `OFFER_LAYERS` array (both are read: `offerProps()` rejects an id missing from the array, and `url.ts` accepts only ids in it). If a transaction needs its own flow, add it to `OfferFlow` and `OFFER_FLOWS`. If it is the first layer of an offer kind, add it to `layerFor()`.
2. The component: a function of `{ props: OfferProps }` that draws `<OfferFrame gk=... kicker=... title=... primary=... headAction=...>`. Open further layers with `push(offerDescriptor(...))`, swap with `replace(...)`; follow the stack rule at the top of `descriptor.ts` (crumb and Esc pop one; the close button closes all; Done returns to where the flow started). Put it in the matching `layers-*.tsx`, or a new file with its own `.css` imported by `offer.css`.
3. `OfferLayer.tsx`: add a `case` to the `switch`. It is exhaustive, so the compiler will say if one is missing.
4. `url.ts` (`packages/cms-ui/src/surface/url.ts`): nothing to add for a new id (it reads `OFFER_LAYERS`); check that the key is addressable (`OFFER_KEY_RE`) and that any state that must survive a shared link is in the flow or the key, not in `OfferCtx` (only `flow` reaches the URL).
5. If it needs a new icon kind or kind colour: `icons.tsx` (`SurfaceIconKind`), `KIND_VAR` in `OfferFrame.tsx`, and a `--os-kind-*` token in `look.css` (include it in the `[data-tint="off"]` block).
6. Catalogue: add an entry to `layers` in `apps/development/src/offer-templates/catalogue.ts` (what opens it, what it pushes, head button, primary action, real or sample-only) and its place in `flows`.

## 7. CSS rules

- **Prefixes.** `osf-` is the kit (surfaces, page pieces: `offer.css`, `layers-*.css`; sub-prefixes `osf-rd-`, `osf-tk-`, `osf-stage-`, `osf-ser-`, `osf-pm-`). `ost-` is the templates (`ost-page`, `ost-main`, `ost-top`, `ost-gate` in `shell.css`; `ost-<id>-*` in each template, shortened in three: `ost-doc-`, `ost-gaz-`, `ost-pf-`).
- **Scope.** Everything sits under `.osf-root` (the `OfferSurfaceRoot` wrapper, which also carries `.eac-offer` and `data-ft`, `data-tint`, `data-mark`, `data-sheet`). Surfaces opened from an offer page are dark and square; other sites' surfaces are untouched.
- **Tokens only.** Colours from `--os-*` (`look.css`), type from `--fh --fb --fq --fu --fk` and the scale `--fhx`, so all six font templates work. Square corners; round only avatars and radio dots. Plain CSS: no Tailwind in package files.
- **Button reset.** `:where(.osf-root) button { font: inherit; color: inherit }` (`offer.css` line 40) has zero specificity: any class that sets a button's font wins, so no extra scoping is needed.
- **Scale-up (`--ost-base`).** Each template sets `--ost-base` (its mock's width in px) on `.ost-page[data-template=<id>]`. `shell.css` zooms the whole page by `--ost-z = clamp(1, vw * 0.9 / base, 1.8)`, where `vw` is the window width floored to a step (640 to 1920). Below 640px nothing scales. Under zoom a `vh` or `dvh` length is multiplied too: divide it by `--ost-z`. Popups scale separately (`--osf-pz`, up to 1.25) and hang from a fixed top.
- **Fonts load by `<link>`, not `@import`.** `fonts.ts` holds the request; `OfferSurfaceRoot` renders it. A remote `@import` inside an imported stylesheet is dropped silently by the bundler.
- **Weights follow the packet markup**, not how a screenshot looks.
- **Every module in `templates/` is `.tsx`** (the export map maps `offer-templates/<name>` to `<name>.tsx`).

## 8. Preview, screenshot, compare

- **Gallery and sandbox:** `apps/development` at `/development/offer-templates` (Live tab: a desktop and a phone frame per template with the look switches; Catalogue tab: this documentation). One template alone: `/development/offer-templates/t/<id>?ft=para|gazette|quiet|marquee|ledger|rite&icons=things|marks|stamps|glyph&tint=off&mark=inline|thumb|box`. A layer already open: `/development/offer-templates/t/profile?surface=offer:<layer>:<key>[:<flow>]`; the key holds a colon, so typed into an address bar it is encoded twice (`thread%253Aevt`). Network admins only.
- **Type-check:** `tsc --noEmit -p .` inside `packages/cms-ui` and inside `apps/development`. On eris the wrapper is `~/scratch/ot/tsc.sh packages/cms-ui` (queued, one at a time; exit 0 and no output is clean).
- **Screenshot:** on eris, `~/scratch/ot/shot.sh <lane> <name> "<path?query>" [width] [height] [full 0|1] [click text]` writes `~/scratch/ot/shots/<lane>-<name>.png` and prints the page height, overflow and console errors. These scripts are team scratch, not in the repo. The preview (`ot-preview`, a dev copy of apps/development with a fake admin) serves `http://127.0.0.1:4531/development/...`. Compile errors: `sudo -n docker logs --tail 40 ot-preview`.
- **Compare with a mock:** the packet is in `apps/development/designs/publication-surfaces-2026-11-27/`. `Offer Surface.dc.html` is the implementation reference for every layer; `Flyer Pages Wireframes.dc.html` is the pan-and-zoom canvas (find a frame by its badge id, e.g. `2m`); `README.md` has the rules, tokens and per-layer head/body/foot. The files play at `/development/designs/publication-surfaces-2026-11-27/<file>` (admins). Put the frame and our screenshot side by side and make them the same; for exact values the packet's HTML is the authority, not pixels. Automatic per-frame crops of the canvas proved unreliable on 2026-11-27: check a crop shows the frame you expect.

## 9. What is sample-only or unbuilt today

- **Sandbox actions.** `sampleActions`: `rsvp` and `follow` always succeed, `checkout` always refuses. The live host's actions are in `apps/arts-collective/src/components/sites/offer-actions.ts` (not re-checked for this guide).
- **Talk "Post"** adds a reply to local state only; no action is wired (`layers-read.tsx`, `useComments`).
- **Series subscribe** (`ser-sub`) checks the email and goes to `done`; `SurfaceActions` has no subscribe call, so nothing is sent.
- **Member profile** replies come from the optional `data.memberReplies`, which no host supplies yet; the sample site has no member (`/offer-templates/t/people` adds one).
- **Inert controls** (drawn, do nothing; the metas' `actions` say "inert"): event "+ Add a photo", document "Download PDF", essay "All writing", note reply field and button, artwork thumbnails, series "earlier sessions" toggle, the service page's inline four-step rail (enquiry, slot radios, price slider, Add to calendar), and the Talk "Photo" button.
- **Docked writing stage** (`WritingStage`, frames 3b and 4c) exists and has a sandbox route (`t/stage`) but is not placed on any template page.
- **Decision 14 (sign up to RSVP) is built:** signed out, RSVP, Follow, Subscribe and Talk Post push the `join` layer (`layers-join.tsx`, `useJoinGate`); hosts give optional `SurfaceActions.join` and `signIn`; `GUEST_RSVP = true` there restores the guest-by-email forms. Without `join`/`signIn` the old forms and the `signInHref` link stay.
- **Template choice** (which template a site uses, and the "Current Work Page" card in the hub) is decided, not built in this folder; the hub's Look form has no template field.
- **Defects lane L saw on the real page** (not fixed here): service, series and artwork draw `description` as plain text in a `<p>`; body figures from the block editor (`eac-figtext`, wide images) overflow at 390px because no template styles the `eac-*` body classes; the essay is very tall on a phone for a long piece; the essay byline shows the org name, not the author.
- **Meta statuses.** Most metas say `draft` (built, not yet signed off against the mock); only `service` and `profile` say `matches-packet`; `artwork` and `series` are `derived` (the packet has no page for them).

## 10. Where decisions are recorded

`docs/open/OFFER_SURFACES_2026-11-27/`:

- `BOARD.md`: the team log, newest entries win; fit rules, lane notes, findings. Append only.
- `DECISIONS.md`: Justin's decisions, which override the look-aheads' open questions.
- `CONTENT_LIBRARY_LOOKAHEAD.md`, `TEMPLATE_CHOICE_LOOKAHEAD.md`, `FORUM_LOOKAHEAD.md`: read-only findings on the content library as pay path, choosing a template and entering content, and the forum; nothing in them is built or decided unless `DECISIONS.md` says so.
- `README.md`: the first handoff for a design/code agent (partly out of date; the board is newer).
- The design packet: `apps/development/designs/publication-surfaces-2026-11-27/README.md`.

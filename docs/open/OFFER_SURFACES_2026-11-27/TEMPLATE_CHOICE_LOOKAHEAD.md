# Choosing a template and entering content: look-ahead (2026-11-27)

Read-only findings by a search agent for Manjushri, condensed. Nothing was changed, built or run. "Inference" marks what was worked out rather than seen; "Proposal" marks suggestions. Verify before acting.

## Short answer

Nothing yet lets an owner choose a **template** (the layout). The hub has only a **look** form: font template, icons, phone mark, tint, and an on/off switch. The eleven templates exist only in the development gallery with sample data, and the live site always draws the profile page. Content comes from the Studio forms; they cover the core of each offer, but most template extras have no form, and the page loader ignores several fields that are already stored.

## What exists

- Hub Look page: `apps/arts-collective/src/app/hub/sites/[slug]/look/` (owners, guides, admins). Saves `site_config` key `offer:look` = `{font, icons, mark, tint, enabled}`. No preview, no template. Its only link is on the org's default page ("Choose the page look →").
- `SurfaceLook` has no template field. `apps/arts-collective` imports nothing from the templates; `OfferSitePage.tsx` always draws `OfferProfilePage`; `loadSurfaceSite` builds neither `extras` nor `pieces`.
- Turning on "Use the new page" switches the live site at once, and takes precedence over a designed Puck home. The `?look=preview` override works only in development.
- Featured offer: `getOfferingThread` (`src/lib/org.ts:287`) = the pinned thread, else the newest published PUBLIC thread not in `OFF_FEED_KINDS`. A Studio `writing` piece can never be featured (it is in that list); a `post` can. Artworks are not threads and are never loaded.
- **Possible leak, found by reading, not run:** the featured lookups do not filter `min_role`. A pinned PUBLIC thread with a `min_role` could reach a signed-out page through `loadSurfaceSite` (`offer-site.ts:272`).
- A second, separate "one featured offer" exists on ArtDirect: `users.featured_thread_id` (per person, `oad` meeting or service only).
- On ArtDirect only the page's own account gets owner tools (`isSelf`). An org's identity has no login, so nobody gets owner tools on an org's ArtDirect page today.
- ArtDirect can already deep-link into the hub signed in (`/api/auth/handoff`). The link back from the offer page is missing (`owner.directoryHref` is null).

## Fields: stored, unread, or missing

- Stored and read: title, standfirst (excerpt), description (body), poster (cover), start and end, venue name, online, capacity, price (workshop and service; the meeting form has no price), host.
- Stored but the loader does not read them: time zone, street address (workshop), sliding scale minimum (service), gallery pictures, artwork medium / size / edition (artworks are not loaded at all), booking slots, series sessions.
- Could be derived: talk count, posted date, attendee avatars from RSVPs (a privacy question), sessions, co-hosts (the meeting form saves them to the rota for the next occurrence, not to the thread).
- No form or store: running order, category, ribbon, map, reply note, guest photos, tags, artwork shipping and collect, and for writing: sections, pull quote, a second picture with caption, footnotes, version.

Real template choice exists for two kinds only: event (Playbill or Announcement) and writing (Announcement, Note, Essay, Feature, Document, Gazette). Service, artwork and series have one template each.

## Reusable pieces

- The elktours create-tour popup (`apps/elktours/src/components/office/create-tour/`): steps inside a surface frame, each step saves on leaving, works as a popup or a page, edits published items. Best fit for "offer → template → fields → preview".
- studio-forms `FormShell` in the ledger theme: the natural home for fields an offer carries; has a preview column but no page mode for these templates.
- The development gallery (`apps/development/src/offer-templates/GalleryLive.tsx`): the picker and the desktop + phone preview almost as is, if its frames pointed at an editor-only preview of the real site.
- house-editor Fields lens: typing on the page itself; live only in elktours; needs `data-field` marks in all eleven templates.
- `PinToggle` / `togglePinAction` (which offer leads); ArtDirect's `OfferingPickerField` (picks a record by content key, the same key form as `SurfaceOffer.key`).

## Proposals (not built)

**A. One "Your offer page" flow in the hub** (elktours-style frame): pick the offer → pick a template that suits its kind → fill in what that template reads ("from your offer" with Edit in Studio; "for this page" for the extras) → look → preview on desktop and phone → Publish or Save draft. Risk: a second place where offer data is edited.

**B. Inside the Studio forms**: an "On your page" section in each offer form holds the template and its extras; the form's preview gains a Page mode; the piece summary gets "Feature on <org>'s page". Risk: studio-forms is shared by about six hosts, so sections must be gated per host.

**C. On the page itself** (Fields lens): an Edit page bar for editors; offer and template pickers; type in place; dashed placeholders for empty optional fields. Risk: marks in every template, draft against live on a public page.

Storage in all three, with no migration: `site_config` `offer:look.template` and `offer:featured {key}` plus a draft key; offer extras in `threads.metadata.page`. All three need the loader to read the stored-but-unread fields, build `TemplateData`, choose the template in `OfferSitePage`, and close the `min_role` gap. All three need an editor-only preview route in production.

ArtDirect entry for any flow: a new gate (viewer is owner or guide of the org whose identity this is), then a button that hands off to the hub or the site's edit mode.

## Decisions for Justin

1. Template per site or per offer: when the featured offer changes, does the template stay or does each offer remember its own?
2. Where choosing happens: A, B, C or a mix.
3. One featured mechanism (org pin, ArtDirect's per-person field, or a new site key), and whether artworks and writing can be featured.
4. Where extras live: on the offer (follow it everywhere) or on the page.
5. Which template-only fields to collect at all.
6. Whether org owners and guides get tools on the org's ArtDirect page, or ArtDirect is only a deep link into the hub.
7. Draft and preview before publish.
8. Attendee avatars from RSVPs; the `min_role` gap.

# Offer surfaces: Justin's decisions (2026-11-27)

Taken one question at a time, in Justin's words where they matter. These override the look-ahead documents' open questions and anything older on the board.

## The page and its content

1. **One piece at a time, chosen through the content library.** A free-tier site features ONE "content / work" at a time. It is picked with the content library used as the picker (published work, files, media) and stored by its content key (`thread:<id>`, `artwork:<id>`), so artworks and writing can lead the page as well as events, services and series. The same picker later replaces the file browser in arts-collective.com/hub.
2. **The template follows the featured content.** Each piece carries its own template; changing what is featured changes the layout.
3. **A template's secondary pieces never leave the page.** They open through the surface flows (as in the packet, 4b → 3a: a service offered beside the featured event opens as a popup).
4. **Writing templates render the piece's own block document** from the Studio editor: headings become the index, a quote block becomes the pull quote, footnotes only if the editor has them. Nothing extra to fill in. Check what blocks the editor really has before building. Open question Justin raised: how the block editor sits in the form flow, and how a piece made with blocks is shared into one of these templates.
5. **Running order** is an optional field on events and meetings. **Category** is dropped for now (no good meaning for it yet).

## Choosing and editing

6. **"Your offer page" lives in the hub as a card: "Current Work Page".** It holds the template choice and the content. The hub itself is due a revamp toward the surface look, organised around this.
7. **Live at once to start.** No draft system yet. Later: saved custom looks per template per user, which brings versioning.
8. **Fields use the surface look itself**, built as a third look on site-forms so it stays one form system (not ledger, not the old block/stack).
9. **Edit on the page comes later**, through the house editor's direct edit or the live edit (font, weight, colour, fields, upload).
10. **ArtDirect is a door.** On an org's ArtDirect page its owners and guides see a button that hands off, signed in, to the hub's Current Work Page card.

## People, talk and the forum

11. **Writing pieces live on the forum like any other thread.** The ban comes off (`writing` leaves `OFF_FEED_KINDS`). Manjushri counts the existing writing pieces and their visibility and shows Justin before flipping it, because it changes every site's forum at once.
12. **Talk: anyone reads, posting needs sign-in.**
13. **Owners and guides can hide a single reply**, built before Talk goes public on free-tier sites.
14. **Sign up to RSVP.** (Changed by Justin later the same day: "just make it sign up to RSVP; we will start there and fall back if needed.") An RSVP needs an account, made through the same quick "just create it" sign-up surface as following. No guest RSVP door for now; the earlier guest-by-email plan is the fallback if sign-up proves a barrier. RSVP emails still join the org's email list in the hub.
15. **Following needs an account**, through a quick "just create it" sign-up surface (see the one on IFAC's series page, or make our own).
16. **Subscribe = follow the series**: an account, one email before each session. RSVP to a series needs an account like any RSVP (see 14).
17. **Who's coming:** everyone sees the count; a face shows only for an account with a public profile.

## Paying

18. **All of it now:** fix the four checkout bugs, put the Stripe key on arts-collective, and prove the path with one small real purchase, refunded after. Manjushri stops and tells Justin the exact item and amount before the real charge.

## To test, as Justin asked

19. Phone sheets keeping a **level height after the first popup**: build it so he can compare it with the packet's "each sheet takes the height it needs".
20. **Closing a step returns to its parent popup** (session or module), not all the way back to the series.

## Order of work

First: artworks and writing showing up properly, with the items above that they depend on. Then the template flow (the Current Work Page card).

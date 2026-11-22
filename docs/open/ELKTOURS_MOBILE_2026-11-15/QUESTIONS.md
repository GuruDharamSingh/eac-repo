# Questions for Justin

Format: `- [Jay|Gee] question. **Rec:** recommendation. **Answer:** ...`

- [Jay] Mobile web or native? The pack assumes the mobile layout of apps/elktours. **Rec:** responsive mobile layout of the existing Next app (phones get the new design; desktop keeps working, then converges). **Answer:**
- [Jay] Pay screen: keep Stripe's hosted checkout page (Apple Pay appears there) instead of an in-page card form? **Rec:** yes. **Answer:**
- [Jay] Below-minimum rule: one site-wide switch, "guide decides" by default (the alternative is auto-cancel), set in site settings via the house editor? **Rec:** yes. **Answer:**
- [Jay] Cancel + refund: does the owner tap Refund per order, or is it automatic? **Rec:** owner tap for v1 (live Stripe only, no test key). **Answer:**
- [Jay] Waitlist: does the guide offer by hand (as the design shows) or does it promote automatically (booking decision 9)? **Rec:** ship v1 without a waitlist, then decide. **Answer:**
- [Jay] Per-slot price override: v1 or drop? **Rec:** drop for v1 (price stays on the tour). **Answer:**
- [Jay] Guides (role guide): do they see the board for their own slots, or is it owners only? **Rec:** their own slots. **Answer:**
- [Jay] Add a Stripe webhook to elktours before the first real departure? **Rec:** yes. **Answer:**
- [Jay] Cutover to booking tables (2 migrations, each applied alone) once the UI runs on the adapter? **Rec:** yes, after parity tests. **Answer:**
- [Jay] Artist role: `member` + an artist link (no shared constraint change), or a real `artist` org role? **Rec:** member + link. **Answer:**
- [Jay] The `guide` role today = full editor of /manage. Keep that, or narrow it (own slots, own posts, places)? **Rec:** narrow later; keep for v1. **Answer:**
- [Jay] Blocked link previews: unfurl card + "Open in browser" (no iframe proxy)? **Rec:** yes. **Answer:**
- [Jay] Suggest: signed-in only (existing daily limit), or anyone with an email? **Rec:** signed-in only for v1. **Answer:**
- [Jay] Private topics with named people cost L (shared forum read). Ship Public + Members first and make Private author-only in v1? **Rec:** yes. **Answer:**
- [Jay] "Members only" experiences: any signed-in follower (ORGANIZATION) or real members only? **Rec:** any signed-in follower (matches "followers after sign-up = members"). **Answer:**
- [Jay] Office review: guide posts only, or comments too? **Rec:** posts only. **Answer:**
- [Jay] Artist fee on invitations is informational only for now (payouts stubbed)? **Rec:** yes. **Answer:**
- [Jay] Place tags: who seeds the first set (85 places, 0 tags today)? **Rec:** guides via the edit page; we propose a starter list. **Answer:**
- [Gee] ANSWERED by Justin 2026-11-15 (in Gee session): mobile layout below md, desktop pages kept as today. Same URLs.
- [Gee] ANSWERED by Justin 2026-11-15: house editor edits copy + look on guest pages (mobile Puck docs m-*, record templates with editable labels, Site style tokens); board/manage = tool UI, not editable.
- [Gee] Artist profile: build /people/[slug] here with link-out to ArtDirect portfolio, or link straight out? **Rec:** build here. **Answer:**
- [Gee] Studio list: group the phone docs (m-discover, m-tours ...) under one "Phone layout" heading? **Rec:** yes. **Answer:**
- [Jay] Scratch database for testing: may my agents start a throwaway Postgres container on eris (no ports exposed, removed after), load the schema plus all migrations and draft migrations, and test the booking/collaborate DB paths there? Without it, slot creation, cancel, run/reopen, the sweeper and both booking migrations are typechecked only. The permission check blocked it without your yes. **Rec:** yes. **Answer:**

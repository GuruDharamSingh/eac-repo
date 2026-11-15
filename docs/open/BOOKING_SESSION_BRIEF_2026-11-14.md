# Brief: booking module, phase 1 (2026-11-14)

For a new Claude session (Opus, high effort, sharing the checkout). The Check session prepared it; the app could not start the session over Remote Control, so the developer starts it from the desktop app and pastes or points to this file.

## Task
Build phase 1 of the booking module designed in `docs/open/BOOKING_MODULE_2026-11-14.md`. Read it first, then CLAUDE.md, `.claude/rules/00-working-style.md`, `.claude/rules/areas/db.md`, `.claude/rules/areas/threads.md` and `docs/reference/commerce.md`.

The developer accepted all nine recommended decisions on 2026-11-14 ("probably all reccommended"). Record that, dated, in the design doc:
1. First flow: one-to-one booking of a person's offering from open hours on artdirect, free and paid; elktours departures follow in phase 2.
2. Storage: a new canonical `bookings` + `booking_slots` store; the old tables are backfilled later, then dropped.
3. `thread_rsvps` stays the attendance read model.
4. Refunds: the policy is recorded and shown, a refund due is flagged, and the seller refunds by hand.
5. One-to-one booking is instant from open hours; request-a-time is a separate mode.
6. Open-hours slots are computed from rules; a slot row is created on first booking.
7. Agents are deferred; their columns are reserved only.
8. A new `@elkdonis/booking` data package, with org-checked saves in `@elkdonis/services`.
9. Waitlist promotion is automatic.

## Done for phase 1
- Migrations, through `/new-migration`. List `packages/db/migrations/` right before choosing a number. Apply them through the admin container, starting it if it is stopped.
- The `@elkdonis/booking` package and its services.
- A Booking section for the shared forms in `@elkdonis/studio-forms`. The "Studio form design versioning" session owns that package: message it before editing there.
- The artdirect booking panel and flow.
- The free path verified end to end on the live DB, with the test row deleted afterwards.
- The paid path verified up to order creation, unless the developer provides a Stripe test key.

## Constraints
- The Stripe keys in `.env` are live. Never create Stripe objects or run probe scripts against Stripe.
- Several sessions share the tree. Run `git diff` before editing a shared file. Never use git checkout, stash or restore. Do not commit.
- Before rebuilding artdirect, back up its `.next` (`docs/reference/ops.md`). Compare the build's CSS chunks with the previous build: on 2026-11-14 a broken `@import` silently dropped a stylesheet (`.claude/rules/areas/css-ui.md`).
- Render the UI before calling it done (`.claude/rules/03-verification.md`).
- Report to the "Check" session at each milestone: what landed, how it was verified, what is open. Check is watching this work for the developer.

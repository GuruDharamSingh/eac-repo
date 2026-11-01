# Series email list and per-series letters: design (2026-10-10)

Design for a series' email list (planner tab), per-series letters in the email suite,
per-series triggers and a series-addressed newsletter. Written from a read-only survey on
2026-10-10 (code read, `\d`, SELECT). Companion: `docs/open/EMAIL_RSVP_DEBRIEF_2026-10-10.md`,
`docs/open/IFAC_SERIES_PLAN_2026-10-10.md`. Labels: verified (code at the cited line or a
query), assumed.

## 1. Current state

- **Suite routes.** `/manage/email` (`apps/ifac/src/app/manage/email/page.tsx`) mounts the
  shared `EmailSurface` through `EmailSuiteHost` (tabs: activity, inbox, addresses, letters,
  look; gate `requireIfacManager`). `/hub/email` redirects there. `/hub/email/[key]` is
  `TemplateWordsEditor` plus preview; `/hub/email/[key]/edit` is the GrapesJS layout editor.
  API: `api/hub/email/[key]` PUT/DELETE, `preview/[key]`, `[key]/test`, gated by `getApiEditor`
  (owner or guide). Verified.
- **Per-thread overrides exist in the store only.** `resolveOrgTemplate`
  (`packages/email/src/template-store.ts:219-239`) prefers `<key>:<threadId>` over `<key>` when
  the sender passes `threadId`. No route, connector or UI writes a scoped key: the PUT route
  accepts only plain `TEMPLATE_KEYS` (`isTemplateKey`), and `loadEmailSuite` matches plain keys
  only (`apps/ifac/src/lib/email-suite.ts:74,107`). IFAC has no `email_template_settings` rows;
  the only scoped rows are 3 inner_group rows on archived threads. Verified.
- **Newsletter.** `site_config` key `newsletter:<slug>`, 0 rows network-wide.
  `listRecipients` reads `contacts` minus `unsubscribed` (`packages/newsletter/src/server.ts:154`);
  `withUnsubscribe` (`:233`) links to `/unsubscribe` with an org-level token; `sendNewsletter`
  (`:269`) passes no `threadId`. IFAC has no newsletter route and no `/unsubscribe`. Verified.
- **Meeting-trigger letter** renders directly and skips overrides
  (`packages/email/src/index.ts:434-438`); IFAC does not use it. Verified.

### Thread id passed by each series letter (verified)

| Letter | Sender | `threadId` | Key / purpose |
|---|---|---|---|
| Confirmation | `apps/ifac/src/lib/series-mail.ts:181` (`:195`), from `api/series/rsvp` and `api/series/coming` | week topic | `rsvp-guest` |
| Host notice | `series-mail.ts:199` (`:208`) | week topic | `rsvp-owner` (no merge fields) |
| Attendee reminders (day, soon) | `reminders.ts:154-180` (`:177`) | week topic | `reminder` / attendee |
| Subscriber letter | `reminders.ts:273-311` (`:308`) | series | `reminder` / subscriber |
| Host / co-host reminder | `reminders.ts:337-359` (`:357`) | series | `reminder` / host |
| Host assigned | `series-mail.ts:80-118` (`:115`) | series | `reminder` / host-assigned |

Four letters share `reminder`, so a per-series override needs the purpose in its key.

## 2. Rules

- **Override chain.** Senders keep `threadId` for the ledger and add `templateScope: string[]`,
  most specific first: reminders `[`${seriesId}:${purpose}`, seriesId]`, confirmation
  `[seriesId]`. Absent scope means `[threadId]` (today's behaviour; inner_group rows keep
  working). `resolveOrgTemplate` builds `candidates = scopes.map(s => key + ':' + s).concat(key)`
  and orders by `array_position`. Nanoids contain no `:`.
- **Scoped stored words win.** When the resolved row is scoped, use
  `template.bodyText ?? data.bodyText` and `{...data.copy, ...template.copy}`; org-wide rows keep
  today's precedence (caller wins, `index.ts:349,358`). Facts stay with the caller: `links`
  ("I'm coming"), `summary`, `meetingUrl`. Move week summary and join lines out of `bodyText` into
  `summary` (`reminders.ts:294-302`) so customised words do not drop them.
- **The list is a query, not a `contacts` mirror.** `contacts` is unique on
  `(org_id, lower(email))` with no thread key, and a mirror would add series people to org
  newsletters. Union: series-thread `thread_rsvps` (`subscribed`), `yes` on `series_session`
  topics of the series, `meeting_hosts` of the series; join `users`; left-join `contacts` for the
  org `unsubscribed` status. Owner/guide only.
- **Unsubscribing deletes the row today** (`meeting-series.ts:999-1003,1048-1056`). Recording it
  needs `thread_rsvps` status `unsubscribed` (migration) and UPDATE instead of DELETE;
  `listAddressBook` (`packages/email/src/address-book.ts:89-97`) must exclude it.
- **Triggers without a table.** Trigger 1 is the subscriber letter (`metadata.series.reminderDays`,
  ledger kind `subscribers`, letter `reminder:<seriesId>:subscriber`). Further triggers:
  `metadata.series.mailings: [{id, letter, audience, daysBefore, enabled}]`, ledger kind
  `m:<id>` (`kind` is varchar(24)); write the array whole (the metadata merge is shallow).
  "Send now" is a series newsletter issue, not a trigger.
- **Series newsletter.** `Newsletter.audience = {kind:'org'} | {kind:'series', threadId}`
  (`saveNewsletter` must carry it, `server.ts:101-107`); `listRecipients(orgId, audience)`;
  `withUnsubscribe` takes `unsubscribeUrl(email)`; pass `threadId` for the ledger.
- **CSV export** with `Content-Disposition: attachment`, `Cache-Control: no-store`, and cells
  beginning `= + - @` prefixed against formula injection.

## 3. UI

- Planner (cms-ui `SeriesPlannerSurface`): tabs "Weeks | People & emails" when `canPlan`:
  counts (subscribed, coming to a week, hosts, unsubscribed), table with filter, "Download CSV",
  "Edit this series' emails" → `/manage/email/series/<id>`. Reuse `AddressesTab` markup
  (`EmailSurface.tsx:560`) exported as `EmailAddressTable`; widen `EmailAddress.sources`
  (`packages/cms-ui/src/email/types.ts:44`).
- Suite: `/manage/email/series/[id]` mounts `EmailSurface` with Letters only, built from a
  `SERIES_LETTERS` list (confirmation, attendee, subscriber, host, host-assigned; host notice
  read-only). Rows show "Uses the IFAC letter" / "Customised for this series"; first save creates
  the scoped key; "Back to the IFAC letter" deletes only that key. Connectors add
  `?series=&purpose=`; the server checks the series belongs to the org. `/manage/email` Letters
  gets a "Series" list. A Triggers panel lists trigger 1 (days) and the fixed reminders.

## 4. Clean-up found

- Safe to remove: `apps/ifac/src/components/rsvp-form.tsx` (no importer) and its only caller
  target `apps/ifac/src/app/api/rsvp/route.ts` (guest route writing `contacts` `ifac_rsvp`);
  `sendNewsletterEmail` (`packages/email/src/index.ts:567`, no caller).
- Fix: "All email" link at `hub/email/[key]/page.tsx:88` → `/manage/email?tab=letters`;
  `[key]/test/route.ts:64` omits `bodyFont` and `chrome`.
- **Hazard:** `packages/email/scripts/test-layers.mts` and `test-suite.mts` write to org `ifac`
  in production (`clearOrgTemplate('ifac','welcome')` would delete a real override). Do not run
  them; retarget to a sentinel org.
- Stale: `docs/reference/email.md` says "ifac has no reminders".

## 5. Implementation steps

1. Override chain and precedence (no migration): `template-store.ts`, `index.ts`, `samples.ts`,
   IFAC `reminders.ts` / `series-mail.ts`. Verify with check-types, `check:fields`,
   `check:portability`, the chain SQL under `BEGIN … ROLLBACK`, render-only previews. Rebuild the
   email dist after reading `git diff packages/email`.
2. Series list API, `unsubscribed` status (migration), CSV: `meeting-series.ts`,
   `address-book.ts`, `apps/ifac/src/app/api/hub/series/people/route.ts`.
3. Planner tab: cms-ui `SeriesPlannerSurface.tsx`, `email/EmailSurface.tsx`, `email/types.ts`.
4. Per-series letters in the suite: `/manage/email/series/[id]`, scope parameters on the email
   API routes, `use-email-connectors.ts`, `lib/email-suite.ts`.
5. Triggers panel and `mailings`, with a `dryRun` that lists recipients without claiming.
6. Series newsletter: `packages/newsletter` audience, IFAC `/manage/newsletter`.

Render without sending: `renderSample`, `renderWithProps`, `renderTemplateBody` /
`renderTemplateEnvelope`, `packages/email/scripts/preview.mts`. `EMAIL_SANDBOX` still writes
`email_sends` (`client.ts:110,144`).

## Open questions

- Week-level overrides, and whether they sit before or after the series level.
- Newsletter audience default: subscribers only (recommended) or also week attendees.
- A `comingUrl` merge field (allows full layouts for the subscriber letter) or words-only editing.

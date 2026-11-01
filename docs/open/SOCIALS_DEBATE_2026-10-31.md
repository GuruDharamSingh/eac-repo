# EAC Socials / Center / Studio — Blue vs Red debate (2026-10-31)

> Note: migration 219_social_posts was applied after the agents ran; references to it being unapplied are stale.


---

# Arbitrator's Thesis: Socials, the Center, the Studio and Tenancy

## 1. What this is becoming

The code describes one product: **a network-hosted operating system for creative collectives**. arts-collective.com does four jobs: SSO broker, OAuth broker, multi-tenant renderer (`/sites/[slug]/*` plus the middleware's Host resolution), and the home of the Studio. Orgs are tenants on it. People keep one global identity (`users`) and choose where they show up through `org_profiles`. The pattern is hub and spoke:

- **The Center** holds who you are, where you show and what you are connected to.
- **The Studio** is where you make things, and it pushes them outward.
- **ArtDirect, market and directory** hold the canonical public copy.

This is closer to Buffer + Mighty Networks + Linktree run by a not-for-profit than to a plain CMS. The shared-package work (CenterPage, layout-as-data, `connectionsHandlers`, org-create) only makes sense as the step before **collapsing the ~11 per-org Next apps into one Host-resolved app**. My claim is that this collapse is the real direction. The per-app `/center` copies are scaffolding.

## 2. Gaps and connections that matter

- **The Center has no home on its own domain.** arts-collective.com has no `/center`. The person hub is `/hub/network`, the org console is `/hub/organization`, and the org-facing Center is copied into seven apps whose `/api/center/*` routes differ. The Connections tab therefore silently disappears on most org sites.
- **Credentials belong to people, but posting claims to be by the org.** `user_connections` has no `org_id`, yet `social_posts.org_id` posts "as the org" through one member's personal token. If that member leaves, the org loses its channel. This is the biggest tenancy flaw.
- **The policy contradicts the code.** The policy says "we never post on our own initiative." `publish-target.ts` `mode:'auto'` uploads every circle recording, and other editors can flip privacy and mode on someone else's binding.
- **Custody is weak.** The encryption key is HKDF-derived from `INTER_APP_JWT_SECRET`, which every container holds. `getConnectionAccessToken(id)` is not scoped to a user. There is no audit log. Threads and Instagram tokens are never revoked upstream. There is no deauthorize callback. Refresh is lazy, so unused tokens expire silently.
- **The publishing paths are split.** `threads.metadata.shares` and `social_posts.shares` are two share models, and YouTube is outside the Studio. Posting runs synchronously with no queue, while `video_uploads` already has queue states.
- **External blockers:** Meta App Review has not been done, and YouTube requires each user to bring their own Google Cloud client. Both block self-serve multi-tenancy. All of this work is uncommitted, and migration 219 is not applied.

## 3. Proposed connect flow, through the Center

There are two tiers, and they should stay separate.

**Tier A, Links: everyone.** These are URL-only `social_links`, collected in onboarding and shown on the profile. There is no OAuth and no liability.

**Tier B, Connections: opt-in, for publishing.**

1. The user opens **Center → You → Connections**, which is the same surface on every tenant, mounted once in the unified app. Alternatively they reach it from the "Connect a channel" step in `/learn/getting-started`. That step can be skipped.
2. A pre-consent card names each scope in plain words. For example, "Lets you post to your Page from the Studio. We cannot read your messages or friends." It links to `/data` and the Terms.
3. Consent hops to `arts-collective.com/api/connections/start` (one broker, one redirect URI), then returns to the originating tenant's Center through `handoffUrl`.
4. The callback stores the sealed tokens and lists the targets (Pages, IG, channel). The user picks defaults. An audit row is written: `connected`.
5. **Optionally, share with an org.** An org owner can request a connection, and the member grants it as a revocable **delegation** (a new `connection_grants(org_id, connection_id, role)`). The member can also hand the org a connection the org owns outright: `user_connections.org_id`, with an admin as custodian.
6. Studio publishing always goes through a **publish queue**, which is the `video_uploads` pattern extended to Meta. Each queued item needs a human "Post", or an explicitly scheduled one, and every item is audited.
7. The connection card shows health: last used, when the token expires, a reconnect prompt, and a single **Disconnect** that does an upstream revoke plus local delete for every provider.

## 4. Stance on liability and onboarding: custodian, not operator

**Our commitment:** we hold the keys you give us. We use them only for an action you started, item by item, or a schedule you set. We log every use, and you can see the log. Disconnect is total.

**Where reliance should come from:** value, not lock-in. The pitch is "write once, post everywhere, and your canonical, owned copy lives on ArtDirect." Socials become distribution and the network stays home.

**Concretely:**

- Add a network **Terms + Acceptable Use** through the existing `org_agreements` / `org_agreement_acceptances` tables, accepted with a version at signup. It should make the user the publisher of their own content.
- Bring the policy text up to date: the Center as the place to connect, Google/YouTube Limited Use, and the auto mode. Either remove auto or put it behind a per-binding, owner-only opt-in.
- Ask about socials as **links first** and present connections as a benefit later, at the moment of Studio intent. Never make a connection a gate.

## 5. Decisions for the teams to fight over

1. **Collapse to one Host-resolved multi-tenant app now.** Freeze new per-org apps and make `/sites/[slug]` plus a real `arts-collective.com/center` canonical, rather than keep patching seven `/center` copies.
2. **Org-owned connections are required before "post as org" ships.** Either delegation grants or `org_id` custody, and `social_posts.org_id` posting through a personal token should be blocked until then.
3. **Kill YouTube auto-upload and bring-your-own client.** Register one verified collective Google app (as with Meta), accept the verification cost, and remove `mode:'auto'` or make it owner-only with explicit opt-in.
4. **Make one publish queue the only outbound path.** Merge `threads.metadata.shares`, `social_posts.shares` and `video_uploads` into one queue with scheduling, retries, per-target status and audit, covering both Meta and YouTube.
5. **Fix custody before App Review.** That means a dedicated, versioned connections key (not derived from the JWT secret), user-scoped token access, upstream revoke for all providers, deauthorize webhooks, a refresh cron with expiry warnings, and an append-only audit log.
6. **Onboarding goes links first and connections at intent.** Socials enter as URL links during signup. OAuth is offered only from the Studio or as a skippable course step, never as a prerequisite, and comes with a versioned Terms acceptance. Teams should argue whether this costs too much activation compared with Buffer-style "connect during onboarding".

---

# Team Blue, Round 2: rebuttal and final report

## Checked again on eris (read-only)

- **Red is right about `social_posts`.** Every query in `packages/services/src/social-posts.ts` (lines 91, 101, 135, 142, 150) is limited to `owner_id = ${userId}`. In `post-actions.ts:65-67`, `org_id` is only a filing label, checked against `listListableOrgs`. Nobody posts through another person's token. **We concede that wording.**
- **The YouTube seam is wider than Red said.** In `publish-target.ts`, the ownership check (`getConnection(userId, …)`) runs only when `connectionId` changes. Both `privacy` (line ~103) and `mode` (~107) can be overwritten by anyone allowed to edit the thread. So another editor can set someone else's channel to **public + auto**, not just auto.
- **The code already reads Page roles.** `connections-meta.ts:113-124` already stores the Page `tasks` returned with `me/accounts`. That makes Red's "let Meta own the roles" model cheap to enforce.
- `apps/` holds 21 directories. Seven of them (art-auction, artdirect, arts-collective, danamccool, ifac, innergathering, sunjay) depend on the Puck page builder.

## Rebuttals and concessions

**On D1 (collapse now).** We concede that a one-step rewrite is wrong while 623 paths are uncommitted. But Red's alternative is our thesis under a new name. "Freeze new apps, make `/sites/[slug]` the default, ship a real `arts-collective.com/center`" is the strangler-fig pattern, which is what "collapse now" meant: decide the direction now, migrate gradually. Red also underweights the cost of waiting. The per-app `/api/center/*` sets have already drifted: ifac has avatar and profile only, and amrit, elktours and sunjay have no connections. Every week the Connections tab, "Where you show" and the journeys silently disappear for tenants. So each app with an empty Center should become a redirect to the canonical Center now, not "when it needs work anyway."

**On D2 (org-owned connections).** We concede the diagnosis. The flaw is continuity, not cross-person access. We also accept Red's main point: Meta's Page roles are the source of truth, and EAC should never hold an org credential. But "tell orgs to add two admins" leaves the org with nothing to look at. Our narrower fix is a `connection_grants(org_id, connection_id, granted_by)` table that holds **pointers only, no tokens**. It means "Maria's connection may serve Page X for org Y." It is checked against the stored `tasks` (it needs `CREATE_CONTENT`) and can be revoked by the member at any time. This gives the org a channel view ("Page X: 2 members can post, 0 if Maria leaves"), a warning when coverage drops to one person, and the base for Red's own "shared drafting with approval." Custody stays with individual people.

**On D3 (YouTube).** We concede the quota point. Default quota is 10,000 units/day, and `videos.insert` is listed at about 1,600 units, so a single collective app supports only about 6 uploads a day. Red overstates the verification cost, though. `youtube.upload` is a *sensitive* scope, not a *restricted* one. That means brand verification plus a demo video, with no paid security assessment (CASA applies only to restricted scopes). Raising the quota does need the YouTube API compliance audit, which needs the Limited Use and ToS links we lack anyway. **Synthesis:** the collective app is the default, and we file verification and a quota-raise request at the same time as Meta App Review. Bring-your-own client stays as the "advanced / high volume" path, since each BYO client gets its own quota, which is a real advantage. We adopt Red's export-to-upload idea as the zero-token fallback.

**On D4 (one queue).** We accept Red's version, an `outbound_posts` ledger with one executor per provider and `video_uploads` kept as the YouTube executor. That is a better design than a literal merge. We agree on the urgent part: fold `threads.metadata.shares` into the ledger **before migration 219 is applied**, while there is no data to migrate.

**On D5 (custody order).** Red's order is right for passing review. We add one condition: steps 5 and 6 (user-scoped token access and the versioned `CONNECTIONS_KEY`) must ship **before the first outside tenant connects**, not before review. The risk comes from the number of people connected, not from what reviewers inspect.

**On the flow.** We concede the inline connect card in the Studio. The thesis already listed the Studio as one entry point, and Red is right that it should be the main one. The Center stays the place to manage connections and check their health.

## FINAL REPORT: recommendations

1. **One canonical Center, migrated gradually.** Ship `arts-collective.com/center` (person) and `/sites/[slug]/center` (org) as the only Center implementations. Turn each per-app `/center` into a `handoffUrl` redirect, starting with the apps whose `/api/center/*` is incomplete. Freeze new per-org apps. *Strongest reason:* the copies have already drifted and broken features for tenants. Mighty Networks and Circle each serve every tenant from one codebase.

2. **Owner-only publishing, enforced in code.** Make `setPublishTarget` refuse `privacy` and `mode` changes from anyone but the connection owner. Make `auto` an explicit opt-in for each binding. Rename "post as org" to "file under org · posting to Page X via your connection." *Strongest reason:* the policy currently says "never on our own initiative," and the code contradicts it. Buffer's "we never post without your approval" is a promise it actually keeps.

3. **One `outbound_posts` ledger before 219 ships.** It records status, `scheduled_at`, retries, per-target results and the actor. Each provider has its own executor, and `video_uploads` stays as the YouTube executor. The ledger rows also act as the audit log the user can see. *Strongest reason:* it costs nothing now and needs a migration later. Hootsuite and Later both build this way: one ledger, one adapter per network.

4. **Minimal custody, ordered for review and then for scale.** The order: deauthorize callback, upstream revoke for Threads and Instagram, policy text made true (Center, Google Limited Use, YouTube ToS links), audit, `(userId, id)`-scoped token access, then the versioned `CONNECTIONS_KEY`. Add a refresh cron and an email warning before a token expires. *Strongest reason:* this covers what Meta and Google reviewers check, and it limits the damage if any one container is compromised.

5. **Org channels as delegation pointers, never org tokens.** `connection_grants` links an org to members' own connections, checked against Meta Page `tasks`. It warns the org when only one person can still post. *Strongest reason:* org continuity is visible without EAC becoming custodian of org credentials. This mirrors Meta Business Suite's own role model.

6. **Onboarding: links at signup, connections at intent, versioned Terms.** At signup, collect URL `social_links` and record acceptance of the Terms and Acceptable Use through `org_agreements` and `org_agreement_acceptances`. Those Terms make the member the publisher. The first time someone uses "Post to…" in the Studio, show an inline pre-consent card that explains each scope in plain words, then return them to their draft. Show a "verified" badge where a link matches a connection's `account_url`. Offer a skippable connect step in `/learn/getting-started`. *Strongest reason:* EAC's product is the network, not scheduling, so the Mighty Networks/Linktree pattern fits. People come to rely on the platform because the canonical, owned copy lives on ArtDirect (as with Substack and Ghost), not because EAC holds their keys.

---

# Team Red, Round 2: rebuttal and final report

I re-checked three things on eris, read-only. There are still 623 uncommitted paths, and the last commit is still `edcca1e` from 2026-10-04. `post-actions.ts` posts only through the acting user's own connections, and every action is scoped to the owner. `connections.ts:99-103` uses `youtube.readonly` only to read the channel name back through `channels.list?mine=true`.

## Where Blue is right (conceded)

- **`setPublishTarget` lines 107-111.** Only the connection owner should be able to change `privacy` or `mode`. This should ship first.
- **A separate `CONNECTIONS_KEY` with a versioned seal, a `connection_events` log, a deauthorize callback, and upstream revoke for Threads and Instagram.** All of these are cheap and are exactly what a Meta reviewer asks about.
- **The YouTube scopes are sensitive, not restricted.** That means no security assessment of the kind restricted scopes require, and `youtube.readonly` is justified.
- **Links first, with the connect offer appearing at the first Studio publish.** Agreed.

## Where Blue is wrong

**1. "Post as org" is a labelling problem, not a token-sharing problem.** As written, a member who is an admin of the org's Page posts with their own token. Meta allows this, because Page tasks belong to people. Blue's `connection_grants` would let member B post through member A's token when A did nothing. That is the "acting on our own initiative" problem Blue wants to prevent, now pointed at a member instead of the platform.

The safer model is the one Meta itself uses: the **Page is the org's asset, and tokens stay personal**. Add `org_channels(org_id, provider, external_id)`. A post "as org" resolves to *any current org member who has a live connection holding that Page*, and that member must be the person clicking Post. When one admin leaves, another admin connects and the channel survives. No token ever changes hands.

Hootsuite and Sprout Social work this way too: the profile is shared, but someone with access re-authenticates it. Blue's one-line guard should therefore be: "refuse `org_id != oad` unless the clicking user's own connection holds a Page in `org_channels` for that org."

**2. One collective Google app does not unblock YouTube on its own.** Two things still stand in the way:
- **Quota is shared.** The default is 10,000 units a day per project, and `videos.insert` costs about 1,600 units. That is roughly six uploads a day for the *whole network*.
- **Uploads stay private until audit.** The private-until-audit lock (`youtube-uploader.ts:14`) applies to the collective's own project as well.

So the real cost is OAuth verification **plus** the YouTube API Services compliance audit **plus** a quota extension. Blue's plan understates this. Ask for verification, but keep bring-your-own client as a hidden expert path until the audit passes, and put YouTube behind the Meta work.

**3. Auto-upload has a consent gap neither side named.** Circle recordings capture *other participants*, and `mode:'auto'` puts their faces and voices onto one member's personal channel. A 90-day expiry for the owner does not fix that. Any YouTube target on a group recording needs per-session participant notice, consent to recording and publishing, and **review mode as the only mode**.

**4. Collapsing to one Host-resolved app "now" is overbuilt while 623 paths are uncommitted.** There is also no wildcard certificate or wildcard proxy host yet (ops.md:194), and another session is actively changing the Studio. Two steps should come first:
- Commit the work and apply migration 219.
- Ship a `centerRoutes()` factory, the same pattern as `connectionsHandlers`, and mount the identical `/api/center/*` set in every app. That removes the drift between apps in about a day.

Collapse the apps later, once subdomains are self-serve. Blue's "freeze new per-org apps" is fine to do now.

**5. One `publish_jobs` table "with both share models as views" doesn't fit the data.** `threads.metadata.shares` is jsonb inside threads and cannot become a view. Resumable video uploads also have very different payloads and failure modes from a Graph API post. Instead:
- Add `publish_jobs` for Meta posts and piece shares, with `scheduled_at`, per-target status and `external_id`.
- Leave `video_uploads` as it is.
- Build **one union read model** that feeds the user's activity log.

## FINAL REPORT: recommendations

1. **Commit the work and make the integration safe before adding features.** Commit the uncommitted Meta and Studio work, apply migration 219, add the owner-only `setPublishTarget` guard, the separate connections key and `connection_events`. *Justification:* every other decision rests on code that exists only in one working tree. Meta reviewers check how tokens are stored and logged before they look at the UX.

2. **The org owns the asset; tokens stay with people.** Use `org_channels`, and post as an org only through the clicking member's own live token. Never delegate tokens between members. *Justification:* this matches Meta's Page-task model and Hootsuite's practice. It survives staff leaving, and it keeps the promise "we act only on your click" literally true.

3. **One Center route set now, one app later.** Use a `centerRoutes()` factory in every app, add `arts-collective.com/center` as the person's hub, and stop creating new per-org apps. Collapse the apps after the wildcard certificate and self-serve subdomains exist. *Justification:* it removes the missing-Connections-tab bug today without rewriting 11 apps in the middle of the Studio work. Mighty Networks reached a single codebase incrementally, not in one big migration.

4. **YouTube goes in review mode only, with participant consent, behind the audit.** Remove `mode:'auto'` for group recordings. Require a recording and publishing notice in each circle. Apply for verification, the compliance audit and a quota extension. Until those pass, keep bring-your-own client as an advanced option. *Justification:* shared quota and the private-until-audit lock make "one app" non-viable at launch, and auto-publishing third parties is the largest liability in the codebase.

5. **A Meta publish queue with one activity log.** Use `publish_jobs` for posts and shares, with scheduling, retries and `external_id`. Keep `video_uploads`. Every item records "requested by, at, for which org", and the user can see it on their connection card. *Justification:* Buffer and Later win trust with "nothing posts without your approval or your schedule, and here's the log". It is also the evidence that backs up the `/data` policy.

6. **Onboarding: links on the profile, connections at the moment of intent, terms that tell the truth.**
   - At signup, record acceptance of a versioned Terms and Acceptable Use in `org_agreements`, which makes the member the publisher of their content.
   - Offer social URLs as optional profile fields, not a signup step.
   - Make the OAuth offer only at "post this to Instagram too?".
   - Add an Org Owner addendum covering members' data, and the right to suspend a member's posting.
   - Fix `/data`: add Google Limited Use, links to the YouTube Terms and the Google Privacy Policy, the Center as the place to connect, and deletion pages on every host that shows a Connections tab.

   *Justification:* Meta's Platform Terms make the *app developer* answerable for its users. Terms alone cannot pass that liability to members, so the collective also needs enforcement powers. People should rely on the platform because ArtDirect holds the canonical copy and the activity log, not because their accounts are locked in.

---

# Team Blue, Round 1: defending and strengthening the thesis

I checked these claims read-only on eris:
- `publish-target.ts:8` defines `mode 'auto' — upload as soon as a recording is filed`. Lines 107-111 let any caller who can edit the thread change `mode` and overwrite `setBy`. Ownership is checked only when `connectionId` changes (line 94).
- The connections key is `hkdfSync('sha256', INTER_APP_JWT_SECRET, 'eac-connections', 'user_connections v1')`, at `connections.ts:142`.
- `getConnectionAccessToken(id)` at `connections.ts:656` takes no user.
- `video_uploads` (migration 193) already has an `awaiting` → `queued` lifecycle and a queue index.
- `social_posts.org_id` (migration 219) is `NOT NULL REFERENCES organizations`.
- No `connection_grants` table exists, and no `scheduled_at` column on any publishing table.

## Decision 1: one app that picks the org from the Host header. DEFEND, but phase it
The Host-based routing already exists: `middleware.ts` resolves the org from the subdomain or a custom domain, and `/sites/[slug]/center` already serves orgs that have no app of their own. Seven copies of `/center` with different `/api/center/*` routes are why the Connections tab is missing on most org sites. Every new shared package works around that.

Plan:
- Stop creating new per-org apps today. CLAUDE.md should stop naming amrit-canada as the template for new org sites.
- Ship `arts-collective.com/center` as the person's own Center, replacing `/hub/network`.
- Make `/sites/[slug]/center` the org Center, with one shared set of `/api/center/*` routes.
- Move apps over one at a time. Start with the thinnest (sunjay, elktours), then ifac and innergathering.

This is how Mighty Networks, Circle and Substack work: one codebase, with each tenant as data (layout, theme, custom domain). `site_themes`, `resolveCenterLayout` and `org_domains` already store tenant data this way.

**Concession:** the bespoke apps (art-auction, elastrocal, sophia) stay separate. They are products, not tenants.

## Decision 2: org-owned connections before "post as org". DEFEND strongly
Today a post can be filed under an org while it goes out through one member's personal token. That breaks Meta's model too: a Page is an asset of a Business, not of a person.

Proposal:
- Add `connection_grants(org_id, connection_id, granted_by, role, revoked_at)` so a member can delegate a connection to an org and take it back.
- Later, add `user_connections.org_id` with a named custodian, for org-owned channels.
- Until then, `publishSocialPost` refuses `org_id != 'oad'` (oad is "Just me") unless an active grant exists. That is a one-line guard in `post-actions.ts`.

Real-world precedent: Hootsuite and Sprout Social both separate who owns a social profile from who may post to it, and both survive staff leaving.

## Decision 3: one verified Google app, and remove auto-upload. DEFEND
Asking each user to bring their own Google Cloud client fails non-technical members. Unaudited Google projects also upload as private only.

- Register one collective Google app and accept the cost of its verification and audit, the same way we register the Meta apps.
- Scopes stay `youtube.upload` and `youtube.readonly`. `youtube.upload` is a sensitive scope, not restricted, so this is manageable.
- `mode:'auto'` becomes owner-only and expires: "auto-upload this circle's recordings for 90 days", which only the connection owner can set.
- Fix lines 107-111 now: reject changes to `privacy` or `mode` when `userId` is not the connection's owner.

## Decision 4: one publishing queue. DEFEND
`video_uploads` is the template to extend. Generalise it to `publish_jobs`:
- Columns: target, provider, payload_ref, scheduled_at, status (awaiting / queued / sent / failed), attempts, external_id, requested_by, org_id.
- Both `threads.metadata.shares` and `social_posts.shares` become views over this table.
- The `video-worker` container already polls once a minute, so it drains the queue.

Buffer, Later and Postiz all keep a single queue with a status per target. It is also the only place a retry, a schedule, or an audit entry can sit.

## Decision 5: fix how tokens are held before Meta App Review. DEFEND, ordered by cost
1. A separate `CONNECTIONS_KEY`, passed only to arts-collective and video-worker. Seal format `v2` with a key id, plus lazy re-encryption of `v1` rows.
2. `getConnectionAccessToken(userId | grant, id)`.
3. An append-only `connection_events` table: connected, used, refreshed, revoked, granted.
4. A Meta deauthorize callback, reusing `signed-request.ts`.
5. Upstream revoke for threads and instagram.
6. A daily refresh cron that warns at 7 days to expiry.

Meta reviewers do ask how tokens are stored and used. Items 1-3 are about two days of work.

## Decision 6: links first, connections when there is a reason. DEFEND, with one adjustment
Making a connection required at signup costs trust and gains little: most members of a collective will never cross-post.

Adjustment: Buffer-style activation still works if the connect offer appears when the member first presses Publish in the Studio. At that moment it reads "post this to your Instagram too?". The course step "Connect a channel" stays visible but skippable, and is ticked off from `user_connections.status`.

## User flow
1. **Signup:** accept versioned Terms and Acceptable Use (new rows in the existing `org_agreements` tables), then a social links step (URLs only).
2. **Center → You:** profile, where you show, and links.
3. **First Studio publish:** the work goes to ArtDirect as the canonical copy, then a prompt offers to share it to your channels.
4. **Consent screen in plain words:** "post only what you send from the Studio; we never read messages, friends or followers". Then OAuth through the arts-collective.com broker, and back to the Center the user started from.
5. **Connection card:** health, expiry, a link to the activity log, and one Disconnect.
6. **Org admin:** "Request a channel" goes to the member, who grants it, and it appears as an org target in the Studio.

## Liability and onboarding stance: we hold the keys, we don't act
- The Terms make the member the publisher of their own posts and position the collective as a tool, like Buffer's terms. Add a "Platform Terms" agreement for org owners, covering data held about their members.
- Promise "We act only on your click or your schedule" and prove it with the `connection_events` log.
- Update `/data` to cover Google Limited Use, YouTube ToS and Google Privacy links, and the Center as the place to connect.
- Members come to rely on the platform because it is the canonical home: ArtDirect copy, archive, analytics later. Socials are where work gets distributed, not where it lives.

## Next steps, in order
1. Guard `setPublishTarget`.
2. Block posting as an org without a grant.
3. Separate the key and add the events log.
4. Apply 219 and commit the work so far.
5. Create `publish_jobs`.
6. Ship arts-collective.com/center.
7. Do the Google app verification and Meta App Review in parallel.

---

# TEAM RED, Round 1: attacking the arbitrator's thesis

I checked four things in the code on eris, read-only. Two of them undercut the thesis's main tenancy claim.

**Verified in code:**
- **`social_posts` is scoped to its owner.** Every read and write in `packages/services/src/social-posts.ts` has `WHERE owner_id = ${userId}` (lines 91, 101, 135, 142, 150). `org_id` only files the post under an org. `listListableOrgs` (thread-listing.ts:32, 68) lets any member, guide or owner pick an org. No one can post through someone else's token. The "post as org" step is a member posting to a Facebook Page they already administer, with the post filed under an org.
- **The thesis is right about one cross-person seam, and it is YouTube, not Meta.** In `publish-target.ts`, lines 107-111 set `mode` without checking ownership. Any thread editor, such as a guide or an owner, can switch someone else's channel binding to `auto`.
- **`getConnectionAccessToken(id)`** (connections.ts:656) has no user scope. Confirmed.
- **The encryption key** comes from HKDF over `INTER_APP_JWT_SECRET` (connections.ts:140-142). Confirmed.

## Position on each decision

**1. Collapse to one Host-resolved app now: REJECT the "now".** The `apps/` folder holds 21 directories. Each tenant app has its own theme, Puck page builder or "studio" meaning, and its own deploy. A big-bang collapse while 623 paths are uncommitted, and the last commit was on 2026-10-04, is the riskiest move on the table. Mighty Networks and Circle were built multi-tenant from day one. Few platforms migrate a pile of separate apps into one, and the ones that do usually take years. Do this instead:
- Freeze *new* per-org apps, which the thesis already proposes.
- Make `/sites/[slug]` the default for new orgs.
- Ship a real `arts-collective.com/center` that the existing apps link to through `handoffUrl`, instead of each mounting their own copy.

One canonical Center plus links out from the existing apps gets most of the benefit without a rewrite. Collapse apps one at a time, when each needs real work anyway.

**2. Org-owned connections before "post as org": WRONG diagnosis, overbuilt fix.** Meta already owns this problem. A Page is an org asset on Meta's side, with roles managed in Meta Business Suite. A Page token is valid only while its user holds a role on that Page. Adding `connection_grants` or `user_connections.org_id` rebuilds Meta's role system inside EAC and makes EAC the *custodian of org credentials*. That is a larger liability and a larger App Review surface. Do this instead:
- Rename "post as org" to "file under org".
- Show "Posting to *Page X* via your connection".
- Tell orgs to add two Page admins on Meta, each of whom connects.
- Delegation only becomes worth doing once there is shared drafting with an approval step. That is a Studio workflow feature, not a custody feature.

**3. Kill YouTube auto-upload and bring-your-own client: half right.**
- **Auto: agree.** Make it owner-only now. The line 107 bug is real, and the "never on our own initiative" promise is false while it exists.
- **One collective Google app: the thesis misses the costs.** `youtube.upload` is a *sensitive* scope, so the app needs Google OAuth verification. Default YouTube Data API quota is 10,000 units a day, and one `videos.insert` costs about 1,600. One shared app therefore means **about 6 uploads a day for the whole network** until a YouTube API compliance audit passes. That audit also checks the Limited Use disclosure and the ToS links, which are currently missing.

Do this instead: keep bring-your-own as an "advanced" path, and start verification and the audit in parallel. Also offer an export-to-upload alternative: render, then hand the user a file plus metadata. That needs no YouTube token at all, and it is what many creator tools do.

**4. One publish queue for everything: AGREE on the direction, REJECT the merge-everything scope.** The two share models are a real duplication. But `video_uploads` is a resumable-upload worker with its own failure modes, and Meta posts are single HTTP calls. Do this instead: one `outbound_posts` ledger covering status, scheduling, audit and targets, with an executor per provider. Keep `video_uploads` as the YouTube executor. Merge `threads.metadata.shares` into the ledger now, before migration 219 ships, while there is still no data.

**5. Fix custody before App Review: AGREE, with a different order.** Meta reviewers look at the screencast, the data policy, the deletion callback and the deauthorize callback. They do not inspect key derivation. The order that matters:
1. Add the deauthorize callback.
2. Revoke upstream for Threads and Instagram.
3. Make the policy text true.
4. Add the audit log.
5. Scope token access to a user. Rename `getConnectionAccessToken` so it takes `(userId, id)`, or add an explicit system-actor variant.
6. Use a dedicated `CONNECTIONS_KEY` with a key-version prefix. The code already writes `v1.`, so a versioned key is cheap. A KMS is overbuilt for this scale.

**6. Links first, connections at intent: AGREE.** Buffer asks for a connection during onboarding because connecting *is* its product. EAC's product is the network, so the Mighty Networks and Circle pattern of URL fields fits. One risk: if the `social_links` URLs are never reconciled with verified connections, the profile can show a handle the person does not control. Add a "verified" badge where a URL matches a connection's `account_url`.

## Best practices and real-world examples
- **Buffer and Hootsuite:** they explain permissions before consent, and say "we never post without your approval". They also email a warning before a token expires, which EAC lacks.
- **Later and Planoly:** Instagram posts go through Meta's official API. Carousel support arrived only after Meta added it, and EAC's single-JPEG Instagram limit is normal for now.
- **Linktree:** links by default, with OAuth only for optional embeds.
- **Substack and Ghost:** the canonical copy lives on the platform, and social posts are teasers that link back. This matches the ArtDirect canonical URL in `share-actions.ts`.

## User flow (simpler than the thesis)
Signup collects links and accepts the versioned Terms. In the Studio, the first time someone chooses "Post to…", they see an inline connect card. Consent runs on the broker, and they return straight to their draft. The thesis instead sends them to Center → You → Connections first. Dropping that detour keeps intent intact. The Center's Connections tab stays as the place to manage and check connection health, not the entry point.

## Liability and onboarding stance
"Custodian, not operator" is right, but **as small a custodian as possible**:
- Hold only user tokens, never org credentials.
- Write Terms that make the member the publisher.
- Cover every use with an audit row the user can see.
- Never auto-post.

Platform reliance should come from the canonical copy and the network, not from holding the keys. The less EAC holds, the less there is to defend in Meta and Google reviews and in a breach.

# Meta App Review: what to submit and how to record it (2026-11-01, revised 2026-11-12)

Covers the three Meta apps the collective runs (Facebook app 829861816853346
"ElkdonisArts", the Threads app, the Instagram Login app, Instagram app id
2043048082998048) and what App Review needs before people outside the app's
roles can connect. Status 2026-11-12: not submitted. The review form lists
about 21 permissions and features; this document sorts them into "submit
now", "second round" and "do not request", gives a description for each one
submitted, and a shot list for each screencast.

## Current state (2026-11-12)

- App status: `dev_mode`, `is_live: false` (read through the Meta developer
  connector 2026-11-08). Only accounts with an app role can connect.
- Basic settings on 2026-11-08: privacy policy set; Terms of Service,
  data deletion URL and support URL empty; contact email
  `info@elkdonis-arts.org` unverified.
- Facebook Login redirect URIs include
  `https://arts-collective.com/api/connections/callback` (verified through
  the connector 2026-11-08). The Instagram Login redirect list was added by
  the developer 2026-11-08; the next attempt then failed with "Insufficient
  developer role" (the Instagram account had no tester role).
- Scopes the code requests:
  - Facebook: `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`,
    `instagram_basic`, `instagram_content_publish`, `business_management`,
    `pages_manage_metadata` (`packages/services/src/connections-meta.ts:21`).
  - Threads: `threads_basic`, `threads_content_publish` (same file, line 33).
  - Instagram Login: `instagram_business_basic`,
    `instagram_business_content_publish` (same file, line 247).
- Comments: Facebook Page comments (webhook `page`/`feed`) and Instagram
  comments (webhook `instagram`/`comments`) are stored in
  `thread_external_comments` and shown under the piece on ArtDirect
  (`packages/services/src/external-comments.ts:111`). Read only: the network
  cannot reply to, hide or delete a comment.
- Go live (Studio Video) sends to Facebook Live with a stream key the person
  pastes in. It does not call the Live Video API.
- Analytics are first-party (`packages/analytics`). No code reads Meta
  insights, oEmbed, hashtags, ads, WhatsApp or Messenger.

## Which items to submit

Meta approves a permission only when the screencast shows it in use, and a
request for something the product does not do is the most common rejection
reason. Each item below is placed by what the code does today.

### Round 1: submit now (built, can be recorded)

| Permission | App | Screencast |
|---|---|---|
| `pages_show_list` | Facebook | A |
| `pages_read_engagement` | Facebook | A |
| `pages_manage_posts` | Facebook | A |
| `instagram_basic` | Facebook | A |
| `instagram_content_publish` | Facebook | A |
| `business_management` | Facebook | A |
| `instagram_business_basic` | Instagram Login | B |
| `instagram_business_content_publish` | Instagram Login | B |
| `threads_basic`, `threads_content_publish` | Threads | C |

### Round 2: after a reply feature is built

Built today as read-only mirroring. Meta's instructions for the comment
permissions ask for a screencast in which the account replies to a comment
within 30 seconds, which the product cannot do yet.

| Permission | What it would cover |
|---|---|
| `pages_manage_metadata` | Subscribe the Page to the webhook so its comments reach the network |
| `pages_read_user_content` | Read comments left by other people on the Page's posts (assumed needed for the feed webhook's comment text; unverified) |
| `instagram_manage_comments` | Instagram comments on a Page-linked account: read, reply |
| `instagram_business_manage_comments` | Same, for Instagram Login accounts |

Until round 2 is approved, remove `pages_manage_metadata` from
`META_SCOPES` and from the Facebook Login configuration before switching the
app to Live, so the login dialog does not ask for a scope that has not been
granted.

### Do not request (nothing in the product uses them)

| Item | Reason |
|---|---|
| `whatsapp_business_messaging` | No WhatsApp messaging |
| `ads_management`, Marketing API Access Tier | No ads; the tier also needs 500 calls |
| Human Agent | No Messenger conversations |
| Page Mentions | Not used; also asks for a reviewer username and password |
| Instagram Public Content Access | No hashtag search |
| `publish_video`, Live Video API | Go live uses a pasted stream key, which needs neither |
| `read_insights`, `instagram_business_manage_insights` | No Meta insights shown; candidates for a later Channel analytics round |
| Meta oEmbed Read, Threads oEmbed Read | No embeds of Facebook, Instagram or Threads posts |

Removing an item: uncheck it in the submission, or remove it from App Review →
Permissions and Features. "Completed" test calls (`ads_management`) do not
oblige a request.

## Filling in the form

Each permission page in App Review has the same four parts. What each one
asks for, and what to put there:

| Part of the page | What Meta is asking | What to put there |
|---|---|---|
| "Tell us why you're requesting …" | Who uses it, on which screen and button, what data is read or written, and why the feature fails without it. The reviewer compares this text with the video. | Shared paragraph + the permission's paragraph below. Add the screencast timestamp: "In the screencast at 1:10, …". Describe only what the video shows. |
| Screen recording | A video of a real person using that permission in the app, including the Meta login and consent dialog. | The screencast for that app (A, B or C). One video can go on several permissions. |
| "0 of 1 API call(s) required" | Proof the app has made a successful call with this permission recently. Counts after up to 24 h. | Make the calls by using the feature once: connect or Test (basic and list permissions), publish from New post (publish permissions). "Completed" needs nothing. |
| "If approved, I agree …" | Agreement to the allowed-usage text above it. | Tick. |

The form text also mentions using data for "analytics insights … marketing
or advertising purposes". That is Meta's allowed-usage boilerplate. Do not
claim it as a use: the network does neither with Meta data, and a claim
without a matching screen in the video is a common rejection reason.

### Per item

| # | Item | Answer |
|---|---|---|
| 2, 6 | `pages_manage_metadata` | Round 2. If submitted now: its paragraph below, and the video must show a comment on Facebook arriving under the piece on ArtDirect. |
| 3 | `instagram_business_content_publish` | Round 1. Screencast B. Test call: one publish through Instagram Login (needs the tester role first). |
| 4 | `instagram_business_manage_insights` | Do not request: remove from the submission. |
| 5 | `instagram_business_manage_comments` | Round 2. Its 30-second reply screencast needs the reply feature. The reviewer also needs the link to a post and a keyword to comment with; no keyword automation exists. |
| 7 | `pages_read_user_content` | Round 2, with `pages_manage_metadata`. |
| 8 | `read_insights` | Do not request. |
| 9 | `pages_manage_posts` | Round 1. Screencast A step 6. Test call already completed. |
| 10 | `whatsapp_business_messaging` | Do not request. |
| 11 | `pages_show_list` | Round 1. Screencast A steps 3-4. |
| 12 | `publish_video` | Do not request. |
| 13 | `instagram_manage_comments` | Round 2. |
| 14 | `ads_management` | Do not request (the completed test call does not oblige a request). |
| 15 | `instagram_basic` | Round 1. Screencast A step 4. Test call already completed. |
| 16 | Human Agent | Do not request. |
| 17 | Page Mentions | Do not request. It also asks for a username and password to a Page tool, which should not be handed out. |
| 18 | Meta oEmbed Read, Marketing API Access Tier | Do not request either. |
| 19 | Live Video API | Do not request. |
| 20 | Threads oEmbed Read | Do not request. |
| 21 | Instagram Public Content Access | Do not request. |

Not in the pasted list but used by the code, and so part of round 1:
`pages_read_engagement`, `instagram_content_publish`, `business_management`
(screencast A). If the form does not list them, they are at standard access
and need no review yet.

### Other sections of the submission

- **App settings → Basic.** App icon (1024×1024), privacy policy
  `https://arts-collective.com/data`, Terms `https://arts-collective.com/terms`,
  user data deletion as "Data deletion callback URL"
  `https://arts-collective.com/api/meta/data-deletion`, category, app domain
  `arts-collective.com`, verified contact email.
- **Data handling questions.**
  - Data processors: none. Meta data is stored on the collective's own server
    and not sent to another company. Confirm before answering.
  - Responsible entity: Elkdonis Arts Collective, with its country and address
    (developer to supply).
  - Government data requests in the past 12 months: developer to answer.
  - Policies for such requests: a short statement that requests are reviewed
    for legality and challenged or narrowed where possible.
- **Reviewer instructions ("App verification").** Where to sign in
  (`https://arts-collective.com/login`), a reviewer test account on the
  network (made for the review, not a person's own), and the click path:
  Channel → Outlets → Connect Facebook & Instagram → New post → Publish. Say
  that the reviewer connects their own Facebook test user and a Page it
  administers. Never give Facebook or Instagram credentials: Meta's form
  forbids it.
- **Business verification.** In Business settings → Security Centre, for the
  portfolio that owns the app.

### Wording

- Describe the collective as a not-for-profit network whose members publish
  to their own accounts. "Marketing and branding company" reads to a reviewer
  as an agency posting for clients, a different review track (Tech Provider,
  advanced access, more verification).
- Name the screen and the button; avoid growth language ("expand
  exponentially") and claims the video cannot show.
- The mission (artists in precarious circumstances, one place for their
  outlets, legitimacy from the collective's name) belongs in the shared
  paragraph once. It explains why the feature exists, but it is not the
  answer to "how does your app use this permission".

## Descriptions for the form

Draft text for each "Please provide a detailed description" box. Each states
what the person does, which screen, which API call, and what happens without
the permission. Paste the shared paragraph first, then the permission's own
paragraph.

**Shared paragraph.** Elkdonis Arts Collective is a not-for-profit that runs
arts-collective.com, a self-hosted network for artists and arts groups,
many of them working with few resources. Members keep a page in the network's
artist directory and make work in the network's Studio. The network's Channel
lets a member publish one post to the places their audience already is
(their Facebook Page, their Instagram professional account, their Threads
profile) from one screen, so that an artist without a marketing team can
keep their own name and voice across platforms. A member connects an account
on Channel → Outlets; the connection can be removed there at any time, which
deletes the stored token and asks Meta to withdraw access. Nothing is
published without the member pressing Publish and confirming a step that
lists each account and the exact text it will receive.

- **`pages_show_list`.** After a member connects Facebook, the Outlets page
  lists the Pages they manage, and the New post screen lists the same Pages
  as destinations. The member chooses which Page a post goes to. Without it
  the app cannot show which Pages the person may publish to.
- **`pages_read_engagement`.** Reads the name of each Page and the Instagram
  professional account linked to it, so Outlets and New post can
  show "Page name · Instagram @handle". No engagement metrics are read or
  stored.
- **`pages_manage_posts`.** When the member presses Post on a Page destination
  on the New post screen and confirms, the app creates the post (text, link or up to ten pictures)
  on that Page through `/{page-id}/feed` or `/{page-id}/photos` and shows the
  link to the published post. Posts are created only on that press; the app
  does not edit or delete posts it did not create.
- **`instagram_basic`.** Reads the id and username of the Instagram
  professional account linked to the member's Page, to show it on Outlets
  and to address the publish call.
- **`instagram_content_publish`.** When the member presses Post on the
  Instagram destination, the app creates a media container from the post's
  picture and caption and publishes it, then shows the link to the post.
- **`business_management`.** Many arts groups hold their Page through a Meta
  business portfolio, so the Page does not appear in `/me/accounts`. The app
  uses this permission only to list the Pages assigned to the person through
  a business they belong to, so those Pages can be chosen as destinations. It
  does not create or change businesses, assets or people.
- **`instagram_business_basic`** (Instagram Login). For members whose Instagram
  professional account has no Facebook Page. Reads the account's id and
  username to show it on Outlets and to address the publish call.
- **`instagram_business_content_publish`** (Instagram Login). Same flow as
  `instagram_content_publish`, for accounts connected with Instagram Login.
- **`threads_basic`, `threads_content_publish`** (Threads app). Reads the
  member's Threads id and username; publishes a text or picture post to their
  Threads profile when they publish from New post.

Round 2 drafts, to adjust once replies exist:

- **`pages_manage_metadata`.** After the first post to a Page, the app
  subscribes that Page to the app's webhook (field `feed`) so comments on
  posts published from the network arrive at
  `https://arts-collective.com/api/meta/webhook`. The comments are shown under
  the same piece on the member's directory page, so the conversation about
  their work is in one place.
- **`instagram_business_manage_comments`** / **`instagram_manage_comments`.**
  Comments on Instagram posts published from the network are shown under the
  piece on the member's directory page; the member replies from there and the
  reply is posted to the comment on Instagram.

## Screencasts

Meta accepts the same video for several permissions; upload screencast A to
each Round 1 Facebook permission, and so on. Record at 1280×720 or larger in a
desktop browser, English captions or narration, no cuts inside the OAuth
dialog. Start each recording signed out of Facebook/Instagram in that browser
so the full login and consent dialog appears. Do not show credentials, the
`.env`, or other members' data.

### A. Facebook app: connect, post to a Page, post to Instagram (about 4 min)

Paths checked in Chrome 2026-11-12 (signed in as the developer): the
connect panel is on `/channel/outlets` (right column, "Connect"); `/center`
returns 404 on arts-collective.com. Posting is `/channel/new`.

1. arts-collective.com signed out. Caption: "Elkdonis Arts Collective: one
   place for artists to publish to their own Page and Instagram."
2. Sign in as the test member. Open Channel → Outlets.
3. In the right column under Connect, press "Connect Facebook & Instagram"
   (or Reconnect on an existing row). Show Facebook login, the Pages step
   with the Page ticked, the Instagram step with the account ticked, the
   permission list, Continue. Caption the permission names as they appear.
4. Back on Outlets: the "Facebook & Instagram" card with the Page and
   "Instagram @…", "Channel for", Test → "The connection works.", Recent
   activity. Caption: `pages_show_list`, `pages_read_engagement`,
   `instagram_basic`, `business_management`.
5. Channel → New post: title, text, one JPEG picture. Show the Instagram
   (@handle, "25 of 25 left today") and Facebook (Page name) outlets, both On;
   open "Edit for Facebook" and "Edit for Instagram" to show the previews.
6. Press "Publish to N places"; show the confirm step listing each account
   and its text; confirm. Show the result links; open the Page post. Caption
   `pages_manage_posts`.
7. Open the Instagram post from its link. Caption `instagram_content_publish`.
8. Outlets → Remove on the card. Show the card gone and Recent activity
   `removed`. Caption: "Token deleted; Meta asked to withdraw access."
   (Removing the live connection means reconnecting afterwards.)

### B. Instagram Login app (about 3 min)

Steps 1-2 as A; "Connect Instagram (no Page)"; Instagram login and consent;
Outlets card with @handle; New post with a picture; Publish and confirm;
open the post; Remove.

### C. Threads app (about 3 min)

Steps 1-2 as A; "Connect Threads"; Threads consent; a text post and a
picture post, each opened on Threads; Remove.

### D. Round 2: comments (not recordable yet)

Published post from A → a second account comments on Facebook and on
Instagram → within 30 seconds the comment appears under the piece on the
member's ArtDirect page → the member replies there → the reply shows on
Facebook/Instagram. Needs the reply feature.

## Required test calls

The form shows "0 of 1 API call(s) required" per permission; calls count
after up to 24 hours. Rehearsing each screencast once with a tester account
makes the calls: connect (basic and list permissions), Post (publish
permissions). Do the rehearsal at least a day before submitting.

## Before submitting

1. Tester roles: App roles → Roles. Facebook testers accept in their Facebook
   developer settings; Instagram testers accept in Instagram → Settings → Apps
   and websites → Tester invites. The Instagram account must be a Business or
   Creator account.
2. Fill basic settings: Terms of Service `https://arts-collective.com/terms`,
   data deletion URL `https://arts-collective.com/api/meta/data-deletion`
   (Instagram app: `/api/instagram/data-deletion`; Threads:
   `/api/threads/data-deletion`), support URL, app icon, category; verify the
   contact email.
3. Business verification of the portfolio that owns the app (needed for
   advanced access to Page permissions). Status unknown on 2026-11-12.
4. Remove the "do not request" items from the submission.
5. Remove `pages_manage_metadata` from scopes and login configuration if
   round 2 is not submitted together.
6. Rebuild arts-collective with pending migrations; record against the
   deployed site.
7. Rehearse A-C (test calls), wait 24 hours, record, submit.

## Required URLs, all live

| Field | Value |
|---|---|
| Privacy policy | `https://arts-collective.com/data` (also `https://elkdonis-arts.org/data`) |
| Terms of service | `https://arts-collective.com/terms` |
| Data deletion callback | `https://arts-collective.com/api/meta/data-deletion` (Threads: `/api/threads/data-deletion`; Instagram: `/api/instagram/data-deletion`) |
| Deauthorize callback | same three URLs |
| User-facing deletion page | `https://arts-collective.com/data/delete` |
| OAuth redirect | `https://arts-collective.com/api/connections/callback` |
| Webhooks | `https://arts-collective.com/api/{meta,instagram,threads}/webhook`, verify token `META_WEBHOOK_VERIFY_TOKEN` in `.env` |

## Open items

- Decide round 2: build "reply to a comment" (network piece page → Graph
  reply) and submit the four comment permissions, or leave comments for later.
- Confirm whether `pages_read_user_content` is needed for comment text in
  `feed` webhook deliveries (test with a tester comment).
- Business verification status.
- Recording: the developer records with a local screen recorder; Claude can
  rehearse each flow in Chrome beforehand and write captions.

## Rehearsal log

- 2026-11-12 (Chrome, signed in as the developer): `/channel/outlets` loads
  (an error page for a few seconds while another session's build restarted
  the container); Facebook & Instagram connection `y8xjm3zZ…` connected since
  2026-11-01 with the six round-1 Facebook scopes, Page "Elkdonis Arts
  Collective", Instagram @elkdonisarts; Test → "The connection works.";
  `/channel/new` lists both outlets. Instagram Login row `GoNjihLy…` is
  `pending` (left by the 2026-11-08 attempt). Not done: Reconnect through
  the Facebook dialog, a real publish (a draft with the "Elkdonis" artwork
  and one test line was left unsent in the developer's tab; the developer
  records and publishes), Instagram Login connect, Threads.

## History

- 2026-11-12: revised for the review form's full list. Sorted into round 1,
  round 2, do not request. `publish_video` moved to "do not request" (Go live
  needs no permission). The 2026-11-01 line "Not requested: comments
  management, insights" stands for round 1; comments are now proposed for a
  round 2.
- 2026-11-08: Instagram Login redirect URI added; "Insufficient developer
  role" next (tester role missing).
- 2026-11-01: first version (permissions table, one screencast per app).

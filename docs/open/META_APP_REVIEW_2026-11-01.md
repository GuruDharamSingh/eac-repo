# Meta App Review: what to submit and how to record it (2026-11-01)

Covers the three Meta apps the collective runs (Facebook app 829861816853346
"ElkdonisArts", the Threads app, the Instagram app) and what App Review needs
before people outside the app's roles can connect. Status: not submitted.
Everything below is built and deployed on arts-collective.com unless marked.

## What the apps do, in Meta's words

One sentence per app, for the "App details" and each permission's "how you use it":

- **Facebook app.** Members of the Elkdonis Arts Collective network write posts
  and pieces in the Studio on arts-collective.com and publish them to a Facebook
  Page they administer and to the Instagram professional account linked to it.
- **Threads app.** The same Studio publishes a post to the member's own Threads
  profile.
- **Instagram app (Instagram Login).** For members whose Instagram professional
  account has no Facebook Page: the Studio publishes a picture with a caption
  to that account.

## Permissions requested and why (nothing else)

| Permission | Used for | Where in the product |
|---|---|---|
| `public_profile` | Name and id of the connecting account | Connections tab shows "Facebook account: …" |
| `pages_show_list` | List the Pages the member may post to | Connections tab, Page targets |
| `pages_read_engagement` | Read the Page's name and linked Instagram account | Same |
| `pages_manage_posts` | Publish a post to the Page | Studio "Post to" |
| `instagram_basic` | Read the linked Instagram account's id and username | Connections tab |
| `instagram_content_publish` | Publish a picture to the linked account | Studio "Post to" |
| `publish_video` | (kept for Facebook Live later; not used yet) | none yet; say so, or drop it before submitting |
| `business_management` | Find a Page the member holds through a business portfolio | Connect, fallback lookup (`facebookPages`) |
| `threads_basic`, `threads_content_publish` | Threads profile id, publish a post | Connections tab, Studio |
| `instagram_business_basic`, `instagram_business_content_publish` | Instagram Login account id, publish a picture | Same |

Not requested, and should not be added: messaging, comments management,
insights, ads, email.

## Required URLs, all live

| Field | Value |
|---|---|
| Privacy policy | `https://arts-collective.com/data` (also `https://elkdonis-arts.org/data`) |
| Terms of service | `https://arts-collective.com/terms` |
| Data deletion callback | `https://arts-collective.com/api/meta/data-deletion` (Threads: `/api/threads/data-deletion`; Instagram: `/api/instagram/data-deletion`) |
| Deauthorize callback | same three URLs |
| OAuth redirect | `https://arts-collective.com/api/connections/callback` |
| Webhooks | `https://arts-collective.com/api/{meta,instagram,threads}/webhook`, verify token `META_WEBHOOK_VERIFY_TOKEN` in `.env` |

## The screencast (one per app, about three minutes each)

Record in a desktop browser at 1280×720 or larger, signed in as a test user
with the app role "Tester", with the Studio on arts-collective.com. Narrate
or caption each step. Meta reviewers follow the exact clicks.

1. **Sign in** to arts-collective.com, open the Center (any org site, or
   `/hub/network`), press **View profile**, open the **Connections** tab.
2. **Connect.** Press "Connect Facebook & Instagram". Show the Facebook
   dialog: the Pages step with the Page ticked, the Instagram step with the
   account ticked, the permissions list, Continue. Back on Connections, show
   the row with the Page and "Instagram @…" under it, and "Recent activity"
   with the `connected` row. (`pages_show_list`, `pages_read_engagement`,
   `instagram_basic`, `public_profile`)
3. **Post to the Page.** Studio → Posts → New post. Type text, add a picture,
   show the Facebook preview, press **Post** on the Page target. Show the
   "posted …" link, click it, show the post on Facebook.
   (`pages_manage_posts`)
4. **Post to Instagram.** Same post, press **Post** on the Instagram target
   (JPEG picture). Show the link and the post on Instagram.
   (`instagram_content_publish`)
5. **Remove.** Back in Connections, press Remove. Show the row gone and the
   `removed` row in Recent activity. Mention that the stored token is deleted
   and Meta is asked to withdraw the app's access.

For the Threads app: steps 1 and 2 with "Connect Threads", then a text post
and a picture post to Threads, then Remove. For the Instagram app: "Connect
Instagram (no Page)", then a picture post, then Remove.

## Test users

- Development mode allows only accounts with an app role; add each tester
  under App roles → Roles → Testers (they accept in their Facebook developer
  settings). The reviewer uses their own test account once the app is in
  review, so the screencast must not depend on a particular Page.
- For a scripted reviewer walkthrough, a password test account on the
  network is enough (`docs/reference/testing.md`, "Minting a session cookie"),
  plus a Page the test Facebook account administers.

## Before submitting

- Business verification of the Meta Business portfolio that owns the app
  (needed for advanced access to the Page permissions).
- Decide on `publish_video`: justify Facebook Live, or remove it from the
  login configuration and the scopes.
- Apply any pending migrations and rebuild arts-collective; record the
  screencasts against the deployed site, not a preview.
- Open items in the code that reviewers may ask about: none known. Token
  storage (sealed, dedicated key), the audit log, deletion and deauthorize
  callbacks, and upstream revoke on remove are in place.

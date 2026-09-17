# @elkdonis/meta

Publishing a thread to a Facebook Page and a linked Instagram account.

Server-only. Every export handles a credential that can post as the Page.

## Setup, once

1. **Create a Meta app** (App Dashboard → Create App → *Business*) and add the
   **Facebook Login** and **Instagram Graph API** products. Note the App ID and
   App Secret from Settings → Basic.

2. **Get a user token** in Graph API Explorer with your app selected and these
   permissions ticked:

   | permission | for |
   |---|---|
   | `pages_show_list` | finding the Page |
   | `pages_manage_posts` | publishing to it |
   | `pages_read_engagement` | reading back what was posted |
   | `instagram_basic` | finding the linked IG account |
   | `instagram_content_publish` | publishing to it |

   This token is short-lived (1–2 hours). That is expected — step 3 trades it.

3. **Run the probe** and paste its output into `.env`:

   ```bash
   META_APP_ID=... META_APP_SECRET=... META_USER_TOKEN=EAAx... \
     node packages/meta/scripts/probe.mjs
   ```

   It exchanges the short-lived token for a long-lived one, reads the Page
   tokens from it, finds any linked Instagram account, and prints the env block
   for each Page. It writes nothing.

## App Review

Not required while every account involved is an **admin, developer or tester**
of the app — which covers publishing to your own Page. It becomes required the
day an org outside that list connects its own Page, and `pages_manage_posts` /
`instagram_content_publish` are both reviewed permissions. Worth knowing before
promising self-serve connection to anyone.

## Two constraints that decide what is buildable

**Instagram cannot link out.** URLs in a caption are not clickable. An
Instagram post is the whole message or it is nothing; there is no "read more".

**Meta fetches media from its own servers.** Both `postPhotoToPage` and
`postImageToInstagram` take a URL that Meta downloads. It must be reachable
from the public internet with no session. On this network that means a *public*
path through `/api/media/...` — `media-authz` serves those anonymously, which is
what makes this work at all. A path under an org's `Private/` tree, a workshop
folder, or a localhost URL will fail as a *media* error, never as an auth one.

Instagram additionally requires **JPEG**. A PNG produces a container that sits
in `ERROR` and never publishes.

## Use

```ts
import { pageFromEnv, appFromEnv, postLinkToPage, postImageToInstagram } from '@elkdonis/meta';

const page = pageFromEnv();
const { appSecret } = appFromEnv();

const fb = await postLinkToPage(
  page,
  { message: thread.excerpt ?? thread.title, link: `https://arts-collective.com/${org}/${thread.slug}` },
  appSecret
);
// store fb.postId on the thread — without it the copy can never be edited or deleted
```

Errors are `GraphError`, carrying Meta's `code`, `error_subcode` and
`fbtrace_id`. `err.isAuthProblem` means reconnect the Page;
`err.isRateLimited` means back off. `err.userMessage` is Meta's own
author-facing text where it supplies one.

## Rate limits

Instagram allows **25 published posts per rolling 24 hours** per account;
`remainingInstagramQuota()` reads what is left. Facebook Pages are governed by
a per-app call budget rather than a post count.

## Moving to per-org Pages later

`pageFromEnv()` is the only function that reads the environment; everything
else takes `PageTarget` as an argument. Per-org connections mean writing a
different loader (a table, a Facebook Login flow, refresh) — not rewriting any
of the Graph calls.

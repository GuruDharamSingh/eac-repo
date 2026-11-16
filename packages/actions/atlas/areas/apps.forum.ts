import type { Area, Capability, Host, HostKey } from '../types';

// apps/forum: the Grand Forum (network-wide board, wiki, drawings; /embed frames for org sites). 2026-11-16, round 3.
// Conventions: atlas/JOURNAL.md. The board's forms all post to ONE route, api/forum/[action], which is a thin door over
// packages/forum-ui handleForumAction; its 21 actions are claimed here as `case`s over 7 rows (same split as the
// elktours copies in apps.elktours.hub-api.ts). Role rules live in the forum service (packages/services forum-write.ts,
// wiki.ts), reached through packages/forum-ui connectors.

const APP = 'forum';
const SRC = 'apps/forum/src/app/api/';
const V = '2026-11-16 read apps/forum/src/app/api/{drawing,drawing/[id],drawing/[id]/svg,forum/[action],pulse}/route.ts, lib/connectors.ts, packages/forum-ui/src/actions.ts (cases), services drawing.ts and wiki.ts (archive, update, revert)';
const api = (p: string, m: string): HostKey => `api:${SRC}${p}/route.ts#${m}` as HostKey;
const h = (key: HostKey, service: string[], path: string, how: string, note?: string, kase?: string): Host => ({
  key, service, address: { app: APP, path, how }, note, ...(kase ? { case: kase } : {}),
});
const DOOR = api('forum/[action]', 'POST');
const FORUM_SVC = '@elkdonis/forum-ui#handleForumAction';
const cs = (kase: string, service: string[], path: string, how: string, note?: string): Host => h(DOOR, [FORUM_SVC, ...service], path, how, note, kase);
const FORUM = 'packages/forum-ui board pages, mounted by apps/forum/src/app/(site) and /embed';

const capabilities: Capability[] = [
  // ---------------- drawings ----------------
  {
    id: 'forum-drawing-create',
    area: 'forum.drawings',
    label: 'Post a drawing',
    does: 'A signed-in person posts a drawing (an Excalidraw scene plus its exported picture) as a published post in a forum category, optionally citing the topic it was drawn over.',
    class: 'person',
    actors: ['person'],
    scope: 'org',
    hosts: [
      h(api('drawing', 'POST'), ['@elkdonis/services#createDrawing'], '/draw', 'the Post button of the drawing board (app/(site)/draw)', 'Gate: signed in only (getViewer); org and category come from the body.'),
    ],
    entry: null,
    status: 'a threads row of kind post with metadata.drawing exists in the category',
    risk: ['public'],
    confirm: { text: 'Post this drawing as “{title}” in {where}? Everyone who can read the category will see it.', status: 'draft', wave: 6 },
    inputs: 'orgId, feedSlug, title, caption, scene, svg, from (topic id)',
    drift: 'A fourth post-creation path (createDrawing over createThread).',
    canonical: 'one post-creation service (createThread) behind a kit action',
    open: 'SECURITY: services/src/drawing.ts:112-128 looks the feed up by (orgId, feedSlug) and only checks that it exists; it never checks that the signed-in person may post in that organisation or category. min_role is used only to pick the post visibility (:127), not to refuse. So any signed-in account can publish a post into ANY organisation feed (including members-only ones, where it lands ORGANIZATION-visible) by sending its orgId and category slug. The topic path (createTopic, forum-write.ts) does check. The drawing SVG is stored as sent (only checked to start with "<svg", :90) and is served by GET /api/drawing/[id]/svg with a sandboxing CSP and nosniff (that route is safe as read); size caps are 3 MB svg and 4 MB scene.',
    verified: V,
  },
  {
    id: 'forum-drawing-save',
    area: 'forum.drawings',
    label: 'Save changes to a drawing',
    does: 'The author, or a moderator of the organisation, replaces a drawing title, caption, scene and picture.',
    class: 'person',
    actors: ['person'],
    scope: 'thread',
    hosts: [
      h(api('drawing/[id]', 'PUT'), ['@elkdonis/services#canEditDrawing', '@elkdonis/services#updateDrawing'], '/draw', 'the Save button of the drawing board when editing an existing drawing (app/(site)/draw)', 'Gate: signed in, then canEditDrawing (author, an identity of the author, or canModerate of the org); 404 if not a drawing, 403 if not theirs.'),
    ],
    entry: null,
    status: 'the thread metadata.drawing holds the new scene and svg and updated_at moved',
    risk: ['public'],
    confirm: { text: 'Save your changes to the drawing “{title}”? Everyone who can see it will see the new picture.', status: 'draft', wave: 6 },
    inputs: 'drawing id, title, caption, scene, svg',
    drift: 'None: single copy.',
    open: 'Ownership check is correct and read before the write (route.ts:10-12). updateDrawing UPDATE is by id and kind only (drawing.ts:171) and is safe only because the route checked first.',
    verified: V,
  },
  // ---------------- the board door ----------------
  {
    id: 'forum-reply',
    area: 'forum.board',
    label: 'Reply in the forum',
    does: 'A signed-in person replies to a forum topic (optionally to a reply, with photos or videos). The services decide who may post where.',
    class: 'person',
    actors: ['person'],
    scope: 'thread',
    hosts: [cs('reply', ['connectors.write.postReply'], '/', 'the Reply box under a topic (' + FORUM + ')'),
      {
        "key": "api:apps/elktours/src/app/api/forum/[action]/route.ts#POST",
        "service": [
          "@elkdonis/forum-ui#handleForumAction",
          "connectors.write.postReply"
        ],
        "address": {
          "app": "elktours",
          "path": "/forum",
          "how": "the Reply box under a topic (packages/forum-ui (board and topic pages))"
        },
        "case": "reply"
      },
      {
        "key": "api:apps/elktours/src/app/api/hub/forum/replies/route.ts#POST",
        "service": [
          "@/lib/forum-data#replyAction",
          "postReply"
        ],
        "address": {
          "app": "elktours",
          "path": "/hub",
          "how": "the reply panel of the phone forum (components/mobile/forum-replies-panel.tsx)"
        }
      },
      {
        "key": "api:apps/amrit-canada/src/app/api/forum/[action]/route.ts#POST",
        "case": "reply",
        "service": [
          "@elkdonis/forum-ui#handleForumAction",
          "@elkdonis/services#postReply"
        ],
        "address": {
          "app": "amrit-canada",
          "path": "/forum",
          "how": "the reply form of the topic page (packages/forum-ui thread.tsx) posting to /api/forum/reply"
        }
      },
      {
        "key": "api:apps/sunjay/src/app/api/forum/[action]/route.ts#POST",
        "case": "reply",
        "service": [
          "@elkdonis/forum-ui#handleForumAction",
          "@elkdonis/services#postReply"
        ],
        "address": {
          "app": "sunjay",
          "path": "/forum",
          "how": "the reply form of the topic page (packages/forum-ui thread.tsx) posting to /api/forum/reply"
        }
      },
    ],
    entry: null,
    status: 'a reply row exists for the topic by the person',
    risk: ['public'],
    confirm: { text: 'Post your reply on “{title}”? Everyone who can read the topic will see it.', status: 'draft', wave: 6 },
    inputs: 'thread, text, parent, attachments',
    drift: "this host has no phone route.\nMerged 2026-11-16 (consolidation 2): 4 rows, 4 apps (forum, elktours, amrit-canada, sunjay). Differences by app:\n- elktours (was elktours-forum-reply): The board form (/api/forum/reply) and the phone route (/api/hub/forum/replies) call the same postReply; the phone route has no signed-in check of its own (the viewer comes from getForumViewer).\n- amrit-canada (was amrit-forum-reply): Same file in sunjay (apps.sunjay.*.ts: forum-reply); the route is a 7-line mount of handleForumAction. The Grand Forum at the network host uses the same package (Elkdonis forum is arts-collective.hub:post-to-elkdonis-forum, a different door).\n- sunjay (was sunjay-forum-reply): Same file in amrit-canada (apps.amrit-canada.*.ts: forum-reply); the route is a 7-line mount of handleForumAction. The Grand Forum at the network host uses the same package (Elkdonis forum is arts-collective.hub:post-to-elkdonis-forum, a different door).\nDirection (Justin, 2026-11-16): the canonical is the hub / Channel path (hub surface pages, cards and pop-ups), not the /manage page shape. amrit-canada is the oldest site and is being left behind, so its copy is not a model; sunjay is moving from /manage pages to hub + Channel.",
    canonical: 'packages/forum-ui handleForumAction with phone routes calling the same connectors',
    open: "The door checks only that a viewer is signed in (actions.ts:164); postReply must refuse a viewer with no standing. Not re-read.\nelktours (elktours-forum-reply): The routes do no auth themselves; both depend on the forum service (postReply) rejecting a viewer with no standing. Not re-read here.\namrit-canada (amrit-forum-reply): Replies are written by thread id through loadThreadForWrite(viewer): the thread need not belong to this site org (it is the network forum code), only be readable by the viewer. Not re-read past the rate-limit check.",
    verified: V,
  },
  {
    id: 'forum-topic-start',
    area: 'forum.board',
    label: 'Start a forum topic',
    does: 'A signed-in person starts a topic in a category of an organisation (kind post, idea or event; audience everyone, followers or just the author; optional link and attachments).',
    class: 'person',
    actors: ['person'],
    scope: 'org',
    hosts: [cs('topic', ['connectors.write.createTopic'], '/', 'the Start a topic form (' + FORUM + ')'),
      {
        "key": "api:apps/elktours/src/app/api/forum/[action]/route.ts#POST",
        "service": [
          "@elkdonis/forum-ui#handleForumAction",
          "connectors.write.createTopic"
        ],
        "address": {
          "app": "elktours",
          "path": "/forum",
          "how": "the Start a topic form (packages/forum-ui (board and topic pages))"
        },
        "case": "topic"
      },
      {
        "key": "api:apps/elktours/src/app/api/hub/forum/topics/route.ts#POST",
        "service": [
          "@/lib/forum-data#topicAction",
          "createTopic"
        ],
        "address": {
          "app": "elktours",
          "path": "/hub",
          "how": "the Start a topic sheet of the phone forum (components/mobile/forum-compose-surface.tsx)"
        }
      },
      {
        "key": "api:apps/amrit-canada/src/app/api/forum/[action]/route.ts#POST",
        "case": "topic",
        "service": [
          "@elkdonis/forum-ui#handleForumAction",
          "@elkdonis/services#createTopic"
        ],
        "address": {
          "app": "amrit-canada",
          "path": "/forum",
          "how": "the new-topic form (packages/forum-ui category.tsx)"
        }
      },
      {
        "key": "api:apps/sunjay/src/app/api/forum/[action]/route.ts#POST",
        "case": "topic",
        "service": [
          "@elkdonis/forum-ui#handleForumAction",
          "@elkdonis/services#createTopic"
        ],
        "address": {
          "app": "sunjay",
          "path": "/forum",
          "how": "the new-topic form (packages/forum-ui category.tsx)"
        }
      },
    ],
    entry: null,
    status: 'a threads row for the category exists with the title',
    risk: ['public'],
    confirm: { text: 'Start the topic “{title}” in {where}? Everyone who can read the category will see it.', status: 'draft', wave: 6 },
    inputs: 'org, feed, title, text, kind, audience, link, topics, attachments',
    drift: "the Grand Forum is network scope, so every org is reachable.\nMerged 2026-11-16 (consolidation 2): 4 rows, 4 apps (forum, elktours, amrit-canada, sunjay). Differences by app:\n- elktours (was elktours-forum-topic-start): Third post-creation path next to createThread and createPostAnywhere (see journal agent B question 4); this one goes through the forum service.\n- amrit-canada (was amrit-forum-topic-post): Same file in sunjay (apps.sunjay.*.ts: forum-topic-start); the route is a 7-line mount of handleForumAction. The Grand Forum at the network host uses the same package (Elkdonis forum is arts-collective.hub:post-to-elkdonis-forum, a different door).\n- sunjay (was sunjay-forum-topic-post): Same file in amrit-canada (apps.amrit-canada.*.ts: forum-topic-start); the route is a 7-line mount of handleForumAction. The Grand Forum at the network host uses the same package (Elkdonis forum is arts-collective.hub:post-to-elkdonis-forum, a different door).\nDirection (Justin, 2026-11-16): the canonical is the hub / Channel path (hub surface pages, cards and pop-ups), not the /manage page shape. amrit-canada is the oldest site and is being left behind, so its copy is not a model; sunjay is moving from /manage pages to hub + Channel.",
    canonical: 'one post-creation service (createThread)',
    open: "createTopic checks who may post where (forum-write.ts); the door trusts the org from the form. Not re-read in this round. Contrast forum-drawing-create, which has no such check.\nelktours (elktours-forum-topic-start): The routes do no auth themselves; the forum service createTopic checks who may post where. Not re-read here.\namrit-canada (amrit-forum-topic-post): SECURITY: org and feed come from the form (route action topic: str(fd,\"org\") || target). createTopic checks canViewFeed and canPostToFeed against viewer.roles[input.orgId] (forum-write.ts:400-402), so a visitor cannot post to another org’s private forum, but this site’s endpoint will create topics in ANY org whose feed allows the viewer: it is not limited to the site org (scope is a read concern only).",
    verified: V,
  },
  {
    id: 'forum-react',
    area: 'forum.board',
    label: 'Vote, heart, watch or bookmark in the forum',
    does: 'Small reversible reactions on topics and replies: vote up or down, heart, watch a topic, bookmark it, mark everything or notifications read, and the reader display settings (cookies).',
    class: 'internal',
    actors: ['person'],
    scope: 'thread',
    hosts: [
      cs('vote', ['connectors.write.setVote'], '/', 'the vote arrows on a reply or topic'),
      cs('heart', ['connectors.write.toggleHeart'], '/', 'the heart on a reply or topic'),
      cs('watch', ['connectors.write.toggleWatch'], '/', 'the Watch button on a topic'),
      cs('bookmark', ['connectors.write.toggleBookmark'], '/', 'the Bookmark button on a topic'),
      cs('read-all', ['connectors.write.markAllRead'], '/', 'Mark all read on the board'),
      cs('notifications-read', ['connectors.write.markNotificationsRead'], '/', 'the notifications menu'),
      cs('set-theme', [], '/', 'the forum display settings', 'writes the forum_theme, forum_mode, forum_size and forum_layout cookies only; works signed out (actions.ts:134-160)'),
      {
        "key": "api:apps/elktours/src/app/api/forum/[action]/route.ts#POST",
        "service": [
          "@elkdonis/forum-ui#handleForumAction",
          "connectors.write.setVote"
        ],
        "address": {
          "app": "elktours",
          "path": "/forum",
          "how": "the vote arrows on a reply or topic (packages/forum-ui (board and topic pages))"
        },
        "case": "vote"
      },
      {
        "key": "api:apps/elktours/src/app/api/forum/[action]/route.ts#POST",
        "service": [
          "@elkdonis/forum-ui#handleForumAction",
          "connectors.write.toggleHeart"
        ],
        "address": {
          "app": "elktours",
          "path": "/forum",
          "how": "the heart on a reply or topic"
        },
        "case": "heart"
      },
      {
        "key": "api:apps/elktours/src/app/api/forum/[action]/route.ts#POST",
        "service": [
          "@elkdonis/forum-ui#handleForumAction",
          "connectors.write.toggleWatch"
        ],
        "address": {
          "app": "elktours",
          "path": "/forum",
          "how": "the Watch button on a topic"
        },
        "case": "watch"
      },
      {
        "key": "api:apps/elktours/src/app/api/forum/[action]/route.ts#POST",
        "service": [
          "@elkdonis/forum-ui#handleForumAction",
          "connectors.write.toggleBookmark"
        ],
        "address": {
          "app": "elktours",
          "path": "/forum",
          "how": "the Bookmark button on a topic"
        },
        "case": "bookmark"
      },
      {
        "key": "api:apps/elktours/src/app/api/forum/[action]/route.ts#POST",
        "service": [
          "@elkdonis/forum-ui#handleForumAction",
          "connectors.write.markAllRead"
        ],
        "address": {
          "app": "elktours",
          "path": "/forum",
          "how": "Mark all read on the board"
        },
        "case": "read-all"
      },
      {
        "key": "api:apps/elktours/src/app/api/forum/[action]/route.ts#POST",
        "service": [
          "@elkdonis/forum-ui#handleForumAction",
          "connectors.write.markNotificationsRead"
        ],
        "address": {
          "app": "elktours",
          "path": "/forum",
          "how": "the notifications menu"
        },
        "case": "notifications-read"
      },
      {
        "key": "api:apps/amrit-canada/src/app/api/forum/[action]/route.ts#POST",
        "case": "vote",
        "service": [
          "@elkdonis/forum-ui#handleForumAction",
          "@elkdonis/services#setVote",
          "toggleHeart",
          "toggleWatch",
          "toggleBookmark"
        ]
      },
      {
        "key": "api:apps/amrit-canada/src/app/api/forum/[action]/route.ts#POST",
        "case": "heart",
        "service": [
          "@elkdonis/forum-ui#handleForumAction",
          "@elkdonis/services#setVote",
          "toggleHeart",
          "toggleWatch",
          "toggleBookmark"
        ]
      },
      {
        "key": "api:apps/amrit-canada/src/app/api/forum/[action]/route.ts#POST",
        "case": "watch",
        "service": [
          "@elkdonis/forum-ui#handleForumAction",
          "@elkdonis/services#setVote",
          "toggleHeart",
          "toggleWatch",
          "toggleBookmark"
        ]
      },
      {
        "key": "api:apps/amrit-canada/src/app/api/forum/[action]/route.ts#POST",
        "case": "bookmark",
        "service": [
          "@elkdonis/forum-ui#handleForumAction",
          "@elkdonis/services#setVote",
          "toggleHeart",
          "toggleWatch",
          "toggleBookmark"
        ]
      },
      {
        "key": "api:apps/sunjay/src/app/api/forum/[action]/route.ts#POST",
        "case": "vote",
        "service": [
          "@elkdonis/forum-ui#handleForumAction",
          "@elkdonis/services#setVote",
          "toggleHeart",
          "toggleWatch",
          "toggleBookmark"
        ]
      },
      {
        "key": "api:apps/sunjay/src/app/api/forum/[action]/route.ts#POST",
        "case": "heart",
        "service": [
          "@elkdonis/forum-ui#handleForumAction",
          "@elkdonis/services#setVote",
          "toggleHeart",
          "toggleWatch",
          "toggleBookmark"
        ]
      },
      {
        "key": "api:apps/sunjay/src/app/api/forum/[action]/route.ts#POST",
        "case": "watch",
        "service": [
          "@elkdonis/forum-ui#handleForumAction",
          "@elkdonis/services#setVote",
          "toggleHeart",
          "toggleWatch",
          "toggleBookmark"
        ]
      },
      {
        "key": "api:apps/sunjay/src/app/api/forum/[action]/route.ts#POST",
        "case": "bookmark",
        "service": [
          "@elkdonis/forum-ui#handleForumAction",
          "@elkdonis/services#setVote",
          "toggleHeart",
          "toggleWatch",
          "toggleBookmark"
        ]
      },
    ],
    status: 'the reaction row (vote, heart, watch, bookmark) exists or is gone for the person and target; cookies set for set-theme',
    risk: ['none'],
    inputs: 'thread or reply id, kind, theme, mode, size, layout',
    drift: "Merged 2026-11-16 (consolidation 2): 4 rows, 4 apps (forum, elktours, amrit-canada, sunjay). Differences by app:\n- elktours (was elktours-forum-react): None.\n- amrit-canada (was amrit-forum-react): Same file in sunjay (apps.sunjay.*.ts: forum-react); the route is a 7-line mount of handleForumAction. The Grand Forum at the network host uses the same package (Elkdonis forum is arts-collective.hub:post-to-elkdonis-forum, a different door).\n- sunjay (was sunjay-forum-react): Same file in amrit-canada (apps.amrit-canada.*.ts: forum-react); the route is a 7-line mount of handleForumAction. The Grand Forum at the network host uses the same package (Elkdonis forum is arts-collective.hub:post-to-elkdonis-forum, a different door).\nDirection (Justin, 2026-11-16): the canonical is the hub / Channel path (hub surface pages, cards and pop-ups), not the /manage page shape. amrit-canada is the oldest site and is being left behind, so its copy is not a model; sunjay is moving from /manage pages to hub + Channel.",
    verified: V,
  },
  {
    id: 'forum-moderate',
    area: 'forum.board',
    label: 'Moderate the forum',
    does: 'Pin, lock, delete or move a topic; the author takes down their own topic; approve or reject a pending topic; add a category; propose a topic tag.',
    class: 'person',
    actors: ['person', 'owner', 'guide'],
    scope: 'org',
    hosts: [
      cs('moderate', ['connectors.write.moderateThread'], '/', 'the Moderate menu on a topic (' + FORUM + ')', 'do = pin, unpin, lock, unlock, delete, move'),
      cs('remove', ['connectors.write.removeThread'], '/', 'the Remove button on your own topic'),
      cs('review-topic', ['connectors.write.reviewTopic'], '/', 'the approve and reject buttons on a pending topic'),
      cs('category', ['connectors.write.createCategory'], '/', 'the New category form'),
      cs('propose-topic', ['connectors.write.proposeTopic'], '/', 'the propose-a-topic-tag box'),
      {
        "key": "api:apps/elktours/src/app/api/forum/[action]/route.ts#POST",
        "service": [
          "@elkdonis/forum-ui#handleForumAction",
          "connectors.write.moderateThread"
        ],
        "address": {
          "app": "elktours",
          "path": "/forum",
          "how": "the Moderate menu on a topic (packages/forum-ui (board and topic pages))"
        },
        "note": "do = pin, unpin, lock, unlock, delete, move",
        "case": "moderate"
      },
      {
        "key": "api:apps/elktours/src/app/api/forum/[action]/route.ts#POST",
        "service": [
          "@elkdonis/forum-ui#handleForumAction",
          "connectors.write.removeThread"
        ],
        "address": {
          "app": "elktours",
          "path": "/forum",
          "how": "the Remove button on your own topic"
        },
        "case": "remove"
      },
      {
        "key": "api:apps/elktours/src/app/api/forum/[action]/route.ts#POST",
        "service": [
          "@elkdonis/forum-ui#handleForumAction",
          "connectors.write.reviewTopic"
        ],
        "address": {
          "app": "elktours",
          "path": "/forum",
          "how": "the approve and reject buttons on a pending topic"
        },
        "case": "review-topic"
      },
      {
        "key": "api:apps/elktours/src/app/api/forum/[action]/route.ts#POST",
        "service": [
          "@elkdonis/forum-ui#handleForumAction",
          "connectors.write.createCategory"
        ],
        "address": {
          "app": "elktours",
          "path": "/forum",
          "how": "the New category form"
        },
        "case": "category"
      },
      {
        "key": "api:apps/elktours/src/app/api/forum/[action]/route.ts#POST",
        "service": [
          "@elkdonis/forum-ui#handleForumAction",
          "connectors.write.proposeTopic"
        ],
        "address": {
          "app": "elktours",
          "path": "/forum",
          "how": "the propose-a-topic-tag box"
        },
        "case": "propose-topic"
      },
      {
        "key": "api:apps/amrit-canada/src/app/api/forum/[action]/route.ts#POST",
        "case": "moderate",
        "service": [
          "@elkdonis/forum-ui#handleForumAction",
          "@elkdonis/services#moderateThread",
          "@elkdonis/services#reviewTopicAndNotify"
        ],
        "address": {
          "app": "amrit-canada",
          "path": "/forum",
          "how": "the Moderate menu on a topic (packages/forum-ui thread.tsx) and the topic review list"
        }
      },
      {
        "key": "api:apps/amrit-canada/src/app/api/forum/[action]/route.ts#POST",
        "case": "review-topic",
        "service": [
          "@elkdonis/forum-ui#handleForumAction",
          "@elkdonis/services#moderateThread",
          "@elkdonis/services#reviewTopicAndNotify"
        ]
      },
      {
        "key": "api:apps/sunjay/src/app/api/forum/[action]/route.ts#POST",
        "case": "moderate",
        "service": [
          "@elkdonis/forum-ui#handleForumAction",
          "@elkdonis/services#moderateThread",
          "@elkdonis/services#reviewTopicAndNotify"
        ],
        "address": {
          "app": "sunjay",
          "path": "/forum",
          "how": "the Moderate menu on a topic (packages/forum-ui thread.tsx) and the topic review list"
        }
      },
      {
        "key": "api:apps/sunjay/src/app/api/forum/[action]/route.ts#POST",
        "case": "review-topic",
        "service": [
          "@elkdonis/forum-ui#handleForumAction",
          "@elkdonis/services#moderateThread",
          "@elkdonis/services#reviewTopicAndNotify"
        ]
      },
    ],
    entry: null,
    status: 'the topic (pinned, locked, archived, moved or reviewed) or category row reflects the action',
    risk: ['irreversible', 'public', 'others'],
    confirm: { text: 'Apply {state} to “{title}”? Everyone who can read it will see the change. Deleting cannot be undone.', status: 'draft', wave: 6 },
    inputs: 'thread id, do, arg, category name, tag name, decision',
    drift: "copy of apps.forum:forum-moderate. The global-admin equivalent is admin-content-moderate in apps.admin.ts.\nMerged 2026-11-16 (consolidation 2): 4 rows, 4 apps (forum, elktours, amrit-canada, sunjay). Differences by app:\n- elktours (was elktours-forum-moderate): None: single dispatcher.\n- amrit-canada (was amrit-forum-moderate): Same file in sunjay (apps.sunjay.*.ts: forum-moderate); the route is a 7-line mount of handleForumAction. The Grand Forum at the network host uses the same package (Elkdonis forum is arts-collective.hub:post-to-elkdonis-forum, a different door).\n- sunjay (was sunjay-forum-moderate): Same file in amrit-canada (apps.amrit-canada.*.ts: forum-moderate); the route is a 7-line mount of handleForumAction. The Grand Forum at the network host uses the same package (Elkdonis forum is arts-collective.hub:post-to-elkdonis-forum, a different door).\nDirection (Justin, 2026-11-16): the canonical is the hub / Channel path (hub surface pages, cards and pop-ups), not the /manage page shape. amrit-canada is the oldest site and is being left behind, so its copy is not a model; sunjay is moving from /manage pages to hub + Channel.",
    open: "All role checks are in the forum service (canModerate and friends), not the door. createCategory takes the org from the form and gates on membership of that org (forum-write.ts, per the apps.sunjay notes). Not re-read.\nelktours (elktours-forum-moderate): Five different verbs behind one dispatcher, kept as one capability because the dock never offers them as separate steps; split when needed. All role checks are in the forum service, not the route.\namrit-canada (amrit-forum-moderate): moderateThread checks canModerate(viewer, thread.org_id) against the thread’s own org (forum-write.ts:809), so a site cannot moderate another org; the audit writes logModeration. Good.",
    verified: V,
  },
  {
    id: 'forum-wiki-edit',
    area: 'forum.board',
    label: 'Edit the forum wiki',
    does: 'Define, create, update, archive or revert a wiki page, discuss it, and link two topics together (a line).',
    class: 'person',
    actors: ['person'],
    scope: 'other',
    hosts: [
      cs('wiki-define', ['connectors.wiki'], '/wiki', 'the Define a term control'),
      cs('wiki-talk', ['connectors.wiki.talkThread'], '/wiki', 'the wiki Talk tab'),
      cs('wiki-create', ['connectors.wiki.create'], '/wiki', 'the New wiki page form (the Tiptap island, apps/forum components/WikiEditorIsland.tsx)'),
      cs('wiki-update', ['connectors.wiki.update'], '/wiki', 'the wiki Edit form'),
      cs('wiki-archive', ['connectors.wiki.archive'], '/wiki', 'the wiki Archive button'),
      cs('wiki-revert', ['connectors.wiki.revert'], '/wiki', 'the wiki history Revert button'),
      cs('line', ['connectors.write.drawLine', 'connectors.write.eraseLine'], '/', 'the link-to-another-topic box on a topic'),
      {
        "key": "api:apps/elktours/src/app/api/forum/[action]/route.ts#POST",
        "service": [
          "@elkdonis/forum-ui#handleForumAction",
          "connectors.write"
        ],
        "address": {
          "app": "elktours",
          "path": "/forum",
          "how": "the Define a term control (packages/forum-ui (board and topic pages))"
        },
        "case": "wiki-define"
      },
      {
        "key": "api:apps/elktours/src/app/api/forum/[action]/route.ts#POST",
        "service": [
          "@elkdonis/forum-ui#handleForumAction",
          "connectors.write"
        ],
        "address": {
          "app": "elktours",
          "path": "/forum",
          "how": "the wiki Talk tab"
        },
        "case": "wiki-talk"
      },
      {
        "key": "api:apps/elktours/src/app/api/forum/[action]/route.ts#POST",
        "service": [
          "@elkdonis/forum-ui#handleForumAction",
          "connectors.write"
        ],
        "address": {
          "app": "elktours",
          "path": "/forum",
          "how": "the New wiki page form"
        },
        "case": "wiki-create"
      },
      {
        "key": "api:apps/elktours/src/app/api/forum/[action]/route.ts#POST",
        "service": [
          "@elkdonis/forum-ui#handleForumAction",
          "connectors.write"
        ],
        "address": {
          "app": "elktours",
          "path": "/forum",
          "how": "the wiki Edit form"
        },
        "case": "wiki-update"
      },
      {
        "key": "api:apps/elktours/src/app/api/forum/[action]/route.ts#POST",
        "service": [
          "@elkdonis/forum-ui#handleForumAction",
          "connectors.write"
        ],
        "address": {
          "app": "elktours",
          "path": "/forum",
          "how": "the wiki Archive button"
        },
        "case": "wiki-archive"
      },
      {
        "key": "api:apps/elktours/src/app/api/forum/[action]/route.ts#POST",
        "service": [
          "@elkdonis/forum-ui#handleForumAction",
          "connectors.write"
        ],
        "address": {
          "app": "elktours",
          "path": "/forum",
          "how": "the wiki history Revert button"
        },
        "case": "wiki-revert"
      },
      {
        "key": "api:apps/elktours/src/app/api/forum/[action]/route.ts#POST",
        "service": [
          "@elkdonis/forum-ui#handleForumAction",
          "connectors.write"
        ],
        "address": {
          "app": "elktours",
          "path": "/forum",
          "how": "the link-to-another-topic box on a topic"
        },
        "case": "line"
      },
      {
        "key": "api:apps/amrit-canada/src/app/api/forum/[action]/route.ts#POST",
        "case": "wiki-define",
        "service": [
          "@elkdonis/forum-ui#handleForumAction",
          "@elkdonis/services#createWikiPage",
          "updateWikiPage",
          "revertWikiPage",
          "archiveWikiPage"
        ],
        "address": {
          "app": "amrit-canada",
          "path": "/forum",
          "how": "the wiki pages of the forum (packages/forum-ui wiki-pages.tsx), reached only if the forum hrefs offer them"
        }
      },
      {
        "key": "api:apps/amrit-canada/src/app/api/forum/[action]/route.ts#POST",
        "case": "wiki-talk",
        "service": [
          "@elkdonis/forum-ui#handleForumAction",
          "@elkdonis/services#createWikiPage",
          "updateWikiPage",
          "revertWikiPage",
          "archiveWikiPage"
        ]
      },
      {
        "key": "api:apps/amrit-canada/src/app/api/forum/[action]/route.ts#POST",
        "case": "wiki-create",
        "service": [
          "@elkdonis/forum-ui#handleForumAction",
          "@elkdonis/services#createWikiPage",
          "updateWikiPage",
          "revertWikiPage",
          "archiveWikiPage"
        ]
      },
      {
        "key": "api:apps/amrit-canada/src/app/api/forum/[action]/route.ts#POST",
        "case": "wiki-update",
        "service": [
          "@elkdonis/forum-ui#handleForumAction",
          "@elkdonis/services#createWikiPage",
          "updateWikiPage",
          "revertWikiPage",
          "archiveWikiPage"
        ]
      },
      {
        "key": "api:apps/amrit-canada/src/app/api/forum/[action]/route.ts#POST",
        "case": "wiki-revert",
        "service": [
          "@elkdonis/forum-ui#handleForumAction",
          "@elkdonis/services#createWikiPage",
          "updateWikiPage",
          "revertWikiPage",
          "archiveWikiPage"
        ]
      },
      {
        "key": "api:apps/amrit-canada/src/app/api/forum/[action]/route.ts#POST",
        "case": "wiki-archive",
        "service": [
          "@elkdonis/forum-ui#handleForumAction",
          "@elkdonis/services#createWikiPage",
          "updateWikiPage",
          "revertWikiPage",
          "archiveWikiPage"
        ]
      },
      {
        "key": "api:apps/sunjay/src/app/api/forum/[action]/route.ts#POST",
        "case": "wiki-define",
        "service": [
          "@elkdonis/forum-ui#handleForumAction",
          "@elkdonis/services#createWikiPage",
          "updateWikiPage",
          "revertWikiPage",
          "archiveWikiPage"
        ],
        "address": {
          "app": "sunjay",
          "path": "/forum",
          "how": "the wiki pages of the forum (packages/forum-ui wiki-pages.tsx), reached only if the forum hrefs offer them"
        }
      },
      {
        "key": "api:apps/sunjay/src/app/api/forum/[action]/route.ts#POST",
        "case": "wiki-talk",
        "service": [
          "@elkdonis/forum-ui#handleForumAction",
          "@elkdonis/services#createWikiPage",
          "updateWikiPage",
          "revertWikiPage",
          "archiveWikiPage"
        ]
      },
      {
        "key": "api:apps/sunjay/src/app/api/forum/[action]/route.ts#POST",
        "case": "wiki-create",
        "service": [
          "@elkdonis/forum-ui#handleForumAction",
          "@elkdonis/services#createWikiPage",
          "updateWikiPage",
          "revertWikiPage",
          "archiveWikiPage"
        ]
      },
      {
        "key": "api:apps/sunjay/src/app/api/forum/[action]/route.ts#POST",
        "case": "wiki-update",
        "service": [
          "@elkdonis/forum-ui#handleForumAction",
          "@elkdonis/services#createWikiPage",
          "updateWikiPage",
          "revertWikiPage",
          "archiveWikiPage"
        ]
      },
      {
        "key": "api:apps/sunjay/src/app/api/forum/[action]/route.ts#POST",
        "case": "wiki-revert",
        "service": [
          "@elkdonis/forum-ui#handleForumAction",
          "@elkdonis/services#createWikiPage",
          "updateWikiPage",
          "revertWikiPage",
          "archiveWikiPage"
        ]
      },
      {
        "key": "api:apps/sunjay/src/app/api/forum/[action]/route.ts#POST",
        "case": "wiki-archive",
        "service": [
          "@elkdonis/forum-ui#handleForumAction",
          "@elkdonis/services#createWikiPage",
          "updateWikiPage",
          "revertWikiPage",
          "archiveWikiPage"
        ]
      },
    ],
    entry: null,
    status: 'the wiki page or line row reflects the action',
    risk: ['public', 'irreversible'],
    confirm: { text: 'Save your change to the wiki page “{title}”? Everyone who can read the forum will see it.', status: 'draft', wave: 6 },
    inputs: 'page, text, term, topic reference',
    drift: "copy of apps.forum:forum-wiki-edit.\nMerged 2026-11-16 (consolidation 2): 4 rows, 4 apps (forum, elktours, amrit-canada, sunjay). Differences by app:\n- elktours (was elktours-forum-wiki-edit): None: single dispatcher.\n- amrit-canada (was amrit-forum-wiki-edit): Same file in sunjay (apps.sunjay.*.ts: forum-wiki-edit); the route is a 7-line mount of handleForumAction. The Grand Forum at the network host uses the same package (Elkdonis forum is arts-collective.hub:post-to-elkdonis-forum, a different door).\n- sunjay (was sunjay-forum-wiki-edit): Same file in amrit-canada (apps.amrit-canada.*.ts: forum-wiki-edit); the route is a 7-line mount of handleForumAction. The Grand Forum at the network host uses the same package (Elkdonis forum is arts-collective.hub:post-to-elkdonis-forum, a different door).\nDirection (Justin, 2026-11-16): the canonical is the hub / Channel path (hub surface pages, cards and pop-ups), not the /manage page shape. amrit-canada is the oldest site and is being left behind, so its copy is not a model; sunjay is moving from /manage pages to hub + Channel.",
    open: "SECURITY: the wiki is network-wide and these cases check only that a viewer is signed in (forum-ui actions.ts:307-377). wiki-archive calls archiveWikiPage(id) with no viewer or role (services wiki.ts:381-400: UPDATE threads SET status archived WHERE id AND kind wiki_page), and wiki-update and wiki-revert pass the viewer id only as the editor name (revertWikiPage wiki.ts:360-378): any account, however new, can archive any wiki page and overwrite or revert any other (revisions are kept, but archiving hides the page). apps/forum/src/lib/connectors.ts supplies wiki.* with no role wrapper, so the network host is where this is reachable. Same finding as the sunjay and amrit rows; wiki-update has an optimistic lock (expectedUpdatedAt).\nelktours (elktours-forum-wiki-edit): Seven wiki cases (wiki-define, wiki-talk, wiki-create, wiki-update, wiki-archive, wiki-revert, line) share one capability; the case bodies were not read past the action names. Role rules live in the forum service.\namrit-canada (amrit-forum-wiki-edit): SECURITY: packages/forum-ui actions.ts handles wiki-archive (line 347), wiki-update and wiki-revert after checking only viewer.userId; archiveWikiPage(id) takes no viewer or org (services wiki.ts:381, UPDATE threads ... WHERE id AND kind = wiki_page). The wiki is network-wide (listWikiPages is unscoped). So any signed-in account, including a follower of this site, can archive or overwrite any network wiki page by id, through /api/forum/wiki-archive here. Same on every app that mounts this route.",
    verified: V,
  },
  // ---------------- analytics ----------------
];

const ignored: Area['ignored'] = [];

export default { capabilities, ignored } satisfies Area;

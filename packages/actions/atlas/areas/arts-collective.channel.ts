// Curated capabilities: arts-collective /channel (the planning board: suggestions, slots, plans, to-dos,
// routines, new posts). 2026-11-16, agent B. Conventions: atlas/JOURNAL.md.
import type { Area, Capability } from '../types';

const capabilities: Capability[] = [
  // ---------------- channel.board ----------------
  {
    id: 'accept-channel-suggestion',
    area: 'channel.board',
    label: 'Accept a suggested post',
    does: "Puts a suggested post for a piece on the queue as a draft and adds a step to the piece's plan. Nothing is sent.",
    class: 'person',
    actors: ['person', 'owner', 'guide'],
    scope: 'channel',
    hosts: [
      {
        key: 'sa:apps/arts-collective/src/lib/channel/actions.ts#acceptSuggestionAction',
        service: ['createChannelDelivery', 'addChannelPlanStep'],
        address: {
          app: 'arts-collective',
          path: '/channel/piece/{pieceKey}',
          anchor: 'accept-channel-suggestion',
          how: 'The Accept button on a suggestion row (components/channel/PieceSurface.tsx).',
        },
      },
      {
        key: 'sa:apps/arts-collective/src/lib/channel/actions.ts#acceptSuggestionsAction',
        service: ['createChannelDelivery', 'addChannelPlanStep'],
        address: {
          app: 'arts-collective',
          path: '/channel/queue',
          anchor: 'accept-channel-suggestion',
          how: 'Accept all / Accept on the Queue and the piece board (components/channel/Queue.tsx, PieceBoard.tsx). Up to 20 at a time.',
        },
        note: 'acceptSuggestionAction calls this one.',
      },
      {
        key: 'sa:apps/arts-collective/src/lib/channel/actions.ts#acceptAdjustedAction',
        service: ['createChannelDelivery', 'addChannelPlanStep'],
        address: {
          app: 'arts-collective',
          path: '/channel/queue',
          anchor: 'accept-channel-suggestion',
          how: 'Accept with changes in components/channel/AdjustSheet.tsx (changes the outlet, time, importance or a note).',
        },
        note: 'Same writes with a changed outlet/text/time.',
      },
      {
        "key": "sa:apps/sunjay/src/lib/channel-door.ts#runChannelAction",
        "case": "channel-suggestion-accept",
        "service": [
          "@elkdonis/actions/server#performSiteChannelAction"
        ],
        "address": {
          "app": "sunjay",
          "path": "/channel",
          "how": "the Channel tabs of the site (components/hub/ChannelSurface.tsx and app/channel/page.tsx call runChannelAction)"
        }
      },
      {
        "key": "sa:apps/katie-the-potter/src/lib/channel-door.ts#runChannelAction",
        "case": "channel-suggestion-accept",
        "service": [
          "@elkdonis/actions/server#performSiteChannelAction"
        ],
        "address": {
          "app": "katie-the-potter",
          "path": "/channel",
          "how": "the Channel tabs of the site (app/channel/page.tsx calls runChannelAction)"
        }
      },
    ],
    entry: 'channel-suggestion-accept',
    status: 'channel-next',
    risk: ['none'],
    confirm: {
      text: 'Add a draft {outlet} post about “{title}” for {when}. Nothing is posted.',
      title: 'Queue suggested post',
      status: 'approved',
      wave: 1,
    },
    inputs: 'pieceKey, outlet, identityId, text, at, routineId',
    drift: "The app's lib/channel/actions.ts and the registry's packages/actions/src/server/channel.ts each carry their own copy of acting/ownerFor/mayTouch and the delivery + plan-step writes (both call @elkdonis/services/channel). Three app hosts for one registry runner (acceptSuggestion); the adjusted one can also change the outlet.\nMerged 2026-11-16 (consolidation 2): 3 rows, 3 apps (arts-collective, sunjay, katie-the-potter). Differences by app:\n- sunjay (was sunjay-channel-suggestion-accept): this is the site door (performSiteChannelAction, org fixed to siteConfig.orgId, owners and guides only) and writes plans only, nothing is sent; one host serves six entries (SITE_DOOR_ALLOW).\n- katie-the-potter (was katie-channel-suggestion-accept): one host serves six entries (SITE_DOOR_ALLOW).\nDirection (Justin, 2026-11-16): the canonical is the hub / Channel path (hub surface pages, cards and pop-ups), not the /manage page shape. amrit-canada is the oldest site and is being left behind, so its copy is not a model; sunjay is moving from /manage pages to hub + Channel.\nRelated, not merged: sunjay-channel-slot-fill and sunjay-channel-slot-fill (their own registry entry channel-slot-fill).",
    canonical: 'packages/actions server/channel.ts acceptSuggestion, called by all three actions',
    verified: '2026-11-16 read lib/channel/actions.ts, packages/actions server/channel.ts, run.ts',
  },
  {
    id: 'dismiss-channel-suggestion',
    area: 'channel.board',
    label: 'Dismiss a suggestion',
    does: 'Records that a suggested outlet for a piece is not wanted, so it stops suggesting itself.',
    class: 'person',
    actors: ['person', 'owner', 'guide'],
    scope: 'channel',
    hosts: [
      {
        key: 'sa:apps/arts-collective/src/lib/channel/actions.ts#dismissSuggestionAction',
        service: ['createChannelDelivery'],
        address: {
          app: 'arts-collective',
          path: '/channel/queue',
          anchor: 'dismiss-channel-suggestion',
          how: 'The Dismiss / Skip for this piece control on a suggestion (PieceSurface.tsx, PieceBoard.tsx, AdjustSheet.tsx).',
        },
      },
      {
        "key": "sa:apps/sunjay/src/lib/channel-door.ts#runChannelAction",
        "case": "channel-suggestion-dismiss",
        "service": [
          "@elkdonis/actions/server#performSiteChannelAction"
        ],
        "address": {
          "app": "sunjay",
          "path": "/channel",
          "how": "the Channel tabs of the site (components/hub/ChannelSurface.tsx and app/channel/page.tsx call runChannelAction)"
        }
      },
      {
        "key": "sa:apps/katie-the-potter/src/lib/channel-door.ts#runChannelAction",
        "case": "channel-suggestion-dismiss",
        "service": [
          "@elkdonis/actions/server#performSiteChannelAction"
        ],
        "address": {
          "app": "katie-the-potter",
          "path": "/channel",
          "how": "the Channel tabs of the site (app/channel/page.tsx calls runChannelAction)"
        }
      },
    ],
    entry: 'channel-suggestion-dismiss',
    status: 'channel-next',
    risk: ['none'],
    confirm: {
      text: 'Stop suggesting {outlet} for “{title}”. Posting there by hand still works.',
      title: 'Dismiss suggestion',
      status: 'approved',
      wave: 1,
    },
    drift: "The app's lib/channel/actions.ts and the registry's packages/actions/src/server/channel.ts each carry their own copy of acting/ownerFor/mayTouch and the delivery + plan-step writes (both call @elkdonis/services/channel).\nMerged 2026-11-16 (consolidation 2): 3 rows, 3 apps (arts-collective, sunjay, katie-the-potter). Differences by app:\n- sunjay (was sunjay-channel-suggestion-dismiss): this is the site door (performSiteChannelAction, org fixed to siteConfig.orgId, owners and guides only) and writes plans only, nothing is sent; one host serves six entries (SITE_DOOR_ALLOW).\n- katie-the-potter (was katie-channel-suggestion-dismiss): one host serves six entries (SITE_DOOR_ALLOW).\nDirection (Justin, 2026-11-16): the canonical is the hub / Channel path (hub surface pages, cards and pop-ups), not the /manage page shape. amrit-canada is the oldest site and is being left behind, so its copy is not a model; sunjay is moving from /manage pages to hub + Channel.",
    canonical: 'packages/actions server/channel.ts dismissSuggestion',
    open: 'The registry says "hides a gap for good". Can it be undone from the UI?',
    verified: '2026-11-16 read lib/channel/actions.ts',
  },
  {
    id: 'never-suggest',
    area: 'channel.board',
    label: 'Never suggest this again',
    does: 'Adds a rule so an outlet (or an outlet for one kind of piece) is never suggested.',
    class: 'person',
    actors: ['person', 'owner', 'guide'],
    scope: 'channel',
    hosts: [
      {
        key: 'sa:apps/arts-collective/src/lib/channel/actions.ts#neverSuggestAction',
        service: ['addChannelRule'],
        address: {
          app: 'arts-collective',
          path: '/channel/queue',
          anchor: 'never-suggest',
          how: 'The "Never suggest this" control in components/channel/AdjustSheet.tsx.',
        },
      },
    ],
    entry: null,
    status: 'A channel rule exists for the outlet and kind',
    risk: ['none'],
    confirm: { text: 'Never suggest {outlet} for {kind}? You can still post there by hand.', status: 'draft', wave: 2 },
    open: 'Can a rule be removed in the UI? I did not find a removal action.',
    verified: '2026-11-16 read lib/channel/actions.ts',
  },
  // ---------------- channel.plan ----------------
  {
    id: 'start-piece-plan',
    area: 'channel.plan',
    label: 'Start a plan for a piece',
    does: "Creates the piece's plan (a checklist of steps) if it has none.",
    class: 'person',
    actors: ['person', 'owner', 'guide'],
    scope: 'channel',
    hosts: [
      {
        key: 'sa:apps/arts-collective/src/lib/channel/actions.ts#startPlanAction',
        service: ['ensureChannelPlan'],
        address: {
          app: 'arts-collective',
          path: '/channel/piece/{pieceKey}',
          anchor: 'start-piece-plan',
          how: 'The Start a plan button on a piece with no plan (components/channel/PieceSurface.tsx).',
        },
      },
      {
        "key": "sa:apps/sunjay/src/lib/channel-door.ts#runChannelAction",
        "case": "channel-plan",
        "service": [
          "@elkdonis/actions/server#performSiteChannelAction"
        ],
        "address": {
          "app": "sunjay",
          "path": "/channel",
          "how": "the Channel tabs of the site (components/hub/ChannelSurface.tsx and app/channel/page.tsx call runChannelAction)"
        }
      },
      {
        "key": "sa:apps/katie-the-potter/src/lib/channel-door.ts#runChannelAction",
        "case": "channel-plan",
        "service": [
          "@elkdonis/actions/server#performSiteChannelAction"
        ],
        "address": {
          "app": "katie-the-potter",
          "path": "/channel",
          "how": "the Channel tabs of the site (app/channel/page.tsx calls runChannelAction)"
        }
      },
    ],
    entry: 'channel-plan',
    status: 'channel-next',
    risk: ['none'],
    confirm: {
      text: 'Create an empty plan for “{title}”. Only you see it.',
      title: 'Start plan',
      status: 'approved',
      wave: 1,
    },
    drift: "The app's lib/channel/actions.ts and the registry's packages/actions/src/server/channel.ts each carry their own copy of acting/ownerFor/mayTouch and the delivery + plan-step writes (both call @elkdonis/services/channel). Registry channel-plan (\"Plan it\") also proposes steps; startPlanAction only creates the empty plan.\nMerged 2026-11-16 (consolidation 2): 3 rows, 3 apps (arts-collective, sunjay, katie-the-potter). Differences by app:\n- sunjay (was sunjay-channel-plan): this is the site door (performSiteChannelAction, org fixed to siteConfig.orgId, owners and guides only) and writes plans only, nothing is sent; one host serves six entries (SITE_DOOR_ALLOW).\n- katie-the-potter (was katie-channel-plan): one host serves six entries (SITE_DOOR_ALLOW).\nDirection (Justin, 2026-11-16): the canonical is the hub / Channel path (hub surface pages, cards and pop-ups), not the /manage page shape. amrit-canada is the oldest site and is being left behind, so its copy is not a model; sunjay is moving from /manage pages to hub + Channel.",
    canonical: 'planPiece with a no-proposals option',
    open: 'Registry channel-plan = start + propose. The app has no host that proposes; is that intended?',
    verified: '2026-11-16 read lib/channel/actions.ts, run.ts',
  },
  {
    id: 'save-piece-plan',
    area: 'channel.plan',
    label: "Edit a piece's plan text",
    does: 'Saves the free-text plan.md of a piece (with an edit-conflict check).',
    class: 'internal',
    actors: ['person', 'owner', 'guide'],
    scope: 'channel',
    hosts: [
      {
        key: 'sa:apps/arts-collective/src/lib/channel/actions.ts#savePlanAction',
        service: ['saveChannelPlan'],
      },
    ],
    risk: ['none'],
    open: 'Free editing of the plan in PieceSurface.tsx; not a rail step.',
    verified: '2026-11-16 read lib/channel/actions.ts',
  },
  {
    id: 'tick-plan-step',
    area: 'channel.plan',
    label: 'Tick a plan step',
    does: "Ticks or unticks one step of a piece's plan.",
    class: 'person',
    actors: ['person', 'owner', 'guide'],
    scope: 'channel',
    hosts: [
      {
        key: 'sa:apps/arts-collective/src/lib/channel/actions.ts#setPlanStepAction',
        service: ['setChannelPlanStep'],
        address: {
          app: 'arts-collective',
          path: '/channel/piece/{pieceKey}',
          anchor: 'tick-plan-step',
          how: 'The tick box beside a step in the plan list (PieceSurface.tsx).',
        },
      },
      {
        "key": "sa:apps/sunjay/src/lib/channel-door.ts#runChannelAction",
        "case": "channel-plan-step",
        "service": [
          "@elkdonis/actions/server#performSiteChannelAction"
        ],
        "address": {
          "app": "sunjay",
          "path": "/channel",
          "how": "the Channel tabs of the site (components/hub/ChannelSurface.tsx and app/channel/page.tsx call runChannelAction)"
        }
      },
      {
        "key": "sa:apps/katie-the-potter/src/lib/channel-door.ts#runChannelAction",
        "case": "channel-plan-step",
        "service": [
          "@elkdonis/actions/server#performSiteChannelAction"
        ],
        "address": {
          "app": "katie-the-potter",
          "path": "/channel",
          "how": "the Channel tabs of the site (app/channel/page.tsx calls runChannelAction)"
        }
      },
    ],
    entry: 'channel-plan-step',
    status: 'channel-next',
    risk: ['none'],
    confirm: {
      text: 'Mark step “{name}” of “{title}” as {state}.',
      title: 'Tick plan step',
      status: 'approved',
      wave: 1,
    },
    drift: "The app's lib/channel/actions.ts and the registry's packages/actions/src/server/channel.ts each carry their own copy of acting/ownerFor/mayTouch and the delivery + plan-step writes (both call @elkdonis/services/channel). Registry planStep also appends steps (op add); the app only ticks, appending goes through savePlanAction or accept.\nMerged 2026-11-16 (consolidation 2): 3 rows, 3 apps (arts-collective, sunjay, katie-the-potter). Differences by app:\n- sunjay (was sunjay-channel-plan-step): this is the site door (performSiteChannelAction, org fixed to siteConfig.orgId, owners and guides only) and writes plans only, nothing is sent; one host serves six entries (SITE_DOOR_ALLOW).\n- katie-the-potter (was katie-channel-plan-step): one host serves six entries (SITE_DOOR_ALLOW).\nDirection (Justin, 2026-11-16): the canonical is the hub / Channel path (hub surface pages, cards and pop-ups), not the /manage page shape. amrit-canada is the oldest site and is being left behind, so its copy is not a model; sunjay is moving from /manage pages to hub + Channel.",
    canonical: 'packages/actions server/channel.ts planStep',
    verified: '2026-11-16 read lib/channel/actions.ts',
  },
  {
    id: 'add-channel-todo',
    area: 'channel.plan',
    label: 'Add a to-do',
    does: 'Adds a dated or undated to-do to the channel, optionally tied to a piece.',
    class: 'person',
    actors: ['person', 'owner', 'guide'],
    scope: 'channel',
    hosts: [
      {
        key: 'sa:apps/arts-collective/src/lib/channel/actions.ts#addTodoAction',
        service: ['addChannelTodo'],
        address: {
          app: 'arts-collective',
          path: '/channel/queue',
          anchor: 'add-channel-todo',
          how: 'The add a note / to-do control on the Queue (components/channel/Queue.tsx).',
        },
      },
    ],
    entry: null,
    status: 'A todo row exists (services channel)',
    risk: ['none'],
    confirm: {
      text: 'Add the to-do “{name}” to your channel? Only the people who manage it see it.',
      status: 'draft',
      wave: 2,
    },
    verified: '2026-11-16 read lib/channel/actions.ts',
  },
  {
    id: 'tick-channel-todo',
    area: 'channel.plan',
    label: 'Tick a to-do',
    does: 'Marks a channel to-do done or not done.',
    class: 'person',
    actors: ['person', 'owner', 'guide'],
    scope: 'channel',
    hosts: [
      {
        key: 'sa:apps/arts-collective/src/lib/channel/actions.ts#setTodoDoneAction',
        service: ['setChannelTodoDone'],
        address: {
          app: 'arts-collective',
          path: '/channel',
          anchor: 'tick-channel-todo',
          how: 'The tick on a to-do row (components/channel/NextRow.tsx, Queue.tsx).',
        },
      },
    ],
    entry: null,
    status: 'todo row done flag as chosen',
    risk: ['none'],
    confirm: { text: 'Mark the to-do “{name}” as {state}?', status: 'draft', wave: 2 },
    verified: '2026-11-16 read lib/channel/actions.ts',
  },
  // ---------------- channel.posts ----------------
  {
    id: 'plan-or-schedule-post',
    area: 'channel.posts',
    label: 'Plan or schedule a post for a piece',
    does: 'Saves a post about a piece on an outlet with its text and time, as a draft or as scheduled to go out.',
    class: 'person',
    actors: ['person', 'owner', 'guide'],
    scope: 'channel',
    hosts: [
      {
        key: 'sa:apps/arts-collective/src/lib/channel/actions.ts#saveQuickSheetAction',
        service: ['createChannelDelivery', 'updateChannelDelivery', 'ensureChannelPlan'],
        address: {
          app: 'arts-collective',
          path: '/channel/queue',
          anchor: 'plan-or-schedule-post',
          how: 'The quick sheet that opens from a slot or a grid cell (components/channel/QuickSheet.tsx); Schedule vs Save draft.',
        },
      },
    ],
    entry: 'channel-delivery-save',
    status: 'channel-next',
    risk: ['public'],
    confirm: {
      text: 'Save a {outlet} post about “{title}” for {when}. Scheduled posts go public automatically.',
      title: 'Save {outlet} post',
      status: 'approved',
      wave: 1,
    },
    inputs: 'pieceKey, outlet, title, caption, at, routineId, schedule',
    drift: "The app's lib/channel/actions.ts and the registry's packages/actions/src/server/channel.ts each carry their own copy of acting/ownerFor/mayTouch and the delivery + plan-step writes (both call @elkdonis/services/channel). Registry channel-delivery-save only ever writes drafts; this action can set status scheduled.",
    canonical: 'packages/actions server/channel.ts saveDeliveryDraft, with scheduling as a separate entry',
    open: 'Who actually sends a scheduled delivery, and when? The sender was not traced; it decides the risk label.',
    verified: '2026-11-16 read lib/channel/actions.ts, run.ts',
  },
  // ---------------- channel.routines ----------------
  {
    id: 'add-channel-routine',
    area: 'channel.routines',
    label: 'Add a posting routine',
    does: 'Creates a routine (name, outlet, cadence) that opens regular slots on the board.',
    class: 'person',
    actors: ['person', 'owner', 'guide'],
    scope: 'channel',
    hosts: [
      {
        key: 'sa:apps/arts-collective/src/lib/channel/actions.ts#addRoutineAction',
        service: ['createChannelRoutine'],
        address: {
          app: 'arts-collective',
          path: '/channel/routines',
          anchor: 'add-channel-routine',
          how: 'The add control on the Routines page (components/channel/Routines.tsx).',
        },
      },
    ],
    entry: null,
    status: 'A routine exists for the channel',
    risk: ['none'],
    confirm: {
      text: 'Add the routine “{name}” for {outlet}, {cadence}? It opens empty slots on your board.',
      status: 'draft',
      wave: 2,
    },
    open: 'Setup step "a first routine" is mentioned in channel.ts as a move kind, but there is no channel-routine status entry.',
    verified: '2026-11-16 read lib/channel/actions.ts',
  },
  {
    id: 'edit-channel-routine',
    area: 'channel.routines',
    label: 'Edit a posting routine',
    does: "Changes a routine's name, outlet or cadence.",
    class: 'internal',
    actors: ['person', 'owner', 'guide'],
    scope: 'channel',
    hosts: [
      {
        key: 'sa:apps/arts-collective/src/lib/channel/actions.ts#updateRoutineAction',
        service: ['updateChannelRoutine'],
      },
    ],
    risk: ['none'],
    verified: '2026-11-16 read lib/channel/actions.ts',
  },
  {
    id: 'archive-channel-routine',
    area: 'channel.routines',
    label: 'Archive a posting routine',
    does: 'Retires a routine so it stops opening slots.',
    class: 'person',
    actors: ['person', 'owner', 'guide'],
    scope: 'channel',
    hosts: [
      {
        key: 'sa:apps/arts-collective/src/lib/channel/actions.ts#archiveRoutineAction',
        service: ['archiveChannelRoutine'],
        address: {
          app: 'arts-collective',
          path: '/channel/routines',
          anchor: 'archive-channel-routine',
          how: 'The archive control on a routine (components/channel/Routines.tsx).',
        },
      },
    ],
    entry: null,
    status: 'routine archived',
    risk: ['none'],
    confirm: {
      text: 'Archive the routine “{name}”? It stops opening slots, and drafts already in it stay.',
      status: 'draft',
      wave: 2,
    },
    verified: '2026-11-16 read lib/channel/actions.ts',
  },
  // ---------------- channel.posts ----------------
  {
    id: 'post-artwork-from-channel',
    area: 'channel.posts',
    label: 'Make a post from an artwork',
    does: "Creates a draft social post from an artwork's title, details and picture, then opens it in the Studio.",
    class: 'person',
    actors: ['person', 'owner', 'guide'],
    scope: 'person',
    hosts: [
      {
        key: 'sa:apps/arts-collective/src/lib/channel-actions.ts#postArtworkAction',
        service: ['createSocialPost', 'updateSocialPost'],
        address: {
          app: 'arts-collective',
          path: '/studio/channel?view=artwork',
          anchor: 'post-artwork-from-channel',
          how: 'The Post this button on an artwork row in the Studio channel artwork view (app/studio/channel/page.tsx).',
        },
      },
    ],
    entry: null,
    status: 'A social_posts draft with the artwork link exists',
    risk: ['none'],
    confirm: {
      text: 'Make a draft post from “{title}”? It opens in the Studio for you to finish, and nothing is sent.',
      status: 'draft',
      wave: 2,
    },
    drift: 'Third createSocialPost caller (also saveNewPostAction, createSocialPostAction).',
    canonical: 'one createSocialPost wrapper',
    verified: '2026-11-16 read lib/channel-actions.ts',
  },
  // ---------------- channel.comments (2026-11-24) ----------------
  {
    id: 'channel-comment-reply',
    area: 'channel.comments',
    label: 'Reply to a comment on Facebook or Instagram',
    does: 'Posts a reply under a comment on one of the person\'s own Facebook Page or Instagram posts, as that Page or account, and keeps a copy for Channel and the piece page.',
    class: 'person',
    actors: ['person', 'owner', 'guide'],
    scope: 'person',
    hosts: [
      {
        key: 'sa:apps/arts-collective/src/lib/channel/comments.ts#replyToChannelCommentAction',
        service: ['getChannelComment', 'getMetaPageTarget', 'getInstagramLoginTarget', 'replyToPageComment', 'replyToInstagramComment', 'replyToInstagramLoginComment', 'recordExternalComment'],
        address: {
          app: 'arts-collective',
          path: '/channel/comments',
          anchor: 'channel-comment-reply',
          how: 'Reply under a comment, then Send reply (components/channel/Comments.tsx).',
        },
        note: 'Only posts sent through the person\'s own connection (split_part(target_id) owned by them); the reply uses that connection\'s token.',
      },
    ],
    entry: null,
    status: 'A thread_external_comments row with from_self = true under the comment',
    risk: ['public'],
    confirm: {
      text: 'Reply to {author} on {platform} as {account}? Everyone who can see the post will see your reply.',
      status: 'draft',
      wave: 3,
    },
    open: 'Facebook replies need pages_manage_engagement; Instagram needs instagram_manage_comments or instagram_business_manage_comments (App Review round 2).',
    verified: '2026-11-24 read lib/channel/comments.ts',
    added: '2026-11-24',
  },
  {
    id: 'channel-comments-fetch',
    area: 'channel.comments',
    label: 'Fetch comments on outside posts',
    does: 'Reads the comments on the person\'s recent Facebook and Instagram posts and stores a local copy; comments removed on the platform are removed here.',
    class: 'internal',
    actors: ['person', 'owner', 'guide'],
    scope: 'person',
    hosts: [
      {
        key: 'sa:apps/arts-collective/src/lib/channel/comments.ts#refreshChannelCommentsAction',
        service: ['listChannelCommentPosts', 'listPagePostComments', 'listInstagramComments', 'listInstagramLoginComments', 'storeFetchedComments'],
        address: { app: 'arts-collective', path: '/channel/comments', how: 'Runs on opening Comments, and from Check now.' },
      },
      {
        key: 'sa:apps/arts-collective/src/lib/channel/comments.ts#refreshOnePostAction',
        service: ['getChannelCommentPost', 'storeFetchedComments'],
        address: { app: 'arts-collective', path: '/channel/comments', how: 'The Check button on one post.' },
      },
    ],
    risk: ['none'],
    verified: '2026-11-24 read lib/channel/comments.ts',
    added: '2026-11-24',
  },
];

const ignored: Area['ignored'] = [
  { key: 'sa:apps/arts-collective/src/lib/channel/actions.ts#dryRunPublishAction', why: 'Dry run: lists what publishing would do and writes nothing (despite being a server action).' },
  { key: 'sa:apps/arts-collective/src/lib/channel/actions.ts#listPublishTargetsAction', why: 'Read: lists accounts the person may post to.' },
];

export default { capabilities, ignored } satisfies Area;

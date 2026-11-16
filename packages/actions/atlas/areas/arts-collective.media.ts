// Atlas area file (2026-11-16, agent C): the Pureland game's server pieces. The broadcast, relay,
// video and recording hosts were claimed by agent B (arts-collective.studio) first.
// Hosts are the lib action files and write routes outside the hub/studio/channel/learn pages.
import type { Area, Capability } from '../types';

const capabilities: Capability[] = [
  // ---------------- media.pureland ----------------
  {
    id: 'add-pureland-member',
    area: 'media.pureland',
    label: 'Give someone access to Pureland',
    does: 'The Pureland organisation’s owners give someone access by email.',
    class: 'person',
    actors: ['owner'],
    scope: 'org',
    hosts: [
      {
        key: 'sa:apps/arts-collective/src/lib/pureland-actions.ts#addPurelandMember',
        address: {
          app: 'arts-collective',
          path: '/pureland',
          anchor: 'add-pureland-member',
          how: 'The add-by-email form in app/pureland/manage-members.tsx.',
        },
        service: ['setOrgRole'],
        note: 'raw SQL read of users by email; the write is setOrgRole',
      },
    ],
    entry: null,
    status: 'user_organizations has the row for the Pureland org with the chosen role',
    risk: ['others'],
    confirm: {
      text: 'Give {person} access to Pureland as {role}? They can sign in and play.',
      status: 'draft',
      wave: 2,
    },
    drift: 'The same setOrgRole and removeOrgMember are called from api/org/[slug]/members, the hub members panel, cms/org-people-actions and here, each with its own role check.',
    canonical: 'one server action over services setOrgRole/removeOrgMember that takes an org id and checks isOrgOwner (see sites.members capability)',
    verified: '2026-11-16 read lib/broadcast-actions.ts, relay-actions.ts, video-actions.ts, recording-actions.ts, pureland-actions.ts, go-live-access.ts and the broadcast, capture, reels, recordings and pureland routes',
  },
  {
    id: 'change-pureland-role',
    area: 'media.pureland',
    label: 'Change someone’s Pureland role',
    does: 'The Pureland owners change a member’s role.',
    class: 'person',
    actors: ['owner'],
    scope: 'org',
    hosts: [
      {
        key: 'sa:apps/arts-collective/src/lib/pureland-actions.ts#setPurelandRole',
        service: ['setOrgRole'],
        address: {
          app: 'arts-collective',
          path: '/pureland',
          anchor: 'change-pureland-role',
          how: 'The role control beside a member in app/pureland/manage-members.tsx.',
        },
      },
    ],
    entry: null,
    status: 'user_organizations has the row for the Pureland org with the chosen role',
    risk: ['others'],
    confirm: {
      text: 'Change {person}’s Pureland role to {role}? This changes what they can do there.',
      status: 'draft',
      wave: 2,
    },
    drift: 'The same setOrgRole and removeOrgMember are called from api/org/[slug]/members, the hub members panel, cms/org-people-actions and here, each with its own role check.',
    canonical: 'one server action over services setOrgRole/removeOrgMember that takes an org id and checks isOrgOwner (see sites.members capability)',
    verified: '2026-11-16 read lib/broadcast-actions.ts, relay-actions.ts, video-actions.ts, recording-actions.ts, pureland-actions.ts, go-live-access.ts and the broadcast, capture, reels, recordings and pureland routes',
  },
  {
    id: 'remove-pureland-member',
    area: 'media.pureland',
    label: 'Remove someone from Pureland',
    does: 'The Pureland owners remove a member.',
    class: 'person',
    actors: ['owner'],
    scope: 'org',
    hosts: [
      {
        key: 'sa:apps/arts-collective/src/lib/pureland-actions.ts#removePurelandMember',
        service: ['removeOrgMember'],
        address: {
          app: 'arts-collective',
          path: '/pureland',
          anchor: 'remove-pureland-member',
          how: 'The remove control beside a member in app/pureland/manage-members.tsx.',
        },
      },
    ],
    entry: null,
    status: 'no user_organizations row for the person in the Pureland org',
    risk: ['others', 'irreversible'],
    confirm: { text: 'Remove {person} from Pureland? They lose access to the game.', status: 'draft', wave: 2 },
    drift: 'The same setOrgRole and removeOrgMember are called from api/org/[slug]/members, the hub members panel, cms/org-people-actions and here, each with its own role check.',
    canonical: 'one server action over services setOrgRole/removeOrgMember that takes an org id and checks isOrgOwner (see sites.members capability)',
    verified: '2026-11-16 read lib/broadcast-actions.ts, relay-actions.ts, video-actions.ts, recording-actions.ts, pureland-actions.ts, go-live-access.ts and the broadcast, capture, reels, recordings and pureland routes',
  },
  {
    id: 'set-pureland-cloud-save',
    area: 'media.pureland',
    label: 'Turn Pureland cloud save on or off',
    does: 'A player switches on saving their game to their account (game_saves.enabled).',
    class: 'person',
    actors: ['member'],
    scope: 'person',
    hosts: [
      {
        key: 'sa:apps/arts-collective/src/lib/pureland-actions.ts#setPurelandCloudSave',
        address: {
          app: 'arts-collective',
          path: '/pureland',
          anchor: 'set-pureland-cloud-save',
          how: 'The cloud save switch (app/pureland/cloud-save-toggle.tsx)',
        },
      },
      {
        key: 'sql:apps/arts-collective/src/lib/pureland-actions.ts#setPurelandCloudSave',
        note: 'raw SQL twin of the host above',
      },
    ],
    entry: null,
    status: 'game_saves row for the person with enabled = true',
    risk: ['none'],
    confirm: {
      text: 'Turn {state} cloud saving for your Pureland game? While it is on, you can carry on from any device.',
      status: 'draft',
      wave: 2,
    },
    drift: 'Raw SQL in the action; no service function for game saves.',
    canonical: 'a services game-saves module used by this action and api/pureland/save',
    verified: '2026-11-16 read lib/broadcast-actions.ts, relay-actions.ts, video-actions.ts, recording-actions.ts, pureland-actions.ts, go-live-access.ts and the broadcast, capture, reels, recordings and pureland routes',
  },
  {
    id: 'sync-pureland-save',
    area: 'media.pureland',
    label: 'Sync a Pureland save',
    does: 'The game client PUTs its save files to the account (only while cloud save is on).',
    class: 'internal',
    actors: ['member'],
    scope: 'person',
    hosts: [
      { key: 'api:apps/arts-collective/src/app/api/pureland/save/route.ts#PUT' },
      {
        key: 'sql:apps/arts-collective/src/app/api/pureland/save/route.ts#PUT',
        note: 'raw SQL twin of the host above',
      },
    ],
    status: 'game_saves.client_saved_at advances',
    risk: ['none'],
    drift: 'Raw SQL in the route; the same table is toggled by pureland-actions.ts.',
    canonical: 'a services game-saves module',
    verified: '2026-11-16 read lib/broadcast-actions.ts, relay-actions.ts, video-actions.ts, recording-actions.ts, pureland-actions.ts, go-live-access.ts and the broadcast, capture, reels, recordings and pureland routes',
  },
  {
    id: 'log-pureland-diagnostics',
    area: 'media.pureland',
    label: 'Pureland diagnostics log',
    does: 'Appends the game client’s events to a daily log file when diagnostics is on. Rate limited, 50 MB a day.',
    class: 'system',
    actors: ['member'],
    scope: 'person',
    hosts: [
      { key: 'api:apps/arts-collective/src/app/api/pureland/log/route.ts#POST' },
    ],
    status: 'unverifiable: a log file on the server',
    risk: ['none'],
    verified: '2026-11-16 read lib/broadcast-actions.ts, relay-actions.ts, video-actions.ts, recording-actions.ts, pureland-actions.ts, go-live-access.ts and the broadcast, capture, reels, recordings and pureland routes',
  },
];

const ignored: Area['ignored'] = [
];

export default { capabilities, ignored } satisfies Area;

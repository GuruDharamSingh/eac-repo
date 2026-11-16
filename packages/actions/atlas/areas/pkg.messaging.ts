import type { Area, Capability, Host, HostKey } from '../types';

// packages/messaging: direct and group conversations and messages (used only by apps/art-auction today).
// 2026-11-16, round 3 curator (packages). Person rows are in apps.art-auction.market (message-send, message-artist,
// message-mark-read) and apps.art-auction.series (series-org-invite); these are the shared writes behind them.

const SRC = 'packages/messaging/src/server.ts';
const V = '2026-11-16 read packages/messaging/src/server.ts, apps/art-auction app/messages/actions.ts';
const sql = (fn: string): HostKey => `sql:${SRC}#${fn}` as HostKey;
const h = (fn: string, service: string[], note?: string): Host => ({ key: sql(fn), service, ...(note ? { note } : {}) });
const MKT = 'apps.art-auction.market';

const capabilities: Capability[] = [
  {
    id: 'pkg-messaging-conversation',
    area: 'messaging.conversations',
    label: 'Find or start a conversation',
    does: 'getOrCreateDirectConversation finds the two-person conversation (optionally per context) or creates it with both participants; startConversation creates a group conversation with a participant list and an optional opening message in one transaction.',
    class: 'internal',
    actors: ['person'],
    scope: 'other',
    hosts: [
      h('getOrCreateDirectConversation', ['messaging#getOrCreateDirectConversation'], 'No gate: both user ids come from the caller; find then insert, no transaction.'),
      h('startConversation', ['messaging#startConversation'], 'No gate: participants and the opening message\'s senderId come from the caller; one transaction.'),
    ],
    status: 'a conversation row with conversation_participant rows',
    risk: ['others', 'emails'],
    drift: `backs ${MKT}:message-artist (messageArtistAction, direct) and apps.art-auction.series:series-org-invite (addOrgAction starts a group conversation with the invited org\'s owners).`,
    canonical: 'packages/messaging server.ts#getOrCreateDirectConversation',
    open: 'SECURITY: (1) getOrCreateDirectConversation is find-then-insert outside a transaction, so two near-simultaneous first messages create two conversations for the same pair and context. (2) startConversation does not require the creator to be one of the participants and takes the opening message\'s senderId from the caller, so the function can open a conversation between two other people with a message "from" a chosen sender; only art-auction\'s addOrgAction calls it and passes the editor. (3) No block, mute or consent model: any signed-in person can open a conversation with any account (messageArtistAction targets an artist, but the package would accept any user id). (4) No cap on participants or on subject length.',
    verified: V,
  },
  {
    id: 'pkg-messaging-message-send',
    area: 'messaging.conversations',
    label: 'Post a message in a conversation',
    does: 'In one transaction checks the sender is a participant, inserts the message, bumps last_message_at and marks it read for the sender.',
    class: 'internal',
    actors: ['person'],
    scope: 'other',
    hosts: [h('sendMessage', ['messaging#sendMessage'], 'Gate: the sender must be a participant (checked inside the transaction). Empty body refused.')],
    status: 'a message row for the conversation by the sender',
    risk: ['others'],
    drift: `backs ${MKT}:message-send (sendMessageAction) and ${MKT}:message-artist (messageArtistAction, the opening message).`,
    canonical: 'packages/messaging server.ts#sendMessage',
    open: 'GOOD: participant check and insert in one transaction. SECURITY (low): no length cap on the body, no rate limit; the body is stored as plain text and must be escaped where read. Nothing here emails the other participants (notification, if any, is the caller\'s).',
    verified: V,
  },
  {
    id: 'pkg-messaging-mark-read',
    area: 'messaging.conversations',
    label: 'Mark a conversation read',
    does: 'Sets the participant\'s last_read_at to now.',
    class: 'system',
    actors: ['person'],
    scope: 'person',
    hosts: [h('markConversationRead', ['messaging#markConversationRead'], 'UPDATE WHERE conversation_id AND user_id: only the caller\'s own participant row.')],
    status: 'conversation_participant.last_read_at moved',
    risk: ['none'],
    drift: `backs ${MKT}:message-mark-read (markReadAction), which is also called as the conversation page renders (app/messages/[id]/page.tsx).`,
    canonical: 'packages/messaging server.ts#markConversationRead',
    open: 'A write on GET render of a conversation page (opening it marks it read, expected).',
    verified: V,
  },
];

const area: Area = { capabilities, ignored: [] };
export default area;

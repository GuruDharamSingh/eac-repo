import type { Area, Capability, Host, HostKey, Risk, Actor } from '../types';

// art-auction, auction series: the series workspace (/series/[slug]/manage), the admin series desk (/admin/series),
// the public series page (follow, reply, invitations) and the studio "attach a publication" form. 2026-11-16, agent G.
// Conventions: atlas/JOURNAL.md. Most hosts come in pairs: the workspace action and an admin-page copy of the same
// service call. Series editor = owner of the series org, an editor member, or a network admin (canEditSeries).
// The series payout and payment-confirm steps are in apps.art-auction.{admin,studio}.ts.

const APP = 'art-auction';
const SRC = 'apps/art-auction/src/';
const V = '2026-11-16 read app/series/[slug]/{actions,manage/actions,manage/orders/actions}.ts, admin/series/actions.ts, studio/series/actions.ts, packages/commerce server/series.ts, auction-clock.ts';
const sa = (p: string, fn: string): HostKey => `sa:${SRC}${p}#${fn}` as HostKey;
const api = (p: string, m: string): HostKey => `api:${SRC}${p}#${m}` as HostKey;
const SM = 'app/series/[slug]/manage/actions.ts';
const AS = 'app/admin/series/actions.ts';
const PAN = 'the panel in app/series/[slug]/manage/panels.tsx';
const ADP = 'the series desk panel (app/admin/series/series-panels.tsx)';
const h = (key: HostKey, service: string[], path: string, how: string, note?: string): Host => ({ key, service, address: { app: APP, path, how }, note });
const ED = 'Gate: canEditSeries inside the service call (the action only needs a signed-in person).';

function cap(c: {
  id: string; label: string; does: string; hosts: Host[]; status: string; risk: Risk[]; text: string;
  actors?: Actor[]; drift?: string; canonical?: string; open?: string; inputs?: string; scope?: Capability['scope'];
}): Capability {
  return {
    id: c.id, area: 'art-auction.series', label: c.label, does: c.does, class: 'person',
    actors: c.actors ?? ['guide'], scope: c.scope ?? 'series', hosts: c.hosts, entry: null, status: c.status,
    risk: c.risk, confirm: { text: c.text, status: 'draft', wave: 4 }, inputs: c.inputs, drift: c.drift,
    canonical: c.canonical, open: c.open, verified: V,
  };
}

const capabilities: Capability[] = [
  {
    id: 'series-create', area: 'art-auction.series', label: 'Create an auction series',
    does: 'An owner of the marketplace organisation or a network admin creates a new auction series with a title.',
    class: 'admin', actors: ['owner', 'admin'], scope: 'series',
    hosts: [h(sa(AS, 'createSeriesAction'), ['@elkdonis/commerce/server#createSeries'], '/admin/series', `the New series form on ${ADP}`, 'Gate: canCreateSeries (owner of the market org or admin) inside createSeries; the action only checks sign-in.')],
    risk: ['public'], drift: 'Single copy.', verified: V,
  },
  cap({
    id: 'series-save', label: "Save a series' details",
    does: "Saves a series' title, description, schedule (silent open, live time, close mode, stagger), page content and presenting organisation. The series clock then moves its lots.",
    hosts: [
      h(sa(SM, 'saveSeriesAction'), ['@elkdonis/commerce/server#updateSeries', '@elkdonis/commerce/server#syncSeriesThread'], '/series/{slug}/manage/rules', `the Save button in ${PAN} and the page editor (app/series/[slug]/page-editor.tsx)`, ED),
      h(sa(AS, 'updateSeriesAction'), ['@elkdonis/commerce/server#updateSeries'], '/admin/series/{id}', `the Save button on ${ADP}`, ED + ' The admin copy does not sync the forum thread.'),
    ],
    status: 'the auction_series row holds the new values',
    risk: ['public', 'money'],
    text: 'Save the changes to the series “{title}”? If it is published, visitors see them, and changed times move the closing time of every lot in it.',
    drift: "Same updateSeries service; the workspace copy also syncs the series' forum thread, the admin copy does not (thread title can drift).",
    canonical: '@elkdonis/commerce/server#updateSeries with syncSeriesThread inside it',
    open: 'The series clock (applySeriesSchedule) rewrites start_at/end_at of every scheduled or live lot in the series within 30 s of a schedule change, including lots with bids. See bid-place open: this is also what reverts soft-close extensions.',
  }),
  cap({
    id: 'series-status-set', label: 'Publish or close a series',
    does: 'Sets a series to draft, published or closed. Publishing opens its discussion thread; closing stops the series clock from changing its lots.',
    hosts: [
      h(sa(SM, 'setStatusAction'), ['@elkdonis/commerce/server#setSeriesStatus', '@elkdonis/commerce/server#ensureSeriesThread'], '/series/{slug}/manage', 'the status buttons in the workspace header (app/series/[slug]/manage/workspace-chrome.tsx)', ED),
      h(sa(AS, 'setSeriesStatusAction'), ['@elkdonis/commerce/server#setSeriesStatus'], '/admin/series/{id}', `the status select on ${ADP}`, ED + ' No thread is opened.'),
    ],
    status: 'auction_series.status holds the new value',
    risk: ['public', 'money'],
    text: 'Set the series “{title}” to {status}? Publishing makes it visible to everyone and opens its auctions on schedule.',
    drift: 'Admin copy never creates the forum thread; workspace copy does.',
    open: 'setSeriesStatus is an unconditional UPDATE: no allowed-transition rule, so a closed series can go back to draft or published, and unpublishing a series does not touch its running lots.',
  }),
  cap({
    id: 'series-week-save', label: 'Save a week of a series',
    does: "Saves a week's title, focus, brief, colour and question on the series page.",
    hosts: [
      h(sa(SM, 'saveWeekAction'), ['@elkdonis/commerce/server#saveWeek'], '/series/{slug}/manage/weeks', `the week editor in ${PAN}`, ED),
      h(sa(AS, 'setWeekFocusAction'), ['@elkdonis/commerce/server#setWeekFocus'], '/admin/series/{id}', `the focus fields on ${ADP}`, ED + ' Saves focus, title and brief only.'),
    ],
    status: 'the week slot row holds the new values', risk: ['public'],
    text: 'Save week {week} of “{title}”? If the series is published, visitors see it.',
    drift: 'Two services: saveWeek (workspace, all fields) and setWeekFocus (admin, three fields).',
    canonical: '@elkdonis/commerce/server#saveWeek',
  }),
  cap({
    id: 'series-lot-create', label: 'Add a new lot to a series',
    does: 'The series desk creates a piece (for a named or chosen artist, proceeds to the artist or donated) and a lot for it in the series in one step.',
    hosts: [h(sa(SM, 'addLotAction'), ['@elkdonis/commerce/server#addSeriesLot'], '/series/{slug}/manage/lots', `the Add lot form in ${PAN}`, ED)],
    status: 'an artwork and an auction_lot with series_id exist for the title', risk: ['money', 'public'],
    text: 'Add “{title}” as lot {lot} of “{series}”, starting at {price}? It goes up for auction when the series opens, and the proceeds go to {person} or are donated as you chose.',
    open: "Starting bid and reserve come from the client in major units and are converted server-side; reserve against start is checked by the service (not re-read). The artist can be a typed name with no account (a lot with no maker), so the money line is the org's.",
    inputs: 'artist, proceeds, title, details, images, estimate, starting bid, reserve, buy-now, week, lot number',
  }),
  cap({
    id: 'series-listing-add', label: "Put an artist's listing into a series",
    does: 'The series desk takes a published piece an artist already lists and puts it up for auction in the series.',
    hosts: [h(sa(SM, 'addListingAction'), ['@elkdonis/commerce/server#addListingToSeries'], '/series/{slug}/manage/lots', `the From listings picker in ${PAN}`, ED + " The service also requires the piece to be a person's listing in the series marketplace.")],
    status: 'an auction_lot for the artwork with series_id exists', risk: ['money', 'public'],
    text: 'Put “{title}” by {person} up for auction in “{series}”, starting at {price}? They will see it in their art and can withdraw it before bids.',
    inputs: 'artwork, starting bid, reserve, buy-now, lot number, week',
  }),
  cap({
    id: 'series-lot-attach', label: 'Attach an open lot to a series',
    does: 'Puts an existing scheduled or live lot into a series under the next lot number; the series clock then sets its start and end.',
    hosts: [
      h(sa(SM, 'attachOpenLotAction'), ['@elkdonis/commerce/server#addLotToSeries'], '/series/{slug}/manage/lots', `the Attach open lot control in ${PAN}`, ED),
      h(sa(AS, 'addLotToSeriesAction'), ['@elkdonis/commerce/server#addLotToSeries'], '/admin/series/{id}', `the lot id field on ${ADP}`, ED),
    ],
    status: 'auction_lot.series_id = the series', risk: ['money'],
    text: "Attach the auction “{title}” to “{series}”? Its opening and closing times will follow the series' schedule.",
    drift: 'Same service from the workspace and the admin desk.',
    open: "SECURITY / CORRECTNESS: addLotToSeries only checks that the actor can edit the series, not that they may act for the lot's own store. Any series editor who knows a lot id can attach another seller's open lot, even one that already has bids, and attachLot then applies the series clock, which overwrites its start and end time and lot number. The workspace picks from a list but the action takes any id. Consider requiring the seller's consent or limiting to lots without bids.",
  }),
  cap({
    id: 'series-lot-remove', label: 'Take a lot out of a series',
    does: 'Detaches a lot from the series. A lot an artist entered into the series themselves is withdrawn (cancelled) unless it has bids.',
    hosts: [
      h(sa(SM, 'removeLotAction'), ['@elkdonis/commerce/server#removeLotFromSeries'], '/series/{slug}/manage/lots', `the Remove control on a lot in ${PAN}`, ED),
      h(sa(AS, 'removeLotFromSeriesAction'), ['@elkdonis/commerce/server#removeLotFromSeries'], '/admin/series/{id}', `the Remove control on ${ADP}`, ED),
    ],
    status: 'auction_lot.series_id is null (or status cancelled)', risk: ['money', 'public'],
    text: 'Take “{title}” out of “{series}”? If the artist entered it themselves, the auction is withdrawn.',
    open: 'GOOD: lot locked FOR UPDATE; an entered lot with bids is refused. A lot not entered by the artist that has bids is only detached and keeps running on its own clock.',
  }),
  cap({
    id: 'series-lots-renumber', label: 'Reorder the lots of a series',
    does: 'Renumbers the lots of a series in the order given, which sets the staggered closing order.',
    hosts: [
      h(sa(SM, 'renumberLotsAction'), ['@elkdonis/commerce/server#renumberSeriesLots'], '/series/{slug}/manage/lots', `the drag handles of the lot list in ${PAN}`, ED),
      h(sa(AS, 'renumberSeriesLotsAction'), ['@elkdonis/commerce/server#renumberSeriesLots'], '/admin/series/{id}', `the lot order list on ${ADP}`, ED),
    ],
    status: 'auction_lot.lot_number follows the saved order', risk: ['money', 'public'],
    text: 'Save this lot order for “{series}”? In a staggered close, lots finish in this order and their closing times change.',
    open: 'The clock rewrites end times from lot_number, including for lots with bids.',
  }),
  cap({
    id: 'series-editor-add', label: 'Add an editor or contributor to a series',
    does: 'Gives a person with an account a role on the series: editor (full control) or contributor (can submit pieces).',
    hosts: [
      h(sa(SM, 'addMemberAction'), ['@elkdonis/commerce/server#setSeriesMemberById'], '/series/{slug}/manage/team', `the people search and Add button in ${PAN}`, ED),
      h(sa(AS, 'setSeriesMemberAction'), ['@elkdonis/commerce/server#setSeriesMember'], '/admin/series/{id}', `the add-by-email form on ${ADP}`, ED + ' By email.'),
    ],
    status: 'an auction_series_member row for the person and series exists', actors: ['owner', 'admin'], risk: ['others', 'money'],
    text: 'Make {person} an {role} of “{series}”? An editor can change the series, its lots and its orders, and add other editors.',
    drift: 'Workspace adds by id from a search; admin adds by email and answers "No account with that email" (reveals whether an email has an account).',
    open: 'An editor can add another editor, so the role is as strong as ownership for everything except series creation and payouts. The person need not belong to the series org.',
  }),
  cap({
    id: 'series-editor-remove', label: 'Remove a person from a series team',
    does: 'Removes an editor or contributor from the series.',
    hosts: [
      h(sa(SM, 'removeMemberAction'), ['@elkdonis/commerce/server#removeSeriesMember'], '/series/{slug}/manage/team', `the Remove control in ${PAN}`, ED),
      h(sa(AS, 'removeSeriesMemberAction'), ['@elkdonis/commerce/server#removeSeriesMember'], '/admin/series/{id}', `the Remove control on ${ADP}`, ED),
    ],
    status: 'the auction_series_member row is gone', actors: ['owner', 'admin'], risk: ['others'],
    text: 'Remove {person} from the team of “{series}”? They lose their access straight away.',
    open: 'Any editor can remove any other editor, including the one who added them (no last-editor protection; org owners and admins keep access through canEditSeries).',
  }),
  cap({
    id: 'series-week-item-add', label: 'Add a publication to a week',
    does: 'Adds a post (thread) to a week of the series page, from the desk\'s own or another\'s published posts.',
    hosts: [h(sa(SM, 'addWeekItemAction'), ['@elkdonis/commerce/server#addWeekItem'], '/series/{slug}/manage/weeks', `the Add to week control in ${PAN} and the page editor (page-editor.tsx)`, ED)],
    status: 'an auction_series_slot item for the thread and week exists', risk: ['public'],
    text: 'Add “{title}” to week {week} of “{series}”? Visitors of the series page will see it.',
  }),
  cap({
    id: 'series-week-item-remove', label: 'Remove a publication from a week',
    does: 'Removes a post from a week of the series page.',
    hosts: [h(sa(SM, 'removeWeekItemAction'), ['@elkdonis/commerce/server#removeWeekItem'], '/series/{slug}/manage/weeks', `the Remove control in ${PAN}`, ED)],
    status: 'the slot row is gone', risk: ['public'],
    text: 'Take this post out of week {week} of “{series}”?',
  }),
  cap({
    id: 'series-week-item-approve', label: 'Approve a submitted publication',
    does: 'Approves a post a contributor submitted so it shows on the series page.',
    hosts: [h(sa(SM, 'approveWeekItemAction'), ['@elkdonis/commerce/server#approveWeekItem'], '/series/{slug}/manage/weeks', `the Approve button in ${PAN}`, ED)],
    status: 'the slot row is approved', risk: ['public'],
    text: 'Approve “{title}” for week {week} of “{series}”? Visitors will see it.',
  }),
  cap({
    id: 'series-week-featured-set', label: 'Choose the featured pieces of a week',
    does: 'Sets which artworks are featured in a week of the series.',
    hosts: [h(sa(SM, 'setWeekFeaturedAction'), ['@elkdonis/commerce/server#setWeekFeatured'], '/series/{slug}/manage/weeks', `the Featured pieces picker in ${PAN}`, ED)],
    status: 'auction_series_slot_artwork rows for the week match', risk: ['public'],
    text: 'Feature these pieces in week {week} of “{series}”? Visitors will see them first.',
  }),
  cap({
    id: 'series-submit-own-piece', label: 'Submit your own piece to a series',
    does: 'A contributor or artist submits one of their own posts to a week of a series for approval.',
    actors: ['person'],
    hosts: [h(sa(SM, 'submitOwnPieceAction'), ['@elkdonis/commerce/server#submitOwnPiece'], '/series/{slug}', 'the Submit control of the series page (app/series/[slug]/page-editor.tsx)', 'Gate: inside submitOwnPiece (the person must take part in the series).')],
    status: 'a slot row for the thread exists, awaiting approval', risk: ['public'],
    text: 'Submit “{title}” to week {week} of “{series}”? The series team approves it before anyone sees it.',
  }),
  cap({
    id: 'series-org-invite', label: 'Invite an organisation to a series',
    does: 'Adds an organisation to a series. If the person does not run that organisation, its owners get a conversation in the marketplace inbox and an email asking them to accept.',
    hosts: [h(sa(SM, 'addOrgAction'), ['@elkdonis/commerce/server#addSeriesOrg', '@elkdonis/messaging/server#startConversation', '@elkdonis/commerce/server#emailSeriesOrgInvitation'], '/series/{slug}/manage/orgs', 'the Add organisation control (app/series/[slug]/manage/orgs/orgs-panel.tsx)', ED)],
    status: 'an auction_series_org row for the org exists (status invited or accepted)', risk: ['emails', 'others'],
    text: 'Invite {org} to take part in “{series}”? Its owners get a message and an email asking them to accept.',
    open: 'Any series editor can message and email the owners of any organisation on the network (searchOrgs lists all orgs); no rate limit seen. The email body was not read.',
  }),
  cap({
    id: 'series-org-remove', label: 'Remove an organisation from a series',
    does: 'Removes a participating organisation from the series.',
    hosts: [h(sa(SM, 'removeOrgAction'), ['@elkdonis/commerce/server#removeSeriesOrg'], '/series/{slug}/manage/orgs', 'the Remove control (app/series/[slug]/manage/orgs/orgs-panel.tsx)', ED)],
    status: 'the auction_series_org row is gone', risk: ['others'],
    text: 'Remove {org} from “{series}”? It will no longer show as a partner.',
  }),
  cap({
    id: 'series-invitation-decide', label: 'Accept or decline a series invitation',
    does: 'An owner of an invited organisation accepts or declines taking part in a series.',
    actors: ['owner'], scope: 'org',
    hosts: [h(sa('app/series/[slug]/actions.ts', 'decideInvitationAction'), ['@elkdonis/commerce/server#decideSeriesOrg'], '/series/{slug}/invitations', 'the Accept / Decline buttons (app/series/[slug]/invitations/invitation-list.tsx)', 'Gate: inside decideSeriesOrg (owner of the org); the action checks sign-in only.')],
    status: 'the auction_series_org row is accepted or declined', risk: ['others', 'public'],
    text: 'Accept the invitation for {org} to take part in “{series}”? {org} will show as a partner and the series can show work from its media folder.',
  }),
  cap({
    id: 'series-follow', label: 'Follow a series',
    does: 'Follows or unfollows a published series.', actors: ['person'], scope: 'person',
    hosts: [h(sa('app/series/[slug]/actions.ts', 'followSeriesAction'), ['@elkdonis/commerce/server#setSeriesFollow'], '/series/{slug}', 'the Follow button (app/series/[slug]/series-social.tsx)')],
    status: 'a series follow row for the person exists', risk: ['none'],
    text: 'Follow “{title}”? You will see its news. Only you see who you follow.',
  }),
  cap({
    id: 'series-reply', label: 'Post in a series discussion',
    does: 'Posts a comment or reply in the discussion of a published series.', actors: ['person'], scope: 'thread',
    hosts: [h(sa('app/series/[slug]/actions.ts', 'replySeriesAction'), ['@elkdonis/commerce/server#postSeriesReply'], '/series/{slug}', 'the discussion box (app/series/[slug]/series-social.tsx)')],
    status: 'a post row in the series thread by the person exists', risk: ['public', 'others'],
    text: 'Post your comment on “{title}”? Everyone who can see the series will see it.',
    open: 'Spam control (rate, length) lives in postSeriesReply and was not read.',
  }),
  cap({
    id: 'series-order-handover', label: 'Record how a series order is handed over',
    does: 'The series desk records how a sold lot reaches the buyer (pick-up, local delivery, or a tracked courier).',
    hosts: [h(sa('app/series/[slug]/manage/orders/actions.ts', 'setHandoverAction'), ['@elkdonis/commerce/server#setSeriesOrderHandover'], '/series/{slug}/manage/orders', 'the hand-over selector of the series orders panel (app/series/[slug]/manage/orders/orders-panel.tsx)', ED)],
    status: 'the order carries the handover method', risk: ['emails'],
    text: 'Record the hand-over of order {order} as {method}? The buyer sees it on their order page.',
  }),
  cap({
    id: 'series-order-received', label: 'Mark a series order as received',
    does: 'The series desk records that the buyer has received the piece.',
    hosts: [h(sa('app/series/[slug]/manage/orders/actions.ts', 'setReceivedAction'), ['@elkdonis/commerce/server#setSeriesOrderReceived'], '/series/{slug}/manage/orders', 'the Received toggle of the series orders panel (app/series/[slug]/manage/orders/orders-panel.tsx)', ED)],
    status: 'the order is marked received', risk: ['none'],
    text: 'Mark order {order} as received by the buyer?',
  }),
  cap({
    id: 'series-publication-attach', label: 'Attach a post to a series from the studio',
    does: 'A person who takes part in a series attaches one of their own posts to a week of it.',
    actors: ['person'],
    hosts: [h(sa('app/studio/series/actions.ts', 'attachPublicationAction'), ['@elkdonis/commerce/server#attachPublication'], '/studio/series', 'the attach form (app/studio/series/attach-form.tsx)', 'Gate: canParticipateInSeries inside attachPublication.')],
    status: 'a slot row for the thread exists', risk: ['public'],
    text: 'Attach “{title}” to “{series}”? The series team may show it on the series page.',
  }),
  cap({
    id: 'series-publication-detach', label: 'Detach a post from a series',
    does: "Removes one of the person's posts from a series slot.", actors: ['person'],
    hosts: [h(sa('app/studio/series/actions.ts', 'detachPublicationAction'), ['@elkdonis/commerce/server#detachPublication'], '/studio/series', 'the detach control (app/studio/series/attach-form.tsx)')],
    status: 'the slot row is gone', risk: ['public'],
    text: 'Take “{title}” off “{series}”?',
  }),
  {
    id: 'series-media-upload', area: 'art-auction.series', label: 'Upload series page media',
    does: "Stores a series hero image or video or a card image in the uploader's public media folder. Series editors only.",
    class: 'internal', actors: ['guide'], scope: 'series',
    hosts: [h(api('app/api/series/media/route.ts', 'POST'), ['@elkdonis/commerce/server#canEditSeries', '@elkdonis/services#uploadFile', '@elkdonis/utils#validateUploadBuffer'], '/api/series/media', 'no visible control: the hero picker in the series page editor posts here (app/series/[slug]/page-editor.tsx)', ED)],
    risk: ['public'], drift: 'Same shape as artwork-image-upload and about-media-upload.',
    open: 'Files are stored WITHOUT a Private segment, so /api/media serves them to anyone: anything uploaded is public by design. 25 MB image / 250 MB video caps; bytes are checked.',
    verified: V,
  },
];

export default {
  capabilities,
  ignored: [
    { key: sa(SM, 'searchPeopleAction'), why: 'Read: people search for the team picker.' },
    { key: sa(SM, 'searchRepostableAction'), why: 'Read: searches posts that can be added to a week.' },
    { key: sa(SM, 'collectiveArtistsAction'), why: 'Read: lists collective artists.' },
    { key: sa(SM, 'listLibrariesAction'), why: 'Read: lists media libraries.' },
    { key: sa(SM, 'listLibraryItemsAction'), why: 'Read: lists items of a media library.' },
    { key: sa(SM, 'listArtistListingsAction'), why: "Read: lists an artist's listings." },
    { key: sa(SM, 'searchOrgsAction'), why: 'Read: organisation search for the invite box.' },
  ],
} satisfies Area;

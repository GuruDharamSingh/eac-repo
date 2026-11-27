// Atlas area file (2026-11-24): the market's store course, "Finish your store", done in the dock on
// market.arts-collective.com. Both entries run through the market's dock door
// (apps/art-auction/src/lib/dock-actions.ts runDockAction → performAction), so each claims that host
// with its own case; the door itself is claimed with case 'door' on run-registry-action.
// Plan: docs/open/MARKET_CENTER_AND_DOCK_2026-11-24.md. Conventions: atlas/JOURNAL.md.
import type { Area, Capability, HostKey } from '../types';

const DOOR: HostKey = 'sa:apps/art-auction/src/lib/dock-actions.ts#runDockAction';

const capabilities: Capability[] = [
  {
    id: 'store-front',
    area: 'art-auction.store',
    label: 'Write the store front description',
    does: "Saves two or three lines of plain text as the description of the person's own market store (store.bio_html, as paragraphs). Leaves the network profile alone.",
    class: 'person',
    actors: ['signed-in'],
    scope: 'person',
    hosts: [
      {
        key: DOOR,
        case: 'store-front',
        service: ['performAction(store-front)', '@elkdonis/commerce/server#updateStore'],
        address: { app: 'art-auction', path: '/studio', how: 'step 1 of Finish your store, in the dock (module form store-front)' },
        note: 'Runner in packages/actions/src/server/run.ts; status check in server/status.ts.',
      },
    ],
    entry: 'store-front',
    status: "store.bio_html of the person's market store (owner_user_id, org market) is not empty",
    risk: ['public'],
    confirm: { text: 'Save this description on your store? It shows at the top of your store page.', status: 'draft', wave: 5 },
    inputs: 'the description, plain text up to 1,200 characters',
    drift: "Same store column as market-store-profile-save (the store details form), which also writes the network profile; this one writes the store's description only.",
    open: "Org stores are left out on purpose (the runner looks up owner_user_id only).",
    verified: '2026-11-24 written; check-types',
    added: '2026-11-24',
  },
  {
    id: 'ship-from',
    area: 'art-auction.shipping',
    label: 'Save where you ship from, from the dock',
    does: "Saves the person's ship-from address (users.ship_from) through commerce's setShipFrom: name on the label, street, city, region, postal code, two-letter country and phone; the email is the account's own.",
    class: 'person',
    actors: ['signed-in'],
    scope: 'person',
    hosts: [
      {
        key: DOOR,
        case: 'ship-from',
        service: ['performAction(ship-from)', '@elkdonis/commerce/shipping#setShipFrom'],
        address: { app: 'art-auction', path: '/studio', how: 'step 2 of Finish your store, in the dock (generic form fields)' },
        note: 'Runner in packages/actions/src/server/run.ts; status check in server/status.ts.',
      },
    ],
    entry: 'ship-from',
    status: "users.ship_from is set for the person",
    risk: ['none'],
    confirm: { text: 'Save this as your ship-from address? It is private: only the city shows, and couriers quote and label from it.', status: 'draft', wave: 5 },
    inputs: 'name on the label, street, city, province or state, postal code, country (two letters), phone',
    drift: 'Same service as ship-from-save (the Shipping form on /studio/profile).',
    verified: '2026-11-24 written; check-types',
    added: '2026-11-24',
  },
];

const ignored: Area['ignored'] = [];

export default { capabilities, ignored } satisfies Area;

import type { Area, Capability } from '../types';

const capabilities: Capability[] = [
  // ---------------- orgapps.dictionary ----------------
  {
    id: 'dictionary-term-define',
    area: 'orgapps.dictionary',
    label: 'Define a term in the network dictionary',
    does: 'Adds a definition for a term to the network-wide dictionary (the wiki). If the term is new it becomes a page every org can read and edit.',
    class: 'person',
    actors: ['member', 'guide', 'owner'],
    scope: 'other',
    hosts: [
      {
        key: 'sa:apps/sunjay/src/lib/dictionary-actions.ts#defineTermAction',
        service: ['@elkdonis/services#defineTerm'],
        address: { app: 'sunjay', path: '/hub', how: 'the define-term surface in the editor / reading view' },
      },
      {
        key: 'sa:apps/amrit-canada/src/lib/dictionary-actions.ts#defineTermAction',
        service: ['@elkdonis/services#defineTerm'],
        address: { app: 'amrit-canada', path: '/hub', how: 'the define-term surface in the editor / reading view' },
      },
      {
        key: 'sa:apps/elktours/src/lib/dictionary-actions.ts#defineTermAction',
        service: ['@elkdonis/services#defineTerm'],
        address: { app: 'elktours', path: '/hub', how: 'the define-term surface in the editor / reading view' },
      },
      {
        key: 'sa:apps/fourthwayBookreaders/src/lib/dictionary-actions.ts#defineTermAction',
        service: ['@elkdonis/services#defineTerm'],
        address: {
          app: 'fourthwayBookreaders',
          path: '/hub',
          how: 'the define-term surface in the editor / reading view',
        },
      },
    ],
    entry: null,
    status: 'a dictionary definition by this person for the term exists (getTermDefinitions)',
    risk: ['public', 'others'],
    confirm: {
      text: 'Add your definition of “{title}” to the network dictionary? Every organisation on the network can read and edit it.',
      status: 'draft',
      wave: 3,
    },
    inputs: 'term, definition, sourceThreadId',
    drift: 'None: four byte-identical files, gate requireOrgMember (any member-or-above role, deliberately looser than requireOrgEditor because the wiki is network-wide). Arts-collective has its own dictionary path (other agents).',
    canonical: 'services defineTerm via one shared org-site kit action using requireOrgMember.',
    open: 'Network-wide writes from any org member: confirm that this bar (membership of any one org) is intended for a wiki every org edits.',
    verified: '2026-11-16 read/diffed {sunjay,amrit-canada,elktours,fourthwayBookreaders}/src/lib/dictionary-actions.ts (all md5 bf9f924d, byte-identical)',
  },
];

const ignored: Area['ignored'] = [
  { key: 'sa:apps/sunjay/src/lib/dictionary-actions.ts#lookupTermAction', why: 'read: looks a term up' },
  { key: 'sa:apps/amrit-canada/src/lib/dictionary-actions.ts#lookupTermAction', why: 'read: looks a term up' },
  { key: 'sa:apps/elktours/src/lib/dictionary-actions.ts#lookupTermAction', why: 'read: looks a term up' },
  { key: 'sa:apps/fourthwayBookreaders/src/lib/dictionary-actions.ts#lookupTermAction', why: 'read: looks a term up' },
];

export default { capabilities, ignored } satisfies Area;

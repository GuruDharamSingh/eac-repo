import type { Area, Capability } from '../types';

const capabilities: Capability[] = [
  // ---------------- orgapps.questionnaires ----------------
  {
    id: 'questionnaire-create',
    area: 'orgapps.questionnaires',
    label: 'Create a questionnaire or poll',
    does: "Creates a questionnaire or poll for the org with its fields and optional closing date. A poll shows its tally to respondents; a questionnaire's results go to admins.",
    class: 'person',
    actors: ['owner', 'guide'],
    scope: 'org',
    hosts: [
      {
        key: 'sa:apps/sunjay/src/lib/cms/questionnaire-actions.ts#createQuestionnaireAction',
        service: ['@elkdonis/services#canManageQuestionnaires', '@elkdonis/services#createOrgQuestionnaire'],
        address: {
          app: 'sunjay',
          path: '/manage/compose',
          how: 'questionnaire composer (components/manage/questionnaire-composer-body.tsx)',
        },
      },
      {
        key: 'sa:apps/amrit-canada/src/lib/cms/questionnaire-actions.ts#createQuestionnaireAction',
        service: ['@elkdonis/services#canManageQuestionnaires', '@elkdonis/services#createOrgQuestionnaire'],
        address: { app: 'amrit-canada', path: '/manage/compose', how: 'questionnaire composer' },
      },
      {
        key: 'sa:apps/elktours/src/lib/cms/questionnaire-actions.ts#createQuestionnaireAction',
        service: ['@elkdonis/services#canManageQuestionnaires', '@elkdonis/services#createOrgQuestionnaire'],
        address: { app: 'elktours', path: '/manage/compose', how: 'questionnaire composer' },
      },
      {
        key: 'sa:apps/innergathering/src/lib/cms/questionnaire-actions.ts#createQuestionnaireAction',
        service: ['@elkdonis/services#canManageQuestionnaires', '@elkdonis/services#createOrgQuestionnaire'],
        address: { app: 'innergathering', path: '/manage/compose', how: 'questionnaire composer' },
      },
      {
        key: 'sa:apps/ifac/src/lib/cms/questionnaire-actions.ts#createQuestionnaireAction',
        service: ['@elkdonis/auth-server#getServerSession', '@elkdonis/services#createOrgQuestionnaire'],
        address: {
          app: 'ifac',
          path: '/hub',
          how: 'questionnaire composer (components/hub/questionnaire-composer.tsx)',
        },
        note: 'gate is canManageIfac, not canManageQuestionnaires',
      },
      {
        "key": "sa:apps/arts-collective/src/lib/cms/questionnaire-actions.ts#createQuestionnaireAction",
        "service": [
          "canManageQuestionnaires",
          "createOrgQuestionnaire"
        ],
        "address": {
          "app": "arts-collective",
          "path": "/hub/organization?org={org}",
          "surface": "compose",
          "anchor": "questionnaire-create",
          "how": "The questionnaire / poll composer (components/cms/questionnaire-composer.tsx) from the Create dialog."
        }
      },
    ],
    entry: null,
    status: 'an org_questionnaires row for the org with the title exists and status is open',
    risk: ['public'],
    confirm: {
      text: 'Create the {kind} “{title}” for {org}? People you share it with can answer it.',
      status: 'draft',
      wave: 3,
    },
    inputs: 'title, description, fields[], kind (questionnaire|poll), closesAt',
    drift: "sunjay, amrit-canada, elktours, innergathering are byte-identical (md5 9ec43c6c): requireOrgEditor redirect, then canManageQuestionnaires (hasOrgRole owner|guide), then createOrgQuestionnaire with resultsVisibility respondents for polls else admins, revalidatePath /manage. ifac differs: no requireOrgEditor; uses getServerSession and canManageIfac (lib/data.ts), which returns true for (1) anyone whose email is in siteConfig.ownerEmails, (2) a global admin, (3) an owner/guide row. Same resultsVisibility, but it revalidates /hub. The ifac comments saying the allowlist is the only administrator path are stale: ifac now has 2 owners and 4 guides.\nMerged 2026-11-16 (consolidation 2): 2 rows, 2 apps (sunjay, arts-collective). Differences by app:\n- arts-collective (was create-questionnaire): Same file copied into elktours and amrit-canada (lib/cms/questionnaire-actions.ts); all call createOrgQuestionnaire.",
    canonical: 'services createOrgQuestionnaire behind a single shared org-site kit action that does viewer + canManageQuestionnaires; ifac converges once the ownerEmails and global-admin branches of canManageIfac are dropped (owners are seeded: 2 owners, 4 guides).',
    open: "ifac’s gate is broader than the others: an email on siteConfig.ownerEmails, or any of the 4 global admins, passes without an ifac role, although ifac now has 2 owners and 4 guides. See docs/open/mcp-foundations/ATLAS_SECURITY_2026-11-16.md finding 4: drop the email and isAdmin branches of canManageIfac (apps/ifac/src/lib/data.ts:120-125, config/site.ts:10), or gate the questionnaire on hasOrgRole(['owner','guide']), and fix the stale comments. Fix waits on Justin.",
    verified: '2026-11-16 read/diffed {sunjay,amrit-canada,elktours,innergathering,ifac}/src/lib/cms/questionnaire-actions.ts (md5 compared), services questionnaires.ts canManageQuestionnaires, ifac lib/data.ts canManageIfac',
  },
];

const ignored: Area['ignored'] = [
];

export default { capabilities, ignored } satisfies Area;

import type { Area, Capability } from '../types';

// sunjay pipeline: written by the round 2 curator, 2026-11-16 (generated from one shared definition for sunjay and amrit-canada, which
// copy most of their api routes). Conventions: atlas/JOURNAL.md. Ids carry the app prefix; a row that copies another app's family says so in `drift`.

const capabilities: Capability[] = [
  {
    "area": "sunjay.pipeline",
    "scope": "org",
    "risk": [
      "others"
    ],
    "id": "sunjay-pipeline-board-create",
    "label": "Set up the pipeline board",
    "does": "An owner or guide creates the organisation's Nextcloud Deck board on first use (idempotent) and returns it.",
    "class": "person",
    "actors": [
      "owner",
      "guide"
    ],
    "hosts": [
      {
        "key": "api:apps/sunjay/src/app/api/pipeline/provision/route.ts#POST",
        "service": [
          "@elkdonis/services (org-deck)"
        ],
        "address": {
          "app": "sunjay",
          "path": "/hub/pipeline",
          "how": "the Set up board button of components ProvisionBoard (packages/pipeline)"
        }
      },
      {
        "key": "api:apps/amrit-canada/src/app/api/pipeline/provision/route.ts#POST",
        "service": [
          "@elkdonis/services (org-deck)"
        ],
        "address": {
          "app": "amrit-canada",
          "path": "/hub/pipeline",
          "how": "the Set up board button of components ProvisionBoard (packages/pipeline)"
        }
      },
    ],
    "entry": null,
    "status": "organizations.deck_board_id is set for the org",
    "confirm": {
      "text": "Set up the pipeline board for {org}? A task board is created for the group, and members can add cards.",
      "status": "draft",
      "wave": 6
    },
    "drift": "a thin mount of packages/pipeline createPipelineApi: the org is fixed, no board id crosses the wire, services org-deck re-checks the card or stack belongs to the org board (OrgDeckScopeError). Same file in amrit-canada (apps.amrit-canada.*.ts: sunjay-pipeline-board-create); byte-identical bar log prefixes.\nMerged 2026-11-16 (consolidation 2): 2 rows, 2 apps (sunjay, amrit-canada). Differences by app:\n- amrit-canada (was amrit-pipeline-board-create): a thin mount of packages/pipeline createPipelineApi: the org is fixed, no board id crosses the wire, services org-deck re-checks the card or stack belongs to the org board (OrgDeckScopeError). Same file in sunjay (apps.sunjay.*.ts: sunjay-pipeline-board-create); byte-identical bar log prefixes.\namrit-canada is the oldest site and much of it is being left behind: do not let its shape become the canonical.",
    "canonical": "packages/pipeline createPipelineApi + services org-deck (already shared)",
    "verified": "2026-11-16 read app/api/pipeline/**/route.ts (17 files), lib/pipeline.ts, lib/pipeline-api.ts, packages/pipeline routes.ts, services org-deck.ts"
  },
  {
    "area": "sunjay.pipeline",
    "scope": "org",
    "risk": [
      "others"
    ],
    "id": "sunjay-pipeline-list-add",
    "label": "Add a pipeline list",
    "does": "An owner or guide adds a column (list) to the board.",
    "class": "person",
    "actors": [
      "owner",
      "guide"
    ],
    "hosts": [
      {
        "key": "api:apps/sunjay/src/app/api/pipeline/stacks/route.ts#POST",
        "service": [
          "@elkdonis/services (org-deck)"
        ],
        "address": {
          "app": "sunjay",
          "path": "/hub/pipeline",
          "how": "the Add list control of PipelineBoard.tsx"
        }
      },
      {
        "key": "api:apps/amrit-canada/src/app/api/pipeline/stacks/route.ts#POST",
        "service": [
          "@elkdonis/services (org-deck)"
        ],
        "address": {
          "app": "amrit-canada",
          "path": "/hub/pipeline",
          "how": "the Add list control of PipelineBoard.tsx"
        }
      },
      {
        "key": "api:apps/hidden-enneagram/src/app/api/pipeline/stacks/route.ts#POST",
        "service": [
          "(withEditor: getApiEditor = owner or guide)"
        ],
        "address": {
          "app": "hidden-enneagram",
          "path": "/hub",
          "how": "the pipeline board in the hub (packages/pipeline PipelineBoard / PipelineCardDialog, mounted by components/hub/HubSurfaces.tsx)"
        }
      },
      {
        "key": "api:apps/ifac/src/app/api/pipeline/stacks/route.ts#POST",
        "service": [
          "(withEditor: getApiEditor = owner or guide)"
        ],
        "address": {
          "app": "ifac",
          "path": "/hub",
          "how": "the pipeline board in the hub (packages/pipeline PipelineBoard / PipelineCardDialog, mounted by components/hub/HubSurfaces.tsx)"
        }
      },
      {
        "key": "api:apps/elktours/src/app/api/pipeline/stacks/route.ts#POST",
        "service": [
          "@/lib/pipeline#createPipelineStack"
        ],
        "address": {
          "app": "elktours",
          "path": "/hub/pipeline",
          "how": "the Add a list control of the board (packages/pipeline/src/components/PipelineBoard.tsx)"
        }
      },
      {
        "key": "api:apps/innergathering/src/app/api/pipeline/stacks/route.ts#POST",
        "service": [
          "lib/pipeline#createPipelineStack"
        ],
        "address": {
          "app": "innergathering",
          "path": "/hub/pipeline",
          "how": "the Add list control (packages/pipeline/src/components/PipelineBoard.tsx)"
        }
      },
    ],
    "status": "the board has a stack with the title",
    "drift": "a thin mount of packages/pipeline createPipelineApi: the org is fixed, no board id crosses the wire, services org-deck re-checks the card or stack belongs to the org board (OrgDeckScopeError). Same file in amrit-canada (apps.amrit-canada.*.ts: sunjay-pipeline-list-add); byte-identical bar log prefixes.\nMerged 2026-11-16 (consolidation 2): 6 rows, 6 apps (sunjay, amrit-canada, hidden-enneagram, ifac, elktours, innergathering). Differences by app:\n- amrit-canada (was amrit-pipeline-list-add): a thin mount of packages/pipeline createPipelineApi: the org is fixed, no board id crosses the wire, services org-deck re-checks the card or stack belongs to the org board (OrgDeckScopeError). Same file in sunjay (apps.sunjay.*.ts: sunjay-pipeline-list-add); byte-identical bar log prefixes.\n- hidden-enneagram (was he-pipeline-list-add): Byte-identical to the ifac route (ifac-pipeline-* rows) (diffed all 16 files, identical bar the org id). The routes are already a thin mount of packages/pipeline createPipelineApi; org scoping is enforced in services org-deck (OrgDeckScopeError), no board id crosses the wire.\n- ifac (was ifac-pipeline-list-add): Byte-identical to the hidden-enneagram route (diffed all 16 files, identical bar org id). The routes are already a thin mount of packages/pipeline createPipelineApi; org scoping is enforced in services org-deck (OrgDeckScopeError), no board id crosses the wire.\n- elktours (was elktours-pipeline-list-create): Same pipeline routes and package are mounted in the other org apps that show a Deck board; ids and rules are shared in @elkdonis/pipeline.\n- innergathering (was ig-pipeline-list-add): Same route in the other five org apps.\namrit-canada is the oldest site and much of it is being left behind: do not let its shape become the canonical.",
    "canonical": "packages/pipeline createPipelineApi + services org-deck (already shared)",
    "verified": "2026-11-16 read app/api/pipeline/**/route.ts (17 files), lib/pipeline.ts, lib/pipeline-api.ts, packages/pipeline routes.ts, services org-deck.ts",
    "confirm": {
      "text": "Add the list “{name}” to the {org} board? The team sees it.",
      "status": "draft",
      "wave": 6
    },
    "inputs": "title"
  },
  {
    "area": "sunjay.pipeline",
    "scope": "org",
    "risk": [
      "others"
    ],
    "id": "sunjay-pipeline-list-rename",
    "label": "Rename a pipeline list",
    "does": "An owner or guide renames a list.",
    "class": "person",
    "actors": [
      "owner",
      "guide"
    ],
    "hosts": [
      {
        "key": "api:apps/sunjay/src/app/api/pipeline/stacks/[stackId]/route.ts#PATCH",
        "service": [
          "@elkdonis/services (org-deck)"
        ],
        "address": {
          "app": "sunjay",
          "path": "/hub/pipeline",
          "how": "the list title edit of PipelineBoard.tsx"
        }
      },
      {
        "key": "api:apps/amrit-canada/src/app/api/pipeline/stacks/[stackId]/route.ts#PATCH",
        "service": [
          "@elkdonis/services (org-deck)"
        ],
        "address": {
          "app": "amrit-canada",
          "path": "/hub/pipeline",
          "how": "the list title edit of PipelineBoard.tsx"
        }
      },
      {
        "key": "api:apps/hidden-enneagram/src/app/api/pipeline/stacks/[stackId]/route.ts#PATCH",
        "service": [
          "(withEditor: getApiEditor = owner or guide)"
        ],
        "address": {
          "app": "hidden-enneagram",
          "path": "/hub",
          "how": "the pipeline board in the hub (packages/pipeline PipelineBoard / PipelineCardDialog, mounted by components/hub/HubSurfaces.tsx)"
        }
      },
      {
        "key": "api:apps/ifac/src/app/api/pipeline/stacks/[stackId]/route.ts#PATCH",
        "service": [
          "(withEditor: getApiEditor = owner or guide)"
        ],
        "address": {
          "app": "ifac",
          "path": "/hub",
          "how": "the pipeline board in the hub (packages/pipeline PipelineBoard / PipelineCardDialog, mounted by components/hub/HubSurfaces.tsx)"
        }
      },
      {
        "key": "api:apps/elktours/src/app/api/pipeline/stacks/[stackId]/route.ts#PATCH",
        "service": [
          "@/lib/pipeline#renamePipelineStack"
        ],
        "address": {
          "app": "elktours",
          "path": "/hub/pipeline",
          "how": "the list title edit of the board (packages/pipeline/src/components/PipelineBoard.tsx)"
        }
      },
      {
        "key": "api:apps/innergathering/src/app/api/pipeline/stacks/[stackId]/route.ts#PATCH",
        "service": [
          "lib/pipeline#renamePipelineStack"
        ],
        "address": {
          "app": "innergathering",
          "path": "/hub/pipeline",
          "how": "the rename item of the list menu (packages/pipeline/src/components/PipelineColumn.tsx)"
        }
      },
    ],
    "status": "the stack has the new title",
    "drift": "a thin mount of packages/pipeline createPipelineApi: the org is fixed, no board id crosses the wire, services org-deck re-checks the card or stack belongs to the org board (OrgDeckScopeError). Same file in amrit-canada (apps.amrit-canada.*.ts: sunjay-pipeline-list-rename); byte-identical bar log prefixes.\nMerged 2026-11-16 (consolidation 2): 6 rows, 6 apps (sunjay, amrit-canada, hidden-enneagram, ifac, elktours, innergathering). Differences by app:\n- amrit-canada (was amrit-pipeline-list-rename): a thin mount of packages/pipeline createPipelineApi: the org is fixed, no board id crosses the wire, services org-deck re-checks the card or stack belongs to the org board (OrgDeckScopeError). Same file in sunjay (apps.sunjay.*.ts: sunjay-pipeline-list-rename); byte-identical bar log prefixes.\n- hidden-enneagram (was he-pipeline-list-rename): Byte-identical to the ifac route (ifac-pipeline-* rows) (diffed all 16 files, identical bar the org id). The routes are already a thin mount of packages/pipeline createPipelineApi; org scoping is enforced in services org-deck (OrgDeckScopeError), no board id crosses the wire.\n- ifac (was ifac-pipeline-list-rename): Byte-identical to the hidden-enneagram route (diffed all 16 files, identical bar org id). The routes are already a thin mount of packages/pipeline createPipelineApi; org scoping is enforced in services org-deck (OrgDeckScopeError), no board id crosses the wire.\n- elktours (was elktours-pipeline-list-rename): Same pipeline routes and package are mounted in the other org apps that show a Deck board; ids and rules are shared in @elkdonis/pipeline.\n- innergathering (was ig-pipeline-list-rename): Same route in the other five org apps.\namrit-canada is the oldest site and much of it is being left behind: do not let its shape become the canonical.",
    "canonical": "packages/pipeline createPipelineApi + services org-deck (already shared)",
    "verified": "2026-11-16 read app/api/pipeline/**/route.ts (17 files), lib/pipeline.ts, lib/pipeline-api.ts, packages/pipeline routes.ts, services org-deck.ts",
    "confirm": {
      "text": "Rename this list to “{name}”? The team sees the new name.",
      "status": "draft",
      "wave": 6
    },
    "inputs": "stackId, title"
  },
  {
    "area": "sunjay.pipeline",
    "scope": "org",
    "risk": [
      "irreversible",
      "others"
    ],
    "id": "sunjay-pipeline-list-delete",
    "label": "Delete a pipeline list",
    "does": "An owner or guide deletes a list and its cards.",
    "class": "person",
    "actors": [
      "owner",
      "guide"
    ],
    "hosts": [
      {
        "key": "api:apps/sunjay/src/app/api/pipeline/stacks/[stackId]/route.ts#DELETE",
        "service": [
          "@elkdonis/services (org-deck)"
        ],
        "address": {
          "app": "sunjay",
          "path": "/hub/pipeline",
          "how": "the list menu Delete of PipelineBoard.tsx"
        }
      },
      {
        "key": "api:apps/amrit-canada/src/app/api/pipeline/stacks/[stackId]/route.ts#DELETE",
        "service": [
          "@elkdonis/services (org-deck)"
        ],
        "address": {
          "app": "amrit-canada",
          "path": "/hub/pipeline",
          "how": "the list menu Delete of PipelineBoard.tsx"
        }
      },
      {
        "key": "api:apps/hidden-enneagram/src/app/api/pipeline/stacks/[stackId]/route.ts#DELETE",
        "service": [
          "(withEditor: getApiEditor = owner or guide)"
        ],
        "address": {
          "app": "hidden-enneagram",
          "path": "/hub",
          "how": "the pipeline board in the hub (packages/pipeline PipelineBoard / PipelineCardDialog, mounted by components/hub/HubSurfaces.tsx)"
        }
      },
      {
        "key": "api:apps/ifac/src/app/api/pipeline/stacks/[stackId]/route.ts#DELETE",
        "service": [
          "(withEditor: getApiEditor = owner or guide)"
        ],
        "address": {
          "app": "ifac",
          "path": "/hub",
          "how": "the pipeline board in the hub (packages/pipeline PipelineBoard / PipelineCardDialog, mounted by components/hub/HubSurfaces.tsx)"
        }
      },
      {
        "key": "api:apps/elktours/src/app/api/pipeline/stacks/[stackId]/route.ts#DELETE",
        "service": [
          "@/lib/pipeline#deletePipelineStack"
        ],
        "address": {
          "app": "elktours",
          "path": "/hub/pipeline",
          "how": "the delete control of a list (packages/pipeline/src/components/PipelineBoard.tsx)"
        }
      },
      {
        "key": "api:apps/innergathering/src/app/api/pipeline/stacks/[stackId]/route.ts#DELETE",
        "service": [
          "lib/pipeline#deletePipelineStack"
        ],
        "address": {
          "app": "innergathering",
          "path": "/hub/pipeline",
          "how": "the delete item of the list menu (packages/pipeline/src/components/PipelineColumn.tsx, with a window.confirm warning)"
        }
      },
    ],
    "entry": null,
    "status": "the board has no stack with that id",
    "confirm": {
      "text": "Delete the list “{name}” and every card in it? This cannot be undone.",
      "status": "draft",
      "wave": 6
    },
    "drift": "a thin mount of packages/pipeline createPipelineApi: the org is fixed, no board id crosses the wire, services org-deck re-checks the card or stack belongs to the org board (OrgDeckScopeError). Same file in amrit-canada (apps.amrit-canada.*.ts: sunjay-pipeline-list-delete); byte-identical bar log prefixes.\nMerged 2026-11-16 (consolidation 2): 6 rows, 6 apps (sunjay, amrit-canada, hidden-enneagram, ifac, elktours, innergathering). Differences by app:\n- amrit-canada (was amrit-pipeline-list-delete): a thin mount of packages/pipeline createPipelineApi: the org is fixed, no board id crosses the wire, services org-deck re-checks the card or stack belongs to the org board (OrgDeckScopeError). Same file in sunjay (apps.sunjay.*.ts: sunjay-pipeline-list-delete); byte-identical bar log prefixes.\n- hidden-enneagram (was he-pipeline-list-delete): Byte-identical to the ifac route (ifac-pipeline-* rows) (diffed all 16 files, identical bar the org id). The routes are already a thin mount of packages/pipeline createPipelineApi; org scoping is enforced in services org-deck (OrgDeckScopeError), no board id crosses the wire.\n- ifac (was ifac-pipeline-list-delete): Byte-identical to the hidden-enneagram route (diffed all 16 files, identical bar org id). The routes are already a thin mount of packages/pipeline createPipelineApi; org scoping is enforced in services org-deck (OrgDeckScopeError), no board id crosses the wire.\n- elktours (was elktours-pipeline-list-delete): Same pipeline routes and package are mounted in the other org apps that show a Deck board; ids and rules are shared in @elkdonis/pipeline.\n- innergathering (was ig-pipeline-list-delete): Same route in the other five org apps.\namrit-canada is the oldest site and much of it is being left behind: do not let its shape become the canonical.",
    "canonical": "packages/pipeline createPipelineApi + services org-deck (already shared)",
    "open": "Does the Deck service delete the cards with the stack, or orphan them? Not traced.\nelktours (elktours-pipeline-list-delete): Hard delete in Deck with its cards, attachments and comments; the board is shared by every member.",
    "verified": "2026-11-16 read app/api/pipeline/**/route.ts (17 files), lib/pipeline.ts, lib/pipeline-api.ts, packages/pipeline routes.ts, services org-deck.ts",
    "inputs": "stackId"
  },
  {
    "area": "sunjay.pipeline",
    "scope": "org",
    "risk": [
      "others"
    ],
    "id": "sunjay-pipeline-card-add",
    "label": "Add a pipeline card",
    "does": "A member adds a card to a list.",
    "class": "person",
    "actors": [
      "member",
      "guide",
      "owner"
    ],
    "hosts": [
      {
        "key": "api:apps/sunjay/src/app/api/pipeline/cards/route.ts#POST",
        "service": [
          "@elkdonis/services (org-deck)"
        ],
        "address": {
          "app": "sunjay",
          "path": "/hub/pipeline",
          "how": "the Add card box at the foot of a list (PipelineBoard.tsx)"
        }
      },
      {
        "key": "api:apps/amrit-canada/src/app/api/pipeline/cards/route.ts#POST",
        "service": [
          "@elkdonis/services (org-deck)"
        ],
        "address": {
          "app": "amrit-canada",
          "path": "/hub/pipeline",
          "how": "the Add card box at the foot of a list (PipelineBoard.tsx)"
        }
      },
      {
        "key": "api:apps/hidden-enneagram/src/app/api/pipeline/cards/route.ts#POST",
        "service": [
          "(withMember: getApiMember = owner, guide or member)"
        ],
        "address": {
          "app": "hidden-enneagram",
          "path": "/hub",
          "how": "the pipeline board in the hub (packages/pipeline PipelineBoard / PipelineCardDialog, mounted by components/hub/HubSurfaces.tsx)"
        }
      },
      {
        "key": "api:apps/ifac/src/app/api/pipeline/cards/route.ts#POST",
        "service": [
          "(withMember: getApiMember = owner, guide or member)"
        ],
        "address": {
          "app": "ifac",
          "path": "/hub",
          "how": "the pipeline board in the hub (packages/pipeline PipelineBoard / PipelineCardDialog, mounted by components/hub/HubSurfaces.tsx)"
        }
      },
      {
        "key": "api:apps/elktours/src/app/api/pipeline/cards/route.ts#POST",
        "service": [
          "@/lib/pipeline#createPipelineCard"
        ],
        "address": {
          "app": "elktours",
          "path": "/hub/pipeline",
          "how": "the Add a card control of a list (packages/pipeline/src/components/PipelineBoard.tsx)"
        }
      },
      {
        "key": "api:apps/innergathering/src/app/api/pipeline/cards/route.ts#POST",
        "service": [
          "lib/pipeline#createPipelineCard"
        ],
        "address": {
          "app": "innergathering",
          "path": "/hub/pipeline",
          "how": "the add-card box of a list (packages/pipeline/src/components/PipelineBoard.tsx)"
        },
        "note": "The stack id comes from the request; org scoping is done by OrgDeckScopeError inside @elkdonis/pipeline."
      },
    ],
    "entry": null,
    "status": "the stack has a card with the title",
    "confirm": {
      "text": "Add the card “{title}” to {org}’s pipeline? Members can see and change it.",
      "status": "draft",
      "wave": 6
    },
    "drift": "a thin mount of packages/pipeline createPipelineApi: the org is fixed, no board id crosses the wire, services org-deck re-checks the card or stack belongs to the org board (OrgDeckScopeError). Same file in amrit-canada (apps.amrit-canada.*.ts: sunjay-pipeline-card-add); byte-identical bar log prefixes.\nMerged 2026-11-16 (consolidation 2): 6 rows, 6 apps (sunjay, amrit-canada, hidden-enneagram, ifac, elktours, innergathering). Differences by app:\n- amrit-canada (was amrit-pipeline-card-add): a thin mount of packages/pipeline createPipelineApi: the org is fixed, no board id crosses the wire, services org-deck re-checks the card or stack belongs to the org board (OrgDeckScopeError). Same file in sunjay (apps.sunjay.*.ts: sunjay-pipeline-card-add); byte-identical bar log prefixes.\n- hidden-enneagram (was he-pipeline-card-create): Byte-identical to the ifac route (ifac-pipeline-* rows) (diffed all 16 files, identical bar the org id). The routes are already a thin mount of packages/pipeline createPipelineApi; org scoping is enforced in services org-deck (OrgDeckScopeError), no board id crosses the wire.\n- ifac (was ifac-pipeline-card-create): Byte-identical to the hidden-enneagram route (diffed all 16 files, identical bar org id). The routes are already a thin mount of packages/pipeline createPipelineApi; org scoping is enforced in services org-deck (OrgDeckScopeError), no board id crosses the wire.\n- elktours (was elktours-pipeline-card-create): Same pipeline routes and package are mounted in the other org apps that show a Deck board; ids and rules are shared in @elkdonis/pipeline.\n- innergathering (was ig-pipeline-card-add): Same route in the other five org apps.\namrit-canada is the oldest site and much of it is being left behind: do not let its shape become the canonical.",
    "canonical": "packages/pipeline createPipelineApi + services org-deck (already shared)",
    "verified": "2026-11-16 read app/api/pipeline/**/route.ts (17 files), lib/pipeline.ts, lib/pipeline-api.ts, packages/pipeline routes.ts, services org-deck.ts",
    "inputs": "stackId, title, description, duedate"
  },
  {
    "area": "sunjay.pipeline",
    "scope": "org",
    "risk": [
      "others"
    ],
    "id": "sunjay-pipeline-card-edit",
    "label": "Edit a pipeline card",
    "does": "A member changes a card title, description, due date or archived flag.",
    "class": "person",
    "actors": [
      "member",
      "guide",
      "owner"
    ],
    "hosts": [
      {
        "key": "api:apps/sunjay/src/app/api/pipeline/cards/[cardId]/route.ts#PATCH",
        "service": [
          "@elkdonis/services (org-deck)"
        ],
        "address": {
          "app": "sunjay",
          "path": "/hub/pipeline",
          "how": "the card dialog (PipelineCardDialog.tsx)"
        }
      },
      {
        "key": "api:apps/amrit-canada/src/app/api/pipeline/cards/[cardId]/route.ts#PATCH",
        "service": [
          "@elkdonis/services (org-deck)"
        ],
        "address": {
          "app": "amrit-canada",
          "path": "/hub/pipeline",
          "how": "the card dialog (PipelineCardDialog.tsx)"
        }
      },
      {
        "key": "api:apps/hidden-enneagram/src/app/api/pipeline/cards/[cardId]/route.ts#PATCH",
        "service": [
          "(withMember: getApiMember = owner, guide or member)"
        ],
        "address": {
          "app": "hidden-enneagram",
          "path": "/hub",
          "how": "the pipeline board in the hub (packages/pipeline PipelineBoard / PipelineCardDialog, mounted by components/hub/HubSurfaces.tsx)"
        },
        "note": "title, description, duedate, archived"
      },
      {
        "key": "api:apps/hidden-enneagram/src/app/api/pipeline/cards/[cardId]/state/route.ts#PUT",
        "service": [
          "(withMember: getApiMember = owner, guide or member)"
        ],
        "address": {
          "app": "hidden-enneagram",
          "path": "/hub",
          "how": "the pipeline board in the hub (packages/pipeline PipelineBoard / PipelineCardDialog, mounted by components/hub/HubSurfaces.tsx)"
        },
        "note": "done state"
      },
      {
        "key": "api:apps/hidden-enneagram/src/app/api/pipeline/cards/[cardId]/labels/route.ts#PUT",
        "service": [
          "(withMember: getApiMember = owner, guide or member)"
        ],
        "address": {
          "app": "hidden-enneagram",
          "path": "/hub",
          "how": "the pipeline board in the hub (packages/pipeline PipelineBoard / PipelineCardDialog, mounted by components/hub/HubSurfaces.tsx)"
        },
        "note": "label set"
      },
      {
        "key": "api:apps/hidden-enneagram/src/app/api/pipeline/cards/[cardId]/assignees/route.ts#PUT",
        "service": [
          "(withMember: getApiMember = owner, guide or member)"
        ],
        "address": {
          "app": "hidden-enneagram",
          "path": "/hub",
          "how": "the pipeline board in the hub (packages/pipeline PipelineBoard / PipelineCardDialog, mounted by components/hub/HubSurfaces.tsx)"
        },
        "note": "assignee set"
      },
      {
        "key": "api:apps/ifac/src/app/api/pipeline/cards/[cardId]/route.ts#PATCH",
        "service": [
          "(withMember: getApiMember = owner, guide or member)"
        ],
        "address": {
          "app": "ifac",
          "path": "/hub",
          "how": "the pipeline board in the hub (packages/pipeline PipelineBoard / PipelineCardDialog, mounted by components/hub/HubSurfaces.tsx)"
        },
        "note": "title, description, duedate, archived"
      },
      {
        "key": "api:apps/ifac/src/app/api/pipeline/cards/[cardId]/state/route.ts#PUT",
        "service": [
          "(withMember: getApiMember = owner, guide or member)"
        ],
        "address": {
          "app": "ifac",
          "path": "/hub",
          "how": "the pipeline board in the hub (packages/pipeline PipelineBoard / PipelineCardDialog, mounted by components/hub/HubSurfaces.tsx)"
        },
        "note": "done state"
      },
      {
        "key": "api:apps/ifac/src/app/api/pipeline/cards/[cardId]/labels/route.ts#PUT",
        "service": [
          "(withMember: getApiMember = owner, guide or member)"
        ],
        "address": {
          "app": "ifac",
          "path": "/hub",
          "how": "the pipeline board in the hub (packages/pipeline PipelineBoard / PipelineCardDialog, mounted by components/hub/HubSurfaces.tsx)"
        },
        "note": "label set"
      },
      {
        "key": "api:apps/ifac/src/app/api/pipeline/cards/[cardId]/assignees/route.ts#PUT",
        "service": [
          "(withMember: getApiMember = owner, guide or member)"
        ],
        "address": {
          "app": "ifac",
          "path": "/hub",
          "how": "the pipeline board in the hub (packages/pipeline PipelineBoard / PipelineCardDialog, mounted by components/hub/HubSurfaces.tsx)"
        },
        "note": "assignee set"
      },
      {
        "key": "api:apps/elktours/src/app/api/pipeline/cards/[cardId]/route.ts#PATCH",
        "service": [
          "@/lib/pipeline#updatePipelineCard"
        ],
        "address": {
          "app": "elktours",
          "path": "/hub/pipeline",
          "how": "the card dialog fields (packages/pipeline/src/components/PipelineCardDialog.tsx)"
        }
      },
      {
        "key": "api:apps/innergathering/src/app/api/pipeline/cards/[cardId]/route.ts#PATCH",
        "service": [
          "lib/pipeline#updatePipelineCard"
        ],
        "address": {
          "app": "innergathering",
          "path": "/hub/pipeline",
          "how": "the card dialog (packages/pipeline/src/components/PipelineCardDialog.tsx)"
        }
      },
    ],
    "status": "the card holds the new values",
    "drift": "a thin mount of packages/pipeline createPipelineApi: the org is fixed, no board id crosses the wire, services org-deck re-checks the card or stack belongs to the org board (OrgDeckScopeError). Same file in amrit-canada (apps.amrit-canada.*.ts: sunjay-pipeline-card-edit); byte-identical bar log prefixes.\nMerged 2026-11-16 (consolidation 2): 6 rows, 6 apps (sunjay, amrit-canada, hidden-enneagram, ifac, elktours, innergathering). Differences by app:\n- amrit-canada (was amrit-pipeline-card-edit): a thin mount of packages/pipeline createPipelineApi: the org is fixed, no board id crosses the wire, services org-deck re-checks the card or stack belongs to the org board (OrgDeckScopeError). Same file in sunjay (apps.sunjay.*.ts: sunjay-pipeline-card-edit); byte-identical bar log prefixes.\n- hidden-enneagram (was he-pipeline-card-edit): Byte-identical to the ifac route (ifac-pipeline-* rows) (diffed all 16 files, identical bar the org id). The routes are already a thin mount of packages/pipeline createPipelineApi; org scoping is enforced in services org-deck (OrgDeckScopeError), no board id crosses the wire.\n- ifac (was ifac-pipeline-card-edit): Byte-identical to the hidden-enneagram route (diffed all 16 files, identical bar org id). The routes are already a thin mount of packages/pipeline createPipelineApi; org scoping is enforced in services org-deck (OrgDeckScopeError), no board id crosses the wire.\n- elktours (was elktours-pipeline-card-edit): Same pipeline routes and package are mounted in the other org apps that show a Deck board; ids and rules are shared in @elkdonis/pipeline.\n- innergathering (was ig-pipeline-card-edit): Same route in the other five org apps.\namrit-canada is the oldest site and much of it is being left behind: do not let its shape become the canonical.",
    "canonical": "packages/pipeline createPipelineApi + services org-deck (already shared)",
    "verified": "2026-11-16 read app/api/pipeline/**/route.ts (17 files), lib/pipeline.ts, lib/pipeline-api.ts, packages/pipeline routes.ts, services org-deck.ts",
    "open": "elktours (elktours-pipeline-card-edit): Any member can edit any card, including archiving it (the DELETE needs an editor; PATCH with archived does not).",
    "confirm": {
      "text": "Save your changes to the card “{title}”? The team sees them.",
      "status": "draft",
      "wave": 6
    },
    "inputs": "cardId, title, description, duedate, archived, state, labels, assignees"
  },
  {
    "area": "sunjay.pipeline",
    "scope": "org",
    "risk": [
      "irreversible",
      "others"
    ],
    "id": "sunjay-pipeline-card-delete",
    "label": "Delete a pipeline card",
    "does": "An owner or guide deletes a card.",
    "class": "person",
    "actors": [
      "owner",
      "guide"
    ],
    "hosts": [
      {
        "key": "api:apps/sunjay/src/app/api/pipeline/cards/[cardId]/route.ts#DELETE",
        "service": [
          "@elkdonis/services (org-deck)"
        ],
        "address": {
          "app": "sunjay",
          "path": "/hub/pipeline",
          "how": "the Delete control of the card dialog"
        }
      },
      {
        "key": "api:apps/amrit-canada/src/app/api/pipeline/cards/[cardId]/route.ts#DELETE",
        "service": [
          "@elkdonis/services (org-deck)"
        ],
        "address": {
          "app": "amrit-canada",
          "path": "/hub/pipeline",
          "how": "the Delete control of the card dialog"
        }
      },
      {
        "key": "api:apps/hidden-enneagram/src/app/api/pipeline/cards/[cardId]/route.ts#DELETE",
        "service": [
          "(withEditor: getApiEditor = owner or guide)"
        ],
        "address": {
          "app": "hidden-enneagram",
          "path": "/hub",
          "how": "the pipeline board in the hub (packages/pipeline PipelineBoard / PipelineCardDialog, mounted by components/hub/HubSurfaces.tsx)"
        }
      },
      {
        "key": "api:apps/ifac/src/app/api/pipeline/cards/[cardId]/route.ts#DELETE",
        "service": [
          "(withEditor: getApiEditor = owner or guide)"
        ],
        "address": {
          "app": "ifac",
          "path": "/hub",
          "how": "the pipeline board in the hub (packages/pipeline PipelineBoard / PipelineCardDialog, mounted by components/hub/HubSurfaces.tsx)"
        }
      },
      {
        "key": "api:apps/elktours/src/app/api/pipeline/cards/[cardId]/route.ts#DELETE",
        "service": [
          "@/lib/pipeline#deletePipelineCard"
        ],
        "address": {
          "app": "elktours",
          "path": "/hub/pipeline",
          "how": "the Delete card control in the card menu (packages/pipeline/src/components/PipelineBoard.tsx)"
        }
      },
      {
        "key": "api:apps/innergathering/src/app/api/pipeline/cards/[cardId]/route.ts#DELETE",
        "service": [
          "lib/pipeline#deletePipelineCard"
        ],
        "address": {
          "app": "innergathering",
          "path": "/hub/pipeline",
          "how": "the Delete item of the card menu (packages/pipeline/src/components/PipelineCardMenu.tsx, with a window.confirm)"
        }
      },
    ],
    "entry": null,
    "status": "the board has no card with that id",
    "confirm": {
      "text": "Delete the card “{title}”? This cannot be undone.",
      "status": "draft",
      "wave": 6
    },
    "drift": "a thin mount of packages/pipeline createPipelineApi: the org is fixed, no board id crosses the wire, services org-deck re-checks the card or stack belongs to the org board (OrgDeckScopeError). Same file in amrit-canada (apps.amrit-canada.*.ts: sunjay-pipeline-card-delete); byte-identical bar log prefixes.\nMerged 2026-11-16 (consolidation 2): 6 rows, 6 apps (sunjay, amrit-canada, hidden-enneagram, ifac, elktours, innergathering). Differences by app:\n- amrit-canada (was amrit-pipeline-card-delete): a thin mount of packages/pipeline createPipelineApi: the org is fixed, no board id crosses the wire, services org-deck re-checks the card or stack belongs to the org board (OrgDeckScopeError). Same file in sunjay (apps.sunjay.*.ts: sunjay-pipeline-card-delete); byte-identical bar log prefixes.\n- hidden-enneagram (was he-pipeline-card-delete): Byte-identical to the ifac route (ifac-pipeline-* rows) (diffed all 16 files, identical bar the org id). The routes are already a thin mount of packages/pipeline createPipelineApi; org scoping is enforced in services org-deck (OrgDeckScopeError), no board id crosses the wire.\n- ifac (was ifac-pipeline-card-delete): Byte-identical to the hidden-enneagram route (diffed all 16 files, identical bar org id). The routes are already a thin mount of packages/pipeline createPipelineApi; org scoping is enforced in services org-deck (OrgDeckScopeError), no board id crosses the wire.\n- elktours (was elktours-pipeline-card-delete): Same pipeline routes and package are mounted in the other org apps that show a Deck board; ids and rules are shared in @elkdonis/pipeline.\n- innergathering (was ig-pipeline-card-delete): Same route in the other five org apps.\namrit-canada is the oldest site and much of it is being left behind: do not let its shape become the canonical.",
    "canonical": "packages/pipeline createPipelineApi + services org-deck (already shared)",
    "verified": "2026-11-16 read app/api/pipeline/**/route.ts (17 files), lib/pipeline.ts, lib/pipeline-api.ts, packages/pipeline routes.ts, services org-deck.ts",
    "inputs": "cardId"
  },
  {
    "area": "sunjay.pipeline",
    "scope": "org",
    "risk": [
      "others"
    ],
    "id": "sunjay-pipeline-card-move",
    "label": "Move a pipeline card",
    "does": "A member drags a card to a position in a list.",
    "class": "person",
    "actors": [
      "member",
      "guide",
      "owner"
    ],
    "hosts": [
      {
        "key": "api:apps/sunjay/src/app/api/pipeline/cards/[cardId]/reorder/route.ts#PUT",
        "service": [
          "@elkdonis/services (org-deck)"
        ],
        "address": {
          "app": "sunjay",
          "path": "/hub/pipeline",
          "how": "drag and drop on PipelineBoard.tsx"
        }
      },
      {
        "key": "api:apps/amrit-canada/src/app/api/pipeline/cards/[cardId]/reorder/route.ts#PUT",
        "service": [
          "@elkdonis/services (org-deck)"
        ],
        "address": {
          "app": "amrit-canada",
          "path": "/hub/pipeline",
          "how": "drag and drop on PipelineBoard.tsx"
        }
      },
      {
        "key": "api:apps/hidden-enneagram/src/app/api/pipeline/cards/[cardId]/reorder/route.ts#PUT",
        "service": [
          "(withMember: getApiMember = owner, guide or member)"
        ],
        "address": {
          "app": "hidden-enneagram",
          "path": "/hub",
          "how": "the pipeline board in the hub (packages/pipeline PipelineBoard / PipelineCardDialog, mounted by components/hub/HubSurfaces.tsx)"
        }
      },
      {
        "key": "api:apps/ifac/src/app/api/pipeline/cards/[cardId]/reorder/route.ts#PUT",
        "service": [
          "(withMember: getApiMember = owner, guide or member)"
        ],
        "address": {
          "app": "ifac",
          "path": "/hub",
          "how": "the pipeline board in the hub (packages/pipeline PipelineBoard / PipelineCardDialog, mounted by components/hub/HubSurfaces.tsx)"
        }
      },
      {
        "key": "api:apps/elktours/src/app/api/pipeline/cards/[cardId]/reorder/route.ts#PUT",
        "service": [
          "@/lib/pipeline#movePipelineCard"
        ],
        "address": {
          "app": "elktours",
          "path": "/hub/pipeline",
          "how": "dragging a card on the board (packages/pipeline/src/components/PipelineBoard.tsx)"
        }
      },
      {
        "key": "api:apps/innergathering/src/app/api/pipeline/cards/[cardId]/reorder/route.ts#PUT",
        "service": [
          "lib/pipeline#movePipelineCard"
        ],
        "address": {
          "app": "innergathering",
          "path": "/hub/pipeline",
          "how": "dragging a card (packages/pipeline/src/components/PipelineBoard.tsx)"
        }
      },
      {
        "key": "api:apps/innergathering/src/app/api/pipeline/cards/[cardId]/labels/route.ts#PUT",
        "service": [
          "lib/pipeline#setPipelineCardLabel"
        ],
        "address": {
          "app": "innergathering",
          "path": "/hub/pipeline",
          "how": "the label chips of the card dialog (packages/pipeline/src/components/PipelineCardDialog.tsx)"
        }
      },
      {
        "key": "api:apps/innergathering/src/app/api/pipeline/cards/[cardId]/assignees/route.ts#PUT",
        "service": [
          "lib/pipeline#setPipelineCardAssignee"
        ],
        "address": {
          "app": "innergathering",
          "path": "/hub/pipeline",
          "how": "the assignee chips of the card dialog (PipelineCardDialog.tsx)"
        },
        "note": "userId comes from the request; Nextcloud decides whether it is a Deck user of the board."
      },
      {
        "key": "api:apps/innergathering/src/app/api/pipeline/cards/[cardId]/state/route.ts#PUT",
        "service": [
          "lib/pipeline#setPipelineCardDone",
          "lib/pipeline#setPipelineCardArchived"
        ],
        "address": {
          "app": "innergathering",
          "path": "/hub/pipeline",
          "how": "the Done tick and Archive item (PipelineCardDialog.tsx; packages/pipeline/src/components/ArchivedCards.tsx restores)"
        }
      },
    ],
    "status": "the card sits in the stack at the order",
    "drift": "a thin mount of packages/pipeline createPipelineApi: the org is fixed, no board id crosses the wire, services org-deck re-checks the card or stack belongs to the org board (OrgDeckScopeError). Same file in amrit-canada (apps.amrit-canada.*.ts: sunjay-pipeline-card-move); byte-identical bar log prefixes.\nMerged 2026-11-16 (consolidation 2): 6 rows, 6 apps (sunjay, amrit-canada, hidden-enneagram, ifac, elktours, innergathering). Differences by app:\n- amrit-canada (was amrit-pipeline-card-move): a thin mount of packages/pipeline createPipelineApi: the org is fixed, no board id crosses the wire, services org-deck re-checks the card or stack belongs to the org board (OrgDeckScopeError). Same file in sunjay (apps.sunjay.*.ts: sunjay-pipeline-card-move); byte-identical bar log prefixes.\n- hidden-enneagram (was he-pipeline-card-move): Byte-identical to the ifac route (ifac-pipeline-* rows) (diffed all 16 files, identical bar the org id). The routes are already a thin mount of packages/pipeline createPipelineApi; org scoping is enforced in services org-deck (OrgDeckScopeError), no board id crosses the wire.\n- ifac (was ifac-pipeline-card-move): Byte-identical to the hidden-enneagram route (diffed all 16 files, identical bar org id). The routes are already a thin mount of packages/pipeline createPipelineApi; org scoping is enforced in services org-deck (OrgDeckScopeError), no board id crosses the wire.\n- elktours (was elktours-pipeline-card-move): Same pipeline routes and package are mounted in the other org apps that show a Deck board; ids and rules are shared in @elkdonis/pipeline.\n- innergathering (was ig-pipeline-card-arrange): Same four routes in the other five org apps.\namrit-canada is the oldest site and much of it is being left behind: do not let its shape become the canonical.",
    "canonical": "packages/pipeline createPipelineApi + services org-deck (already shared)",
    "verified": "2026-11-16 read app/api/pipeline/**/route.ts (17 files), lib/pipeline.ts, lib/pipeline-api.ts, packages/pipeline routes.ts, services org-deck.ts",
    "open": "elktours (elktours-pipeline-card-move): The route comment says the service refuses a card or stack that is not on the org board; the check is in @/lib/pipeline and not re-read.",
    "confirm": {
      "text": "Move the card “{title}” to {where}? The team sees it there.",
      "status": "draft",
      "wave": 6
    },
    "inputs": "cardId, stackId, order"
  },
  {
    "area": "sunjay.pipeline",
    "scope": "org",
    "risk": [
      "others"
    ],
    "id": "sunjay-pipeline-card-state",
    "label": "Tick or archive a pipeline card",
    "does": "A member marks a card done, or archives or restores it.",
    "class": "person",
    "actors": [
      "member",
      "guide",
      "owner"
    ],
    "hosts": [
      {
        "key": "api:apps/sunjay/src/app/api/pipeline/cards/[cardId]/state/route.ts#PUT",
        "service": [
          "@elkdonis/services (org-deck)"
        ],
        "address": {
          "app": "sunjay",
          "path": "/hub/pipeline",
          "how": "the done tick and Archive on the card"
        }
      },
      {
        "key": "api:apps/amrit-canada/src/app/api/pipeline/cards/[cardId]/state/route.ts#PUT",
        "service": [
          "@elkdonis/services (org-deck)"
        ],
        "address": {
          "app": "amrit-canada",
          "path": "/hub/pipeline",
          "how": "the done tick and Archive on the card"
        }
      },
      {
        "key": "api:apps/elktours/src/app/api/pipeline/cards/[cardId]/state/route.ts#PUT",
        "service": [
          "@/lib/pipeline#setPipelineCardDone",
          "@/lib/pipeline#setPipelineCardArchived"
        ],
        "address": {
          "app": "elktours",
          "path": "/hub/pipeline",
          "how": "Deck's 'Mark as done' and 'Archive card' in the card menu (packages/pipeline/src/components/PipelineBoard.tsx)"
        }
      },
    ],
    "status": "the card has done or archived set",
    "drift": "a thin mount of packages/pipeline createPipelineApi: the org is fixed, no board id crosses the wire, services org-deck re-checks the card or stack belongs to the org board (OrgDeckScopeError). Same file in amrit-canada (apps.amrit-canada.*.ts: sunjay-pipeline-card-state); byte-identical bar log prefixes.\nMerged 2026-11-16 (consolidation 2): 3 rows, 3 apps (sunjay, amrit-canada, elktours). Differences by app:\n- amrit-canada (was amrit-pipeline-card-state): a thin mount of packages/pipeline createPipelineApi: the org is fixed, no board id crosses the wire, services org-deck re-checks the card or stack belongs to the org board (OrgDeckScopeError). Same file in sunjay (apps.sunjay.*.ts: sunjay-pipeline-card-state); byte-identical bar log prefixes.\n- elktours (was elktours-pipeline-card-state): Same pipeline routes and package are mounted in the other org apps that show a Deck board; ids and rules are shared in @elkdonis/pipeline.\namrit-canada is the oldest site and much of it is being left behind: do not let its shape become the canonical.",
    "canonical": "packages/pipeline createPipelineApi + services org-deck (already shared)",
    "verified": "2026-11-16 read app/api/pipeline/**/route.ts (17 files), lib/pipeline.ts, lib/pipeline-api.ts, packages/pipeline routes.ts, services org-deck.ts",
    "confirm": {
      "text": "Mark the Pipeline card “{title}” as {state}? Every member will see it.",
      "status": "draft",
      "wave": 6
    },
    "inputs": "card id, done or archived flag"
  },
  {
    "area": "sunjay.pipeline",
    "scope": "org",
    "risk": [
      "others"
    ],
    "id": "sunjay-pipeline-card-label",
    "label": "Label a pipeline card",
    "does": "A member adds or removes a label on a card.",
    "class": "person",
    "actors": [
      "member",
      "guide",
      "owner"
    ],
    "hosts": [
      {
        "key": "api:apps/sunjay/src/app/api/pipeline/cards/[cardId]/labels/route.ts#PUT",
        "service": [
          "@elkdonis/services (org-deck)"
        ],
        "address": {
          "app": "sunjay",
          "path": "/hub/pipeline",
          "how": "the labels picker of the card dialog"
        }
      },
      {
        "key": "api:apps/amrit-canada/src/app/api/pipeline/cards/[cardId]/labels/route.ts#PUT",
        "service": [
          "@elkdonis/services (org-deck)"
        ],
        "address": {
          "app": "amrit-canada",
          "path": "/hub/pipeline",
          "how": "the labels picker of the card dialog"
        }
      },
      {
        "key": "api:apps/elktours/src/app/api/pipeline/cards/[cardId]/labels/route.ts#PUT",
        "service": [
          "@/lib/pipeline#setPipelineCardLabel"
        ],
        "address": {
          "app": "elktours",
          "path": "/hub/pipeline",
          "how": "the Labels control in the card dialog (packages/pipeline/src/components/PipelineCardDialog.tsx)"
        }
      },
    ],
    "status": "the card has the label (or not)",
    "drift": "a thin mount of packages/pipeline createPipelineApi: the org is fixed, no board id crosses the wire, services org-deck re-checks the card or stack belongs to the org board (OrgDeckScopeError). Same file in amrit-canada (apps.amrit-canada.*.ts: sunjay-pipeline-card-label); byte-identical bar log prefixes.\nMerged 2026-11-16 (consolidation 2): 3 rows, 3 apps (sunjay, amrit-canada, elktours). Differences by app:\n- amrit-canada (was amrit-pipeline-card-label): a thin mount of packages/pipeline createPipelineApi: the org is fixed, no board id crosses the wire, services org-deck re-checks the card or stack belongs to the org board (OrgDeckScopeError). Same file in sunjay (apps.sunjay.*.ts: sunjay-pipeline-card-label); byte-identical bar log prefixes.\n- elktours (was elktours-pipeline-card-label): Same pipeline routes and package are mounted in the other org apps that show a Deck board; ids and rules are shared in @elkdonis/pipeline.\namrit-canada is the oldest site and much of it is being left behind: do not let its shape become the canonical.",
    "canonical": "packages/pipeline createPipelineApi + services org-deck (already shared)",
    "verified": "2026-11-16 read app/api/pipeline/**/route.ts (17 files), lib/pipeline.ts, lib/pipeline-api.ts, packages/pipeline routes.ts, services org-deck.ts",
    "confirm": {
      "text": "Change the labels on the Pipeline card “{title}”? Every member will see them.",
      "status": "draft",
      "wave": 6
    },
    "inputs": "card id, label id, assigned flag"
  },
  {
    "area": "sunjay.pipeline",
    "scope": "org",
    "risk": [
      "others"
    ],
    "id": "sunjay-pipeline-card-assign",
    "label": "Assign a pipeline card",
    "does": "A member assigns or unassigns a person on a card.",
    "class": "person",
    "actors": [
      "member",
      "guide",
      "owner"
    ],
    "hosts": [
      {
        "key": "api:apps/sunjay/src/app/api/pipeline/cards/[cardId]/assignees/route.ts#PUT",
        "service": [
          "@elkdonis/services (org-deck)"
        ],
        "address": {
          "app": "sunjay",
          "path": "/hub/pipeline",
          "how": "the assignees picker of the card dialog"
        }
      },
      {
        "key": "api:apps/amrit-canada/src/app/api/pipeline/cards/[cardId]/assignees/route.ts#PUT",
        "service": [
          "@elkdonis/services (org-deck)"
        ],
        "address": {
          "app": "amrit-canada",
          "path": "/hub/pipeline",
          "how": "the assignees picker of the card dialog"
        }
      },
      {
        "key": "api:apps/elktours/src/app/api/pipeline/cards/[cardId]/assignees/route.ts#PUT",
        "service": [
          "@/lib/pipeline#setPipelineCardAssignee"
        ],
        "address": {
          "app": "elktours",
          "path": "/hub/pipeline",
          "how": "the Assignees control in the card dialog (packages/pipeline/src/components/PipelineCardDialog.tsx)"
        }
      },
    ],
    "status": "the card lists the person as assignee (or not)",
    "drift": "a thin mount of packages/pipeline createPipelineApi: the org is fixed, no board id crosses the wire, services org-deck re-checks the card or stack belongs to the org board (OrgDeckScopeError). Same file in amrit-canada (apps.amrit-canada.*.ts: sunjay-pipeline-card-assign); byte-identical bar log prefixes.\nMerged 2026-11-16 (consolidation 2): 3 rows, 3 apps (sunjay, amrit-canada, elktours). Differences by app:\n- amrit-canada (was amrit-pipeline-card-assign): a thin mount of packages/pipeline createPipelineApi: the org is fixed, no board id crosses the wire, services org-deck re-checks the card or stack belongs to the org board (OrgDeckScopeError). Same file in sunjay (apps.sunjay.*.ts: sunjay-pipeline-card-assign); byte-identical bar log prefixes.\n- elktours (was elktours-pipeline-card-assign): Same pipeline routes and package are mounted in the other org apps that show a Deck board; ids and rules are shared in @elkdonis/pipeline.\namrit-canada is the oldest site and much of it is being left behind: do not let its shape become the canonical.",
    "canonical": "packages/pipeline createPipelineApi + services org-deck (already shared)",
    "open": "The userId comes from the body and goes to setOrgCardAssignee(ORG, card, userId); whether services restricts it to Deck users of this org was not re-read.\nelktours (elktours-pipeline-card-assign): The userId is a free string sent by the client; the service layer must refuse non-participants (route comment), not re-read.",
    "verified": "2026-11-16 read app/api/pipeline/**/route.ts (17 files), lib/pipeline.ts, lib/pipeline-api.ts, packages/pipeline routes.ts, services org-deck.ts",
    "confirm": {
      "text": "Assign {person} to the Pipeline card “{title}”? Every member will see who is on it.",
      "status": "draft",
      "wave": 6
    },
    "inputs": "card id, user id, assigned flag"
  },
  {
    "area": "sunjay.pipeline",
    "scope": "org",
    "risk": [
      "others"
    ],
    "id": "sunjay-pipeline-comment-add",
    "label": "Comment on a pipeline card",
    "does": "A member adds a comment to a card under their profile name.",
    "class": "person",
    "actors": [
      "member",
      "guide",
      "owner"
    ],
    "hosts": [
      {
        "key": "api:apps/sunjay/src/app/api/pipeline/cards/[cardId]/comments/route.ts#POST",
        "service": [
          "@elkdonis/services (org-deck)"
        ],
        "address": {
          "app": "sunjay",
          "path": "/hub/pipeline",
          "how": "the comment box of the card dialog"
        }
      },
      {
        "key": "api:apps/amrit-canada/src/app/api/pipeline/cards/[cardId]/comments/route.ts#POST",
        "service": [
          "@elkdonis/services (org-deck)"
        ],
        "address": {
          "app": "amrit-canada",
          "path": "/hub/pipeline",
          "how": "the comment box of the card dialog"
        }
      },
      {
        "key": "api:apps/hidden-enneagram/src/app/api/pipeline/cards/[cardId]/comments/route.ts#POST",
        "service": [
          "(withMember: getApiMember = owner, guide or member)",
          "@elkdonis/services#getProfile"
        ],
        "address": {
          "app": "hidden-enneagram",
          "path": "/hub",
          "how": "the pipeline board in the hub (packages/pipeline PipelineBoard / PipelineCardDialog, mounted by components/hub/HubSurfaces.tsx)"
        }
      },
      {
        "key": "api:apps/ifac/src/app/api/pipeline/cards/[cardId]/comments/route.ts#POST",
        "service": [
          "(withMember: getApiMember = owner, guide or member)",
          "@elkdonis/services#getProfile"
        ],
        "address": {
          "app": "ifac",
          "path": "/hub",
          "how": "the pipeline board in the hub (packages/pipeline PipelineBoard / PipelineCardDialog, mounted by components/hub/HubSurfaces.tsx)"
        }
      },
      {
        "key": "api:apps/elktours/src/app/api/pipeline/cards/[cardId]/comments/route.ts#POST",
        "service": [
          "@/lib/pipeline#addPipelineComment",
          "@elkdonis/services#getProfile"
        ],
        "address": {
          "app": "elktours",
          "path": "/hub/pipeline",
          "how": "the comment box in the card dialog (packages/pipeline/src/components/PipelineCardDialog.tsx)"
        }
      },
      {
        "key": "api:apps/innergathering/src/app/api/pipeline/cards/[cardId]/comments/route.ts#POST",
        "service": [
          "lib/pipeline#addPipelineComment",
          "@elkdonis/services#getProfile"
        ],
        "address": {
          "app": "innergathering",
          "path": "/hub/pipeline",
          "how": "the comment box of the card dialog (packages/pipeline/src/components/PipelineCardDialog.tsx)"
        }
      },
    ],
    "status": "the card has a comment by the person",
    "drift": "a thin mount of packages/pipeline createPipelineApi: the org is fixed, no board id crosses the wire, services org-deck re-checks the card or stack belongs to the org board (OrgDeckScopeError). Same file in amrit-canada (apps.amrit-canada.*.ts: sunjay-pipeline-comment-add); byte-identical bar log prefixes.\nMerged 2026-11-16 (consolidation 2): 6 rows, 6 apps (sunjay, amrit-canada, hidden-enneagram, ifac, elktours, innergathering). Differences by app:\n- amrit-canada (was amrit-pipeline-comment-add): a thin mount of packages/pipeline createPipelineApi: the org is fixed, no board id crosses the wire, services org-deck re-checks the card or stack belongs to the org board (OrgDeckScopeError). Same file in sunjay (apps.sunjay.*.ts: sunjay-pipeline-comment-add); byte-identical bar log prefixes.\n- hidden-enneagram (was he-pipeline-comment-add): Byte-identical to the ifac route (ifac-pipeline-* rows) (diffed all 16 files, identical bar the org id). The routes are already a thin mount of packages/pipeline createPipelineApi; org scoping is enforced in services org-deck (OrgDeckScopeError), no board id crosses the wire.\n- ifac (was ifac-pipeline-comment-add): Byte-identical to the hidden-enneagram route (diffed all 16 files, identical bar org id). The routes are already a thin mount of packages/pipeline createPipelineApi; org scoping is enforced in services org-deck (OrgDeckScopeError), no board id crosses the wire.\n- elktours (was elktours-pipeline-comment-add): Same pipeline routes and package are mounted in the other org apps that show a Deck board; ids and rules are shared in @elkdonis/pipeline.\n- innergathering (was ig-pipeline-comment-add): Same route in the other five org apps.\namrit-canada is the oldest site and much of it is being left behind: do not let its shape become the canonical.",
    "canonical": "packages/pipeline createPipelineApi + services org-deck (already shared)",
    "verified": "2026-11-16 read app/api/pipeline/**/route.ts (17 files), lib/pipeline.ts, lib/pipeline-api.ts, packages/pipeline routes.ts, services org-deck.ts",
    "open": "hidden-enneagram (he-pipeline-comment-add): Every comment is stored under the Nextcloud service account with the name in the text, so there is no per-author ownership (route comment).\nelktours (elktours-pipeline-comment-add): The author is recorded only as text inside the comment (the Deck author is the service account), so a comment cannot be traced to a user account except by that text.",
    "confirm": {
      "text": "Post your comment on “{title}”? The team sees it.",
      "status": "draft",
      "wave": 6
    },
    "inputs": "cardId, message"
  },
  {
    "area": "sunjay.pipeline",
    "scope": "org",
    "risk": [
      "irreversible",
      "others"
    ],
    "id": "sunjay-pipeline-comment-delete",
    "label": "Delete a pipeline comment",
    "does": "An owner or guide deletes a comment.",
    "class": "person",
    "actors": [
      "owner",
      "guide"
    ],
    "hosts": [
      {
        "key": "api:apps/sunjay/src/app/api/pipeline/cards/[cardId]/comments/[commentId]/route.ts#DELETE",
        "service": [
          "@elkdonis/services (org-deck)"
        ],
        "address": {
          "app": "sunjay",
          "path": "/hub/pipeline",
          "how": "the comment menu of the card dialog"
        }
      },
      {
        "key": "api:apps/amrit-canada/src/app/api/pipeline/cards/[cardId]/comments/[commentId]/route.ts#DELETE",
        "service": [
          "@elkdonis/services (org-deck)"
        ],
        "address": {
          "app": "amrit-canada",
          "path": "/hub/pipeline",
          "how": "the comment menu of the card dialog"
        }
      },
      {
        "key": "api:apps/hidden-enneagram/src/app/api/pipeline/cards/[cardId]/comments/[commentId]/route.ts#DELETE",
        "service": [
          "(withEditor: getApiEditor = owner or guide)"
        ],
        "address": {
          "app": "hidden-enneagram",
          "path": "/hub",
          "how": "the pipeline board in the hub (packages/pipeline PipelineBoard / PipelineCardDialog, mounted by components/hub/HubSurfaces.tsx)"
        }
      },
      {
        "key": "api:apps/ifac/src/app/api/pipeline/cards/[cardId]/comments/[commentId]/route.ts#DELETE",
        "service": [
          "(withEditor: getApiEditor = owner or guide)"
        ],
        "address": {
          "app": "ifac",
          "path": "/hub",
          "how": "the pipeline board in the hub (packages/pipeline PipelineBoard / PipelineCardDialog, mounted by components/hub/HubSurfaces.tsx)"
        }
      },
      {
        "key": "api:apps/elktours/src/app/api/pipeline/cards/[cardId]/comments/[commentId]/route.ts#DELETE",
        "service": [
          "@/lib/pipeline#deletePipelineComment"
        ],
        "address": {
          "app": "elktours",
          "path": "/hub/pipeline",
          "how": "the delete control on a comment (packages/pipeline/src/components/PipelineCardDialog.tsx)"
        }
      },
      {
        "key": "api:apps/innergathering/src/app/api/pipeline/cards/[cardId]/comments/[commentId]/route.ts#DELETE",
        "service": [
          "lib/pipeline#deletePipelineComment"
        ],
        "address": {
          "app": "innergathering",
          "path": "/hub/pipeline",
          "how": "the delete icon on a comment (PipelineCardDialog.tsx)"
        }
      },
    ],
    "status": "the card has no comment with that id",
    "drift": "a thin mount of packages/pipeline createPipelineApi: the org is fixed, no board id crosses the wire, services org-deck re-checks the card or stack belongs to the org board (OrgDeckScopeError). Same file in amrit-canada (apps.amrit-canada.*.ts: sunjay-pipeline-comment-delete); byte-identical bar log prefixes.\nMerged 2026-11-16 (consolidation 2): 6 rows, 6 apps (sunjay, amrit-canada, hidden-enneagram, ifac, elktours, innergathering). Differences by app:\n- amrit-canada (was amrit-pipeline-comment-delete): a thin mount of packages/pipeline createPipelineApi: the org is fixed, no board id crosses the wire, services org-deck re-checks the card or stack belongs to the org board (OrgDeckScopeError). Same file in sunjay (apps.sunjay.*.ts: sunjay-pipeline-comment-delete); byte-identical bar log prefixes.\n- hidden-enneagram (was he-pipeline-comment-delete): Byte-identical to the ifac route (ifac-pipeline-* rows) (diffed all 16 files, identical bar the org id). The routes are already a thin mount of packages/pipeline createPipelineApi; org scoping is enforced in services org-deck (OrgDeckScopeError), no board id crosses the wire.\n- ifac (was ifac-pipeline-comment-delete): Byte-identical to the hidden-enneagram route (diffed all 16 files, identical bar org id). The routes are already a thin mount of packages/pipeline createPipelineApi; org scoping is enforced in services org-deck (OrgDeckScopeError), no board id crosses the wire.\n- elktours (was elktours-pipeline-comment-delete): Same pipeline routes and package are mounted in the other org apps that show a Deck board; ids and rules are shared in @elkdonis/pipeline.\n- innergathering (was ig-pipeline-comment-delete): Same route in the other five org apps.\namrit-canada is the oldest site and much of it is being left behind: do not let its shape become the canonical.",
    "canonical": "packages/pipeline createPipelineApi + services org-deck (already shared)",
    "verified": "2026-11-16 read app/api/pipeline/**/route.ts (17 files), lib/pipeline.ts, lib/pipeline-api.ts, packages/pipeline routes.ts, services org-deck.ts",
    "open": "elktours (elktours-pipeline-comment-delete): Members cannot delete their own comments (no per-author ownership exists in Deck here, per the route comment).",
    "confirm": {
      "text": "Delete this comment on “{title}”? This cannot be undone.",
      "status": "draft",
      "wave": 6
    },
    "inputs": "cardId, commentId"
  },
  {
    "area": "sunjay.pipeline",
    "scope": "org",
    "risk": [
      "others"
    ],
    "id": "sunjay-pipeline-attachment-add",
    "label": "Attach a file to a pipeline card",
    "does": "A member attaches a file (100 MB max) to a card.",
    "class": "person",
    "actors": [
      "member",
      "guide",
      "owner"
    ],
    "hosts": [
      {
        "key": "api:apps/sunjay/src/app/api/pipeline/cards/[cardId]/attachments/route.ts#POST",
        "service": [
          "@elkdonis/services (org-deck)"
        ],
        "address": {
          "app": "sunjay",
          "path": "/hub/pipeline",
          "how": "the attachments area of the card dialog"
        }
      },
      {
        "key": "api:apps/amrit-canada/src/app/api/pipeline/cards/[cardId]/attachments/route.ts#POST",
        "service": [
          "@elkdonis/services (org-deck)"
        ],
        "address": {
          "app": "amrit-canada",
          "path": "/hub/pipeline",
          "how": "the attachments area of the card dialog"
        }
      },
      {
        "key": "api:apps/hidden-enneagram/src/app/api/pipeline/cards/[cardId]/attachments/route.ts#POST",
        "service": [
          "(withMember: getApiMember = owner, guide or member)"
        ],
        "address": {
          "app": "hidden-enneagram",
          "path": "/hub",
          "how": "the pipeline board in the hub (packages/pipeline PipelineBoard / PipelineCardDialog, mounted by components/hub/HubSurfaces.tsx)"
        }
      },
      {
        "key": "api:apps/ifac/src/app/api/pipeline/cards/[cardId]/attachments/route.ts#POST",
        "service": [
          "(withMember: getApiMember = owner, guide or member)"
        ],
        "address": {
          "app": "ifac",
          "path": "/hub",
          "how": "the pipeline board in the hub (packages/pipeline PipelineBoard / PipelineCardDialog, mounted by components/hub/HubSurfaces.tsx)"
        }
      },
      {
        "key": "api:apps/elktours/src/app/api/pipeline/cards/[cardId]/attachments/route.ts#POST",
        "service": [
          "@/lib/pipeline#addPipelineAttachment"
        ],
        "address": {
          "app": "elktours",
          "path": "/hub/pipeline",
          "how": "the Attach control in the card dialog (packages/pipeline/src/components/PipelineCardDialog.tsx)"
        }
      },
      {
        "key": "api:apps/innergathering/src/app/api/pipeline/cards/[cardId]/attachments/route.ts#POST",
        "service": [
          "lib/pipeline#addPipelineAttachment"
        ],
        "address": {
          "app": "innergathering",
          "path": "/hub/pipeline",
          "how": "the attach button of the card dialog (packages/pipeline/src/components/PipelineCardDialog.tsx)"
        }
      },
    ],
    "status": "the card lists the attachment",
    "drift": "a thin mount of packages/pipeline createPipelineApi: the org is fixed, no board id crosses the wire, services org-deck re-checks the card or stack belongs to the org board (OrgDeckScopeError). Same file in amrit-canada (apps.amrit-canada.*.ts: sunjay-pipeline-attachment-add); byte-identical bar log prefixes.\nMerged 2026-11-16 (consolidation 2): 6 rows, 6 apps (sunjay, amrit-canada, hidden-enneagram, ifac, elktours, innergathering). Differences by app:\n- amrit-canada (was amrit-pipeline-attachment-add): a thin mount of packages/pipeline createPipelineApi: the org is fixed, no board id crosses the wire, services org-deck re-checks the card or stack belongs to the org board (OrgDeckScopeError). Same file in sunjay (apps.sunjay.*.ts: sunjay-pipeline-attachment-add); byte-identical bar log prefixes.\n- hidden-enneagram (was he-pipeline-attachment-add): Byte-identical to the ifac route (ifac-pipeline-* rows) (diffed all 16 files, identical bar the org id). The routes are already a thin mount of packages/pipeline createPipelineApi; org scoping is enforced in services org-deck (OrgDeckScopeError), no board id crosses the wire.\n- ifac (was ifac-pipeline-attachment-add): Byte-identical to the hidden-enneagram route (diffed all 16 files, identical bar org id). The routes are already a thin mount of packages/pipeline createPipelineApi; org scoping is enforced in services org-deck (OrgDeckScopeError), no board id crosses the wire.\n- elktours (was elktours-pipeline-attachment-add): Same pipeline routes and package are mounted in the other org apps that show a Deck board; ids and rules are shared in @elkdonis/pipeline.\n- innergathering (was ig-pipeline-file-add): Same route in the other five org apps.\namrit-canada is the oldest site and much of it is being left behind: do not let its shape become the canonical.",
    "canonical": "packages/pipeline createPipelineApi + services org-deck (already shared)",
    "open": "SECURITY: attachments/route.ts:23-33 accepts any file type and size up to 100 MB from any member with no content sniffing (the org /api/upload route validates bytes); files are served back with Content-Disposition attachment and no-store (GET), which limits the risk.\nhidden-enneagram (he-pipeline-attachment-add): SECURITY: apps/hidden-enneagram/src/app/api/pipeline/cards/[cardId]/attachments/route.ts:20-40 file bytes and name go to Deck unsniffed (size limit only); reads are served as Content-Disposition: attachment (good).\nifac (ifac-pipeline-attachment-add): SECURITY: apps/ifac/src/app/api/pipeline/cards/[cardId]/attachments/route.ts:33 file bytes and name go to Deck unsniffed (size limit only); reads are served as Content-Disposition: attachment (good).\nelktours (elktours-pipeline-attachment-add): SECURITY: no file-type check and no byte sniff in the route (the POST of app/api/pipeline/cards/[cardId]/attachments/route.ts checks only that a file exists, is not empty and is under 100 MB); any member may upload up to 100 MB of any type. Downloads are served with Content-Disposition attachment from the app origin, which limits script risk. contentType is the client's file.type.\ninnergathering (ig-pipeline-file-add): SECURITY (mild): no file-type or magic-byte check, only a size cap (attachments/route.ts:29-33); downloads are served as Content-Disposition attachment, which limits the risk.",
    "verified": "2026-11-16 read app/api/pipeline/**/route.ts (17 files), lib/pipeline.ts, lib/pipeline-api.ts, packages/pipeline routes.ts, services org-deck.ts",
    "confirm": {
      "text": "Attach “{file}” to the card “{title}”? The team can open it.",
      "status": "draft",
      "wave": 6
    },
    "inputs": "cardId, file"
  },
  {
    "area": "sunjay.pipeline",
    "scope": "org",
    "risk": [
      "irreversible",
      "others"
    ],
    "id": "sunjay-pipeline-attachment-delete",
    "label": "Remove a pipeline attachment",
    "does": "An owner or guide removes an attachment from a card.",
    "class": "person",
    "actors": [
      "owner",
      "guide"
    ],
    "hosts": [
      {
        "key": "api:apps/sunjay/src/app/api/pipeline/cards/[cardId]/attachments/[attachmentId]/route.ts#DELETE",
        "service": [
          "@elkdonis/services (org-deck)"
        ],
        "address": {
          "app": "sunjay",
          "path": "/hub/pipeline",
          "how": "the attachment menu of the card dialog"
        }
      },
      {
        "key": "api:apps/amrit-canada/src/app/api/pipeline/cards/[cardId]/attachments/[attachmentId]/route.ts#DELETE",
        "service": [
          "@elkdonis/services (org-deck)"
        ],
        "address": {
          "app": "amrit-canada",
          "path": "/hub/pipeline",
          "how": "the attachment menu of the card dialog"
        }
      },
      {
        "key": "api:apps/hidden-enneagram/src/app/api/pipeline/cards/[cardId]/attachments/[attachmentId]/route.ts#DELETE",
        "service": [
          "(withEditor: getApiEditor = owner or guide)"
        ],
        "address": {
          "app": "hidden-enneagram",
          "path": "/hub",
          "how": "the pipeline board in the hub (packages/pipeline PipelineBoard / PipelineCardDialog, mounted by components/hub/HubSurfaces.tsx)"
        }
      },
      {
        "key": "api:apps/ifac/src/app/api/pipeline/cards/[cardId]/attachments/[attachmentId]/route.ts#DELETE",
        "service": [
          "(withEditor: getApiEditor = owner or guide)"
        ],
        "address": {
          "app": "ifac",
          "path": "/hub",
          "how": "the pipeline board in the hub (packages/pipeline PipelineBoard / PipelineCardDialog, mounted by components/hub/HubSurfaces.tsx)"
        }
      },
      {
        "key": "api:apps/elktours/src/app/api/pipeline/cards/[cardId]/attachments/[attachmentId]/route.ts#DELETE",
        "service": [
          "@/lib/pipeline#removePipelineAttachment"
        ],
        "address": {
          "app": "elktours",
          "path": "/hub/pipeline",
          "how": "the remove control on an attachment (packages/pipeline/src/components/PipelineCardDialog.tsx)"
        }
      },
      {
        "key": "api:apps/innergathering/src/app/api/pipeline/cards/[cardId]/attachments/[attachmentId]/route.ts#DELETE",
        "service": [
          "lib/pipeline#removePipelineAttachment"
        ],
        "address": {
          "app": "innergathering",
          "path": "/hub/pipeline",
          "how": "the remove icon on an attachment (PipelineCardDialog.tsx)"
        }
      },
    ],
    "status": "the card lists no attachment with that id",
    "drift": "a thin mount of packages/pipeline createPipelineApi: the org is fixed, no board id crosses the wire, services org-deck re-checks the card or stack belongs to the org board (OrgDeckScopeError). Same file in amrit-canada (apps.amrit-canada.*.ts: sunjay-pipeline-attachment-delete); byte-identical bar log prefixes.\nMerged 2026-11-16 (consolidation 2): 6 rows, 6 apps (sunjay, amrit-canada, hidden-enneagram, ifac, elktours, innergathering). Differences by app:\n- amrit-canada (was amrit-pipeline-attachment-delete): a thin mount of packages/pipeline createPipelineApi: the org is fixed, no board id crosses the wire, services org-deck re-checks the card or stack belongs to the org board (OrgDeckScopeError). Same file in sunjay (apps.sunjay.*.ts: sunjay-pipeline-attachment-delete); byte-identical bar log prefixes.\n- hidden-enneagram (was he-pipeline-attachment-delete): Byte-identical to the ifac route (ifac-pipeline-* rows) (diffed all 16 files, identical bar the org id). The routes are already a thin mount of packages/pipeline createPipelineApi; org scoping is enforced in services org-deck (OrgDeckScopeError), no board id crosses the wire.\n- ifac (was ifac-pipeline-attachment-delete): Byte-identical to the hidden-enneagram route (diffed all 16 files, identical bar org id). The routes are already a thin mount of packages/pipeline createPipelineApi; org scoping is enforced in services org-deck (OrgDeckScopeError), no board id crosses the wire.\n- elktours (was elktours-pipeline-attachment-delete): Same pipeline routes and package are mounted in the other org apps that show a Deck board; ids and rules are shared in @elkdonis/pipeline.\n- innergathering (was ig-pipeline-file-remove): Same route in the other five org apps.\namrit-canada is the oldest site and much of it is being left behind: do not let its shape become the canonical.",
    "canonical": "packages/pipeline createPipelineApi + services org-deck (already shared)",
    "verified": "2026-11-16 read app/api/pipeline/**/route.ts (17 files), lib/pipeline.ts, lib/pipeline-api.ts, packages/pipeline routes.ts, services org-deck.ts",
    "confirm": {
      "text": "Remove “{file}” from the card “{title}”? This cannot be undone.",
      "status": "draft",
      "wave": 6
    },
    "inputs": "cardId, attachmentId"
  }
];

export default { capabilities, ignored: [] } satisfies Area;

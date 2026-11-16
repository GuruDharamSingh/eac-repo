import type { Area, Capability } from '../types';

// fourthwayBookreaders circle: round 2 curator, 2026-11-16. Conventions: atlas/JOURNAL.md. Generated from a structured definition.

const capabilities: Capability[] = [
  {
    "area": "fourthway.circle",
    "scope": "org",
    "risk": [
      "public"
    ],
    "id": "fourthway-circle-create",
    "label": "Start a reading group",
    "does": "An owner or guide starts a reading group: a thread of kind reading_group with its book, schedule, RSVP rules and (best effort) its folder, Talk room and members-only discussion feed.",
    "class": "person",
    "actors": [
      "owner",
      "guide"
    ],
    "hosts": [
      {
        "key": "sa:apps/fourthwayBookreaders/src/lib/manage-actions.ts#createReadingGroup",
        "service": [
          "@elkdonis/services#createThread",
          "@elkdonis/services#ensureCircleSpace",
          "(raw UPDATE threads recurrence)"
        ],
        "address": {
          "app": "fourthwayBookreaders",
          "path": "/manage/groups/new",
          "how": "the new-group form (app/manage/groups/new/page.tsx, a server-action form)"
        }
      },
      {
        "key": "sql:apps/fourthwayBookreaders/src/lib/manage-actions.ts#createReadingGroup",
        "note": "sql twin of sa:apps/fourthwayBookreaders/src/lib/manage-actions.ts#createReadingGroup"
      }
    ],
    "entry": null,
    "status": "a threads row of kind reading_group exists for the org with the title (status published or draft)",
    "confirm": {
      "text": "Start the reading group “{title}” on {org}? If you publish it, anyone can see it and join.",
      "status": "draft",
      "wave": 6
    },
    "drift": "Only fourthwayBookreaders has reading circles; no copies elsewhere. Related to elktours/ifac \"create a series\" (orgapps.meetings:org-series-create): a different model (reading_group thread with circle metadata, not a series).",
    "canonical": "one shared reading-circle kit action set in services (reading-circle.ts is already the service; these server actions are the only copy: no other app has circle actions)",
    "verified": "2026-11-16 read lib/circle-actions.ts, lib/manage-actions.ts, lib/auth.ts, components/circle/{circle-manage,circle-page,circle-surfaces}.tsx, components/group-panels.tsx, services reading-circle.ts ensureCircleSessionTopic"
  },
  {
    "area": "fourthway.circle",
    "scope": "thread",
    "risk": [
      "others"
    ],
    "id": "fourthway-circle-space-setup",
    "label": "Set up the circle's space",
    "does": "An owner or guide makes the circle's folder, Talk room and discussion feed (each only when missing).",
    "class": "person",
    "actors": [
      "owner",
      "guide"
    ],
    "hosts": [
      {
        "key": "sa:apps/fourthwayBookreaders/src/lib/circle-actions.ts#setUpCircleSpace",
        "service": [
          "@elkdonis/services#ensureCircleSpace"
        ],
        "address": {
          "app": "fourthwayBookreaders",
          "path": "/groups/{group}",
          "how": "the 'Set up the circle's space' button of components/circle/circle-page.tsx"
        }
      }
    ],
    "entry": null,
    "status": "the circle's metadata has folder, Talk token and feedSlug (ensureCircleSpace result, no warnings)",
    "confirm": {
      "text": "Set up the folder, chat room and discussion for “{title}”? Members of {org} get access to them.",
      "status": "draft",
      "wave": 6
    },
    "drift": "Only fourthwayBookreaders has reading circles; no copies elsewhere. createReadingGroup also calls ensureCircleSpace (best effort); this is the retry.",
    "canonical": "one shared reading-circle kit action set in services (reading-circle.ts is already the service; these server actions are the only copy: no other app has circle actions)",
    "verified": "2026-11-16 read lib/circle-actions.ts, lib/manage-actions.ts, lib/auth.ts, components/circle/{circle-manage,circle-page,circle-surfaces}.tsx, components/group-panels.tsx, services reading-circle.ts ensureCircleSessionTopic"
  },
  {
    "area": "fourthway.circle",
    "scope": "thread",
    "risk": [
      "public"
    ],
    "id": "fourthway-circle-units-add",
    "label": "Add readings to a circle's plan",
    "does": "An owner or guide adds units (one per line: label | title | length | file) to the circle plan. A file name is resolved inside the circle Material folder or from the org root.",
    "class": "person",
    "actors": [
      "owner",
      "guide"
    ],
    "hosts": [
      {
        "key": "sa:apps/fourthwayBookreaders/src/lib/circle-actions.ts#addCircleUnitsAction",
        "service": [
          "@elkdonis/services#addCircleUnits"
        ],
        "address": {
          "app": "fourthwayBookreaders",
          "path": "/groups/{group}#plan",
          "how": "the plan form of components/circle/circle-manage.tsx"
        }
      }
    ],
    "entry": null,
    "status": "circle_units has rows for the group with the titles",
    "confirm": {
      "text": "Add {count} readings to the plan of “{title}”? Members see them on the group page.",
      "status": "draft",
      "wave": 6
    },
    "drift": "Only fourthwayBookreaders has reading circles; no copies elsewhere.",
    "canonical": "one shared reading-circle kit action set in services (reading-circle.ts is already the service; these server actions are the only copy: no other app has circle actions)",
    "open": "SECURITY: addCircleUnitsAction (circle-actions.ts:108-117) takes sourcePath from the form; a name with \"/\" is used as a path from the ORG root (leading slashes stripped), only \"..\" is refused. An editor can point a unit at any file in the org storage, including private folders, and members reading the unit then get it if /api/circle-file serves by unit path (not re-read). Editors only.",
    "verified": "2026-11-16 read lib/circle-actions.ts, lib/manage-actions.ts, lib/auth.ts, components/circle/{circle-manage,circle-page,circle-surfaces}.tsx, components/group-panels.tsx, services reading-circle.ts ensureCircleSessionTopic"
  },
  {
    "area": "fourthway.circle",
    "scope": "thread",
    "risk": [
      "none"
    ],
    "id": "fourthway-circle-unit-status",
    "label": "Set a reading as planned, done or skipped",
    "does": "An owner or guide changes the status of one unit in the circle plan.",
    "class": "internal",
    "actors": [
      "owner",
      "guide"
    ],
    "hosts": [
      {
        "key": "sa:apps/fourthwayBookreaders/src/lib/circle-actions.ts#setCircleUnitStatus",
        "service": [
          "@elkdonis/services#updateCircleUnit"
        ],
        "address": {
          "app": "fourthwayBookreaders",
          "path": "/groups/{group}#plan",
          "how": "the status select of components/circle/circle-manage.tsx"
        }
      }
    ],
    "status": "the circle_units row has the status",
    "drift": "Only fourthwayBookreaders has reading circles; no copies elsewhere.",
    "canonical": "one shared reading-circle kit action set in services (reading-circle.ts is already the service; these server actions are the only copy: no other app has circle actions)",
    "verified": "2026-11-16 read lib/circle-actions.ts, lib/manage-actions.ts, lib/auth.ts, components/circle/{circle-manage,circle-page,circle-surfaces}.tsx, components/group-panels.tsx, services reading-circle.ts ensureCircleSessionTopic"
  },
  {
    "area": "fourthway.circle",
    "scope": "thread",
    "risk": [
      "none"
    ],
    "id": "fourthway-circle-unit-move",
    "label": "Move a reading up or down",
    "does": "An owner or guide moves a unit one place up or down in the plan.",
    "class": "internal",
    "actors": [
      "owner",
      "guide"
    ],
    "hosts": [
      {
        "key": "sa:apps/fourthwayBookreaders/src/lib/circle-actions.ts#moveCircleUnitAction",
        "service": [
          "@elkdonis/services#moveCircleUnit"
        ],
        "address": {
          "app": "fourthwayBookreaders",
          "path": "/groups/{group}#plan",
          "how": "the up/down buttons of components/circle/circle-manage.tsx"
        }
      }
    ],
    "status": "the unit position changed",
    "drift": "Only fourthwayBookreaders has reading circles; no copies elsewhere.",
    "canonical": "one shared reading-circle kit action set in services (reading-circle.ts is already the service; these server actions are the only copy: no other app has circle actions)",
    "verified": "2026-11-16 read lib/circle-actions.ts, lib/manage-actions.ts, lib/auth.ts, components/circle/{circle-manage,circle-page,circle-surfaces}.tsx, components/group-panels.tsx, services reading-circle.ts ensureCircleSessionTopic"
  },
  {
    "area": "fourthway.circle",
    "scope": "thread",
    "risk": [
      "irreversible",
      "public"
    ],
    "id": "fourthway-circle-unit-remove",
    "label": "Remove a reading from the plan",
    "does": "An owner or guide removes a unit from the plan.",
    "class": "person",
    "actors": [
      "owner",
      "guide"
    ],
    "hosts": [
      {
        "key": "sa:apps/fourthwayBookreaders/src/lib/circle-actions.ts#removeCircleUnitAction",
        "service": [
          "@elkdonis/services#removeCircleUnit"
        ],
        "address": {
          "app": "fourthwayBookreaders",
          "path": "/groups/{group}#plan",
          "how": "the Remove button of components/circle/circle-manage.tsx"
        }
      }
    ],
    "entry": null,
    "status": "no circle_units row with that id",
    "confirm": {
      "text": "Remove “{title}” from the plan of {org}’s group? Any stops recorded against it may lose their link. This cannot be undone.",
      "status": "draft",
      "wave": 6
    },
    "drift": "Only fourthwayBookreaders has reading circles; no copies elsewhere.",
    "canonical": "one shared reading-circle kit action set in services (reading-circle.ts is already the service; these server actions are the only copy: no other app has circle actions)",
    "verified": "2026-11-16 read lib/circle-actions.ts, lib/manage-actions.ts, lib/auth.ts, components/circle/{circle-manage,circle-page,circle-surfaces}.tsx, components/group-panels.tsx, services reading-circle.ts ensureCircleSessionTopic"
  },
  {
    "area": "fourthway.circle",
    "scope": "thread",
    "risk": [
      "public"
    ],
    "id": "fourthway-circle-stop-record",
    "label": "Record where the group stopped",
    "does": "The host of that sitting, or an owner or guide, records the unit and position the group reached, whether it finished, and a note; a pasted passage also becomes the public home-page excerpt.",
    "class": "person",
    "actors": [
      "member",
      "guide",
      "owner"
    ],
    "hosts": [
      {
        "key": "sa:apps/fourthwayBookreaders/src/lib/circle-actions.ts#recordCircleStopAction",
        "service": [
          "@elkdonis/services#recordCircleStop",
          "@elkdonis/services#updateCircleMeta"
        ],
        "address": {
          "app": "fourthwayBookreaders",
          "path": "/groups/{group}#manage",
          "how": "the 'We stopped here' form in the manage section (components/circle/circle-manage.tsx)"
        }
      }
    ],
    "entry": null,
    "status": "meeting_occurrence_notes (circle stop) has a row for the sitting and unit",
    "confirm": {
      "text": "Record that the group stopped at {where} on {when}? The passage you paste shows on {org}’s home page.",
      "status": "draft",
      "wave": 6
    },
    "drift": "Only fourthwayBookreaders has reading circles; no copies elsewhere.",
    "canonical": "one shared reading-circle kit action set in services (reading-circle.ts is already the service; these server actions are the only copy: no other app has circle actions)",
    "open": "Gate is hostOrEditor: getApiMember (member or above) and either canEdit or the holder of the host role for that occurrence. The unit is checked against the group (listCircleUnits). The excerpt update repeats the host check, good.",
    "verified": "2026-11-16 read lib/circle-actions.ts, lib/manage-actions.ts, lib/auth.ts, components/circle/{circle-manage,circle-page,circle-surfaces}.tsx, components/group-panels.tsx, services reading-circle.ts ensureCircleSessionTopic"
  },
  {
    "area": "fourthway.circle",
    "scope": "thread",
    "risk": [
      "others"
    ],
    "id": "fourthway-session-stage",
    "label": "Open session topics ahead of time",
    "does": "An owner or guide creates the discussion topic for one sitting, or for the next 1 to 12 sittings (published, organisation-visible, RSVP enabled).",
    "class": "internal",
    "actors": [
      "owner",
      "guide"
    ],
    "hosts": [
      {
        "key": "sa:apps/fourthwayBookreaders/src/lib/circle-actions.ts#stageCircleSession",
        "service": [
          "@elkdonis/services#ensureCircleSessionTopic"
        ],
        "address": {
          "app": "fourthwayBookreaders",
          "path": "/groups/{group}#sessions",
          "how": "the Stage button of components/circle/circle-manage.tsx"
        }
      },
      {
        "key": "sa:apps/fourthwayBookreaders/src/lib/circle-actions.ts#stageNextCircleSessions",
        "service": [
          "@elkdonis/services#occurrencesOf",
          "@elkdonis/services#ensureCircleSessionTopic"
        ],
        "address": {
          "app": "fourthwayBookreaders",
          "path": "/groups/{group}#manage",
          "how": "the 'Stage the next sittings' form of components/circle/circle-manage.tsx"
        }
      }
    ],
    "status": "threads has a post with metadata circleSession for each sitting",
    "drift": "Only fourthwayBookreaders has reading circles; no copies elsewhere.",
    "canonical": "one shared reading-circle kit action set in services (reading-circle.ts is already the service; these server actions are the only copy: no other app has circle actions)",
    "verified": "2026-11-16 read lib/circle-actions.ts, lib/manage-actions.ts, lib/auth.ts, components/circle/{circle-manage,circle-page,circle-surfaces}.tsx, components/group-panels.tsx, services reading-circle.ts ensureCircleSessionTopic"
  },
  {
    "area": "fourthway.circle",
    "scope": "thread",
    "risk": [
      "others"
    ],
    "id": "fourthway-session-doc-create",
    "label": "Start a sitting's shared document",
    "does": "Anyone with a role in the org makes the collaborative document for one sitting (once).",
    "class": "person",
    "actors": [
      "viewer",
      "member",
      "guide",
      "owner"
    ],
    "hosts": [
      {
        "key": "sa:apps/fourthwayBookreaders/src/lib/circle-actions.ts#createSessionDocument",
        "service": [
          "@elkdonis/services#ensureCircleSessionDocument"
        ],
        "address": {
          "app": "fourthwayBookreaders",
          "path": "/groups/{group}#sessions",
          "how": "the Start document button of components/circle/circle-page.tsx"
        }
      }
    ],
    "entry": null,
    "status": "the sitting topic has a documentUrl",
    "confirm": {
      "text": "Start the shared document for the {when} sitting of “{title}”? Everyone in the group can edit it.",
      "status": "draft",
      "wave": 6
    },
    "drift": "Only fourthwayBookreaders has reading circles; no copies elsewhere.",
    "canonical": "one shared reading-circle kit action set in services (reading-circle.ts is already the service; these server actions are the only copy: no other app has circle actions)",
    "open": "SECURITY: gated by getApiAffiliate (lib/auth.ts:84), any role including viewer (a follower or someone who joined a group), by owner decision 2026-09-26 (auth.ts comment). ensureCircleSessionTopic(orgId, circleId, occurrenceAt, actor) (services reading-circle.ts:738-783) never checks occurrenceAt is a real sitting of the schedule, so any follower can create a published, organisation-visible, RSVP-enabled topic for any timestamp, and each call for a new timestamp adds one thread (and a thread_gathers edge). No rate limit on this route.",
    "verified": "2026-11-16 read lib/circle-actions.ts, lib/manage-actions.ts, lib/auth.ts, components/circle/{circle-manage,circle-page,circle-surfaces}.tsx, components/group-panels.tsx, services reading-circle.ts ensureCircleSessionTopic"
  },
  {
    "area": "fourthway.circle",
    "scope": "thread",
    "risk": [
      "public"
    ],
    "id": "fourthway-session-comment-post",
    "label": "Comment on a sitting",
    "does": "Anyone with a role in the org posts a comment on a sitting topic (a forum reply).",
    "class": "person",
    "actors": [
      "viewer",
      "member",
      "guide",
      "owner"
    ],
    "hosts": [
      {
        "key": "sa:apps/fourthwayBookreaders/src/lib/circle-actions.ts#postSessionComment",
        "service": [
          "@elkdonis/services#postReply"
        ],
        "address": {
          "app": "fourthwayBookreaders",
          "path": "/groups/{group}#sessions",
          "how": "the comment box of components/circle/circle-page.tsx"
        }
      }
    ],
    "entry": null,
    "status": "replies has a row on the sitting topic by the person",
    "confirm": {
      "text": "Post your comment on the {when} sitting of “{title}”? Everyone in the group can read it.",
      "status": "draft",
      "wave": 6
    },
    "drift": "Only fourthwayBookreaders has reading circles; no copies elsewhere.",
    "canonical": "one shared reading-circle kit action set in services (reading-circle.ts is already the service; these server actions are the only copy: no other app has circle actions)",
    "open": "SECURITY: gated by getApiAffiliate (lib/auth.ts:84), any role including viewer (a follower or someone who joined a group), by owner decision 2026-09-26 (auth.ts comment). ensureCircleSessionTopic(orgId, circleId, occurrenceAt, actor) (services reading-circle.ts:738-783) never checks occurrenceAt is a real sitting of the schedule, so any follower can create a published, organisation-visible, RSVP-enabled topic for any timestamp, and each call for a new timestamp adds one thread (and a thread_gathers edge). No rate limit on this route.",
    "verified": "2026-11-16 read lib/circle-actions.ts, lib/manage-actions.ts, lib/auth.ts, components/circle/{circle-manage,circle-page,circle-surfaces}.tsx, components/group-panels.tsx, services reading-circle.ts ensureCircleSessionTopic"
  },
  {
    "area": "fourthway.circle",
    "scope": "thread",
    "risk": [
      "public"
    ],
    "id": "fourthway-session-thread-start",
    "label": "Start a thread from a sitting",
    "does": "Anyone with a role in the org starts a post in the circle's discussion feed, gathered onto the sitting; Save draft keeps it private, otherwise it publishes (subject to review).",
    "class": "person",
    "actors": [
      "viewer",
      "member",
      "guide",
      "owner"
    ],
    "hosts": [
      {
        "key": "sa:apps/fourthwayBookreaders/src/lib/circle-actions.ts#createSessionThread",
        "service": [
          "@elkdonis/services#createThread",
          "@elkdonis/services#gatherOnto"
        ],
        "address": {
          "app": "fourthwayBookreaders",
          "path": "/groups/{group}#sessions",
          "how": "the compose pop-up opened from components/circle/circle-surfaces.tsx"
        }
      }
    ],
    "entry": null,
    "status": "a threads post exists in the circle feed gathered onto the sitting topic",
    "confirm": {
      "text": "Post “{title}” in the discussion of “{group}”? Everyone in the group can read it.",
      "status": "draft",
      "wave": 6
    },
    "drift": "Only fourthwayBookreaders has reading circles; no copies elsewhere.",
    "canonical": "one shared reading-circle kit action set in services (reading-circle.ts is already the service; these server actions are the only copy: no other app has circle actions)",
    "open": "createSessionThread takes {groupId, occurrenceAt, title, body, status} as a plain object, not a form. SECURITY: gated by getApiAffiliate (lib/auth.ts:84), any role including viewer (a follower or someone who joined a group), by owner decision 2026-09-26 (auth.ts comment). ensureCircleSessionTopic(orgId, circleId, occurrenceAt, actor) (services reading-circle.ts:738-783) never checks occurrenceAt is a real sitting of the schedule, so any follower can create a published, organisation-visible, RSVP-enabled topic for any timestamp, and each call for a new timestamp adds one thread (and a thread_gathers edge). No rate limit on this route.",
    "verified": "2026-11-16 read lib/circle-actions.ts, lib/manage-actions.ts, lib/auth.ts, components/circle/{circle-manage,circle-page,circle-surfaces}.tsx, components/group-panels.tsx, services reading-circle.ts ensureCircleSessionTopic"
  },
  {
    "area": "fourthway.circle",
    "scope": "thread",
    "risk": [
      "others"
    ],
    "id": "fourthway-session-rsvp",
    "label": "Say you are coming to a sitting",
    "does": "Anyone with a role in the org RSVPs yes to one sitting, or withdraws.",
    "class": "person",
    "actors": [
      "viewer",
      "member",
      "guide",
      "owner"
    ],
    "hosts": [
      {
        "key": "sa:apps/fourthwayBookreaders/src/lib/circle-actions.ts#rsvpSession",
        "service": [
          "@elkdonis/services#setRsvpStatus",
          "@elkdonis/services#deleteRsvp"
        ],
        "address": {
          "app": "fourthwayBookreaders",
          "path": "/groups/{group}#sessions",
          "how": "the Going / Not going buttons of components/circle/circle-page.tsx"
        }
      }
    ],
    "entry": null,
    "status": "thread_rsvps has a yes row for the sitting topic",
    "confirm": {
      "text": "Say you are coming to the {when} sitting of “{title}”? The group sees your name on the list.",
      "status": "draft",
      "wave": 6
    },
    "drift": "Only fourthwayBookreaders has reading circles; no copies elsewhere.",
    "canonical": "one shared reading-circle kit action set in services (reading-circle.ts is already the service; these server actions are the only copy: no other app has circle actions)",
    "open": "SECURITY: gated by getApiAffiliate (lib/auth.ts:84), any role including viewer (a follower or someone who joined a group), by owner decision 2026-09-26 (auth.ts comment). ensureCircleSessionTopic(orgId, circleId, occurrenceAt, actor) (services reading-circle.ts:738-783) never checks occurrenceAt is a real sitting of the schedule, so any follower can create a published, organisation-visible, RSVP-enabled topic for any timestamp, and each call for a new timestamp adds one thread (and a thread_gathers edge). No rate limit on this route.",
    "verified": "2026-11-16 read lib/circle-actions.ts, lib/manage-actions.ts, lib/auth.ts, components/circle/{circle-manage,circle-page,circle-surfaces}.tsx, components/group-panels.tsx, services reading-circle.ts ensureCircleSessionTopic"
  },
  {
    "area": "fourthway.circle",
    "scope": "thread",
    "risk": [
      "others"
    ],
    "id": "fourthway-session-notes-save",
    "label": "Write a sitting's notes",
    "does": "The host of a sitting, or an owner or guide, saves the notes for that sitting.",
    "class": "person",
    "actors": [
      "member",
      "guide",
      "owner"
    ],
    "hosts": [
      {
        "key": "sa:apps/fourthwayBookreaders/src/lib/circle-actions.ts#saveSessionNotes",
        "service": [
          "@elkdonis/services#setCircleSessionNotes"
        ],
        "address": {
          "app": "fourthwayBookreaders",
          "path": "/groups/{group}#sessions",
          "how": "the notes form of components/circle/circle-manage.tsx"
        }
      }
    ],
    "entry": null,
    "status": "meeting_occurrence_notes has the notes",
    "confirm": {
      "text": "Save the notes for the {when} sitting of “{title}”? Members of the group can read them.",
      "status": "draft",
      "wave": 6
    },
    "drift": "Only fourthwayBookreaders has reading circles; no copies elsewhere.",
    "canonical": "one shared reading-circle kit action set in services (reading-circle.ts is already the service; these server actions are the only copy: no other app has circle actions)",
    "verified": "2026-11-16 read lib/circle-actions.ts, lib/manage-actions.ts, lib/auth.ts, components/circle/{circle-manage,circle-page,circle-surfaces}.tsx, components/group-panels.tsx, services reading-circle.ts ensureCircleSessionTopic"
  },
  {
    "area": "fourthway.circle",
    "scope": "thread",
    "risk": [
      "others"
    ],
    "id": "fourthway-session-plan-save",
    "label": "Say what a sitting is for",
    "does": "The host of a sitting, or an owner or guide, saves the plan line for that sitting.",
    "class": "person",
    "actors": [
      "member",
      "guide",
      "owner"
    ],
    "hosts": [
      {
        "key": "sa:apps/fourthwayBookreaders/src/lib/circle-actions.ts#saveSessionPlan",
        "service": [
          "@elkdonis/services#setCircleSessionPlan"
        ],
        "address": {
          "app": "fourthwayBookreaders",
          "path": "/groups/{group}#manage",
          "how": "the plan line of components/circle/circle-manage.tsx"
        }
      }
    ],
    "entry": null,
    "status": "meeting_occurrence_notes has the plan line",
    "confirm": {
      "text": "Save the plan for the {when} sitting of “{title}”? Members of the group can read it.",
      "status": "draft",
      "wave": 6
    },
    "drift": "Only fourthwayBookreaders has reading circles; no copies elsewhere.",
    "canonical": "one shared reading-circle kit action set in services (reading-circle.ts is already the service; these server actions are the only copy: no other app has circle actions)",
    "verified": "2026-11-16 read lib/circle-actions.ts, lib/manage-actions.ts, lib/auth.ts, components/circle/{circle-manage,circle-page,circle-surfaces}.tsx, components/group-panels.tsx, services reading-circle.ts ensureCircleSessionTopic"
  },
  {
    "area": "fourthway.circle",
    "scope": "thread",
    "risk": [
      "others"
    ],
    "id": "fourthway-session-host-set",
    "label": "Choose who hosts a sitting",
    "does": "An owner or guide assigns, or clears, the host of one sitting.",
    "class": "person",
    "actors": [
      "owner",
      "guide"
    ],
    "hosts": [
      {
        "key": "sa:apps/fourthwayBookreaders/src/lib/circle-actions.ts#setSessionHost",
        "service": [
          "@elkdonis/services#assignMeetingRole",
          "@elkdonis/services#clearMeetingRole"
        ],
        "address": {
          "app": "fourthwayBookreaders",
          "path": "/groups/{group}#manage",
          "how": "the host select of components/circle/circle-manage.tsx"
        }
      }
    ],
    "entry": null,
    "status": "meeting_hosts has a host row for the sitting",
    "confirm": {
      "text": "Make {person} the host of the {when} sitting of “{title}”? They can then write its notes and record where the group stopped.",
      "status": "draft",
      "wave": 6
    },
    "drift": "Only fourthwayBookreaders has reading circles; no copies elsewhere.",
    "canonical": "one shared reading-circle kit action set in services (reading-circle.ts is already the service; these server actions are the only copy: no other app has circle actions)",
    "open": "SECURITY: userId comes from the form (circle-actions.ts:298) and goes to assignMeetingRole (services meeting-rota.ts:234), which inserts without checking the person is in this org. A host outside the org still cannot act, because hostOrEditor requires getApiMember (circle-actions.ts:209-211), so the effect is limited to a stray row.",
    "verified": "2026-11-16 read lib/circle-actions.ts, lib/manage-actions.ts, lib/auth.ts, components/circle/{circle-manage,circle-page,circle-surfaces}.tsx, components/group-panels.tsx, services reading-circle.ts ensureCircleSessionTopic"
  },
  {
    "area": "fourthway.circle",
    "scope": "thread",
    "risk": [
      "public"
    ],
    "id": "fourthway-circle-schedule-save",
    "label": "Set a circle's schedule",
    "does": "An owner or guide sets start time, repeat (daily, weekly, monthly), length and end date of the circle.",
    "class": "person",
    "actors": [
      "owner",
      "guide"
    ],
    "hosts": [
      {
        "key": "sa:apps/fourthwayBookreaders/src/lib/circle-actions.ts#saveCircleSchedule",
        "service": [
          "@elkdonis/services#setCircleSchedule"
        ],
        "address": {
          "app": "fourthwayBookreaders",
          "path": "/groups/{group}#manage",
          "how": "the schedule form of components/circle/circle-manage.tsx"
        }
      }
    ],
    "entry": null,
    "status": "threads has scheduled_at, recurrence_pattern and until for the group",
    "confirm": {
      "text": "Set “{title}” to meet {when}? The group page and calendar show the new times.",
      "status": "draft",
      "wave": 6
    },
    "drift": "Only fourthwayBookreaders has reading circles; no copies elsewhere.",
    "canonical": "one shared reading-circle kit action set in services (reading-circle.ts is already the service; these server actions are the only copy: no other app has circle actions)",
    "verified": "2026-11-16 read lib/circle-actions.ts, lib/manage-actions.ts, lib/auth.ts, components/circle/{circle-manage,circle-page,circle-surfaces}.tsx, components/group-panels.tsx, services reading-circle.ts ensureCircleSessionTopic"
  },
  {
    "area": "fourthway.circle",
    "scope": "thread",
    "risk": [
      "public"
    ],
    "id": "fourthway-circle-structure-save",
    "label": "Write the circle's structure",
    "does": "An owner or guide saves the rich-text description of how the group meets and its pace.",
    "class": "person",
    "actors": [
      "owner",
      "guide"
    ],
    "hosts": [
      {
        "key": "sa:apps/fourthwayBookreaders/src/lib/circle-actions.ts#saveCircleStructure",
        "service": [
          "@elkdonis/services#updateCircleMeta",
          "@elkdonis/utils#sanitizeRichText"
        ],
        "address": {
          "app": "fourthwayBookreaders",
          "path": "/groups/{group}#manage",
          "how": "the structure editor of components/circle/circle-manage.tsx"
        }
      }
    ],
    "entry": null,
    "status": "the circle metadata holds the sanitised structure",
    "confirm": {
      "text": "Save how “{title}” meets? The home page and group page show it.",
      "status": "draft",
      "wave": 6
    },
    "drift": "Only fourthwayBookreaders has reading circles; no copies elsewhere.",
    "canonical": "one shared reading-circle kit action set in services (reading-circle.ts is already the service; these server actions are the only copy: no other app has circle actions)",
    "verified": "2026-11-16 read lib/circle-actions.ts, lib/manage-actions.ts, lib/auth.ts, components/circle/{circle-manage,circle-page,circle-surfaces}.tsx, components/group-panels.tsx, services reading-circle.ts ensureCircleSessionTopic"
  },
  {
    "area": "fourthway.circle",
    "scope": "thread",
    "risk": [
      "public"
    ],
    "id": "fourthway-circle-cover-save",
    "label": "Choose the circle's cover picture",
    "does": "An owner or guide sets (or clears) the cover to a picture in this organisation’s own media folder.",
    "class": "person",
    "actors": [
      "owner",
      "guide"
    ],
    "hosts": [
      {
        "key": "sa:apps/fourthwayBookreaders/src/lib/circle-actions.ts#saveCircleCover",
        "service": [
          "@elkdonis/services#setCircleCover"
        ],
        "address": {
          "app": "fourthwayBookreaders",
          "path": "/groups/{group}#manage",
          "how": "the cover picker of components/circle/circle-manage.tsx"
        }
      }
    ],
    "entry": null,
    "status": "the circle metadata holds the cover url",
    "confirm": {
      "text": "Use this picture as the cover of “{title}”? Visitors see it on the group page.",
      "status": "draft",
      "wave": 6
    },
    "drift": "Only fourthwayBookreaders has reading circles; no copies elsewhere.",
    "canonical": "one shared reading-circle kit action set in services (reading-circle.ts is already the service; these server actions are the only copy: no other app has circle actions)",
    "open": "Good: the action refuses any url outside /api/media/EAC_Network/<org>/ (circle-actions.ts:393), stricter than the avatar and gallery fields elsewhere.",
    "verified": "2026-11-16 read lib/circle-actions.ts, lib/manage-actions.ts, lib/auth.ts, components/circle/{circle-manage,circle-page,circle-surfaces}.tsx, components/group-panels.tsx, services reading-circle.ts ensureCircleSessionTopic"
  },
  {
    "area": "fourthway.circle",
    "scope": "thread",
    "risk": [
      "public"
    ],
    "id": "fourthway-circle-excerpt-save",
    "label": "Post or clear the home-page passage",
    "does": "An owner or guide posts a passage (text, where it is from, a page) on the home page, or clears it.",
    "class": "person",
    "actors": [
      "owner",
      "guide"
    ],
    "hosts": [
      {
        "key": "sa:apps/fourthwayBookreaders/src/lib/circle-actions.ts#saveCircleExcerpt",
        "service": [
          "@elkdonis/services#updateCircleMeta"
        ],
        "address": {
          "app": "fourthwayBookreaders",
          "path": "/groups/{group}#manage",
          "how": "the passage form of components/circle/circle-manage.tsx"
        }
      }
    ],
    "entry": null,
    "status": "the circle metadata holds the excerpt",
    "confirm": {
      "text": "Show this passage on {org}’s home page? Anyone who visits can read it.",
      "status": "draft",
      "wave": 6
    },
    "drift": "Only fourthwayBookreaders has reading circles; no copies elsewhere.",
    "canonical": "one shared reading-circle kit action set in services (reading-circle.ts is already the service; these server actions are the only copy: no other app has circle actions)",
    "open": "The passage is plain text (excerptFrom caps it at 6,000 characters); whether the home page escapes it was not read.",
    "verified": "2026-11-16 read lib/circle-actions.ts, lib/manage-actions.ts, lib/auth.ts, components/circle/{circle-manage,circle-page,circle-surfaces}.tsx, components/group-panels.tsx, services reading-circle.ts ensureCircleSessionTopic"
  },
  {
    "area": "fourthway.circle",
    "scope": "org",
    "risk": [
      "public"
    ],
    "id": "fourthway-circle-featured-set",
    "label": "Feature a group on the home page",
    "does": "An owner or guide chooses which reading group the home page features, or clears it.",
    "class": "person",
    "actors": [
      "owner",
      "guide"
    ],
    "hosts": [
      {
        "key": "sa:apps/fourthwayBookreaders/src/lib/circle-actions.ts#setFeaturedGroup",
        "service": [
          "(raw INSERT org_site_sections featured_group, raw DELETE)"
        ],
        "address": {
          "app": "fourthwayBookreaders",
          "path": "/manage/groups",
          "how": "the Feature button of app/manage/groups/page.tsx"
        }
      },
      {
        "key": "sql:apps/fourthwayBookreaders/src/lib/circle-actions.ts#setFeaturedGroup",
        "note": "sql twin of sa:apps/fourthwayBookreaders/src/lib/circle-actions.ts#setFeaturedGroup"
      }
    ],
    "entry": null,
    "status": "org_site_sections has a featured_group row for the org with the thread id",
    "confirm": {
      "text": "Feature “{title}” on {org}’s home page? Visitors see it at the top.",
      "status": "draft",
      "wave": 6
    },
    "drift": "Only fourthwayBookreaders has reading circles; no copies elsewhere.",
    "canonical": "one shared reading-circle kit action set in services (reading-circle.ts is already the service; these server actions are the only copy: no other app has circle actions)",
    "verified": "2026-11-16 read lib/circle-actions.ts, lib/manage-actions.ts, lib/auth.ts, components/circle/{circle-manage,circle-page,circle-surfaces}.tsx, components/group-panels.tsx, services reading-circle.ts ensureCircleSessionTopic"
  },
  {
    "area": "fourthway.circle",
    "scope": "thread",
    "risk": [
      "public"
    ],
    "id": "fourthway-group-bookmark-set",
    "label": "Move a group's bookmark",
    "does": "An owner or guide sets the page a group has reached (merged into the group's metadata).",
    "class": "person",
    "actors": [
      "owner",
      "guide"
    ],
    "hosts": [
      {
        "key": "sa:apps/fourthwayBookreaders/src/lib/manage-actions.ts#setGroupPage",
        "service": [
          "(raw UPDATE threads metadata)"
        ],
        "address": {
          "app": "fourthwayBookreaders",
          "path": "/groups/{group}",
          "how": "the page form of components/group-panels.tsx"
        }
      },
      {
        "key": "sql:apps/fourthwayBookreaders/src/lib/manage-actions.ts#setGroupPage",
        "note": "sql twin of sa:apps/fourthwayBookreaders/src/lib/manage-actions.ts#setGroupPage"
      }
    ],
    "entry": null,
    "status": "threads.metadata.currentPage holds the page",
    "confirm": {
      "text": "Move the bookmark of “{title}” to page {count}? Visitors see where the group has got to.",
      "status": "draft",
      "wave": 6
    },
    "drift": "Only fourthwayBookreaders has reading circles; no copies elsewhere. recordCircleStopAction is the circle-model way to say where a sitting stopped; this older group panel writes metadata.currentPage directly.",
    "canonical": "one shared reading-circle kit action set in services (reading-circle.ts is already the service; these server actions are the only copy: no other app has circle actions)",
    "verified": "2026-11-16 read lib/circle-actions.ts, lib/manage-actions.ts, lib/auth.ts, components/circle/{circle-manage,circle-page,circle-surfaces}.tsx, components/group-panels.tsx, services reading-circle.ts ensureCircleSessionTopic"
  },
  {
    "area": "fourthway.circle",
    "scope": "thread",
    "risk": [
      "public"
    ],
    "id": "fourthway-group-sitting-record",
    "label": "Record a sitting as a post",
    "does": "An owner or guide records a sitting: notes, the pages read, a recording link become a published public post in the archive that the group produced; optionally the bookmark moves.",
    "class": "person",
    "actors": [
      "owner",
      "guide"
    ],
    "hosts": [
      {
        "key": "sa:apps/fourthwayBookreaders/src/lib/manage-actions.ts#addSessionNote",
        "service": [
          "@elkdonis/services#createThread",
          "@elkdonis/services#gatherOnto",
          "(raw UPDATE threads metadata)"
        ],
        "address": {
          "app": "fourthwayBookreaders",
          "path": "/groups/{group}",
          "how": "the 'Record a sitting' form of components/group-panels.tsx"
        }
      },
      {
        "key": "sql:apps/fourthwayBookreaders/src/lib/manage-actions.ts#addSessionNote",
        "note": "sql twin of sa:apps/fourthwayBookreaders/src/lib/manage-actions.ts#addSessionNote"
      }
    ],
    "entry": null,
    "status": "threads has a published post in the archive feed gathered 'produced' by the group",
    "confirm": {
      "text": "Publish the record of {where} for “{title}” in the archive? Anyone can read it.",
      "status": "draft",
      "wave": 6
    },
    "drift": "Only fourthwayBookreaders has reading circles; no copies elsewhere. Overlaps recordCircleStopAction and saveSessionNotes: three ways to record a sitting (old group panel, circle manage, circle sessions).",
    "canonical": "one shared reading-circle kit action set in services (reading-circle.ts is already the service; these server actions are the only copy: no other app has circle actions)",
    "open": "The notes are HTML-escaped before becoming <p> (manage-actions.ts:149-155), good; recordingUrl is allowed only for /api/media/ or https (manage-actions.ts:178): good. Visibility PUBLIC, status published with no review step, by an editor.",
    "verified": "2026-11-16 read lib/circle-actions.ts, lib/manage-actions.ts, lib/auth.ts, components/circle/{circle-manage,circle-page,circle-surfaces}.tsx, components/group-panels.tsx, services reading-circle.ts ensureCircleSessionTopic"
  },
];

export default { capabilities, ignored: [
  {
    "key": "sa:apps/fourthwayBookreaders/src/lib/circle-actions.ts#baselineCirclePlan",
    "why": "dead: no importer in app/ or components/ (grep of apps/fourthwayBookreaders/src); the plan UI never calls it"
  }
] } satisfies Area;

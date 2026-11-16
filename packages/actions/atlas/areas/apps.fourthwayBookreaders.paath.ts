import type { Area, Capability } from '../types';

// fourthwayBookreaders akhand path: round 2 curator, 2026-11-16. Conventions: atlas/JOURNAL.md. Generated from a structured definition.

const capabilities: Capability[] = [
  {
    "area": "fourthway.paath",
    "scope": "thread",
    "risk": [
      "others"
    ],
    "id": "fourthway-paath-read",
    "label": "Check a passage off as read",
    "does": "A reader of the Akhand Path (the author, a yes RSVP, or any affiliate once the circle is public) marks a passage read, which moves the day stop point.",
    "class": "person",
    "actors": [
      "person"
    ],
    "hosts": [
      {
        "key": "api:apps/fourthwayBookreaders/src/app/api/akhand-path/read/route.ts#POST",
        "service": [
          "(lib/paath.ts markRead)"
        ],
        "address": {
          "app": "fourthwayBookreaders",
          "path": "/akhand-path",
          "how": "the Read button of components/paath/paath-reader.tsx"
        }
      },
      {
        "key": "sql:apps/fourthwayBookreaders/src/lib/paath.ts#markRead",
        "note": "sql twin of api:apps/fourthwayBookreaders/src/app/api/akhand-path/read/route.ts#POST"
      }
    ],
    "entry": null,
    "status": "circle_units.status is 'done' with done_at and done_by",
    "confirm": {
      "text": "Mark “{title}” as read? Others reading along see it ticked.",
      "status": "draft",
      "wave": 6
    },
    "drift": "No copy elsewhere: the Akhand Path is a fourthwayBookreaders-only reading of the Guru Granth Sahib over circle_units (see project SGGS corpus).",
    "canonical": "lib/paath.ts functions as the single path; move them into services reading-circle once a second circle uses the pattern",
    "open": "SECURITY (weak): any reader can tick, and (via unread) untick, any passage; done_by only records the first ticker, and markUnread clears it. With the circle public every affiliate (including followers, canReadPaath paath.ts:188-196) is a reader. By design for a shared reading, but there is no undo trail beyond the day note.",
    "verified": "2026-11-16 read lib/paath.ts, app/api/akhand-path/*/route.ts, components/paath/{paath-reader,day-note,admin-details}.tsx"
  },
  {
    "area": "fourthway.paath",
    "scope": "thread",
    "risk": [
      "none"
    ],
    "id": "fourthway-paath-unread",
    "label": "Put passages back as unread",
    "does": "A reader puts one or more recently read passages (up to 100) back to unread, moving each day stop point back.",
    "class": "internal",
    "actors": [
      "person"
    ],
    "hosts": [
      {
        "key": "api:apps/fourthwayBookreaders/src/app/api/akhand-path/unread/route.ts#POST",
        "service": [
          "(lib/paath.ts markUnread)"
        ],
        "address": {
          "app": "fourthwayBookreaders",
          "path": "/akhand-path",
          "how": "the 'Manage the reading' list of components/paath/paath-reader.tsx"
        }
      },
      {
        "key": "sql:apps/fourthwayBookreaders/src/lib/paath.ts#markUnread",
        "note": "sql twin of api:apps/fourthwayBookreaders/src/app/api/akhand-path/unread/route.ts#POST"
      }
    ],
    "status": "circle_units.status is 'planned' with no done_at",
    "drift": "No copy elsewhere: the Akhand Path is a fourthwayBookreaders-only reading of the Guru Granth Sahib over circle_units (see project SGGS corpus).",
    "canonical": "lib/paath.ts functions as the single path; move them into services reading-circle once a second circle uses the pattern",
    "verified": "2026-11-16 read lib/paath.ts, app/api/akhand-path/*/route.ts, components/paath/{paath-reader,day-note,admin-details}.tsx"
  },
  {
    "area": "fourthway.paath",
    "scope": "thread",
    "risk": [
      "others"
    ],
    "id": "fourthway-paath-note-add",
    "label": "Leave a thought on a passage",
    "does": "A reader adds a note (8,000 characters max) to a passage, under their name.",
    "class": "person",
    "actors": [
      "person"
    ],
    "hosts": [
      {
        "key": "api:apps/fourthwayBookreaders/src/app/api/akhand-path/note/route.ts#POST",
        "service": [
          "(lib/paath.ts addNote)"
        ],
        "address": {
          "app": "fourthwayBookreaders",
          "path": "/akhand-path",
          "how": "the thought box of components/paath/passage-card.tsx"
        }
      },
      {
        "key": "sql:apps/fourthwayBookreaders/src/lib/paath.ts#addNote",
        "note": "sql twin of api:apps/fourthwayBookreaders/src/app/api/akhand-path/note/route.ts#POST"
      }
    ],
    "entry": null,
    "status": "circle_unit_notes has a row by the person on the passage",
    "confirm": {
      "text": "Leave your thought on “{title}”? Everyone reading along can see it.",
      "status": "draft",
      "wave": 6
    },
    "drift": "No copy elsewhere: the Akhand Path is a fourthwayBookreaders-only reading of the Guru Granth Sahib over circle_units (see project SGGS corpus).",
    "canonical": "lib/paath.ts functions as the single path; move them into services reading-circle once a second circle uses the pattern",
    "verified": "2026-11-16 read lib/paath.ts, app/api/akhand-path/*/route.ts, components/paath/{paath-reader,day-note,admin-details}.tsx"
  },
  {
    "area": "fourthway.paath",
    "scope": "thread",
    "risk": [
      "none"
    ],
    "id": "fourthway-paath-note-remove",
    "label": "Remove my own thought",
    "does": "A reader soft-deletes their own note; never anyone else’s.",
    "class": "internal",
    "actors": [
      "person"
    ],
    "hosts": [
      {
        "key": "api:apps/fourthwayBookreaders/src/app/api/akhand-path/note/route.ts#DELETE",
        "service": [
          "(lib/paath.ts removeNote)"
        ],
        "address": {
          "app": "fourthwayBookreaders",
          "path": "/akhand-path",
          "how": "the remove link of a thought (components/paath/passage-card.tsx)"
        }
      },
      {
        "key": "sql:apps/fourthwayBookreaders/src/lib/paath.ts#removeNote",
        "note": "sql twin of api:apps/fourthwayBookreaders/src/app/api/akhand-path/note/route.ts#DELETE"
      }
    ],
    "status": "circle_unit_notes.deleted_at set",
    "drift": "No copy elsewhere: the Akhand Path is a fourthwayBookreaders-only reading of the Guru Granth Sahib over circle_units (see project SGGS corpus).",
    "canonical": "lib/paath.ts functions as the single path; move them into services reading-circle once a second circle uses the pattern",
    "open": "Ownership is enforced in the UPDATE (user_id = viewer, paath.ts:540-545): good.",
    "verified": "2026-11-16 read lib/paath.ts, app/api/akhand-path/*/route.ts, components/paath/{paath-reader,day-note,admin-details}.tsx"
  },
  {
    "area": "fourthway.paath",
    "scope": "thread",
    "risk": [
      "none"
    ],
    "id": "fourthway-paath-day-note-save",
    "label": "Write the day's note",
    "does": "A reader saves (or clears) the day note: how the reading went, who was there.",
    "class": "internal",
    "actors": [
      "person"
    ],
    "hosts": [
      {
        "key": "api:apps/fourthwayBookreaders/src/app/api/akhand-path/day/route.ts#POST",
        "service": [
          "(lib/paath.ts setDayNote)"
        ],
        "address": {
          "app": "fourthwayBookreaders",
          "path": "/akhand-path",
          "how": "components/paath/day-note.tsx"
        }
      },
      {
        "key": "sql:apps/fourthwayBookreaders/src/lib/paath.ts#setDayNote",
        "note": "sql twin of api:apps/fourthwayBookreaders/src/app/api/akhand-path/day/route.ts#POST"
      }
    ],
    "status": "meeting_occurrence_notes has the note for the day",
    "drift": "No copy elsewhere: the Akhand Path is a fourthwayBookreaders-only reading of the Guru Granth Sahib over circle_units (see project SGGS corpus).",
    "canonical": "lib/paath.ts functions as the single path; move them into services reading-circle once a second circle uses the pattern",
    "open": "SECURITY (weak): any reader overwrites the whole day note (last write wins; recorded_by replaced), not only its author (paath.ts:547-555).",
    "verified": "2026-11-16 read lib/paath.ts, app/api/akhand-path/*/route.ts, components/paath/{paath-reader,day-note,admin-details}.tsx"
  },
  {
    "area": "fourthway.paath",
    "scope": "thread",
    "risk": [
      "others"
    ],
    "id": "fourthway-paath-recording-upload",
    "label": "Save a recorded reading",
    "does": "A reader uploads a reading recorded in the browser (up to 400 MB, audio or video, sniffed) into the day's recordings folder.",
    "class": "person",
    "actors": [
      "person"
    ],
    "hosts": [
      {
        "key": "api:apps/fourthwayBookreaders/src/app/api/akhand-path/recording/route.ts#POST",
        "service": [
          "@elkdonis/utils#validateUploadBuffer",
          "(lib/paath.ts saveRecording)"
        ],
        "address": {
          "app": "fourthwayBookreaders",
          "path": "/akhand-path",
          "how": "the Record control of components/paath/paath-reader.tsx"
        }
      }
    ],
    "entry": null,
    "status": "a file exists in <circle folder>/Meeting Recordings/<day>",
    "confirm": {
      "text": "Save this recording to the circle folder for {when}? Other readers can listen to it.",
      "status": "draft",
      "wave": 6
    },
    "drift": "No copy elsewhere: the Akhand Path is a fourthwayBookreaders-only reading of the Guru Granth Sahib over circle_units (see project SGGS corpus).",
    "canonical": "lib/paath.ts functions as the single path; move them into services reading-circle once a second circle uses the pattern",
    "open": "startedAt comes from the client (clamped to now). Content sniffed (route.ts:30), good.",
    "verified": "2026-11-16 read lib/paath.ts, app/api/akhand-path/*/route.ts, components/paath/{paath-reader,day-note,admin-details}.tsx"
  },
  {
    "area": "fourthway.paath",
    "scope": "thread",
    "risk": [
      "others"
    ],
    "id": "fourthway-paath-call-record",
    "label": "Start or stop recording the call",
    "does": "A reader starts or stops the Talk room recording through the Nextcloud OCS API.",
    "class": "internal",
    "actors": [
      "person"
    ],
    "hosts": [
      {
        "key": "api:apps/fourthwayBookreaders/src/app/api/akhand-path/call/route.ts#POST",
        "service": [
          "(lib/paath.ts setCallRecording)"
        ],
        "address": {
          "app": "fourthwayBookreaders",
          "path": "/akhand-path",
          "how": "the recording switch of components/paath/paath-reader.tsx"
        }
      }
    ],
    "status": "unverifiable: Talk recording state (getCallState)",
    "drift": "No copy elsewhere: the Akhand Path is a fourthwayBookreaders-only reading of the Guru Granth Sahib over circle_units (see project SGGS corpus).",
    "canonical": "lib/paath.ts functions as the single path; move them into services reading-circle once a second circle uses the pattern",
    "open": "SECURITY (weak): any reader can start recording the call for everyone in it (route.ts:16-21, getPaathReader only, no host check); uses the Nextcloud admin account (paath.ts NEXTCLOUD_ADMIN_*).",
    "verified": "2026-11-16 read lib/paath.ts, app/api/akhand-path/*/route.ts, components/paath/{paath-reader,day-note,admin-details}.tsx"
  },
  {
    "area": "fourthway.paath",
    "scope": "thread",
    "risk": [
      "public"
    ],
    "id": "fourthway-paath-publish-target-save",
    "label": "Choose where the recordings go on YouTube",
    "does": "The circle's author or an owner or guide chooses the connection, privacy and mode for sending recordings to YouTube.",
    "class": "person",
    "actors": [
      "owner",
      "guide"
    ],
    "hosts": [
      {
        "key": "api:apps/fourthwayBookreaders/src/app/api/akhand-path/publish/route.ts#POST",
        "service": [
          "@elkdonis/services#setPublishTarget"
        ],
        "address": {
          "app": "fourthwayBookreaders",
          "path": "/akhand-path",
          "how": "the Admin details dialog (components/paath/admin-details.tsx)"
        }
      }
    ],
    "entry": null,
    "status": "threads.metadata.publish.youtube holds the target (getPublishTarget)",
    "confirm": {
      "text": "Send the recordings of “{title}” to {account} on YouTube as {state}? They go out once you approve each one.",
      "status": "draft",
      "wave": 6
    },
    "drift": "No copy elsewhere: the Akhand Path is a fourthwayBookreaders-only reading of the Guru Granth Sahib over circle_units (see project SGGS corpus).",
    "canonical": "services setPublishTarget (shared)",
    "verified": "2026-11-16 read lib/paath.ts, app/api/akhand-path/*/route.ts, components/paath/{paath-reader,day-note,admin-details}.tsx"
  },
  {
    "area": "fourthway.paath",
    "scope": "thread",
    "risk": [
      "public",
      "irreversible"
    ],
    "id": "fourthway-paath-upload-act",
    "label": "Approve, retry or skip a YouTube upload",
    "does": "The circle's author or an owner or guide approves, retries, skips or restores one queued recording upload.",
    "class": "person",
    "actors": [
      "owner",
      "guide"
    ],
    "hosts": [
      {
        "key": "api:apps/fourthwayBookreaders/src/app/api/akhand-path/uploads/route.ts#POST",
        "service": [
          "@elkdonis/services#actOnUpload"
        ],
        "address": {
          "app": "fourthwayBookreaders",
          "path": "/akhand-path",
          "how": "the uploads list of components/paath/admin-details.tsx"
        }
      }
    ],
    "entry": null,
    "status": "video_uploads has the new state for the upload",
    "confirm": {
      "text": "Send this recording to YouTube now? It becomes {state} there. This cannot be undone from here.",
      "status": "draft",
      "wave": 6
    },
    "drift": "No copy elsewhere: the Akhand Path is a fourthwayBookreaders-only reading of the Guru Granth Sahib over circle_units (see project SGGS corpus).",
    "canonical": "services actOnUpload (shared)",
    "verified": "2026-11-16 read lib/paath.ts, app/api/akhand-path/*/route.ts, components/paath/{paath-reader,day-note,admin-details}.tsx"
  }
];

export default { capabilities, ignored: [] } satisfies Area;

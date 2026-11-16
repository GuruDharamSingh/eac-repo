import type { Area, Capability } from '../types';

// sunjay audience: written by the round 2 curator, 2026-11-16 (generated from one shared definition for sunjay and amrit-canada, which
// copy most of their api routes). Conventions: atlas/JOURNAL.md. Ids carry the app prefix; a row that copies another app's family says so in `drift`.

const capabilities: Capability[] = [
  {
    "area": "sunjay.audience",
    "scope": "thread",
    "risk": [
      "emails",
      "others"
    ],
    "id": "sunjay-rsvp-guest",
    "label": "RSVP as a guest, without an account",
    "does": "A visitor gives a name (and optionally email, phone, message) to say they are coming to a published RSVP-enabled gathering; the organiser gets an email and the guest a confirmation if they gave an address.",
    "class": "person",
    "actors": [
      "visitor"
    ],
    "hosts": [
      {
        "key": "api:apps/sunjay/src/app/api/rsvp/route.ts#POST",
        "service": [
          "(raw INSERT guest_submissions, contacts)",
          "@elkdonis/email#sendRsvpConfirmation",
          "@elkdonis/email#sendRsvpNotification"
        ],
        "address": {
          "app": "sunjay",
          "path": "/{section}/{slug}",
          "how": "the guest form of the RSVP panel (components/rsvp-panel.tsx) posting to /api/rsvp"
        }
      },
      {
        "key": "sql:apps/sunjay/src/app/api/rsvp/route.ts#POST",
        "note": "sql twin of api:apps/sunjay/src/app/api/rsvp/route.ts#POST"
      },
      {
        "key": "api:apps/amrit-canada/src/app/api/rsvp/route.ts#POST",
        "service": [
          "(raw INSERT guest_submissions, contacts)",
          "@elkdonis/email#sendRsvpConfirmation",
          "@elkdonis/email#sendRsvpNotification"
        ],
        "address": {
          "app": "amrit-canada",
          "path": "/{section}/{slug}",
          "how": "the guest form of the RSVP panel (components/rsvp-panel.tsx) posting to /api/rsvp"
        }
      },
      {
        "key": "sql:apps/amrit-canada/src/app/api/rsvp/route.ts#POST",
        "note": "sql twin of api:apps/amrit-canada/src/app/api/rsvp/route.ts#POST"
      },
      {
        "key": "api:apps/innergathering/src/app/api/rsvp/route.ts#POST",
        "service": [
          "@elkdonis/email#sendRsvpConfirmation",
          "@elkdonis/email#sendRsvpNotification"
        ],
        "address": {
          "app": "innergathering",
          "path": "/{section}/{slug}",
          "how": "the guest RSVP form on a gathering page (components/rsvp-panel.tsx, with packages/ui/src/components/RsvpForm.tsx)"
        },
        "note": "Priced gatherings are refused (409, \"please sign in to book a place\")."
      },
      {
        "key": "sql:apps/innergathering/src/app/api/rsvp/route.ts#POST",
        "service": [
          "(raw SQL in the same function)"
        ],
        "note": "sql twin of api:apps/innergathering/src/app/api/rsvp/route.ts#POST"
      },
      {
        "key": "api:apps/elktours/src/app/api/rsvp/route.ts#POST",
        "service": [
          "@elkdonis/email#sendRsvpConfirmation",
          "@elkdonis/email#sendRsvpNotification",
          "raw SQL INSERT guest_submissions, contacts"
        ],
        "address": {
          "app": "elktours",
          "path": "/{feed}/{slug}",
          "how": "the guest RSVP form on a gathering page (components/rsvp-panel.tsx)"
        }
      },
      {
        "key": "sql:apps/elktours/src/app/api/rsvp/route.ts#POST",
        "service": [
          "raw SQL"
        ],
        "note": "twin of api:apps/elktours/src/app/api/rsvp/route.ts#POST"
      },
    ],
    "entry": null,
    "status": "guest_submissions has a row of kind 'rsvp' for the thread and the name",
    "confirm": {
      "text": "Tell {org} you are coming to “{title}” on {when}? The organiser gets an email, and so do you if you gave an address.",
      "status": "draft",
      "wave": 6
    },
    "drift": "No arts-collective guest route (arts-collective has only the member RSVP). Same file in amrit-canada (apps.amrit-canada.*.ts: sunjay-rsvp-guest); byte-identical bar log prefixes.\nMerged 2026-11-16 (consolidation 2): 4 rows, 4 apps (sunjay, amrit-canada, innergathering, elktours). Differences by app:\n- amrit-canada (was amrit-rsvp-guest): No arts-collective guest route (arts-collective has only the member RSVP). Same file in sunjay (apps.sunjay.*.ts: sunjay-rsvp-guest); byte-identical bar log prefixes.\n- innergathering (was ig-rsvp-guest): Same route (guest RSVP) in amrit-canada, elktours, sunjay and admin: not diffed here (other agents). The member door is ig-rsvp-join (arts-collective.sites.ts:rsvp-to-event is its twin).\n- elktours (was elktours-rsvp-guest): Same route exists in the other org apps (inner-gathering original); member RSVP is a separate route (rsvp-to-event).\nDirection (Justin, 2026-11-16): RSVP and booking should be straightened together; consider ONE logic for both (see rsvp-to-event, cancel-rsvp, ig-rsvp-join, ig-rsvp-cancel, sunjay-rsvp-guest and service-book-and-pay).\namrit-canada is the oldest site and much of it is being left behind: do not let its shape become the canonical.\nRelated, not merged: rsvp-to-event (signed-in member RSVP).",
    "canonical": "one shared guest RSVP handler in services with rate limit and email validation",
    "open": "SECURITY: unauthenticated POST. route.ts:70 inserts a guest_submissions row on every call: no rate limit, no captcha, no duplicate check per email, no email format check; it then mails the visitor-supplied address (route.ts:99) and the organiser. Anyone can use it to send a confirmation email to any address and to inflate the head count. Org filter on the thread is correct (WHERE org_id).\ninnergathering (ig-rsvp-guest): SECURITY: the route is public with no rate limit, captcha or length cap on name, email, phone or message (rsvp/route.ts:24-29, 81-95), writes two tables and sends two emails per call, one to whatever address the caller typed (rsvp/route.ts:110-119). It can be used to fill the guest list and to send the confirmation mail to third parties; the email addresses are not format-checked. The author’s notification renders the free text through React email components, which escape it.\nelktours (elktours-rsvp-guest): SECURITY: fully public with no rate limit, captcha or per-address limit (app/api/rsvp/route.ts:19-); name, message and phone are unbounded in length and the email is not format-checked. Each call can send a confirmation to ANY address the caller types (sendRsvpConfirmation to `email`) with the caller's text inside, and a notification to the organiser: a mail-bomb and spam relay under the org's name. The thread must be published and RSVP-enabled (org filtered, good).",
    "verified": "2026-11-16 read app/api/{rsvp,inquiry}/route.ts, app/api/threads/[id]/rsvp/route.ts, components/rsvp-panel.tsx, components/inquiry-form.tsx, diff of the sunjay and amrit copies",
    "inputs": "threadId, name, email, phone, message, wantsReminder"
  },
  {
    "area": "sunjay.audience",
    "scope": "thread",
    "risk": [
      "others"
    ],
    "id": "sunjay-inquiry-send",
    "label": "Send an inquiry about a service",
    "does": "A visitor asks about a published service or offering: name, email and message are stored as a guest submission and as a new contact for the organisation's list.",
    "class": "person",
    "actors": [
      "visitor"
    ],
    "hosts": [
      {
        "key": "api:apps/sunjay/src/app/api/inquiry/route.ts#POST",
        "service": [
          "(raw INSERT guest_submissions, contacts)"
        ],
        "address": {
          "app": "sunjay",
          "path": "/{section}/{slug}",
          "how": "the inquiry form block (components/inquiry-form.tsx, also offered as a Puck block in lib/puck/catalogue.ts)"
        }
      },
      {
        "key": "sql:apps/sunjay/src/app/api/inquiry/route.ts#POST",
        "note": "sql twin of api:apps/sunjay/src/app/api/inquiry/route.ts#POST"
      },
      {
        "key": "api:apps/amrit-canada/src/app/api/inquiry/route.ts#POST",
        "service": [
          "(raw INSERT guest_submissions, contacts)"
        ],
        "address": {
          "app": "amrit-canada",
          "path": "/{section}/{slug}",
          "how": "the inquiry form block (components/inquiry-form.tsx, also offered as a Puck block in lib/puck/catalogue.ts)"
        }
      },
      {
        "key": "sql:apps/amrit-canada/src/app/api/inquiry/route.ts#POST",
        "note": "sql twin of api:apps/amrit-canada/src/app/api/inquiry/route.ts#POST"
      },
      {
        "key": "api:apps/elktours/src/app/api/inquiry/route.ts#POST",
        "service": [
          "raw SQL INSERT guest_submissions, contacts"
        ],
        "address": {
          "app": "elktours",
          "path": "/services/{slug}",
          "how": "the inquiry form (components/inquiry-form.tsx)"
        }
      },
      {
        "key": "sql:apps/elktours/src/app/api/inquiry/route.ts#POST",
        "service": [
          "raw SQL"
        ],
        "note": "twin of api:apps/elktours/src/app/api/inquiry/route.ts#POST"
      },
    ],
    "entry": null,
    "status": "guest_submissions has a row of kind 'inquiry' for the thread",
    "confirm": {
      "text": "Send your question about “{title}” to {org}? They will see your name, email and message.",
      "status": "draft",
      "wave": 6
    },
    "drift": "No arts-collective copy. Same file in amrit-canada (apps.amrit-canada.*.ts: sunjay-inquiry-send); byte-identical bar log prefixes.\nMerged 2026-11-16 (consolidation 2): 3 rows, 3 apps (sunjay, amrit-canada, elktours). Differences by app:\n- amrit-canada (was amrit-inquiry-send): No arts-collective copy. Same file in sunjay (apps.sunjay.*.ts: sunjay-inquiry-send); byte-identical bar log prefixes.\n- elktours (was elktours-inquiry-send): Elktours also has sendExperienceInquiryAction (elktours-experience-inquiry-send) which emails owners and hosts and stores nothing; two inquiry paths.\nDirection (Justin, 2026-11-16): the canonical is the hub / Channel path (hub surface pages, cards and pop-ups), not the /manage page shape. amrit-canada is the oldest site and is being left behind, so its copy is not a model; sunjay is moving from /manage pages to hub + Channel.",
    "canonical": "one shared inquiry handler in services",
    "open": "SECURITY: unauthenticated; no rate limit, no email format check, no length cap on name or message (route.ts:36-44 insert). The organisation list (contacts) can be filled with junk. Sends no email, so it is not a relay. Thread filter is correct.\nelktours (elktours-inquiry-send): SECURITY: public with no rate limit or captcha; message and name have no length limit and the email is not format-checked (app/api/inquiry/route.ts:6-). Anyone can fill guest_submissions and contacts (the mailing list) with chosen addresses. It accepts any published thread of the org, whatever its kind. `ON CONFLICT DO NOTHING` on contacts hides repeats. The author_email is selected but unused.",
    "verified": "2026-11-16 read app/api/{rsvp,inquiry}/route.ts, app/api/threads/[id]/rsvp/route.ts, components/rsvp-panel.tsx, components/inquiry-form.tsx, diff of the sunjay and amrit copies",
    "inputs": "thread id, name, email, message"
  },
  {
    "area": "sunjay.audience",
    "scope": "thread",
    "risk": [
      "public"
    ],
    "id": "sunjay-cycle-confirm",
    "label": "Confirm or cancel this cycle's gathering",
    "does": "An owner or guide marks the current occurrence of a recurring gathering as confirmed or cancelled (an append-only event, the latest within the cycle wins).",
    "class": "person",
    "actors": [
      "owner",
      "guide"
    ],
    "hosts": [
      {
        "key": "api:apps/sunjay/src/app/api/threads/[id]/cycle/route.ts#POST",
        "service": [
          "(raw INSERT thread_cycle_events)"
        ],
        "address": {
          "app": "sunjay",
          "path": "/manage",
          "how": "the row menu 'Confirm this cycle' / cancel in components/manage/content-row-actions.tsx"
        }
      },
      {
        "key": "sql:apps/sunjay/src/app/api/threads/[id]/cycle/route.ts#POST",
        "note": "sql twin of api:apps/sunjay/src/app/api/threads/[id]/cycle/route.ts#POST"
      },
      {
        "key": "api:apps/amrit-canada/src/app/api/threads/[id]/cycle/route.ts#POST",
        "service": [
          "(raw INSERT thread_cycle_events)"
        ],
        "address": {
          "app": "amrit-canada",
          "path": "/manage",
          "how": "the row menu 'Confirm this cycle' / cancel in components/manage/content-row-actions.tsx"
        }
      },
      {
        "key": "sql:apps/amrit-canada/src/app/api/threads/[id]/cycle/route.ts#POST",
        "note": "sql twin of api:apps/amrit-canada/src/app/api/threads/[id]/cycle/route.ts#POST"
      },
      {
        "key": "api:apps/elktours/src/app/api/threads/[id]/cycle/route.ts#POST",
        "service": [
          "raw SQL INSERT thread_cycle_events"
        ],
        "address": {
          "app": "elktours",
          "path": "/manage/content/{id}",
          "how": "the Confirm / Cancel this cycle control in the content row actions (components/manage/content-row-actions.tsx)"
        }
      },
      {
        "key": "sql:apps/elktours/src/app/api/threads/[id]/cycle/route.ts#POST",
        "service": [
          "raw SQL"
        ],
        "note": "twin of api:apps/elktours/src/app/api/threads/[id]/cycle/route.ts#POST"
      },
      {
        "key": "api:apps/innergathering/src/app/api/threads/[id]/cycle/route.ts#POST",
        "service": [
          "(raw SQL INSERT into thread_cycle_events)"
        ],
        "address": {
          "app": "innergathering",
          "path": "/manage",
          "how": "the Confirm / Cancel buttons of a content row (components/manage/content-row-actions.tsx:65)"
        }
      },
      {
        "key": "sql:apps/innergathering/src/app/api/threads/[id]/cycle/route.ts#POST",
        "service": [
          "(raw SQL in the same function)"
        ],
        "note": "sql twin of api:apps/innergathering/src/app/api/threads/[id]/cycle/route.ts#POST"
      },
    ],
    "entry": null,
    "status": "thread_cycle_events has a confirmed or cancelled row for the thread in the current cycle (getCycleStatus)",
    "confirm": {
      "text": "Mark “{title}” as {state} for this cycle? Visitors see the status on the gathering page.",
      "status": "draft",
      "wave": 6
    },
    "drift": "Not in arts-collective. inner-gathering uses the same vocabulary (route comment). Same file in amrit-canada (apps.amrit-canada.*.ts: sunjay-cycle-confirm); byte-identical bar log prefixes.\nMerged 2026-11-16 (consolidation 2): 4 rows, 4 apps (sunjay, amrit-canada, elktours, innergathering). Differences by app:\n- amrit-canada (was amrit-cycle-confirm): Not in arts-collective. inner-gathering uses the same vocabulary (route comment). Same file in sunjay (apps.sunjay.*.ts: sunjay-cycle-confirm); byte-identical bar log prefixes.\n- elktours (was elktours-cycle-confirm): Copy of the inner-gathering route (named in the code comment).\n- innergathering (was ig-cycle-mark): Same route in amrit-canada, elktours and sunjay (not diffed). Writes raw SQL where every other write here goes through a service.\nDirection (Justin, 2026-11-16): the canonical is the hub / Channel path (hub surface pages, cards and pop-ups), not the /manage page shape. amrit-canada is the oldest site and is being left behind, so its copy is not a model; sunjay is moving from /manage pages to hub + Channel.",
    "canonical": "a shared cycle-event handler in services",
    "open": "Thread must belong to the org (route.ts:41-46) but is not required to be a recurring or published thread: an event row can be written for any thread of the org. Sends no email by itself; the guide then uses trigger-email.\nelktours (elktours-cycle-confirm): Org filtered; any guide can confirm or cancel any thread (no author check, but threads are not tied to one guide here). No email goes out; use sunjay-trigger-email-send for that.",
    "verified": "2026-11-16 read app/api/threads/[id]/{cycle,reminder,email-settings,trigger-email}/route.ts, lib/email-template-settings.ts, lib/reminders.ts, components/manage/content-row-actions.tsx, components/hub/EmailFace.tsx, EmailSurface.tsx",
    "inputs": "thread id, confirm or cancel"
  },
  {
    "area": "sunjay.audience",
    "scope": "thread",
    "risk": [
      "emails"
    ],
    "id": "sunjay-reminder-set",
    "label": "Set when a gathering reminder goes out",
    "does": "An owner or guide sets (15 minutes to 14 days) or clears how long before a gathering the reminder email goes to everyone who said yes.",
    "class": "person",
    "actors": [
      "owner",
      "guide"
    ],
    "hosts": [
      {
        "key": "api:apps/sunjay/src/app/api/threads/[id]/reminder/route.ts#PATCH",
        "service": [
          "(raw UPDATE threads reminder_minutes_before)"
        ],
        "address": {
          "app": "sunjay",
          "path": "/hub",
          "surface": "compose",
          "how": "the Make tab of the email surface (components/hub/EmailFace.tsx / EmailSurface.tsx) saving to /api/threads/[id]/reminder"
        }
      },
      {
        "key": "sql:apps/sunjay/src/app/api/threads/[id]/reminder/route.ts#PATCH",
        "note": "sql twin of api:apps/sunjay/src/app/api/threads/[id]/reminder/route.ts#PATCH"
      },
      {
        "key": "api:apps/amrit-canada/src/app/api/threads/[id]/reminder/route.ts#PATCH",
        "service": [
          "(raw UPDATE threads reminder_minutes_before)"
        ],
        "address": {
          "app": "amrit-canada",
          "path": "/hub",
          "surface": "compose",
          "how": "the Make tab of the email surface (components/hub/EmailFace.tsx / EmailSurface.tsx) saving to /api/threads/[id]/reminder"
        }
      },
      {
        "key": "sql:apps/amrit-canada/src/app/api/threads/[id]/reminder/route.ts#PATCH",
        "note": "sql twin of api:apps/amrit-canada/src/app/api/threads/[id]/reminder/route.ts#PATCH"
      },
      {
        "key": "api:apps/elktours/src/app/api/threads/[id]/reminder/route.ts#PATCH",
        "service": [
          "raw SQL UPDATE threads"
        ],
        "address": {
          "app": "elktours",
          "path": "/hub",
          "how": "the reminder choice on the Make tab of the email surface (components/hub/EmailSurface.tsx)"
        }
      },
      {
        "key": "sql:apps/elktours/src/app/api/threads/[id]/reminder/route.ts#PATCH",
        "service": [
          "raw SQL"
        ],
        "note": "twin of api:apps/elktours/src/app/api/threads/[id]/reminder/route.ts#PATCH"
      },
    ],
    "entry": null,
    "status": "threads.reminder_minutes_before holds the value for the thread (RETURNING)",
    "confirm": {
      "text": "Send a reminder {when} before “{title}”? Everyone who said yes gets an email.",
      "status": "draft",
      "wave": 6
    },
    "drift": "Not in arts-collective. Ported from inner-gathering (reminders.ts header). Same file in amrit-canada (apps.amrit-canada.*.ts: sunjay-reminder-set); byte-identical bar log prefixes.\nMerged 2026-11-16 (consolidation 2): 3 rows, 3 apps (sunjay, amrit-canada, elktours). Differences by app:\n- amrit-canada (was amrit-reminder-set): Not in arts-collective. Ported from inner-gathering (reminders.ts header). Same file in sunjay (apps.sunjay.*.ts: sunjay-reminder-set); byte-identical bar log prefixes.\n- elktours (was elktours-reminder-set): Copy of the inner-gathering route.\nDirection (Justin, 2026-11-16): the canonical is the hub / Channel path (hub surface pages, cards and pop-ups), not the /manage page shape. amrit-canada is the oldest site and is being left behind, so its copy is not a model; sunjay is moving from /manage pages to hub + Channel.",
    "canonical": "services setThreadReminder behind one shared route",
    "verified": "2026-11-16 read app/api/threads/[id]/{cycle,reminder,email-settings,trigger-email}/route.ts, lib/email-template-settings.ts, lib/reminders.ts, components/manage/content-row-actions.tsx, components/hub/EmailFace.tsx, EmailSurface.tsx",
    "inputs": "thread id, minutes before or null"
  },
  {
    "area": "sunjay.audience",
    "scope": "thread",
    "risk": [
      "emails"
    ],
    "id": "sunjay-email-settings-save",
    "label": "Write the gathering emails",
    "does": "An owner or guide saves the shared body text, links, files and custom recipient list for a thread's confirmation, trigger and reminder emails.",
    "class": "person",
    "actors": [
      "owner",
      "guide"
    ],
    "hosts": [
      {
        "key": "api:apps/sunjay/src/app/api/threads/[id]/email-settings/route.ts#PATCH",
        "service": [
          "saveEmailTemplateSettings"
        ],
        "address": {
          "app": "sunjay",
          "path": "/hub",
          "surface": "compose",
          "how": "the Write tab of the email surface (components/hub/EmailFace.tsx, EmailSurface.tsx) saving to /api/threads/[id]/email-settings"
        }
      },
      {
        "key": "sql:apps/sunjay/src/lib/email-template-settings.ts#saveEmailTemplateSettings",
        "note": "raw INSERT ... ON CONFLICT upsert into email_template_settings; called by the route above"
      },
      {
        "key": "sql:apps/sunjay/src/lib/email-template-settings.ts#deleteEmailTemplateSettings",
        "note": "raw DELETE of a thread override; no caller found in this app (grep), dead or reserved"
      },
      {
        "key": "api:apps/amrit-canada/src/app/api/threads/[id]/email-settings/route.ts#PATCH",
        "service": [
          "saveEmailTemplateSettings"
        ],
        "address": {
          "app": "amrit-canada",
          "path": "/hub",
          "surface": "compose",
          "how": "the Write tab of the email surface (components/hub/EmailFace.tsx, EmailSurface.tsx) saving to /api/threads/[id]/email-settings"
        }
      },
      {
        "key": "sql:apps/amrit-canada/src/lib/email-template-settings.ts#saveEmailTemplateSettings",
        "note": "raw INSERT ... ON CONFLICT upsert into email_template_settings; called by the route above"
      },
      {
        "key": "sql:apps/amrit-canada/src/lib/email-template-settings.ts#deleteEmailTemplateSettings",
        "note": "raw DELETE of a thread override; no caller found in this app (grep), dead or reserved"
      },
      {
        "key": "api:apps/elktours/src/app/api/threads/[id]/email-settings/route.ts#PATCH",
        "service": [
          "@/lib/email-template-settings#saveEmailTemplateSettings",
          "cleanTemplateConfig"
        ],
        "address": {
          "app": "elktours",
          "path": "/hub",
          "how": "the Write tab of the email surface (components/hub/EmailSurface.tsx)"
        }
      },
      {
        "key": "sql:apps/elktours/src/lib/email-template-settings.ts#saveEmailTemplateSettings",
        "service": [
          "raw SQL INSERT ... ON CONFLICT email_template_settings"
        ],
        "note": "inner writer, keyed (org, thread-scoped template key)"
      },
    ],
    "entry": null,
    "status": "email_template_settings has a row for the org and the thread template key",
    "confirm": {
      "text": "Save the email text for “{title}”? It goes to people who RSVP, as a confirmation or reminder.",
      "status": "draft",
      "wave": 6
    },
    "drift": "Not in arts-collective. Same file in amrit-canada (apps.amrit-canada.*.ts: sunjay-email-settings-save); byte-identical bar log prefixes.\nMerged 2026-11-16 (consolidation 2): 3 rows, 3 apps (sunjay, amrit-canada, elktours). Differences by app:\n- amrit-canada (was amrit-email-settings-save): Not in arts-collective. Same file in sunjay (apps.sunjay.*.ts: sunjay-email-settings-save); byte-identical bar log prefixes.\n- elktours (was elktours-email-template-save): Copy of the inner-gathering/amrit email settings route.\nDirection (Justin, 2026-11-16): the canonical is the hub / Channel path (hub surface pages, cards and pop-ups), not the /manage page shape. amrit-canada is the oldest site and is being left behind, so its copy is not a model; sunjay is moving from /manage pages to hub + Channel.",
    "canonical": "a shared email-template-settings module in services (the file is copied per app)",
    "open": "SECURITY: email-settings/route.ts:36-41 builds the template key from the thread id in the URL but never checks the thread belongs to the org; rows are keyed by the org so there is no cross-org write, but an editor can create rows for arbitrary ids. The saved config.recipients list (any emails, cleanTemplateConfig does not cap it) is the audience for trigger-email audience custom.\nelktours (elktours-email-template-save): SECURITY: the route never checks that the thread id belongs to this org (app/api/threads/[id]/email-settings/route.ts:28-41); it writes a template key for any id string, scoped by org in the key. Harmless for other orgs (their reads use their own org id), but junk keys can be written for ids that do not exist, and the GET reads materials for any id under this org only. Config text and links are cleaned by cleanTemplateConfig; link urls are not re-fetched.",
    "verified": "2026-11-16 read app/api/threads/[id]/{cycle,reminder,email-settings,trigger-email}/route.ts, lib/email-template-settings.ts, lib/reminders.ts, components/manage/content-row-actions.tsx, components/hub/EmailFace.tsx, EmailSurface.tsx",
    "inputs": "thread id, body text, links, material ids, media, recipients"
  },
  {
    "area": "sunjay.audience",
    "scope": "thread",
    "risk": [
      "emails",
      "irreversible"
    ],
    "id": "sunjay-trigger-email-send",
    "label": "Email everyone who said they are coming",
    "does": "An owner or guide sends a reminder, confirmation or cancellation notice now to this cycle's RSVPs (members and guests, de-duplicated) or to the saved custom list.",
    "class": "person",
    "actors": [
      "owner",
      "guide"
    ],
    "hosts": [
      {
        "key": "api:apps/sunjay/src/app/api/threads/[id]/trigger-email/route.ts#POST",
        "service": [
          "@elkdonis/email#sendMeetingTriggerEmail"
        ],
        "address": {
          "app": "sunjay",
          "path": "/manage",
          "how": "the row menu 'Send reminder / cancellation' of components/manage/content-row-actions.tsx and the Send control of the email surface"
        }
      },
      {
        "key": "api:apps/amrit-canada/src/app/api/threads/[id]/trigger-email/route.ts#POST",
        "service": [
          "@elkdonis/email#sendMeetingTriggerEmail"
        ],
        "address": {
          "app": "amrit-canada",
          "path": "/manage",
          "how": "the row menu 'Send reminder / cancellation' of components/manage/content-row-actions.tsx and the Send control of the email surface"
        }
      },
      {
        "key": "api:apps/elktours/src/app/api/threads/[id]/trigger-email/route.ts#POST",
        "service": [
          "@elkdonis/email#sendMeetingTriggerEmail",
          "getEmailTemplateSettingsForThread"
        ],
        "address": {
          "app": "elktours",
          "path": "/manage/content/{id}",
          "how": "the Send reminder / Cancel notice controls (components/manage/content-row-actions.tsx and the Send tab of components/hub/EmailSurface.tsx)"
        }
      },
      {
        "key": "api:apps/innergathering/src/app/api/threads/[id]/trigger-email/route.ts#POST",
        "service": [
          "@elkdonis/email#sendMeetingTriggerEmail",
          "@elkdonis/utils#lastOccurrenceEnd"
        ],
        "address": {
          "app": "innergathering",
          "path": "/manage",
          "how": "the Remind / Cancel email items of a content row (components/manage/content-row-actions.tsx)"
        },
        "note": "Recipients are read with a UNION of thread_rsvps and guest_submissions; the route reads, only the email leaves."
      },
    ],
    "entry": null,
    "status": "unverifiable: sent mail (the response counts sent and failed)",
    "confirm": {
      "text": "Email {count} people about “{title}”? This sends a {kind} message now. This cannot be undone.",
      "status": "draft",
      "wave": 6
    },
    "drift": "Not in arts-collective. inner-gathering has a version that links a confirmUrl that 404s (route comment). Same file in amrit-canada (apps.amrit-canada.*.ts: sunjay-trigger-email-send); differs only in EMBLEM_URL and log prefixes.\nMerged 2026-11-16 (consolidation 2): 4 rows, 4 apps (sunjay, amrit-canada, elktours, innergathering). Differences by app:\n- amrit-canada (was amrit-trigger-email-send): Not in arts-collective. inner-gathering has a version that links a confirmUrl that 404s (route comment). Same file in sunjay (apps.sunjay.*.ts: sunjay-trigger-email-send); differs only in EMBLEM_URL and log prefixes.\n- elktours (was elktours-trigger-email-send): elktours dropped it, per the route comment).\n- innergathering (was ig-gathering-email-send): Same route in amrit-canada, elktours and sunjay (not diffed).\nDirection (Justin, 2026-11-16): the canonical is the hub / Channel path (hub surface pages, cards and pop-ups), not the /manage page shape. amrit-canada is the oldest site and is being left behind, so its copy is not a model; sunjay is moving from /manage pages to hub + Channel.",
    "canonical": "a shared trigger-email handler in services",
    "open": "SECURITY: no rate limit, no send ledger and no confirm-token: an editor who re-posts mails everyone again each time (no dedupe across sends; reminders.ts has a ledger, this route does not). With audience custom the recipients are whatever emails were saved in the Write tab (route.ts:79).\nelktours (elktours-trigger-email-send): SECURITY: any guide can email every RSVP holder of any thread, and the \"custom\" audience sends to up to 200 addresses saved by any guide in the template config (lib/email-template-settings.ts:50 MAX_RECIPIENTS), with the org's branding. No rate limit, no send log row and no confirmation count check (app/api/threads/[id]/trigger-email/route.ts:29-). The org filter on the thread is present. senderName is the editor's email address. DRIFT BUG: Khanda emblem with amritcanada.ca fallback.\ninnergathering (ig-gathering-email-send): No rate limit or double-send guard: pressing it twice sends twice (trigger-email/route.ts:88-102). The sender name is the editor’s email address.",
    "verified": "2026-11-16 read app/api/threads/[id]/{cycle,reminder,email-settings,trigger-email}/route.ts, lib/email-template-settings.ts, lib/reminders.ts, components/manage/content-row-actions.tsx, components/hub/EmailFace.tsx, EmailSurface.tsx",
    "inputs": "thread id, type (reminder, confirmation, cancellation), audience (rsvp or custom)"
  },
  {
    "area": "sunjay.audience",
    "scope": "org",
    "risk": [
      "emails"
    ],
    "id": "sunjay-reminders-send",
    "label": "Send due gathering reminders",
    "does": "The periodic tick (started from instrumentation.ts) finds published RSVP-enabled gatherings whose reminder window has opened, claims a ledger row, and emails everyone with a yes.",
    "class": "system",
    "actors": [
      "system"
    ],
    "hosts": [
      {
        "key": "sql:apps/sunjay/src/lib/reminders.ts#runReminderTick",
        "service": [
          "@elkdonis/email#sendReminderEmail",
          "(raw INSERT thread_reminder_sends, UPDATE recipients)"
        ]
      },
      {
        "key": "sql:apps/amrit-canada/src/lib/reminders.ts#runReminderTick",
        "service": [
          "@elkdonis/email#sendReminderEmail",
          "(raw INSERT thread_reminder_sends, UPDATE recipients)"
        ]
      },
      {
        "key": "sql:apps/elktours/src/lib/reminders.ts#runReminderTick",
        "service": [
          "@elkdonis/email#sendReminderEmail",
          "raw SQL INSERT thread_reminder_sends",
          "raw SQL UPDATE thread_reminder_sends"
        ],
        "note": "called from src/instrumentation.ts"
      },
    ],
    "status": "thread_reminder_sends has a row for the thread and occurrence",
    "drift": "Ported from apps/inner-gathering/src/lib/reminders.ts. Same file in amrit-canada (apps.amrit-canada.*.ts: sunjay-reminders-send); differs only in EMBLEM_URL and log prefixes. Recurring occurrences beyond the first are not handled (header: v1).\nMerged 2026-11-16 (consolidation 2): 3 rows, 3 apps (sunjay, amrit-canada, elktours). Differences by app:\n- amrit-canada (was amrit-reminders-send): Ported from apps/inner-gathering/src/lib/reminders.ts. Same file in sunjay (apps.sunjay.*.ts: sunjay-reminders-send); differs only in EMBLEM_URL and log prefixes. Recurring occurrences beyond the first are not handled (header: v1).\n- elktours (was elktours-reminder-tick): Ported from apps/inner-gathering; the same emblem constants (Khanda image, amritcanada.ca default) came with it.\nDirection (Justin, 2026-11-16): the canonical is the hub / Channel path (hub surface pages, cards and pop-ups), not the /manage page shape. amrit-canada is the oldest site and is being left behind, so its copy is not a model; sunjay is moving from /manage pages to hub + Channel.",
    "canonical": "one shared reminder tick in services, called by each app instrumentation",
    "open": "Claim is INSERT ... ON CONFLICT DO NOTHING keyed (thread, occurrence), good. A claimed row stays with recipients 0 if the send throws before updating, so a failure is never retried.\nelktours (elktours-reminder-tick): The ledger row is claimed before sending; if sending throws for a whole thread the row stays with recipients 0 and nothing retries (lib/reminders.ts:61-134). DRIFT BUG: the reminder email uses a Khanda (Sikh) emblem and falls back to https://amritcanada.ca for its image URL (EMBLEM_URL near the top of lib/reminders.ts, emblemAlt \"Khanda\") in an app about Paris tours. Same constants in api/threads/[id]/rsvp and trigger-email. v1 handles the first occurrence only (recurring occurrences are a follow-up in the code comment).",
    "verified": "2026-11-16 read app/api/threads/[id]/{cycle,reminder,email-settings,trigger-email}/route.ts, lib/email-template-settings.ts, lib/reminders.ts, components/manage/content-row-actions.tsx, components/hub/EmailFace.tsx, EmailSurface.tsx",
    "inputs": "none (reads threads)"
  },
  {
    "area": "sunjay.audience",
    "scope": "org",
    "risk": [
      "public"
    ],
    "id": "sunjay-media-upload",
    "label": "Upload a file for the site",
    "does": "An owner or guide uploads an image, audio, video or document into the organisation's storage (25 to 500 MB by type) and a media row records it; used by the content form, media fields, email surface and page picture chooser.",
    "class": "internal",
    "actors": [
      "owner",
      "guide"
    ],
    "hosts": [
      {
        "key": "api:apps/sunjay/src/app/api/upload/route.ts#POST",
        "service": [
          "@elkdonis/services#uploadFile",
          "@elkdonis/utils#validateUploadBuffer",
          "(raw INSERT media)"
        ]
      },
      {
        "key": "sql:apps/sunjay/src/app/api/upload/route.ts#POST",
        "note": "sql twin of api:apps/sunjay/src/app/api/upload/route.ts#POST"
      },
      {
        "key": "api:apps/amrit-canada/src/app/api/upload/route.ts#POST",
        "service": [
          "@elkdonis/services#uploadFile",
          "@elkdonis/utils#validateUploadBuffer",
          "(raw INSERT media)"
        ]
      },
      {
        "key": "sql:apps/amrit-canada/src/app/api/upload/route.ts#POST",
        "note": "sql twin of api:apps/amrit-canada/src/app/api/upload/route.ts#POST"
      },
      {
        "key": "api:apps/fourthwayBookreaders/src/app/api/upload/route.ts#POST",
        "service": [
          "@elkdonis/services#uploadOrgFile",
          "@elkdonis/utils#validateUploadBuffer"
        ]
      },
      {
        "key": "api:apps/katie-the-potter/src/app/api/media/upload/route.ts#POST",
        "service": [
          "@elkdonis/services#uploadFile",
          "resolveUserPath",
          "getStorageSlug",
          "@elkdonis/utils#validateUploadBuffer",
          "(raw INSERT media)"
        ]
      },
      {
        "key": "sql:apps/katie-the-potter/src/app/api/media/upload/route.ts#POST",
        "note": "sql twin of api:apps/katie-the-potter/src/app/api/media/upload/route.ts#POST"
      },
      {
        "key": "api:apps/hidden-enneagram/src/app/api/upload/route.ts#POST",
        "service": [
          "(getApiEditor: owner or guide)",
          "@elkdonis/utils#validateUploadBuffer",
          "@elkdonis/services#uploadFile",
          "@elkdonis/services#getUploadPath"
        ],
        "address": {
          "app": "hidden-enneagram",
          "path": "/manage",
          "how": "upload fields in the content composer, the publish app and the music settings (components/manage/content-composer-body.tsx, components/publish/publish-app.tsx, components/manage/music-settings.tsx)"
        }
      },
      {
        "key": "sql:apps/hidden-enneagram/src/app/api/upload/route.ts#POST",
        "note": "sql twin of api:apps/hidden-enneagram/src/app/api/upload/route.ts#POST"
      },
      {
        "key": "api:apps/innergathering/src/app/api/upload/route.ts#POST",
        "service": [
          "@elkdonis/services#uploadFile",
          "@elkdonis/utils#validateUploadBuffer"
        ],
        "address": {
          "app": "innergathering",
          "path": "/manage",
          "how": "the media pickers of the content composer (components/manage/media-field.tsx, content-composer-body.tsx, materials-field.tsx, landing/page-picture-chooser.tsx)"
        }
      },
      {
        "key": "sql:apps/innergathering/src/app/api/upload/route.ts#POST",
        "service": [
          "(raw SQL in the same function)"
        ],
        "note": "sql twin of api:apps/innergathering/src/app/api/upload/route.ts#POST"
      },
    ],
    "status": "media has a row for the org with the url and nextcloud_path",
    "drift": "Same family as arts-collective.network:upload-image / upload-my-file and art-auction artwork-image-upload, each with its own rules. This copy: owner/guide only, org fixed, validateUploadBuffer refuses SVG. Same file in amrit-canada (apps.amrit-canada.*.ts: sunjay-media-upload); byte-identical bar log prefixes.\nMerged 2026-11-16 (consolidation 2): 6 rows, 6 apps (sunjay, amrit-canada, fourthwayBookreaders, katie-the-potter, hidden-enneagram, innergathering). Differences by app:\n- amrit-canada (was amrit-media-upload): Same family as arts-collective.network:upload-image / upload-my-file and art-auction artwork-image-upload, each with its own rules. This copy: owner/guide only, org fixed, validateUploadBuffer refuses SVG. Same file in sunjay (apps.sunjay.*.ts: sunjay-media-upload); byte-identical bar log prefixes.\n- fourthwayBookreaders (was fourthway-media-upload): Same family as sunjay-media-upload and the other upload routes; differs: uses the consolidated uploadOrgFile (no media table row, no visibility field) and refuses SVG after sniffing; the org-app copies write a media row via raw SQL.\n- katie-the-potter (was katie-media-upload): Same family as sunjay-media-upload, sunjay-media-upload and art-auction artwork-image-upload. Differs: images only, files go to the ARTIST's own tree (users/<slug>/Media/Images or Galleries/<gallery>), never the org tree, via resolveUserPath; the gallery slug is regex-checked; HEIC is refused with a message for Katie.\n- hidden-enneagram (was he-media-upload): Fourth upload family (ifac api/upload, artdirect api/upload, danamccool api/media/upload). This one writes the org tree, not a person folder, and supports audio.\n- innergathering (was ig-media-upload): Same upload route in 10 other apps (amrit-canada, art-auction, artdirect, elktours, fourthwayBookreaders, hidden-enneagram, ifac, inner-gathering, pigeonshoot, sunjay): not diffed. arts-collective has a different upload/image route.\nDirection (Justin, 2026-11-16): avatars and uploads should become one upload path (shared validateUploadBuffer route with a per-purpose policy), not one route per app and purpose.\namrit-canada is the oldest site and much of it is being left behind: do not let its shape become the canonical.",
    "canonical": "one upload route in services with a per-app policy object (types, sizes, who)",
    "open": "The 'visibility' form field is cast to MeetingVisibility without validation (route.ts:50) and handed to getUploadPath; getUploadPath was not re-read, so an odd value may fall through to a default folder. The nextcloud_file_id column is filled with the filename, not a file id.\nkatie-the-potter (katie-media-upload): A guide (not only the owner) can upload into the artist's own storage tree (route.ts:60-62 getSiteArtistUserId): by design (the comment) but it is the person's personal folder.\nhidden-enneagram (he-media-upload): visibility is cast from the form without validation; getUploadPath maps anything but PUBLIC to Private/Media, so it fails closed (checked in services nextcloud.ts:293).\ninnergathering (ig-media-upload): Size caps: image 25 MB, audio 150 MB, video 500 MB, document 50 MB. The visibility form value is cast, not validated, but getUploadPath treats anything that is not PUBLIC as private, so a bad value fails safe. Accepted documents include application/zip and text/plain; zip is checked by magic bytes only.",
    "verified": "2026-11-16 read app/api/upload/route.ts, components/manage/media-field.tsx"
  }
];

export default { capabilities, ignored: [] } satisfies Area;

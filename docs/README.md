# Documentation

Reorganised 2026-09-23. Until then, session reports sat at the repo root; they
are now under `archive/` and `open/` with their filenames unchanged (code
comments cite some of them by name, e.g. `CENTER_PAGE_BRIEF_2026-09-09.md`).

| Folder | Contents | Trust |
|---|---|---|
| `reference/` | Current state of each subsystem, rewritten and checked against the code on 2026-09-23. Start here. | Current as of each file's "Last verified" date |
| `open/` | Briefs, plans and boards with outstanding work. Kept verbatim. | Check against `reference/` before acting |
| `sessions/` | Handovers written from 2026-09-23 on (one per substantial session). | Dated snapshots |
| `archive/` | Reports, briefs and handovers from 2026-04 to 2026-09-21. Kept verbatim for history. | Historical; often stale |
| `schema.mmd` | Mermaid ER diagram. | Check against the live schema |

The archived reports were written by Claude sessions in a persuasive, narrative
register. The `reference/` docs restate what still holds, in a neutral register
(`.claude/rules/01-writing-register.md` on the maintainer's machine; the same
rules are summarised at the end of this file).

## open/

| File | Area | Status (2026-09-23) |
|---|---|---|
| BLOCK_LIBRARY_BRIEF_2026-09-14 | authoring | Steps 4–7 open |
| BRIEF_A_CENTER_UI_2026-09-18 | frontend-ui | Slices 1–4 built; remainder open |
| BRIEF_B_FORUM_SWITCHER_2026-09-18 | forum | Not started |
| BRIEF_C_IFAC_ONBOARDING_2026-09-18 | apps/ifac | Phases 1 and 3 done |
| BRIEF_E_HUB_TOUR_2026-09-18 | frontend-ui | Not started |
| COMPONENT_CENSUS_2026-09-15 | frontend-ui | Duplication data and extraction order |
| HYGIENE_SWEEP_BRIEF_2026-09-03 | packages | Partly done; status unclear |
| SILEX_3.9_UPGRADE_BRIEF | authoring | Phase 0 done; phases 1–3 pending |
| SPRINT_2026-09-18_onboarding | process | Live sprint board (workstreams A–F) |
| news-aggregation-groundwork | data-model | Design only; not built |

## archive/

| File | Area | Kind | Superseded by |
|---|---|---|---|
| AUDIT_2026-09-06_network_state | architecture | audit | reference/packages.md |
| AUDIT_2026-09-06_findings_index | architecture | audit (citations) | reference/packages.md |
| BRIEF_D_NC_FORUM_SYNC_2026-09-18 | nextcloud | brief (done) | reference/nextcloud.md |
| CENTER_PAGE_BRIEF_2026-09-09 | frontend-ui | plan + log | reference/frontend-ui.md |
| COMMERCE_HANDOVER_2026-09-05 | commerce | handover | reference/commerce.md |
| COMMERCE_KICKOFF_PROMPT | commerce | session prompt | — |
| COMMUNITY_ARCHITECTURE | architecture | plan (superseded by /center) | reference/frontend-ui.md |
| COURSE_RESEARCH_2026-09-18 | workshops | research | reference/workshops-and-lms.md |
| DEBRIEF_2026-09-01_workshop_wizard | workshops | debrief | reference/workshops-and-lms.md |
| DEBRIEF_2026-09-06_org_presence | identity | debrief | reference/identity-and-tenancy.md |
| DEPLOYMENT | ops | reference (old) | reference/ops.md |
| DOMAIN_AND_STORAGE_AUDIT_2026-09-15 | ops, nextcloud | audit | reference/ops.md, nextcloud.md |
| EAC_SYSTEM_SYNTHESIS | architecture | strategy (2026-05) | — |
| EMAIL_ARCHITECTURE_BRIEF_2026-09-16 | email | audit + debrief | reference/email.md |
| EMAIL_DNS_RECORDS_2026-09-16 | email | checklist | reference/email.md |
| EMAIL_SUITE_BRIEF_2026-09-17 | email | debrief | reference/email.md |
| GRAND_FORUM_PLAN | forum | plan + log (built) | reference/apps.md, data-model.md |
| HANDOFF | process | handover (2026-05) | — |
| HANDOFF_2026-09-17_identity_and_services | identity | handover | reference/identity-and-tenancy.md |
| HANDOVER_2026-09-18_danamccool | apps/danamccool | handover | reference/apps.md |
| HEADLESS_CMS_DIRECTION | authoring | direction | reference/authoring.md |
| IDENTITY_MODEL_BRIEF_2026-09-17 | identity | plan + debrief | reference/identity-and-tenancy.md |
| INNERGATHERING_CUTOVER_2026-09-09 | ops | runbook | reference/ops.md |
| JWT_AUTH_FLOW | identity | reference (old) | reference/identity-and-tenancy.md |
| MARKETPLACE_NAMING | commerce | naming reference | reference/commerce.md |
| NEXTCLOUD_CUSTOM_CHANGES | nextcloud | patch list | reference/nextcloud.md |
| NEXT_AGENT_BRIEF | apps/inner-gathering | brief | INNERGATHERING_CUTOVER |
| OIDC_NETWORK_FIX | ops | fix plan | — |
| OPENCLAW_BRIDGE_BRIEF | identity | reference | reference/identity-and-tenancy.md |
| PORTAL_SESSION_HANDOFF | identity | handover (2026-04) | — |
| RSVP_EMAIL_TRIGGERS | email | plan | reference/email.md |
| SESSION_BRIEF_2026-07-20 | apps | handover | reference/apps.md |
| SESSION_BRIEF_2026-07-30 | workshops | handover | reference/workshops-and-lms.md |
| SILEX_ALTERNATIVES_2026-09-06 | authoring | research | reference/authoring.md |
| SILEX_AUTHORING_REVIEW_2026-09-05 | authoring | audit | reference/authoring.md |
| SILEX_NEXTCLOUD_CRITICAL_REVIEW_2026-09-06 | authoring | audit | reference/authoring.md |
| SILEX_PUBLIC_DEPLOY | ops | runbook | reference/ops.md |
| SILEX_SESSION_HANDOFF | authoring | handover (2026-04) | reference/authoring.md |
| TALK_ROOM_AUTH_FLOW | identity | reference (old) | reference/identity-and-tenancy.md |
| THREADS_REFACTOR | data-model | debrief | reference/data-model.md |
| WORKSHOP_BINDING_BRIEF | authoring | brief | reference/authoring.md |
| WORKSHOP_BINDING_PROMPT | authoring | session prompt | — |
| WORKSHOP_WORKSPACE_2026-09-09 | workshops | plan + debrief | reference/workshops-and-lms.md |
| dns-and-certs | ops | reference | reference/ops.md |
| nextcloud-security | nextcloud | threat model | reference/nextcloud.md |
| silex-publishing-pipeline | authoring | reference | reference/authoring.md |
| startupguide | ops | reference (old) | reference/ops.md |

`lms/` at the repo root (LMS research and design review) was left in place;
`reference/workshops-and-lms.md` summarises it.

## Writing new docs

- A handover at the end of a session goes in `sessions/YYYY-MM-DD_<topic>.md`.
- A change to how a subsystem works goes into its `reference/` doc; bump its
  "Last verified" date.
- A new plan with open work goes in `open/`; move it to `archive/` when done or
  abandoned, and update the tables above.
- Register: neutral and technical. State facts with `path:line` citations and
  dates; label claims verified / assumed / unknown; give every "never/always"
  its reason; no sales language, no narrative voice, bold at most once per
  section, no all-caps emphasis.

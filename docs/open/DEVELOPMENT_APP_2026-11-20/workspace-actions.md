# Workspace actions for the dock and the platform assistant (design map)

Written 2026-11-23. Source only: nothing here is wired, rebuilt, committed or migrated. The atlas rows are in `packages/actions/atlas/areas/apps.sophia.workspaces.ts` (21 rows, all marked planned: `entry: null`, no runner, no handler).

## In plain words (for Justin)

1. An assistant (or the dock) can help a person with their workspace only as that person: it sees exactly what they see, never more.
2. Reading is free (where am I, what is today's material, what did the circle share). Writing is always shown to the person first, as a card they press.
3. Five actions are "high" and always ask with a stronger card, every time: publish the draft, make everything private, make an invite link, publish results, take results down.
4. Three things are never given to an assistant at all: agreeing to take part in an experiment, agreeing to have your words published, and using an invite link. Those stay the person's own click.
5. The summary of a day is done by the assistant from what the guide is allowed to read; the platform itself runs no AI. Nothing is switched on yet: this is the map and the atlas entries.

## The one rule behind every row

Every action runs the existing engine function with **the acting person's own viewer** (the signed-in session, as `getViewer()` builds it in `apps/sophia/src/lib/viewer.ts`). There is no service or elevated viewer. So an assistant:
- reads what that person may read (their entries; others' only when shared with the circle; for a named run guide also entries shared "with the guide"; never "only me" entries; never entries of someone who withdrew; future days locked; the read-first rule on ongoing days);
- gets no reading power from being an assistant, and none from an organisation role: owners and guides who are **not named on the run** read nothing of the group's words (journal) and cannot touch results (the gate is `runGuide`, the named guides);
- never ticks a consent or agreement box; those are separate actions with no assistant version (see "Must not be exposed").

The checks live in the engine functions (`listRunJournal`, `journalAccess`, `guideGate`, `workspaceActor`, `isRunStaff`, `participationOk`), not in the card. The card only tells the person what is about to happen.

## The table

Risk: none = read only; low = changes a draft or the person's own progress; medium = changes what other people can see or who is in the group; high = always asks with a stronger card and is never remembered ("don't ask again" is not offered). Every write shows a card first; "always asks" in the last column means the strong version.

Who: P = participant seated in the group; G = a guide **named on the run**; OG = org owner or guide (also allowed where noted); S = anyone signed in.
Engine: **exists** = the function is in `packages/lms/src` today; **needs adding** = see the list below the table.
HTTP case = the case of `apps/sophia/src/app/api/workspaces/[action]` (POST) it mirrors.

| Tool (planned name) | Atlas id | Who | R/W | Risk | Asks first | Engine function | HTTP case | Privacy rule |
|---|---|---|---|---|---|---|---|---|
| `workspace.my_state` | `sophia-ws-my-state` | P, G | R | none | no | `refreshWorkspaceDoing`, `getWorkspaceView`, `getExperimentState` (exists) | `state`, `experiment` | Own steps and own agreement state only. A guide also gets the results list. |
| `workspace.read_journal` | `sophia-ws-read-journal` | P, G | R | none | no | `getWorkspaceJournal` / `listRunJournal` (exists) | `journal` | The person's own entries, plus others' entries shared with the circle; a named guide also sees "with the guide". Never "only me". |
| `workspace.read_interval` | `sophia-ws-read-interval` | P, G | R | none | no | `getOngoingView` (exists) | `ongoing` | Today and past days only; read-first gate; others' entries by their own audience. |
| `workspace.read_material` | `sophia-ws-read-interval` | P, G | R | none | no | same view, material part (exists; a slice of the view) | `ongoing` | Material marked "participants" only for people in the group. |
| `workspace.summarise_interval` | `sophia-ws-read-interval` | G | R | none | no | `getOngoingView` / `listRunJournal` (exists); the assistant writes the summary | `ongoing`, `journal` | Summarises only what that guide may read. No server-side AI; the text is returned to the assistant only. |
| `workspace.find_member` | `sophia-ws-add-member` | G, OG | R | none | no | `searchWorkspaceMembers` (exists) | `members-search` | Members of the workspace's own organisation only. |
| `workspace.list_invites` | `sophia-ws-invite-links` | G, OG | R | none | no | `listWorkspaceInvites` (exists) | `invites` | Label, uses, expiry only; tokens are never returned (only a hash is stored). |
| `workspace.list_results` | `sophia-ws-results-draft` | G | R | none | no | `listResults` (exists) | `results` | Named run guides of an experiment only. |
| `workspace.read_candidates` | `sophia-ws-results-draft` | G | R | none | no | `listResultCandidates` (exists) | `results` | Only entries shared with the circle, by people who currently agree. |
| `workspace.complete_step` | `sophia-ws-do-step` | P | W | low | yes | `completeWorkspaceStep` (exists) | `complete` | Own step; the engine refuses locked steps and read-only seats. |
| `workspace.save_entry` | `sophia-ws-do-step` | P | W | medium | yes | `saveWorkspaceResponse` (exists) | `respond` | Own entry; card names the audience; cannot widen beyond what the person said. |
| `workspace.log_entry` | `sophia-ws-log-entry` | P | W | medium | yes | `saveIntervalEntry` (exists) | `ongoing-save` | One entry per day, closing on the writer's own clock, enforced by the engine. |
| `workspace.set_entry_audience` | `sophia-ws-set-entry-audience` | P | W | medium | yes | `setWorkspaceEntryVisibility` (exists) | `visibility` | Own entries only. Widening is the risky direction; the card shows the new audience. |
| `workspace.make_all_private` | `sophia-ws-make-all-private` | P | W | **high** | **always** | `makeMyWorkspaceEntriesPrivate` (exists) | `private-all` | Own entries only; others lose sight at once. Does not unpublish published results. |
| `workspace.comment` | `sophia-ws-comment` | P, G | W | medium | yes | `commentOnWorkspaceEntry` / `answerWorkspaceEntry` (exists) | `comment` | Only on an entry the commenter can read (rechecked by the engine). No email from here. |
| `workspace.plan_interval` | `sophia-ws-plan-interval` | G, OG | W | medium | yes | `saveIntervalPlan` (exists) | `ongoing-plan` | Guides of the run; the card lists every link in the material. |
| `workspace.add_material` | `sophia-ws-plan-interval` | G, OG | W | medium | yes | `saveIntervalPlan` with a read-then-merge (thin wrapper **needs adding**) | `ongoing-plan` | As above; adds one item to the day's list without losing the rest. |
| `workspace.edit_text` | `sophia-ws-edit-text` | G, OG | W | low | yes | `applyWorkspaceEdit` (exists; assistant tool restricts the ops) | `edit` | Draft only; participants see nothing until publish. Allowed ops: course, module, step text, add-step, ongoing. |
| `workspace.publish_draft` | `sophia-ws-publish-draft` | G, OG | W | **high** | **always** | `applyWorkspaceEdit` op publish / adopt (exists) | `edit` | Card says how many people are partway through. |
| `workspace.add_member` | `sophia-ws-add-member` | G, OG | W | medium | yes | `addWorkspaceMember` (exists) | `members-add` | Org members only; in an experiment they read nothing until they agree. |
| `workspace.make_invite` | `sophia-ws-invite-links` | G, OG | W | **high** | **always** | `createWorkspaceInvite` (exists) | `invite-create` | The token goes to the guide's screen only, never into a transcript or log. |
| `workspace.revoke_invite` | `sophia-ws-invite-links` | G, OG | W | medium | yes | `revokeWorkspaceInvite` (exists) | `invite-revoke` | Guides of the run. |
| `workspace.create` | `sophia-ws-create` | OG (owner/guide of the org) | W | medium | yes | `createWorkspace` (exists) | `workspace-create` | Starts private; maker is its guide. The assistant may not pick "open join" or "unlisted" unless the card names it. |
| `workspace.save_consent_text` | `sophia-ws-consent-text` | G | W | medium | yes | `saveConsentText` (exists) | `consent-save` | Writes wording only; records nobody's agreement. |
| `workspace.draft_results` | `sophia-ws-results-draft` | G | W | low | yes | `saveResultDraft` (exists) | `result-save` | Draft only; nothing is published. |
| `workspace.ask_writers` | `sophia-ws-ask-writers` | G | W | medium | yes | `requestPublication` (exists) | `result-request` | Only entries that are shared and whose writer currently agrees; the writer decides. |
| `workspace.publish_results` | `sophia-ws-results-publish` | G | W | **high** | **always** | `prepareResultsPublication` + `markResultPublished` (exist) + the post step (**needs adding**) | `result-publish` | Only agreed entries; refuses with none; "everyone" says it is public. |
| `workspace.takedown_results` | `sophia-ws-results-takedown` | G | W | **high** | **always** | `markResultTakenDown` (exists) + the archive step (**needs adding**) | `result-takedown` | Named run guides only. |

Count: 28 tools. By risk: none 9, low 3, medium 11, high 5. Always-ask (strong card): 5. (The two read rows `read_material` and `summarise_interval` share one atlas row with `read_interval`.)

### Not in the table: never exposed (3 actions, 3 atlas rows marked internal)

| Atlas id | What | HTTP case | Why |
|---|---|---|---|
| `sophia-ws-consent` | agree to take part / withdraw | `experiment-agree`, `experiment-withdraw` | Consent is the person's own act. |
| `sophia-ws-writer-decide` | agree or decline to publish one entry (named or anonymous) | `result-decide` | Only the writer's own click; not even "on their behalf". |
| `sophia-ws-redeem-invite` | join with an invite token | (invite page, `redeemWorkspaceInvite`) | The token is a secret of whoever opens the link. |

## Engine functions that need adding (before those tools may be wired)

1. **Publish and take down results as one engine function.** Today `result-publish` and `result-takedown` do their real work in the HTTP route (`createThread`, `moderateThread`, the "lift a run guide to org guide for one call" step, and rolling back with `archiveOwnPost` when the mark fails). A tool must not copy that route code. Move it into one function (for example `publishWorkspaceResults(viewer, course, resultId)` and `takedownWorkspaceResults(...)`) that both the route and the assistant call. Same for the re-render after a withdrawal. This is a change in `packages/lms` or in a thin app layer, so it is the other worker's area; not done here.
2. **`add_material`**: a small read-then-merge around `saveIntervalPlan` (today it replaces the whole day's list).
3. **An assistant door that builds the acting person's viewer.** The atlas rows assume the platform MCP already acts as a signed-in person (as the dock does). I did not read the MCP server code; this must be confirmed so that an assistant call can never run without that person's session. If it cannot, nothing here may be wired.
4. **A confirm-card contract per tool**: the card text in the atlas rows is draft wording; it has not been through Justin's wording waves.
5. `edit_text` needs an **ops allow-list in the tool** (the atlas shares the one `edit` HTTP case between `edit_text` and `publish_draft`, so the split cannot live in the atlas).

## How the dock shows them

- **Buttons the person sees (dock card, or the dock takes them to the control and highlights it):** complete step, save entry, log today's entry, change audience, make everything private, comment, plan a day, edit text (the Editing mode), publish draft, add person, make and cancel invite links, new workspace, results draft, ask writers, publish and take down results, save agreement wording. Each has an address in the atlas (`/workspaces/{course}...`) so the dock can route there. Risk "high" shows the strong card; the person presses it, not the assistant.
- **Assistant-only calls (no button of their own, they feed an answer):** `my_state`, `read_journal`, `read_interval`, `read_material`, `summarise_interval`, `find_member`, `list_invites`, `list_results`, `read_candidates`. The person asks "what did people write today?" and the assistant calls them; the dock shows nothing to press.
- **Link only (no run in the dock):** agreement panel (consent), writer's agree/decline, invite redemption. The dock may say "open the agreement panel", highlight it, and stop.

## Must not be exposed

- Reading another person's entries beyond the engine's own rule: never "only me", never a withdrawn person's, never a future day, never an org owner's or guide's reading if they are not named on the run. No "read everything" tool, no raw table or export tool, no cross-run search.
- Consent on someone's behalf (`experiment-agree`, `experiment-withdraw`), or agreeing for a writer to publish (`result-decide`). Not even with a card.
- Invite token values in any assistant transcript, log or follow-up message; redeeming a token.
- Publishing results with `audience: everyone` without the card naming it public; publishing with zero agreed entries (the engine refuses; keep it).
- Any result tool for a guide who is only an org owner or guide and not named on the run.
- Widening an entry's audience without naming the new audience.
- Any write run without the person's card press (no background or scheduled writes by assistants).
- Anything from `packages/lms` reading by a service or elevated viewer (including the route's "lift to guide for one call": it exists only inside the takedown route, after its gate).

## Open and not mapped

- The confirm wording for all rows is draft; it has not been sent to Justin. Style should follow wording-wave-01-dry.
- The platform MCP's own viewer building (item 3 above) was not read.
- The experiment's withdrawal re-render of a published post (route code) is mentioned in "needs adding" 1 but has no tool of its own (it is part of consent, which is never exposed).
- Ongoing-session cadence edits are in `edit_text` via the `ongoing` op; I did not list a separate "change cadence" tool.
- Nothing about the dock's persisted state (`lms_dock_state`) is touched.

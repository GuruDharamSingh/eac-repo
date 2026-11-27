import type { Area, Capability, Host, HostKey } from '../types';

// apps/sophia: workspaces (Sophia's workshop and experiment workspaces), 2026-11-23. One door,
// api/workspaces/[action] (27 cases), over the engine files packages/lms/src/{workspaces,ongoing,workspace-edit,
// workspace-create,workspace-experiment}.ts. This area is the source of truth for the PLANNED dock and platform
// assistant ("MCP rails") actions on workspaces. Map and reasoning: docs/open/DEVELOPMENT_APP_2026-11-20/workspace-actions.md.
//
// STATE: every row here is PLANNED for assistants. `entry: null` (no ACTION_CATALOGUE entry, no runner, no MCP handler
// exists yet). What does exist is the HTTP door and the engine functions; those are what the rows claim.
// RULE (all rows): the engine function runs with the ACTING PERSON's own LmsViewer (getViewer on the signed-in session,
// never an elevated or service viewer). An assistant reads only what that person may read and gains no reading power
// from being an assistant. Audience and consent checks live in the engine, never in a card. `confirm` wording is draft.
// Conventions: ids `sophia-ws-*`; area `sophia.workspaces`; the planned tool name (`workspace.my_state`) is in `open`.

const APP = 'sophia';
const DOOR = 'api:apps/sophia/src/app/api/workspaces/[action]/route.ts#POST' as HostKey;
const SRC = 'packages/lms/src/';
const V = '2026-11-23 read apps/sophia/src/app/api/workspaces/[action]/route.ts and packages/lms/src/{workspaces,ongoing,workspace-edit,workspace-create,workspace-experiment}.ts';
const ADDED = '2026-11-23';
const door = (kase: string, service: string[], path: string, how: string, note?: string): Host => ({
  key: DOOR, case: kase, service: service.map((s) => `@elkdonis/lms#${s}`), address: { app: APP, path, how }, ...(note ? { note } : {}),
});
const sql = (file: string, fn: string, service: string[], note?: string): Host => ({
  key: `sql:${SRC}${file}#${fn}` as HostKey, service: service.map((s) => `@elkdonis/lms#${s}`), ...(note ? { note } : {}),
});
const WS = '/workspaces/{course}';

const capabilities: Capability[] = [
  // ---- reads (no confirm): what the person may read, nothing more ----
  {
    id: 'sophia-ws-my-state', area: 'sophia.workspaces', label: 'See where I am in a workspace',
    does: 'Reads the person\'s own steps, what is done, what is next, and (in an experiment) whether they have agreed to take part.',
    class: 'internal', actors: ['person', 'guide'], scope: 'person',
    hosts: [
      door('state', ['refreshWorkspaceDoing', 'getWorkspaceView'], WS, 'the workspace page itself'),
      door('experiment', ['getExperimentState'], WS, 'the agreement panel of an experiment (own state; a named guide also sees the results list)'),
    ],
    entry: null, status: 'a read: nothing is written', risk: ['none'], inputs: 'course',
    open: 'PLANNED tool workspace.my_state. Engine functions exist. Read only, no confirm card.',
    verified: V, added: ADDED,
  },
  {
    id: 'sophia-ws-read-journal', area: 'sophia.workspaces', label: 'Read my journal and the circle feed',
    does: 'Reads the entries the person wrote and the entries others shared with the circle (or with guides, when the person is a named guide), with comments, exactly as the Journal screen shows them.',
    class: 'internal', actors: ['person', 'guide'], scope: 'person',
    hosts: [door('journal', ['getWorkspaceJournal', 'listRunJournal'], `${WS}/journal`, 'the Journal tab')],
    entry: null, status: 'a read: nothing is written', risk: ['none'], inputs: 'course',
    open: 'PLANNED tool workspace.read_journal. Privacy lives in listRunJournal (own entries; others only when shared with the circle, or with guides for a named run guide; "me" entries never; withdrawn seats never). Org owners who are not named on the run get no reading power.',
    verified: V, added: ADDED,
  },
  {
    id: 'sophia-ws-read-interval', area: 'sophia.workspaces', label: 'Read a day of an ongoing session',
    does: 'Reads one interval (a day) of an ongoing session: its material, the person\'s own entry, and the other entries only when the read-first rule and the entries\' own audience allow; past days are readable, future days are locked.',
    class: 'internal', actors: ['person', 'guide'], scope: 'person',
    hosts: [
      door('ongoing', ['getOngoingView', 'listOngoingSessions'], `${WS}/{session}`, 'the ongoing session screen'),
      sql('ongoing.ts', 'getOngoingView', ['getOngoingView'], 'flagged by the scanner as a write host because of a raw SQL string; the function only reads. Claimed here so it stays visible.'),
    ],
    entry: null, status: 'a read: nothing is written', risk: ['none'], inputs: 'course, module, tz, (key)',
    open: 'PLANNED tools workspace.read_interval and workspace.read_material (the material is a part of the same view). The assistant summary for a guide (workspace.summarise_interval) is this same read, handed back to the assistant; the platform runs no AI.',
    verified: V, added: ADDED,
  },

  // ---- participant writes ----
  {
    id: 'sophia-ws-do-step', area: 'sophia.workspaces', label: 'Do a workspace step',
    does: 'The person marks a step done or saves a reflection or practice log for it, with the audience they choose.',
    class: 'person', actors: ['person'], scope: 'person',
    hosts: [
      door('complete', ['completeWorkspaceStep'], `${WS}/{step}`, 'the Mark done button of a step'),
      door('respond', ['saveWorkspaceResponse'], `${WS}/{step}`, 'the entry box under a step (Save)'),
    ],
    entry: null, status: 'an lms step completion or response row for the person', risk: ['others'],
    confirm: { text: 'Save this for “{title}”? It is readable by: {audience}.', status: 'draft' },
    inputs: 'course, step, body, kind, visibility',
    open: 'PLANNED tools workspace.complete_step and workspace.save_entry (ordinary-step entries). The same engine writes as "Take a course" (sophia-course-learn), behind the workspace door.',
    verified: V, added: ADDED,
  },
  {
    id: 'sophia-ws-log-entry', area: 'sophia.workspaces', label: 'Write today\'s entry',
    does: 'The person saves their one entry for the open day of an ongoing session, with a minutes figure and an audience (only me, me and guide, circle). The server closes the day on the person\'s own clock.',
    class: 'person', actors: ['person'], scope: 'person',
    hosts: [
      door('ongoing-save', ['saveIntervalEntry'], `${WS}/{session}`, 'the Save button of the ongoing session screen'),
      sql('ongoing.ts', 'saveIntervalEntry', ['saveIntervalEntry']),
    ],
    entry: null, status: 'an lms_responses row with an interval_key for the person and the day', risk: ['others'],
    confirm: { text: 'Save today\'s entry? It is readable by: {audience}.', status: 'draft' },
    inputs: 'course, module, body, minutes, visibility, key, tz',
    open: 'PLANNED tool workspace.log_entry. One entry per person per day, enforced in the engine. The card names the audience; an assistant may not widen it beyond what the person said.',
    verified: V, added: ADDED,
  },
  {
    id: 'sophia-ws-set-entry-audience', area: 'sophia.workspaces', label: 'Change who can read one of my entries',
    does: 'The person changes the audience of an entry of their own (only me, me and guide, circle).',
    class: 'person', actors: ['person'], scope: 'person',
    hosts: [door('visibility', ['setWorkspaceEntryVisibility', 'saveResponse'], `${WS}/journal`, 'the audience control on an entry in the Journal')],
    entry: null, status: 'the response row\'s visibility reflects the choice', risk: ['others'],
    confirm: { text: 'Let {audience} read this entry?', status: 'draft' },
    inputs: 'course, response, visibility',
    open: 'PLANNED tool workspace.set_entry_audience. Own entries only (the engine refuses others). Narrowing to "only me" is low risk; widening is the one that matters, so the card always shows the new audience.',
    verified: V, added: ADDED,
  },
  {
    id: 'sophia-ws-make-all-private', area: 'sophia.workspaces', label: 'Make everything I wrote private',
    does: 'One press: every entry the person has written in the workspace goes back to only me; others lose sight of them at once.',
    class: 'person', actors: ['person'], scope: 'person',
    hosts: [
      door('private-all', ['makeMyWorkspaceEntriesPrivate'], `${WS}/journal`, 'the Make everything private button'),
      sql('workspaces.ts', 'makeMyWorkspaceEntriesPrivate', ['makeMyWorkspaceEntriesPrivate']),
    ],
    entry: null, status: 'every response of the person in the run has visibility me', risk: ['others'],
    confirm: { text: 'Make everything you wrote here private? Others will stop seeing it at once.', status: 'draft' },
    inputs: 'course',
    open: 'PLANNED tool workspace.make_all_private. Always asks. It does not unpublish results already published with a writer\'s agreement (withdrawing from an experiment does that).',
    verified: V, added: ADDED,
  },
  {
    id: 'sophia-ws-comment', area: 'sophia.workspaces', label: 'Comment on an entry',
    does: 'The person (or a named guide) comments on an entry they can read. A guide\'s words are kept as the engine\'s answer when comments are not switched on. No email is sent from here.',
    class: 'person', actors: ['person', 'guide'], scope: 'thread',
    hosts: [
      door('comment', ['commentOnWorkspaceEntry', 'answerWorkspaceEntry'], `${WS}/journal`, 'the comment box under an entry in the Journal'),
      sql('workspaces.ts', 'commentOnWorkspaceEntry', ['commentOnWorkspaceEntry']),
    ],
    entry: null, status: 'an lms_response_comments row (or an acknowledgement) by the person', risk: ['others'],
    confirm: { text: 'Post this comment on {writer}\'s entry?', status: 'draft' },
    inputs: 'course, response, body',
    open: 'PLANNED tool workspace.comment. The engine rechecks that the commenter may read THAT entry; a comment on an entry you cannot read is refused.',
    verified: V, added: ADDED,
  },

  // ---- guide writes ----
  {
    id: 'sophia-ws-plan-interval', area: 'sophia.workspaces', label: 'Plan a day: note and material',
    does: 'A named guide or org owner/guide sets the note and the material (links, names, who may open each) for one day of an ongoing session.',
    class: 'person', actors: ['guide', 'owner'], scope: 'org',
    hosts: [
      door('ongoing-plan', ['saveIntervalPlan', 'getWorkspaceView'], `${WS}/{session}`, 'the Plan this day control (guides only)'),
      sql('ongoing.ts', 'saveIntervalPlan', ['saveIntervalPlan']),
    ],
    entry: null, status: 'a workspace_materials row for (run, session, day)', risk: ['others'],
    confirm: { text: 'Save this plan for {day}? People in the group will see the note and material that day.', status: 'draft' },
    inputs: 'course, module, key, note, items',
    open: 'PLANNED tools workspace.plan_interval and workspace.add_material (same engine call; add_material merges one item into the day\'s list). Material with "open" access can show a link to people outside the group, so the card lists each link.',
    verified: V, added: ADDED,
  },
  {
    id: 'sophia-ws-edit-text', area: 'sophia.workspaces', label: 'Edit the workspace in the draft',
    does: 'A guide edits the DRAFT of a workspace: course, session and step text, adds, removes and moves, the cadence of an ongoing session, and settings. Nothing reaches participants until a separate publish.',
    class: 'person', actors: ['guide', 'owner'], scope: 'org',
    hosts: [
      door('edit', ['applyWorkspaceEdit', 'workspaceActor'], WS, 'Editing mode in the workspace (guides only)'),
      sql('workspace-edit.ts', 'saveSettings', ['applyWorkspaceEdit'], 'settings (comments by, call link, emails, digest)'),
      sql('ongoing.ts', 'saveOngoingSession', ['saveOngoingSession']),
      sql('ongoing.ts', 'deleteOngoingSession', ['deleteOngoingSession']),
    ],
    entry: null, status: 'the draft version of the course reflects the edit; the published version is unchanged', risk: ['none'],
    confirm: { text: 'Change {what} in the draft of “{title}”? Participants see it only after you publish.', status: 'draft' },
    inputs: 'course, op (course|module|step|add|remove|move|ongoing|plan)',
    open: 'PLANNED tool workspace.edit_text, limited to ops course, module, step (text fields only, not required/due/timeLimit), add-step, ongoing. The ops publish and adopt are NOT part of this tool: they are sophia-ws-publish-draft by the same case, and the tool refuses them. One case "edit" serves both, so the split is in the tool, not the atlas.',
    verified: V, added: ADDED,
  },
  {
    id: 'sophia-ws-publish-draft', area: 'sophia.workspaces', label: 'Publish the workspace draft to participants',
    does: 'A guide publishes the draft: participants see the new text. A structural change leaves people partway through on the old version until the guide moves them.',
    class: 'internal', actors: ['guide', 'owner'], scope: 'org',
    hosts: [],
    entry: null, status: 'unverifiable: shares the edit case with sophia-ws-edit-text (ops publish and adopt)', risk: ['others'],
    open: 'PLANNED tool workspace.publish_draft, ALWAYS asks (confirm text: "Publish the changes to {title}? {n} people are partway through; they stay on the earlier version until you move them."). No host of its own (same route case as sophia-ws-edit-text); the atlas allows one claim per (host, case).',
    verified: V, added: ADDED,
  },
  {
    id: 'sophia-ws-add-member', area: 'sophia.workspaces', label: 'Add a person to the workspace',
    does: 'A guide searches the organisation\'s members and seats one of them in the group.',
    class: 'person', actors: ['guide', 'owner'], scope: 'org',
    hosts: [
      door('members-search', ['searchWorkspaceMembers'], WS, 'the people search in Settings'),
      door('members-add', ['addWorkspaceMember'], WS, 'the Add button next to a person in Settings'),
    ],
    entry: null, status: 'an lms_enrolments row for the person in the run', risk: ['others'],
    confirm: { text: 'Add {name} to “{title}”? They will be able to read what the group shares.', status: 'draft' },
    inputs: 'course, q, userId',
    open: 'PLANNED tools workspace.find_member (read) and workspace.add_member (write). Organisation members only. Adding someone to a closed experiment seats them, but they read nothing of the group until they agree.',
    verified: V, added: ADDED,
  },
  {
    id: 'sophia-ws-invite-links', area: 'sophia.workspaces', label: 'Make or cancel an invite link',
    does: 'A guide lists, makes (with a label, a use limit and an expiry) or revokes invite links. The link token is shown once.',
    class: 'person', actors: ['guide', 'owner'], scope: 'org',
    hosts: [
      door('invites', ['listWorkspaceInvites'], WS, 'the Invite links list in Settings'),
      door('invite-create', ['createWorkspaceInvite'], WS, 'the Make a link button'),
      door('invite-revoke', ['revokeWorkspaceInvite'], WS, 'the Cancel link control'),
      sql('workspace-edit.ts', 'createWorkspaceInvite', ['createWorkspaceInvite']),
      sql('workspace-edit.ts', 'revokeWorkspaceInvite', ['revokeWorkspaceInvite']),
    ],
    entry: null, status: 'a workspace_invites row (hash only) for the run', risk: ['others', 'public'],
    confirm: { text: 'Make a link that lets anyone who has it join “{title}”? Use limit: {limit}. Expires: {expiry}.', status: 'draft' },
    inputs: 'course, label, maxUses, days, id',
    open: 'PLANNED tools workspace.list_invites (read), workspace.make_invite and workspace.revoke_invite, ALWAYS ask. The token must go only to the signed-in guide on screen, never into an assistant transcript or a stored log.',
    verified: V, added: ADDED,
  },
  {
    id: 'sophia-ws-create', area: 'sophia.workspaces', label: 'Make a workspace or an experiment',
    does: 'An org owner or guide makes a workspace (a course, starter sessions, a published version and a cohort run with the maker as guide), optionally as an ongoing or experiment preset with consent text.',
    class: 'person', actors: ['owner', 'guide'], scope: 'org',
    hosts: [
      door('workspace-create', ['createWorkspace'], '/workspaces/new', 'the New workspace form'),
      sql('workspace-create.ts', 'createWorkspace', ['createWorkspace', 'createCourse']),
      sql('workspace-create.ts', 'archiveWorkspace', ['archiveWorkspace'], 'undo of a half-made workspace'),
      sql('workspace-create.ts', 'setCourseKind', ['setCourseKind']),
      sql('workspace-experiment.ts', 'setWorkspacePreset', ['setWorkspacePreset']),
    ],
    entry: null, status: 'an lms_courses row of kind workspace with a run in which the maker is guide', risk: ['others'],
    confirm: { text: 'Make “{title}” in {org}? It starts private; you are its guide.', status: 'draft' },
    inputs: 'orgId, title, line, when, where, sessions, ongoing, experiment, consentText, visibility, join',
    open: 'PLANNED tool workspace.create. Always starts private or unlisted. An assistant may fill the form; it may not choose join "open" or visibility "unlisted" without the card naming it.',
    verified: V, added: ADDED,
  },

  // ---- experiment: guides ----
  {
    id: 'sophia-ws-consent-text', area: 'sophia.workspaces', label: 'Write the agreement text of an experiment',
    does: 'A named guide saves a new version of the wording people agree to. Earlier agreements stay tied to the version people saw.',
    class: 'person', actors: ['guide'], scope: 'org',
    hosts: [
      door('consent-save', ['saveConsentText'], WS, 'the agreement text box in Settings'),
      sql('workspace-experiment.ts', 'saveConsentText', ['saveConsentText']),
    ],
    entry: null, status: 'a workspace_consent_texts row with the next version', risk: ['others'],
    confirm: { text: 'Save this as the new agreement wording for “{title}”?', status: 'draft' },
    inputs: 'course, body',
    open: 'PLANNED tool workspace.save_consent_text. Writes wording only; it never records anyone\'s agreement.',
    verified: V, added: ADDED,
  },
  {
    id: 'sophia-ws-results-draft', area: 'sophia.workspaces', label: 'Draft the results of an experiment',
    does: 'A NAMED run guide lists the results drafts and the entries that could be asked about (shared entries by people who currently agree), and saves a draft (title, intro, conclusion, audience members or everyone). Nothing is published.',
    class: 'person', actors: ['guide'], scope: 'org',
    hosts: [
      door('results', ['listResults', 'listResultCandidates'], `${WS}/results`, 'the Results tab'),
      door('result-save', ['saveResultDraft'], `${WS}/results`, 'the Save draft button'),
      sql('workspace-experiment.ts', 'saveResultDraft', ['saveResultDraft']),
    ],
    entry: null, status: 'a workspace_results row with status draft', risk: ['none'],
    confirm: { text: 'Save this as a draft of the results? Nothing is published.', status: 'draft' },
    inputs: 'course, resultId, title, intro, conclusion, audience',
    open: 'PLANNED tools workspace.list_results (read), workspace.read_candidates (read: only SHARED entries by people who agree) and workspace.draft_results (write). The gate is the named run guide, never the org role.',
    verified: V, added: ADDED,
  },
  {
    id: 'sophia-ws-ask-writers', area: 'sophia.workspaces', label: 'Ask writers if an entry may be published',
    does: 'A named run guide picks shared entries and sends each writer a request. An entry is included only if the writer agrees themselves, per entry, named or anonymous.',
    class: 'person', actors: ['guide'], scope: 'org',
    hosts: [
      door('result-request', ['requestPublication'], `${WS}/results`, 'the Ask the writers button'),
      sql('workspace-experiment.ts', 'requestPublication', ['requestPublication']),
    ],
    entry: null, status: 'workspace_result_items rows in state requested', risk: ['others'],
    confirm: { text: 'Ask {n} people if their entry for {day} may be published? Nothing is included unless each person agrees.', status: 'draft' },
    inputs: 'course, id, responseIds',
    open: 'PLANNED tool workspace.ask_writers. Writers see the request on their own screen; the engine sends no email.',
    verified: V, added: ADDED,
  },
  {
    id: 'sophia-ws-results-publish', area: 'sophia.workspaces', label: 'Publish the results',
    does: 'A named run guide publishes a draft as a post (members by default; "everyone" makes a public post). Only entries whose writers agreed are included; with none agreed it refuses.',
    class: 'person', actors: ['guide'], scope: 'org',
    hosts: [
      door('result-publish', ['prepareResultsPublication', 'markResultPublished', 'createThread', 'moderateThread'], `${WS}/results`, 'the Publish button of a draft'),
      sql('workspace-experiment.ts', 'markResultPublished', ['markResultPublished']),
    ],
    entry: null, status: 'a workspace_results row published with a thread_id; the post exists', risk: ['public'],
    confirm: { text: 'Publish “{title}” to {audience}? It includes {n} entries whose writers agreed. {publicNote}', status: 'draft' },
    inputs: 'course, id',
    open: 'PLANNED tool workspace.publish_results, ALWAYS asks, high risk. The post is made by the ROUTE (createThread), not by an engine function: a tool needs that step moved into one engine function first (see the doc, "needs adding"). Until then it must not be wired.',
    verified: V, added: ADDED,
  },
  {
    id: 'sophia-ws-results-takedown', area: 'sophia.workspaces', label: 'Take the results down',
    does: 'A named run guide marks published results taken down and the post is archived.',
    class: 'person', actors: ['guide'], scope: 'org',
    hosts: [
      door('result-takedown', ['markResultTakenDown', 'moderateThread'], `${WS}/results`, 'the Take down control of published results'),
      sql('workspace-experiment.ts', 'markResultTakenDown', ['markResultTakenDown']),
    ],
    entry: null, status: 'the result row is taken_down and its post is archived', risk: ['irreversible'],
    confirm: { text: 'Take down “{title}”? The post is archived.', status: 'draft' },
    inputs: 'course, id',
    open: 'PLANNED tool workspace.takedown_results, ALWAYS asks. The route lifts a run guide who is not an org guide to guide for the one archive call, after the gate; a handler must not copy that lift outside the same gate.',
    verified: V, added: ADDED,
  },

  // ---- NEVER offered to an assistant: the person's own decision ----
  {
    id: 'sophia-ws-consent', area: 'sophia.workspaces', label: 'Agree to take part, or withdraw (experiment)',
    does: 'The person agrees to the experiment\'s wording, or withdraws; withdrawing pulls their entries from published results.',
    class: 'internal', actors: ['person'], scope: 'person',
    hosts: [
      door('experiment-agree', ['agreeToParticipation'], WS, 'the I agree button of the agreement panel'),
      door('experiment-withdraw', ['withdrawParticipation', 'afterWithdrawalPublished', 'updatePost'], WS, 'the Withdraw control of the agreement panel'),
      sql('workspace-experiment.ts', 'agreeToParticipation', ['agreeToParticipation']),
      sql('workspace-experiment.ts', 'withdrawParticipation', ['withdrawParticipation']),
    ],
    entry: null, status: 'a workspace_consents row for the person', risk: ['others'],
    open: 'NOT EXPOSED to assistants or the dock as a runnable step: consent is the person\'s own act on the screen. The dock may only link to the panel.',
    verified: V, added: ADDED,
  },
  {
    id: 'sophia-ws-writer-decide', area: 'sophia.workspaces', label: 'Agree or decline to have an entry published',
    does: 'A writer agrees (named or anonymous) or declines a guide\'s request to include one entry in published results.',
    class: 'internal', actors: ['person'], scope: 'person',
    hosts: [
      door('result-decide', ['decidePublication'], WS, 'the Agree and Decline buttons on a request on the writer\'s own screen'),
      sql('workspace-experiment.ts', 'decidePublication', ['decidePublication']),
    ],
    entry: null, status: 'a workspace_result_items row in state agreed or declined', risk: ['public'],
    open: 'NOT EXPOSED to assistants or the dock as a runnable step: an agreement to publish someone\'s words is only ever the writer\'s own click, not even "for" the writer.',
    verified: V, added: ADDED,
  },
  {
    id: 'sophia-ws-redeem-invite', area: 'sophia.workspaces', label: 'Join with an invite link',
    does: 'A signed-in person redeems an invite token and is seated in the group.',
    class: 'internal', actors: ['person'], scope: 'person',
    hosts: [sql('workspace-edit.ts', 'redeemWorkspaceInvite', ['redeemWorkspaceInvite'], 'called by the invite page of apps/sophia, not by the workspaces door')],
    entry: null, status: 'an lms_enrolments row for the person; the invite use count rises', risk: ['others'],
    open: 'NOT EXPOSED to assistants: the token is a secret held by whoever opens the link.',
    verified: V, added: ADDED,
  },
];

const ignored: Area['ignored'] = [];

export default { capabilities, ignored } satisfies Area;

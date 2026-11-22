# /development/workspace, round 2 (Justin's running notes, 2026-11-22)

Read `WORKSPACE_CONTRACT.md` in this folder first; this file changes it. It is still a browser-only prototype in `apps/development/src/workspace/**`.

## What Justin said, as changes

**A. Steps live on the main page too.**
- In Editing, clicking "Steps · 0 of 4" must NOT open the sheet. The module's step list opens in the main pane, under the module's text and ABOVE the "This module's colour" section, with room for the step's fields. "+ Add step" and each step's editor are there.
- In every mode the main pane lists the module's steps in some way. For a participant: a compact list with done / current / locked; clicking one selects it, and the sheet shows it for doing.

**B. Module look.**
- Remove the title-font control and its description (direct edit will handle it later).
- Keep the colour section as it is.

**C. The sheet is open by default in all three modes.** It opens on a **home** view.
- A workspace header card:
  - the workshop's name;
  - "Hosted by <guide>", with a small link to the host's profile and a "Contact the host" button;
  - "Your profile", which opens the viewer's profile in the sheet: name, a picture placeholder with "Add a picture", a short bio, and their settings;
  - a small menu: Open journal, People, Settings.
- An orientation:
  - in Editing: "Welcome to the editor", three or four lines on what can be done here;
  - as a participant: a welcome with what to do next (the next step);
  - as the guide: what needs attention (unread journal entries).
- Under it: the selected module's steps, as the steps sheet shows them today. This is the participant's doing view.
- When a step is selected on the main page, the header card collapses to an "Overview" button at the top of the sheet. Pressing it returns to home.
- A **journal overview** block on home: the last two or three entries plus counts. "Open the journal" opens the FRAME, not the sheet view.

**D. Journals are "concurrent", not "cohort" or "circle".**
- Rename everywhere: no "cohort", no "circle".
- The owner sets journal visibility in settings: **Private** (each person and the guide), **Concurrent** (reflections are shared in the group), **Public** (anyone who can see the workshop).
- The Journal shows everything: reflections, logs, media, notes, quiz answers. The filters only narrow it. Say so in its empty and help text.

**E. The sheet is the place for concurrency.** Home also shows:
- who is in the group, with an online dot (fake presence: two or three people marked online);
- a small group message thread ("Messages") that anyone can post to.

**F. The left column gains "Settings", below Journal.** It opens a Settings pane in the MAIN area.
- For the editor/guide:
  - Journals (the three-way visibility; who may comment);
  - Participants (the list; invite is inert);
  - Workshop (status draft/published, price, where; a few inert placeholders marked "later").
- For a participant: their own settings (notifications inert; "share my journal entries with the group" when the workshop is Concurrent).

## Contract changes (worker R1 owns `types.ts`, `store.tsx`, `sample.ts` and makes these FIRST)

```ts
// types.ts
export type JournalVisibility = "private" | "concurrent" | "public";
// Course: REPLACE `journalsShared: boolean` with:
//   journals: JournalVisibility; journalComments: "guide" | "everyone";
// Person: ADD  pictureLabel?: string; bio?: string; online?: boolean; shareJournal?: boolean;
export interface Message { id: string; by: string; at: string; text: string; }
// Module: REMOVE titleFont (leave the key optional in the type so stored state still loads; do not render it).
```

```ts
// store.tsx: ADD to WorkspaceApi
sheet: "home" | "steps" | "journal" | "profile" | "people" | null;   // default "home"; the sheet is open by default
openStep: string | null; setOpenStep(id: string | null): void;       // the step selected on the main page
updatePerson(id: string, patch: Partial<Person>): void;
messages: Message[]; sendMessage(text: string): void;                // by the viewer
// selected: "overview" | "settings" | <module id>
```

- Bump the storage key to `dev-workspace:v2` (old state is dropped).
- A helper `canSee(viewer, person)`, exported from the store: true if it is the same person, or the viewer is the guide, or journals are "concurrent"/"public" and that person's `shareJournal` is not false.

## Owners

**R1, main area and data**
- `types.ts`, `store.tsx`, `sample.ts`, `Shell.tsx`, `ModuleList.tsx`, `ModulePane.tsx`, `DraftBar.tsx`, `Field.tsx`, `workspace.css`
- new `SettingsPane.tsx`, `MainSteps.tsx`
- `MainSteps` reuses W2's kinds (`sheet/kinds`: `KINDS[kind].Edit` / `.Do`, `KIND_ORDER`) for the step editors, so the same fields render in the main pane. Import them; do not copy them.

**R2, the sheet and the journal**
- `sheet/**` (new `SheetHome.tsx`, `ProfilePanel.tsx`, `PeoplePanel.tsx`, `Messages.tsx`; `StepsSheet.tsx` becomes the "doing" list used inside home and on its own) and `journal/**` (rename to Concurrent, use `course.journals` and `canSee`, the journal overview block, help text that it holds everything).
- Shell mounts by `sheet`: home → `SheetHome`, steps → `StepsSheet`, journal → `JournalSheet`, profile → `ProfilePanel`, people → `PeoplePanel`. R1 adds those cases to Shell and creates one-line placeholders at the new paths only if they are missing.

Both: post on `~/eac/docs/open/LIAISON/HOUSE_EDITOR_PM.md` before and after; your files only; no DB, no server actions, no rebuild/restart, no commit; `tsc` 0 errors in your files.

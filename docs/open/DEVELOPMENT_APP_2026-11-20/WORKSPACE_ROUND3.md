# /development/workspace, round 3: the ongoing session and the settings (Justin, 2026-11-22)

Read `WORKSPACE_CONTRACT.md`, `WORKSPACE_ROUND2.md` and `WORKSPACE_ROUND3_NOTES.md` in this folder first. It is still a browser-only prototype in `apps/development/src/workspace/**`, a mock-up to click through. `workspace-grounding.md` says what the real learning package (`packages/lms`) already has; use ITS words where they exist.

## What Justin said (2026-11-22), as changes

**Words.**
- "Shared journal", not "concurrent". Two states only: **Private** (each person and the guide) and **Shared** (people in the workshop see each other's; never outsiders). Remove "Public". No "cohort", "circle" or "concurrent" anywhere on screen.
- Workshop and workspace are the same thing. A "space" is NOT a different kind of workshop. It is a workshop set up a certain way, in settings.

**The ongoing session** (his "ongoing / pinned session"). He also calls it the journal module, the shared space, or a work group.
- A workshop need not have an end date or a number of sessions. Creating one can make a single session.
- In Settings → Sessions, choose a session and set its type from **Standard** to **Ongoing**. An ongoing session has ONE step that repeats every **interval** (day or week).
  - Each interval has its own material, set ahead by the owner for any coming interval.
  - People respond to the current interval's task.
  - When the interval ends, entries for it close and the next one opens. "If you don't enter it at that time, then you just don't get the chance."
- The ongoing session takes over the MODULE WINDOW as the shared-space view:
  - It keeps the cover image, shows the current date, and has an "Open journal" button, in the regular surface look.
  - **A strip of intervals** runs along its header: 5 or 7 days (or weeks) with the current one in the middle. Past ones can be opened to read; future ones are visible to the owner for adding material.
  - **The step to be followed** is restated, with any material attached to this interval.
  - **The entry field** for the step comes next. If it is a practice step: an optional timer (the timer can also sit in the sheet to the side), and a recording (audio or video) or a picture, as pretend controls.
  - **Once entered, the form collapses** and the pane shows everyone's entries for that interval (whoever has published theirs).
  - **Clicking a person's name** shows the list of all their entries through this ongoing session, going back.
- Standard steps elsewhere keep deadlines with a date AND a time. They can still be handed in after it (shown as late); only the ongoing session closes.

**Journal.**
- Take the sort-by-type chips (All / Reflections / Logs / Media / With comments) OFF.
- In the shared view: an aggregated feed AND a filter by participant, for participants as well as the host when the journal is Shared.
- He prefers the frames we have been using; keep that look.

**Settings**, the big ask: "mock up the settings menu, especially for the editor, and the ability to open a session drop-down menu". It is a Settings pane in the main area, for the editor.
- **Workshop:** title, status, who can join (free and open: sign in and click in, which counts as an RSVP; or by invitation), end date optional ("No end date"), pacing (Open / In order / By date: the learning package's own unlock rules).
- **Sessions:** a drop-down to pick a session, then its settings: type (Standard / Ongoing), date, cover, colour, and "Steps in this session" with reorder.
  - For Ongoing: the repeating step, the interval (Every day / Every week), the start date, "Entries close when the interval ends" (on by default), how many intervals show in the strip (5 or 7), and a planner listing the next intervals with the material attached to each ("Add material").
- **Steps:** a drop-down to pick a step (grouped by session), then its settings: kind, required, deadline (date and time), timer, where it is answered (the sheet and the page both).
- **Shared journal:** Private / Shared, who may comment, and "Applies to entries made from now on". Earlier entries stay as they were unless each person opts in.
- **Emails:** who gets them (Everyone / Only the guide / Nobody), when (Each post / A weekly digest of who responded and with what), a reminder before an interval closes. All inert, marked "later".
- **Call link:** paste a link (Zoom or other); "Create a Talk room" inert, marked "later".
- **People:** the list; invite inert.
- A participant's Settings stay small: share my entries, notifications, profile.

## Contract changes (worker T1 owns `types.ts`, `store.tsx`, `sample.ts` and makes these FIRST)

```ts
// types.ts
export type JournalVisibility = "private" | "shared";          // "concurrent" and "public" are gone; map old stored values to "shared"
export type Pacing = "open" | "in-order" | "by-date";
export interface IntervalPlan { key: string; note?: string; materials: Material[]; }   // key = ISO date of the interval's start
export interface Ongoing {
  stepId: string;                       // the one repeating step
  every: "day" | "week";
  start: string;                        // ISO date
  closes: boolean;                      // entries close when the interval ends
  show: 5 | 7;                          // intervals in the strip
  plans: IntervalPlan[];
}
// Module: ADD  kind?: "standard" | "ongoing";  ongoing?: Ongoing;
// Entry:  ADD  intervalKey?: string;  late?: boolean;
// Course: ADD  pacing: Pacing; endDate?: string | null; join: "open" | "invite"; callLink?: string;
//              emails: { to: "everyone" | "guide" | "nobody"; when: "each" | "digest"; remind: boolean };
// Step.due already allows a date-time: show the time too.
```

```ts
// store.tsx: ADD
now: string;                                   // the prototype's fixed "today" (from sample.ts SAMPLE_NOW) so intervals are deterministic
interval: string | null; setInterval(key: string | null): void;     // the interval open in an ongoing session (null = current)
setModuleKind(id: string, kind: "standard" | "ongoing"): void;       // creating a default Ongoing config (and a step) when switched on
updateOngoing(moduleId: string, patch: Partial<Ongoing>): void;
planInterval(moduleId: string, key: string, patch: Partial<IntervalPlan>): void;
// helpers exported from store: intervalsAround(ongoing, now) -> { key, label, state: "past" | "current" | "future" }[] ; intervalOpen(ongoing, key, now): boolean
// `selected` for Settings sub-pages: "settings" stays; the pane holds its own tab state.
```

- Storage key `dev-workspace:v3`.
- Sample: make session 6 (or add a 7th) an ONGOING session called "Daily practice" (every day), with plans for the days around `now`, entries from several people across past days, and today's entry missing for the viewer. Keep the other sessions standard.

## Owners

**T1, main area, data and settings**
- `types.ts`, `store.tsx`, `sample.ts`, `Shell.tsx`, `ModuleList.tsx`, `ModulePane.tsx`, `MainSteps.tsx`, `SettingsPane.tsx` (rebuilt as above, with the session and step drop-downs), `DraftBar.tsx`, `NewWorkshopSheet.tsx` (sessions can be 1; "No end date"), `workspace.css`.
- ModulePane renders T2's `ongoing/OngoingPane.tsx` when `module.kind === "ongoing"`.

**T2, the ongoing session and the journal**
- New `ongoing/OngoingPane.tsx`, `IntervalStrip.tsx`, `IntervalEntry.tsx`, `IntervalFeed.tsx`, `PersonEntries.tsx`, `ongoing.css`.
- `journal/**`: Shared wording, type chips removed, aggregated feed + filter by participant for everyone who may see.
- `sheet/**`: wording; the timer available beside an ongoing session; "Coming up" includes "Today's entry closes in …".

Both: post on `~/eac/docs/open/LIAISON/HOUSE_EDITOR_PM.md` before and after; your files only; no DB, no server actions, no rebuild/restart, no commit; `tsc` 0 errors in your files.

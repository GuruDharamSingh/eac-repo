# /development/workspace: the clickable workshop workspace (contract for the three workers)

Justin, 2026-11-22: "make a page on /development that is /workspace that provides the beginning code backing to these mocks you made so I can click through."

A click-through PROTOTYPE inside `apps/development`. State lives in the browser only (localStorage). Nothing is saved to any site and nothing is written to the database. No shared package is edited.

## What it must let him do
The wireframes are the spec: canvas https://claude.ai/artifact/VxtF2k1ZEXeWzYu5Vn6SM4. The source files are on this Windows machine at
`C:\Users\Justi\AppData\Local\Temp\claude\9519414f725d5b3e\c6565e0f-9a31-44a2-ade5-ce9fe265a00b\scratchpad\workshop-wires\project\*.dc.html`. Read the ones for your lane.

1. Start: "New workshop" sheet with four questions (title, one line, when, where) → creates the course → lands on the page in edit mode. (`Main.dc.html`)
2. The workspace page: a draft bar (in edit mode), a banner, title / one line / price editable in place, a **module list** on the left (Overview + one entry per session + "Add session"), and the selected module's pane. (`Workspace-overview`, `Workspace-session`)
3. A module carries its own cover, colour, title font and materials (open to everyone / participants only). Its colour can fill its row, wash its pane and colour its title. (`Module-colour`)
4. The right **sheet** lists the module's steps with their fields: for completing (participant) or creating/editing (edit mode). (`Session-course-sheet`, `Course-steps-builder`, `Module-activities`)
5. Theater mode: the cover expands for a video, with timestamped notes under it. (`Session-theater`)
6. The **Journal**: everything written or logged in steps gathers there.
   - It opens in the sheet for a participant (`Journal-sheet`).
   - It also opens in a **surface frame** (`Journal-guide-frame`): the guide's view. This is also a "cohort / circle view" when journals are public to the group. A photo opens in a small pop-up from the frame.
   - Comments, filters, export.
7. A mode switch in the page chrome: **Editing · As a participant · As the guide**. A "Reset sample" button.

Justin's decisions: the sheet is for steps; the frame is the Journal view (not the step nav). The Journal in the sheet stays as an option for the participant. A workshop is a course, its sessions are modules, and steps are the kinds of activity in a module.

## Files and owners
All under `apps/development/src/`. Do not edit another lane's files; ask on the board.

**Worker W1, shell and data**
- `workspace/types.ts`, `workspace/sample.ts`, `workspace/store.tsx`
- `workspace/Shell.tsx`, `ModuleList.tsx`, `ModulePane.tsx`, `DraftBar.tsx`, `NewWorkshopSheet.tsx`, `Theater.tsx`
- `workspace/workspace.css`
- `app/workspace/page.tsx` (calls `requireNetworkAdmin("/workspace")`)
- one line in `components/TopBar.tsx` and one Ideas entry

**Worker W2, the steps sheet**
- `workspace/sheet/StepsSheet.tsx`, `workspace/sheet/kinds/*.tsx` (one per step kind, each with a `Do` view and an `Edit` view), `workspace/sheet/sheet.css`

**Worker W3, the Journal**
- `workspace/journal/JournalSheet.tsx`, `JournalFrame.tsx`, `EntryCard.tsx`, `exportJournal.ts`, `journal.css`

## The shared contract (W1 writes these files FIRST, exactly; W2 and W3 code against them from the start)

```ts
// workspace/types.ts
export type Mode = "edit" | "participant" | "guide";
export type StepKind =
  | "reading" | "watch" | "reflection" | "practice" | "photo" | "recording"
  | "conversation" | "gathering" | "resource" | "quiz" | "setup";
// In packages/lms today: reading, practice, reflection, gathering, conversation, resource, setup. New here: watch, photo, recording, quiz.
export const NEW_KINDS: StepKind[] = ["watch", "photo", "recording", "quiz"];
export interface Step {
  id: string; kind: StepKind; title: string; prompt?: string; required?: boolean;
  body?: string;                       // reading text
  videoLabel?: string; duration?: string;          // watch
  options?: string[]; answer?: number;             // quiz
  when?: string; where?: string;                   // gathering
  href?: string; fileName?: string;                // resource
  items?: string[];                                // setup checklist
}
export interface Material { id: string; name: string; access: "open" | "participants"; }
export interface Module {
  id: string; title: string; date?: string; length?: string; description?: string;
  coverLabel?: string; hasVideo?: boolean;
  colour: string;                      // hex
  titleFont?: string;                  // CSS font-family
  fill: { row: boolean; pane: boolean; title: boolean; buttons: boolean };
  materials: Material[]; steps: Step[];
}
export interface Person { id: string; name: string; initials: string; role: "guide" | "participant"; }
export interface Comment { id: string; by: string; at: string; text: string; }
export interface Entry {               // one journal entry, made by doing a step or adding a note
  id: string; personId: string; moduleId: string; stepId?: string;
  kind: "reflection" | "practice" | "photo" | "recording" | "note" | "quiz";
  at: string;                          // ISO
  text?: string; minutes?: number; mediaLabel?: string; timestamp?: string; // "06:30" for a video note
  comments: Comment[];
}
export interface Course {
  id: string; title: string; line: string; price: string;       // "Free" or "CA$ 180"
  when: string; where: "In person" | "Online" | "Both";
  bannerLabel?: string; about: string; guideId: string;
  modules: Module[]; journalsShared: boolean;                    // cohort / circle view when true
  status: "draft" | "published";
}
```

```ts
// workspace/store.tsx  ("use client")
export interface WorkspaceApi {
  course: Course | null;               // null until created from the four questions (or "Use the sample")
  people: Person[]; viewer: Person;    // viewer follows the mode: the guide in "edit"/"guide", a participant otherwise
  mode: Mode; setMode(m: Mode): void;
  selected: string;                    // "overview" or a module id
  select(id: string): void;
  createCourse(a: { title: string; line: string; when: string; where: Course["where"]; sessions: number }): void;
  useSample(): void; reset(): void;
  updateCourse(patch: Partial<Course>): void;
  addModule(): void; updateModule(id: string, patch: Partial<Module>): void; removeModule(id: string): void;
  addStep(moduleId: string, kind: StepKind): string;
  updateStep(moduleId: string, stepId: string, patch: Partial<Step>): void;
  removeStep(moduleId: string, stepId: string): void;
  moveStep(moduleId: string, stepId: string, dir: -1 | 1): void;
  done: Record<string, string[]>;      // personId -> step ids completed
  completeStep(stepId: string): void;  // for the viewer
  entries: Entry[];
  addEntry(e: Omit<Entry, "id" | "at" | "comments" | "personId">): void;   // by the viewer
  addComment(entryId: string, text: string): void;                          // by the viewer
  sheet: "steps" | "journal" | null; setSheet(s: WorkspaceApi["sheet"]): void;
  frame: "journal" | null; setFrame(f: WorkspaceApi["frame"]): void;
  theater: boolean; setTheater(on: boolean): void;
}
export function WorkspaceProvider(props: { children: React.ReactNode }): JSX.Element;
export function useWorkspace(): WorkspaceApi;
```

- State persists in `localStorage` under `dev-workspace:v1`. Reads and writes are wrapped in try/catch, and the page still renders without it.
- `Shell.tsx` (W1) renders: draft bar, mode switch, module list, pane, and on the right `<StepsSheet />` when `sheet === "steps"`, `<JournalSheet />` when `sheet === "journal"`, plus `<JournalFrame />` when `frame === "journal"`. W1 imports those three by the paths above. Until W2 and W3 land them, W1 creates one-line placeholder components AT THOSE PATHS that W2 and W3 then overwrite (tell them on the board when the placeholders exist).
- Class prefix `ws-`. Every lane uses the CSS variables W1 defines on `.ws-root`: `--ws-ground`, `--ws-panel`, `--ws-line`, `--ws-ink`, `--ws-muted`, `--ws-accent`. Inside a module's pane, `--ws-module` is that module's colour.
- The surface frame: use the real shared surface if it mounts cleanly (`@elkdonis/cms-ui` surface: `SurfaceShell` with head / rail / body / foot; see `packages/cms-ui/src/surface/`). Otherwise a local look-alike with the same anatomy. Say which was used.
- Sample content is invented only: "Lantern Row Arts", the workshop "Clay and Breath", six evenings, guide "Ilan Marlowe". Reuse `src/sample/` (the Lantern Row world) where it fits. No photos of people; labelled placeholders.

## Rules for all three
- First read the shared board `~/eac/docs/open/LIAISON/HOUSE_EDITOR_PM.md` and post there before starting (`### [PM worker: Workspace W1|W2|W3] 2026-11-22 HH:MM taking files …`) and when done.
- Edit only your own files (plus W1's two one-line edits). The Manjushri team has files in `apps/development` (`src/ideas/manjushri*`, `src/app/sites/**`, `src/app/pages/**`, `src/lib/sites*.ts`, `src/components/sites/**`, `src/data/manjushri/*`): do not touch them.
- No rebuild or restart of the live container, no DB access, no commit, no pnpm install. No server actions.
- Verify with `cd ~/eac && sudo -n docker compose run --rm --no-deps -w /app/apps/development admin npx tsc --noEmit --incremental false -p .` → 0 errors from your files (other lanes may be mid-edit; report only yours).
- The PM does the build and the rebuild.

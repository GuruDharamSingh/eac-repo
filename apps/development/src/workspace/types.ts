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
  due?: string;                                    // ISO date-time deadline (show the time too)
  timeLimit?: number;                              // minutes, for a timed step
}
export interface Material { id: string; name: string; access: "open" | "participants"; }
export type Pacing = "open" | "in-order" | "by-date";
export interface IntervalPlan { key: string; note?: string; materials: Material[]; }   // key = ISO date of the interval's start
export interface Ongoing {
  stepId: string;                      // the one repeating step
  every: "day" | "week";
  start: string;                       // ISO date
  closes: boolean;                     // entries close when the interval ends
  show: 5 | 7;                         // intervals in the strip
  plans: IntervalPlan[];
}
export interface Module {
  id: string; title: string; date?: string; length?: string; description?: string;
  coverLabel?: string; hasVideo?: boolean;
  colour: string;                      // hex
  titleFont?: string;                  // legacy: kept optional so stored state loads; not rendered
  fill: { row: boolean; pane: boolean; title: boolean; buttons: boolean };
  materials: Material[]; steps: Step[];
  kind?: "standard" | "ongoing"; ongoing?: Ongoing;
}
export interface Person {
  id: string; name: string; initials: string; role: "guide" | "participant";
  pictureLabel?: string; bio?: string; online?: boolean; shareJournal?: boolean;
}
export type JournalVisibility = "private" | "shared";   // old stored "concurrent" / "public" load as "shared"
export interface Message { id: string; by: string; at: string; text: string; }
export interface Comment { id: string; by: string; at: string; text: string; }
export interface Entry {               // one journal entry, made by doing a step or adding a note
  id: string; personId: string; moduleId: string; stepId?: string;
  kind: "reflection" | "practice" | "photo" | "recording" | "note" | "quiz";
  at: string;                          // ISO
  text?: string; minutes?: number; mediaLabel?: string; timestamp?: string; // "06:30" for a video note
  intervalKey?: string;                // ongoing session: the interval it answers
  late?: boolean;                      // handed in after the deadline
  comments: Comment[];
}
export interface Course {
  id: string; title: string; line: string; price: string;       // "Free" or "CA$ 180"
  when: string; where: "In person" | "Online" | "Both";
  bannerLabel?: string; about: string; guideId: string;
  modules: Module[];
  journals: JournalVisibility; journalComments: "guide" | "everyone";
  status: "draft" | "published";
  pacing: Pacing; endDate?: string | null; join: "open" | "invite"; callLink?: string;
  emails: { to: "everyone" | "guide" | "nobody"; when: "each" | "digest"; remind: boolean };
}

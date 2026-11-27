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
  // Read-only server data (Sophia): the published step as stored.
  bodyHtml?: string;                               // the step's body, as authored (HTML)
  summary?: string;
  media?: { kind: "audio" | "video" | "image" | "file"; url: string; title?: string }[];
  links?: { url: string; title: string }[];
  minutes?: number;                                // rough time to give it
  openHref?: string;                               // the step's own page on the host
  completion?: "manual" | "response" | "derived";  // how the engine completes it
  doneLabel?: string;
}
export interface Material { id: string; name: string; access: "open" | "participants"; url?: string; }
export type Pacing = "open" | "in-order" | "by-date";
export interface IntervalPlan { key: string; note?: string; materials: Material[]; }   // key = ISO date of the interval's start
export interface Ongoing {
  stepId: string;                      // the one repeating step
  every: "day" | "week";
  everyDays?: number;                  // server mode: 1 = daily, 7 = weekly, N = every N days (every is then "day" unless 7)
  end?: string | null;                 // ISO date, last day
  entered?: Record<string, number>;    // server mode: how many others entered each interval (counts only)
  start: string;                       // ISO date
  closes: boolean;                     // entries close when the interval ends
  readFirst?: boolean;                 // participants may read the interval's entries before entering their own (default false)
  show: 5 | 7;                         // intervals in the strip
  plans: IntervalPlan[];
}
export interface Module {
  id: string; title: string; date?: string; length?: string; description?: string;
  coverLabel?: string; coverUrl?: string; hasVideo?: boolean;
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
  /** Set when the writer changes an interval entry in place. */
  editedAt?: string;
  id: string; personId: string; moduleId: string; stepId?: string;
  kind: "reflection" | "practice" | "photo" | "recording" | "note" | "quiz";
  at: string;                          // ISO
  text?: string; minutes?: number; mediaLabel?: string; timestamp?: string; // "06:30" for a video note
  intervalKey?: string;                // ongoing session: the interval it answers
  late?: boolean;                      // handed in after the deadline
  visibility?: EntryVisibility;        // who may read it (server mode)
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
  // Read-only server data (Sophia).
  aboutHtml?: string; bannerUrl?: string; peopleCount?: number; orgName?: string;
}

/** What a seated participant may do, and what they have done (slice 3a). All plain data. */
export type EntryVisibility = "me" | "guide" | "circle";
export interface DoingData {
  /** Per step id: may it be opened now, and why not (the engine's unlock rules). */
  access: Record<string, { allowed: boolean; reason: string | null }>;
  /** Step ids completed. */
  done: string[];
  /** The viewer's own reflections and practice logs, as stored. */
  responses: { id: string; stepId: string; kind: "reflection" | "practice_log"; body: string; visibility: EntryVisibility | "public"; createdAt: string; updatedAt: string }[];
  visChoices: EntryVisibility[];
  defaultVisibility: EntryVisibility;
}

/** The shared journal as the server sends it (slice 5): only what this viewer may read. Dates are ISO text. */
export interface JournalWire {
  entries: {
    id: string; stepId: string; kind: "reflection" | "practice_log"; body: string; visibility: EntryVisibility | "public";
    createdAt: string; updatedAt: string; mine: boolean; authorKey: string; authorName: string; authorIsGuide: boolean;
    comments: { id: string; by: string; byName: string; byGuide: boolean; body: string; createdAt: string; kind: "answer" | "comment" }[];
  }[];
  commentsMode: "everyone" | "guide";
  isGuide: boolean;
}
/** What the journal screens need to know about the server journal. */
export interface JournalInfo { commentsMode: "everyone" | "guide"; isGuide: boolean; loading: boolean; error: string | null; loaded: boolean; mayComment: boolean }

/** One ongoing session as the server sends it for one reader (slice 4a). Dates are ISO text. */
export interface OngoingWire {
  moduleId: string;
  tz: string;
  today: { state: "before"; opensOn: string } | { state: "running"; key: string } | { state: "ended" };
  closesAt: string | null;
  plans: Record<string, { note: string | null; items: { id: string; name: string; url?: string; access: "open" | "participants" }[] }>;
  entries: {
    id: string; intervalKey: string; kind: "reflection" | "practice_log"; body: string; visibility: EntryVisibility | "public";
    createdAt: string; updatedAt: string; mine: boolean; authorKey: string; authorName: string; authorIsGuide: boolean;
    comments: { id: string; by: string; byName: string; byGuide: boolean; body: string; createdAt: string; kind: "answer" | "comment" }[];
  }[];
  entered: Record<string, number>;
  commentsMode: "everyone" | "guide";
  isGuide: boolean;
}

// ── guide editing and settings (slice 6 + 4b) ───────────────────────────────
export interface PublishOutcome { changeKind: "fix" | "structural"; versionNo: number; partway: number; adopted: boolean }
export interface SaveState { saving: boolean; error: string | null; unpublished: boolean; hasPublished: boolean; publish: PublishOutcome | null; published: boolean }
/** The draft a guide edits, as the server maps it. */
export interface EditorData { course: Course; people: Person[]; unpublished: boolean; hasPublished: boolean; canSave: boolean }
export interface InviteWire { id: string; label: string | null; createdAt: string; expiresAt: string | null; maxUses: number | null; uses: number; revoked: boolean }
/** What the server-backed provider offers beyond the local one: saving state, publishing, and people tools. Null in the local prototype. */
export interface ServerTools {
  canEdit: boolean;
  /** May open the Settings menu (a guide, or a network admin looking read only). */
  canViewSettings: boolean;
  /** The experiment preset (consent, requests, results); null for an ordinary workspace. */
  experiment: ExperimentTools | null;
  save: SaveState;
  publish(): Promise<string | null>;
  /** Move the group onto the newest published version (after a structural change). */
  adopt(): Promise<string | null>;
  searchMembers(q: string): Promise<{ id: string; name: string }[]>;
  addMember(userId: string): Promise<string | null>;
  listInvites(): Promise<InviteWire[] | null>;
  createInvite(opts: { label?: string; maxUses?: number | null; days?: number | null }): Promise<{ link?: string; error?: string }>;
  revokeInvite(id: string): Promise<string | null>;
}

// ── the experiment preset (288 / 289) ───────────────────────────────────────
export interface ExperimentWire {
  consent: { text: { version: number; body: string; createdAt: string } | null; mine: { version: number; givenAt: string; withdrawnAt: string | null } | null; needs: boolean };
  requests: { itemId: string; resultTitle: string; body: string; state: "requested" | "agreed" | "declined" | "withdrawn"; credit: "named" | "anonymous" | null; at: string }[];
  published: { id: string; title: string; threadId: string; href: string | null; publishedAt: string }[];
  isGuide: boolean;
}
export interface ResultWire {
  id: string; title: string; intro: string; conclusion: string; status: "draft" | "published" | "taken_down"; audience: "everyone" | "members";
  threadId: string | null; publishedAt: string | null;
  items: { id: string; responseId: string; state: "requested" | "agreed" | "declined" | "withdrawn"; credit: "named" | "anonymous" | null; body: string | null; writer: string; at: string }[];
}
export interface CandidateWire { responseId: string; writer: string; at: string; body: string; intervalKey: string | null; itemState: "requested" | "agreed" | "declined" | "withdrawn" | null }
export interface ExperimentTools {
  state: ExperimentWire | null;
  refresh(): Promise<void>;
  agree(): Promise<string | null>;
  withdraw(): Promise<{ error?: string; notes?: string[] }>;
  decide(itemId: string, agree: boolean, credit?: "named" | "anonymous"): Promise<string | null>;
  saveConsent(text: string): Promise<{ error?: string; version?: number }>;
  loadResults(resultId?: string): Promise<{ results: ResultWire[]; candidates: CandidateWire[] } | null>;
  saveResult(r: { id?: string; title: string; intro: string; conclusion: string; audience: "everyone" | "members" }): Promise<{ id?: string; error?: string }>;
  request(id: string, responseIds: string[]): Promise<{ requested?: number; error?: string }>;
  publish(id: string): Promise<{ error?: string; included?: number; audience?: string }>;
  takedown(id: string): Promise<string | null>;
}

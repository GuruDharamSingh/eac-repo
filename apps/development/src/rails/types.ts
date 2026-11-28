// Shapes for the Rails and Map screens. No server imports: client components use these too.
// The readiness shape is the contract in docs/open/RAILS_DESK_2026-11-27/PLAN.md.

export type LevelNo = 0 | 1 | 2 | 3 | 4;

export interface Cap {
  id: string;
  label: string;
  does: string;
  area: string;
  family?: string;
  scope: string;
  actors: string[];
  risk: string[];
  level: LevelNo;
  why: string;
  next: string;
  entry: string | null;
  dockForm: string | null;
  status: string | null;
  confirm: { status: string; text: string } | null;
  address: { app: string; path: string; how?: string } | null;
  hosts: Array<{ key: string; file: string; line?: number }>;
  tracks: string[];
  courses: string[];
  open?: string;
  /** Where it is meant to be done (atlas `where`, lane F 2026-11-27): in the dock, or on its own page. */
  where?: { mode: "dock" | "place"; why: string; deep?: string };
}

export interface ReadinessTrack {
  id: string;
  label: string;
  area: string;
  steps: Array<{ cap?: string; gap?: string; level: number }>;
  leads_to: string[];
  gates: string[];
}

export interface ReadinessCourse {
  id: string;
  label: string;
  area: string;
  tracks: string[];
  builds_on: string[];
  levels: Record<string, number>;
}

export interface Readiness {
  generated: string;
  /** True only in the hand-made sample used before the real file exists. */
  sample?: boolean;
  counts: Record<string, number>;
  capabilities: Cap[];
  tracks: ReadinessTrack[];
  courses: ReadinessCourse[];
}

/** The ladder, with the words shown on screen. */
export const LEVELS: Array<{ n: LevelNo; name: string; means: string; dock: string; color: string }> = [
  { n: 0, name: "Not built", means: "Nothing exists for this yet.", dock: 'Shown as "coming later".', color: "#5b6272" },
  { n: 1, name: "Place", means: "We know where it is done, but it is not in the dock yet.", dock: 'Offers "Take me there" (a deep link); the person ticks "I did it". Marked "to the dock" when a form is planned.', color: "#f0b35a" },
  { n: 2, name: "Checked", means: "Also, the platform can see when it is done.", dock: 'Offers "Take me there" and ticks itself.', color: "#4fc3a1" },
  { n: 3, name: "In the dock", means: "Also, a form opens inside the dock with a confirm card.", dock: "The form opens in the dock.", color: "#7aa2ff" },
  { n: 4, name: "Assistant", means: "Also, the assistant may read it or propose it.", dock: "The assistant can read it or draft it.", color: "#c08cff" },
];

export function levelOf(n: number) {
  return LEVELS[Math.max(0, Math.min(4, Math.round(n)))] ?? LEVELS[0];
}

export type Weight = "essential" | "optional" | "later";
export const WEIGHTS: Array<{ id: Weight; name: string }> = [
  { id: "essential", name: "Essential" },
  { id: "optional", name: "Optional" },
  { id: "later", name: "Later" },
];

/** One step of an edited trail: a capability id, or a gap (a thing to do that has no capability yet). */
export interface RailStep {
  cap?: string;
  gap?: string;
  weight: Weight;
  note: string;
}
/** What is stored in dev_versions.doc for subject `rail:<course id>`. */
export interface RailDoc {
  steps: RailStep[];
  note: string;
}

export const railSubject = (course: string) => `rail:${course}`;

/** The anchor lane C's notes attach to. Capabilities by id, gaps by their position. */
export const stepAnchor = (course: string, step: { cap?: string }, index: number) => `rail:${course}/${step.cap ?? `gap-${index + 1}`}`;

/** A slim capability for pickers and rows (the full one is only sent where needed). */
export interface SlimCap {
  id: string;
  label: string;
  level: LevelNo;
  area: string;
  does: string;
  why: string;
  /** Where it is meant to be done (atlas `where`, lane F 2026-11-27): in the dock, or on its own page. */
  where?: { mode: "dock" | "place"; why: string; deep?: string };
}

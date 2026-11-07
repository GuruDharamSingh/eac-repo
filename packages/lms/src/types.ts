// ============================================================================
// Sophia — shared types. Three layers: content → delivery → record.
// ============================================================================

/**
 * Who is asking. Structurally the same as services' ForumViewer, so a host
 * builds one viewer and hands it to both the forum and Sophia.
 */
export interface LmsViewer {
  userId: string | null;
  /** org_id → role (stewardship already applied by getViewerRoles). */
  roles: Record<string, string>;
  isGlobalAdmin?: boolean;
}
export const LMS_ANONYMOUS: LmsViewer = { userId: null, roles: {} };

export type WriteResult<T = object> = ({ ok: true } & T) | { ok: false; error: string };

export type CourseVisibility = 'public' | 'unlisted' | 'private';
export type RunMode = 'open' | 'drip' | 'cohort' | 'circle';
export type ResponseVisibility = 'me' | 'guide' | 'circle' | 'public';
export type ResponseKind = 'reflection' | 'practice_log' | 'note';
export type StepStatus = 'started' | 'completed' | 'waived';

// ── unlock rules ────────────────────────────────────────────────────────────
// A short typed list. There is no expression language and there never will be.
export type UnlockRule =
  /** The previous REQUIRED step in course order is done. The default. */
  | { kind: 'sequential' }
  /** Always open. */
  | { kind: 'open' }
  /** Every required step of another module is done. */
  | { kind: 'after_module'; moduleId: string }
  /** A calendar date. */
  | { kind: 'date'; at: string }
  /** N days after the enrolment's anchor (run start for a cohort, else enrolment). */
  | { kind: 'offset_days'; days: number };

export interface OutlineStepRef {
  stepId: string;
  /** Present in a published outline, absent in a draft one. */
  stepVersionId?: string;
  /** Counts toward completing the course. Default true. */
  required?: boolean;
  unlock?: UnlockRule;
}
export interface OutlineModule {
  id: string;
  title: string;
  summary?: string | null;
  steps: OutlineStepRef[];
}
export interface Outline {
  modules: OutlineModule[];
}

// ── content ─────────────────────────────────────────────────────────────────
export interface StepMedia {
  kind: 'audio' | 'video' | 'image' | 'file';
  url: string;
  title?: string;
  /** Shown on the page: accessibility, and the text search engines read. */
  transcript?: string;
  durationSeconds?: number;
}
export interface StepLink { url: string; title: string; description?: string; imageUrl?: string; siteName?: string }
export interface StepRefs {
  /** A thread this step points at: a standing meeting, an event, a forum topic. */
  threadId?: string;
  questionnaireId?: string;
  media?: StepMedia[];
  /** Links on the open web, shown as cards under the step. Captured title/description travel with them. */
  links?: StepLink[];
}
/**
 * A `task` step: what the learner is asked to set up on the network. The id
 * is the host's vocabulary (`profile`, `store`, `org`, …); the LMS only
 * carries it. `org` tasks act on the organisation the learner owns.
 */
export interface StepTask {
  id: string;
  scope?: 'person' | 'org';
  /**
   * Choices the author made for this task (e.g. `{ kind: 'event' }` for
   * "publish on your org's site"). Strings only; the host's catalogue says
   * which names and values an id accepts (2026-11-06).
   */
  params?: Record<string, string>;
  /**
   * A routine step (2026-11-07, docs/open/DAILY_ROUTINE_BRIEF_2026-11-06.md):
   * the same task again each period, so it is never recorded as completed;
   * the host's status answers for the current period (today) each time.
   */
  repeat?: 'daily';
}
/** What the host reports about a task for one viewer. */
export interface TaskStatus {
  done: boolean;
  /** Begun but not finished (a store applied for, a Stripe account not yet verified). */
  partial?: boolean;
  /** One line for the learner: what is there now, or what is missing. */
  detail?: string | null;
  /** Where the finished thing lives, once it exists. */
  href?: string | null;
  /** Current values, for a task the host offers as a form in the step (2026-11-06). */
  values?: Record<string, string>;
}

export interface StepSettings {
  /** Rough time to give it, in minutes. */
  minutes?: number;
  /** For `task` steps only. */
  task?: StepTask;
  /** The thing to do. Practice/reflection steps show it as its own block. */
  practice?: string;
  /** A gentler or different way in, always offered for a hard practice. */
  alternative?: string;
  /** The question a reflection asks. */
  prompt?: string;
  [key: string]: unknown;
}
export interface StepContent {
  title: string;
  summary: string | null;
  bodyHtml: string | null;
  settings: StepSettings;
  refs: StepRefs;
}

export interface Course {
  id: string;
  orgId: string;
  orgName: string;
  orgSlug: string;
  slug: string;
  title: string;
  summary: string | null;
  descriptionHtml: string | null;
  coverUrl: string | null;
  language: string;
  visibility: CourseVisibility;
  publishedVersionId: string | null;
  updatedAt: Date;
}

export interface PublishedStep extends StepContent {
  stepId: string;
  stepVersionId: string;
  slug: string;
  type: string;
  moduleId: string;
  moduleTitle: string;
  /** 0-based position across the whole course. */
  index: number;
  required: boolean;
  unlock: UnlockRule;
}
export interface PublishedModule {
  id: string;
  title: string;
  summary: string | null;
  steps: PublishedStep[];
}
export interface PublishedCourse {
  course: Course;
  versionId: string;
  versionNo: number;
  publishedAt: Date;
  modules: PublishedModule[];
  /** Flat, in order. */
  steps: PublishedStep[];
}

// ── delivery ────────────────────────────────────────────────────────────────
export interface Run {
  id: string;
  courseId: string;
  orgId: string;
  slug: string;
  title: string;
  mode: RunMode;
  courseVersionId: string;
  autoFastForward: boolean;
  isDefault: boolean;
  status: 'draft' | 'open' | 'closed' | 'archived';
  startsAt: Date | null;
  endsAt: Date | null;
  capacity: number | null;
  enrolPolicy: 'open' | 'invite';
  defaultVisibility: 'me' | 'guide' | 'circle';
  workshopThreadId: string | null;
  discussionFeed: string | null;
}
export interface Enrolment {
  id: string;
  runId: string;
  courseId: string;
  userId: string;
  orgId: string;
  status: 'active' | 'paused' | 'completed' | 'withdrawn';
  anchorAt: Date;
  lastStepId: string | null;
  enrolledAt: Date;
  completedAt: Date | null;
}

// ── record ──────────────────────────────────────────────────────────────────
export interface Access {
  allowed: boolean;
  /** Plain words for the learner. Null when allowed. */
  reason: string | null;
  unlocksAt: Date | null;
}
export interface OutlineStepView extends PublishedStep {
  status: StepStatus | null;
  access: Access;
}
export interface LearnerOutline {
  run: Run;
  enrolment: Enrolment | null;
  modules: Array<Omit<PublishedModule, 'steps'> & { steps: OutlineStepView[] }>;
  steps: OutlineStepView[];
  /** Where "Continue" goes: the first open step not yet done. Null when finished. */
  continueStep: OutlineStepView | null;
  doneRequired: number;
  totalRequired: number;
}
export interface LmsResponse {
  id: string;
  stepId: string;
  kind: ResponseKind;
  body: string;
  visibility: ResponseVisibility;
  createdAt: Date;
  updatedAt: Date;
  author: { id: string; name: string; avatarUrl: string | null } | null;
  acknowledgements: Array<{ id: string; body: string | null; audioUrl: string | null; guideName: string; createdAt: Date }>;
}

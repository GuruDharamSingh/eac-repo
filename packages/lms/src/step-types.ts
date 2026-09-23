// ============================================================================
// Step types — plugins at the leaves. Structure (courses, modules, order,
// unlock) is core; what a step IS lives here and in the matching renderer in
// @elkdonis/lms-ui. `lms_steps.type` is open text: a type this registry has
// never heard of still loads, exports and renders as a placeholder.
// ============================================================================

export type CompletionMode =
  /** The learner says so ("I've read this", "I did the practice"). */
  | 'manual'
  /** Saving a response completes it. */
  | 'response';

export interface StepTypeDef {
  type: string;
  label: string;
  /** One line for the author choosing a type. */
  describe: string;
  completion: CompletionMode;
  /** Words on the completing button. */
  doneLabel: string;
  /** Shows the reflection box (even when completion is manual). */
  invitesReflection: boolean;
  /** Needs refs.threadId to mean anything. */
  needsThread: boolean;
}

const DEFS: StepTypeDef[] = [
  { type: 'reading', label: 'Reading', describe: 'Something to read, watch or listen to.', completion: 'manual', doneLabel: "I've taken this in", invitesReflection: false, needsThread: false },
  { type: 'practice', label: 'Practice', describe: 'Something to do, make or notice. Every module should have one.', completion: 'manual', doneLabel: 'I did the practice', invitesReflection: true, needsThread: false },
  { type: 'reflection', label: 'Reflection', describe: 'One question, answered for yourself first. Never graded.', completion: 'response', doneLabel: 'Keep this reflection', invitesReflection: true, needsThread: false },
  { type: 'session', label: 'Gathering', describe: 'A live meeting, event or workshop that already exists on the network.', completion: 'manual', doneLabel: 'I was there', invitesReflection: true, needsThread: true },
  { type: 'thread', label: 'Conversation', describe: 'A forum thread to read and take part in.', completion: 'manual', doneLabel: "I've joined the conversation", invitesReflection: false, needsThread: true },
  { type: 'resource', label: 'Resource', describe: 'A file, a link, a reference. Usually optional.', completion: 'manual', doneLabel: 'Seen', invitesReflection: false, needsThread: false },
];

const REGISTRY = new Map(DEFS.map((d) => [d.type, d]));

/** Add or replace a type. For a future @elkdonis/lms-steps or an org's own. */
export function registerStepType(def: StepTypeDef): void {
  REGISTRY.set(def.type, def);
}
export function listStepTypes(): StepTypeDef[] {
  return [...REGISTRY.values()];
}
/** Never throws: an unknown type is a manual step with a plain label. */
export function stepTypeDef(type: string): StepTypeDef {
  return (
    REGISTRY.get(type) ?? {
      type,
      label: type.replace(/[_-]+/g, ' ').replace(/^\w/, (c) => c.toUpperCase()),
      describe: 'A step type this installation does not know.',
      completion: 'manual',
      doneLabel: 'Done',
      invitesReflection: false,
      needsThread: false,
    }
  );
}

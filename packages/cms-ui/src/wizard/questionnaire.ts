import type { WizardFieldSpec, WizardFieldInput } from "./fields";

// ============================================================================
// Questionnaires, wizards and polls are one thing.
//
// `questionnaires.fields` is a JSONB array of field descriptors, authored by
// an org and stored as data. The manifest-driven wizard renders
// `WizardFieldSpec[]`. Those were two vocabularies for the same concept, each
// with its own renderer — this maps the stored shape onto the rendered one so
// there is a single set of controls behind all three surfaces.
//
// A poll is not a fourth thing either: it is a questionnaire whose fields are
// a single `choice` (or `multichoice`) question and whose results are visible
// to the people who answered. The database already carries `closes_at`,
// `status` and `results_visibility`, which is everything a poll needs beyond
// the ballot itself.
//
// Deliberately structural: this package does not import @elkdonis/services, so
// the input type is declared by shape. Services owns the lifecycle
// (draft → submitted → reviewed), this owns the rendering.
// ============================================================================

/** The stored field shape — `QuestionnaireField` in @elkdonis/services. */
export interface StoredQuestionnaireField {
  key: string;
  type: "text" | "longtext" | "choice" | "multichoice" | "image" | "number" | "boolean";
  label: string;
  help?: string;
  required?: boolean;
  /** choice / multichoice only. Stored as bare strings. */
  options?: string[];
}

/**
 * How each stored type is rendered.
 *
 * `choice` becomes radios rather than a dropdown: a questionnaire's choices are
 * usually few and worth seeing at once, and it makes a one-question
 * questionnaire read as the ballot it is.
 */
const INPUT_BY_TYPE: Record<StoredQuestionnaireField["type"], WizardFieldInput> = {
  text: "text",
  longtext: "textarea",
  choice: "radio",
  multichoice: "multichoice",
  number: "number",
  boolean: "boolean",
  // Media is NEVER a URL box. A pasted URL is how you get a dead link, an
  // image hosted somewhere the org does not control, and nothing in the
  // library to reuse — so an image field is always a picker over the org's or
  // the person's own storage. cms-ui carries no upload dependency, so the host
  // app supplies the picker through `customRenderers`; with none supplied the
  // control says so rather than degrading to a text input.
  image: "custom",
};

export interface QuestionnaireFieldMapOptions {
  /**
   * Per-field-key render overrides, for anything richer than a primitive —
   * an image picker, a date-range grid. Matches `WizardFieldSpec.render`.
   */
  customRenderers?: Record<string, NonNullable<WizardFieldSpec["render"]>>;
}

/** Map one stored questionnaire field onto a renderable spec. */
export function questionnaireFieldToSpec(
  field: StoredQuestionnaireField,
  options: QuestionnaireFieldMapOptions = {}
): WizardFieldSpec {
  const render = options.customRenderers?.[field.key];

  return {
    name: field.key,
    label: field.label,
    input: render ? "custom" : (INPUT_BY_TYPE[field.type] ?? "text"),
    hint: field.help,
    required: field.required,
    // Stored options are bare strings; the value IS the label, so an answer
    // stays readable in the JSONB blob without a lookup back to the field list.
    options: field.options?.map((o) => ({ value: o, label: o })),
    render,
  };
}

export function questionnaireFieldsToSpecs(
  fields: StoredQuestionnaireField[],
  options: QuestionnaireFieldMapOptions = {}
): WizardFieldSpec[] {
  return fields.map((f) => questionnaireFieldToSpec(f, options));
}

/**
 * True when this field list is a poll: exactly one question, and it is a
 * choice. Used to decide whether to render a ballot with a result bar rather
 * than a form with a submit button.
 */
export function isPollShape(fields: StoredQuestionnaireField[]): boolean {
  return (
    fields.length === 1 &&
    (fields[0]!.type === "choice" || fields[0]!.type === "multichoice")
  );
}

export interface PollTally {
  option: string;
  count: number;
  /** 0-100, rounded. 0 when nobody has answered. */
  percent: number;
}

/**
 * Count answers for a poll-shaped questionnaire.
 *
 * Takes the raw `questionnaire_responses.answers` blobs so callers do not each
 * re-derive this. Options come from the field rather than from the answers, so
 * an option nobody picked still appears with a zero — otherwise a poll's
 * results silently change shape as votes arrive.
 */
export function tallyPoll(
  field: StoredQuestionnaireField,
  answers: Array<Record<string, unknown>>
): PollTally[] {
  const counts = new Map<string, number>();
  for (const option of field.options ?? []) counts.set(option, 0);

  let total = 0;
  for (const answer of answers) {
    const value = answer[field.key];
    // multichoice stores an array; choice a bare string. Both count once per
    // selected option, so a multichoice poll's percentages are of *votes*, not
    // of respondents — the bars would otherwise never sum to anything.
    const picked = Array.isArray(value) ? value.map(String) : value == null ? [] : [String(value)];
    for (const p of picked) {
      if (!counts.has(p)) continue;
      counts.set(p, counts.get(p)! + 1);
      total += 1;
    }
  }

  return [...counts.entries()].map(([option, count]) => ({
    option,
    count,
    percent: total === 0 ? 0 : Math.round((count / total) * 100),
  }));
}

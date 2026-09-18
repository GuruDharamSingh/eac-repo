"use client";

import * as React from "react";
import {
  QuestionBuilder,
  validateQuestionFields,
  cleanQuestionFields,
} from "./QuestionBuilder";
import type { StoredQuestionnaireField } from "../wizard";
import { SurfaceFrame, useSurface } from "../surface";

/**
 * Asking the group something — the form, and the surface around it.
 *
 * Shared rather than per app, because the only genuinely app-specific part is
 * the SAVE and its permission gate: `createOrgQuestionnaire` in
 * @elkdonis/services already does the writing, the question builder is already
 * here, and a second copy of the form would be a second place for the
 * validation and the privacy wording to drift.
 *
 * Two things are deliberately NOT assumed:
 *
 *   onSave      — the host's server action. A questionnaire writes its own
 *                 table through its own gate (IFAC's, for instance, has to
 *                 check an owner allowlist because that org has no owner
 *                 rows), and this component must not pretend to know it.
 *   privacyNote — who will see the answers. That is a promise about a
 *                 particular org's hub, and stating the wrong one is worse
 *                 than stating none.
 *
 * No toast library and no component library: cms-ui depends on neither, and
 * hosts disagree about both. The controls are plain elements wearing the
 * shared field classes from fields.css, which every host that renders a
 * composer already imports. Problems are said in place, beside the button that
 * caused them.
 */

export type QuestionnaireComposerKind = "questionnaire" | "poll";

export type SaveQuestionnaireResult =
  | { ok: true; key: string }
  | { ok: false; error: string };

export interface QuestionnaireComposerProps {
  kind: QuestionnaireComposerKind;
  onSave: (input: {
    title: string;
    description?: string;
    fields: ReturnType<typeof cleanQuestionFields>;
    kind: QuestionnaireComposerKind;
    closesAt?: string | null;
  }) => Promise<SaveQuestionnaireResult>;
  onDone: () => void;
  /** What the composer is told about who reads the answers. */
  privacyNote?: Partial<Record<QuestionnaireComposerKind, string>>;
}

const DEFAULT_PRIVACY: Record<QuestionnaireComposerKind, string> = {
  poll: "Everyone who answers sees the running result. It is never public.",
  questionnaire: "Answers are visible to this organisation's administrators only.",
};

export function QuestionnaireBody({
  kind,
  onSave,
  onDone,
  privacyNote,
}: QuestionnaireComposerProps) {
  const isPoll = kind === "poll";
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [closesAt, setClosesAt] = React.useState("");
  const [fields, setFields] = React.useState<StoredQuestionnaireField[]>([]);
  const [submitting, setSubmitting] = React.useState(false);
  const [problem, setProblem] = React.useState<string | null>(null);

  async function submit() {
    setProblem(null);
    if (!title.trim()) {
      setProblem("Give it a title.");
      return;
    }
    const invalid = validateQuestionFields(fields);
    if (invalid) {
      setProblem(invalid);
      return;
    }

    setSubmitting(true);
    try {
      const result = await onSave({
        title: title.trim(),
        description: description.trim() || undefined,
        fields: cleanQuestionFields(fields),
        kind,
        closesAt: closesAt ? new Date(closesAt).toISOString() : null,
      });
      // `in` rather than narrowing on `ok`: the union crosses a host-supplied
      // function boundary and TypeScript does not always discriminate it there.
      if (!result.ok) {
        setProblem(("error" in result && result.error) || "Could not create it.");
        return;
      }
      onDone();
    } catch {
      setProblem("Could not reach the server.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="eac-compose">
      <div className="eac-field">
        <label className="eac-field-label" htmlFor="q-title">
          {isPoll ? "What is this poll about?" : "Title"}
        </label>
        <input
          id="q-title"
          className="eac-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>

      <div className="eac-field">
        <label className="eac-field-label" htmlFor="q-desc">
          Description
        </label>
        <textarea
          id="q-desc"
          className="eac-input"
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional — context for the people answering."
        />
      </div>

      <div className="eac-field">
        <span className="eac-field-label">{isPoll ? "The question" : "Questions"}</span>
        {/* `single` is what makes a poll a poll: one question with a result
            bar, rather than a questionnaire that happens to be short. */}
        <QuestionBuilder value={fields} onChange={setFields} single={isPoll} />
      </div>

      <div className="eac-field">
        <label className="eac-field-label" htmlFor="q-closes">
          Closes
        </label>
        <input
          id="q-closes"
          className="eac-input"
          type="datetime-local"
          value={closesAt}
          onChange={(e) => setClosesAt(e.target.value)}
        />
      </div>

      <p className="eac-compose-note">
        {privacyNote?.[kind] ?? DEFAULT_PRIVACY[kind]}
      </p>

      {problem && (
        <p className="eac-compose-problem" role="alert">
          {problem}
        </p>
      )}

      <div className="eac-compose-actions">
        <button
          type="button"
          className="eac-btn eac-btn--primary"
          onClick={submit}
          disabled={submitting}
          aria-busy={submitting}
        >
          {submitting ? "Opening…" : isPoll ? "Open poll" : "Open questionnaire"}
        </button>
      </div>
    </div>
  );
}

/**
 * The same form, as a surface layer.
 *
 * Registered on the connectors as `compose:questionnaire` / `compose:poll`.
 * On success it pops its own layer, returning the person to the catalogue
 * they chose from rather than closing the dialog out from under them.
 */
export function QuestionnaireComposeSurface({
  kind,
  onSave,
  privacyNote,
}: Omit<QuestionnaireComposerProps, "onDone">) {
  const surfaces = useSurface();
  const isPoll = kind === "poll";

  return (
    <SurfaceFrame
      kind={kind}
      title={isPoll ? "Open a poll" : "Ask the group"}
      kicker="Compose"
    >
      <QuestionnaireBody
        kind={kind}
        onSave={onSave}
        privacyNote={privacyNote}
        onDone={() => surfaces.pop()}
      />
    </SurfaceFrame>
  );
}

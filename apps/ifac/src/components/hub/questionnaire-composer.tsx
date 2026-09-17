"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  QuestionBuilder,
  validateQuestionFields,
  cleanQuestionFields,
} from "@elkdonis/cms-ui/compose";
import type { StoredQuestionnaireField } from "@elkdonis/cms-ui/wizard";
import { SurfaceFrame, useSurface } from "@elkdonis/cms-ui/surface";
import { Button, Input, Label, Textarea } from "@elkdonis/primitives";
import { createQuestionnaireAction } from "@/lib/cms/questionnaire-actions";

// ============================================================================
// Asking the membership something — the form, and the surface around it.
//
// Lifted out of compose-workspace.tsx so that the compose POPUP and the
// compose PAGE render the same component rather than two copies that drift.
// The shared `ComposeSurface` can only save what writes to `threads`; a
// questionnaire writes its own table through its own action, so the catalogue
// offers it only when the host registers `compose:questionnaire` — which is
// what `QuestionnaireComposeSurface` below is for.
// ============================================================================

export function QuestionnaireBody({
  kind,
  onDone,
}: {
  kind: "questionnaire" | "poll";
  onDone: () => void;
}) {
  const isPoll = kind === "poll";
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [closesAt, setClosesAt] = React.useState("");
  const [fields, setFields] = React.useState<StoredQuestionnaireField[]>([]);
  const [submitting, setSubmitting] = React.useState(false);

  async function submit() {
    if (!title.trim()) {
      toast.error("Give it a title");
      return;
    }
    const problem = validateQuestionFields(fields);
    if (problem) {
      toast.error(problem);
      return;
    }

    setSubmitting(true);
    const result = await createQuestionnaireAction({
      title: title.trim(),
      description: description.trim() || undefined,
      fields: cleanQuestionFields(fields),
      kind,
      closesAt: closesAt ? new Date(closesAt).toISOString() : null,
    });
    setSubmitting(false);

    if (!result.ok) {
      toast.error("error" in result ? result.error : "Could not create it");
      return;
    }
    toast.success(isPoll ? "Poll opened" : "Questionnaire opened");
    onDone();
  }

  return (
    <div className="eac-compose">
      <div className="eac-field">
        <Label htmlFor="q-title">{isPoll ? "What is this poll about?" : "Title"}</Label>
        <Input id="q-title" value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>

      <div className="eac-field">
        <Label htmlFor="q-desc">Description</Label>
        <Textarea
          id="q-desc"
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional — context for the people answering."
        />
      </div>

      <div className="eac-field">
        <Label>{isPoll ? "The question" : "Questions"}</Label>
        <QuestionBuilder value={fields} onChange={setFields} single={isPoll} />
      </div>

      <div className="eac-field">
        <Label htmlFor="q-closes">Closes</Label>
        <Input
          id="q-closes"
          type="datetime-local"
          value={closesAt}
          onChange={(e) => setClosesAt(e.target.value)}
        />
      </div>

      <p className="ifac-compose-note">
        {isPoll
          ? "Everyone who answers sees the running result. It is never public."
          : "Answers are visible to IFAC's administrators only."}
      </p>

      <div className="ifac-compose-actions">
        <Button type="button" onClick={submit} disabled={submitting} aria-busy={submitting}>
          {submitting ? "Opening…" : isPoll ? "Open poll" : "Open questionnaire"}
        </Button>
      </div>
    </div>
  );
}

/**
 * The same form, as a surface layer.
 *
 * Registered on the connectors as `compose:questionnaire` and `compose:poll`.
 * On success it pops its own layer, which returns the person to the catalogue
 * they chose from rather than closing the dialog out from under them.
 */
export function QuestionnaireComposeSurface({
  kind,
}: {
  kind: "questionnaire" | "poll";
}) {
  const surfaces = useSurface();
  const isPoll = kind === "poll";

  return (
    <SurfaceFrame
      kind={kind}
      title={isPoll ? "Open a poll" : "Ask the membership"}
      kicker="Compose"
    >
      <QuestionnaireBody kind={kind} onDone={() => surfaces.pop()} />
    </SurfaceFrame>
  );
}

"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  QuestionBuilder,
  validateQuestionFields,
  cleanQuestionFields,
} from "@elkdonis/cms-ui/compose";
import type { StoredQuestionnaireField } from "@elkdonis/cms-ui/wizard";
import { createQuestionnaireAction } from "@/lib/cms/questionnaire-actions";
import { Button, Input, Label, Textarea } from "@elkdonis/primitives";

/**
 * Questionnaire / poll authoring for this site.
 *
 * The two are one form with `single` flipped — a poll is a questionnaire whose
 * field list is a single choice question. Extracted from the compose launcher
 * so the popup and the full-page workspace render the same component rather
 * than each carrying a copy.
 */
export function QuestionnaireComposerBody({
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
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="q-title">{isPoll ? "What is this poll about?" : "Title"}</Label>
        <Input id="q-title" value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="q-desc">Description</Label>
        <Textarea
          id="q-desc"
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional — context for the people answering."
        />
      </div>

      <div className="space-y-1.5">
        <Label>{isPoll ? "The question" : "Questions"}</Label>
        <QuestionBuilder value={fields} onChange={setFields} single={isPoll} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="q-closes">Closes</Label>
        <Input
          id="q-closes"
          type="datetime-local"
          value={closesAt}
          onChange={(e) => setClosesAt(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          Optional. Leave empty to keep it open until you close it.
        </p>
      </div>

      <p className="text-xs text-muted-foreground">
        {isPoll
          ? "Everyone who answers sees the running result."
          : "Answers are visible to this group's owners and guides only."}
      </p>

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="ghost" onClick={onDone} disabled={submitting}>
          Cancel
        </Button>
        <Button type="button" onClick={submit} disabled={submitting} aria-busy={submitting}>
          {submitting ? "Opening…" : isPoll ? "Open poll" : "Open questionnaire"}
        </Button>
      </div>
    </div>
  );
}

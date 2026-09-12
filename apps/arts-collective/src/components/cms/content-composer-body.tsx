"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ContentComposer,
  emptyContentAnswers,
  type ContentFieldContext,
  type ContentKind,
} from "@elkdonis/cms-ui/compose";
import { MediaPicker } from "@elkdonis/cms-ui/files";
import { Button } from "@/components/ui/button";
import { RichTextEditor } from "@elkdonis/cms-ui/editor";
import { createThreadAction } from "@/lib/cms/actions";
import type { ThreadFormInput } from "@/lib/cms/schema";

/**
 * Article / event authoring inside the shared compose sheet.
 *
 * The field list is `@elkdonis/cms-ui/compose`'s, so this file supplies only
 * what cms-ui cannot carry: this app's rich-text editor, and the submit that
 * calls its own server action. That is the whole adapter — the 696-line
 * `create-content-dialog` is what this is replacing, and the reason it was
 * 696 lines is that it declared the fields as JSX instead of reading them.
 *
 * Kept alongside the old dialog rather than deleting it: the dialog is still
 * the entry point from other places in the hub, and swapping those over is a
 * separate, verifiable step.
 */
export function ContentComposerBody({
  orgSlug,
  kind,
  fieldContext,
  onDone,
}: {
  orgSlug: string;
  kind: ContentKind;
  fieldContext?: ContentFieldContext;
  onDone: () => void;
}) {
  const router = useRouter();
  const [answers, setAnswers] = React.useState<Record<string, unknown>>(() =>
    emptyContentAnswers(kind, fieldContext)
  );
  const [fieldErrors, setFieldErrors] = React.useState<
    Record<string, string[] | undefined> | undefined
  >();
  const [submitting, setSubmitting] = React.useState(false);

  async function submit() {
    setSubmitting(true);
    setFieldErrors(undefined);

    const result = await createThreadAction({
      ...answers,
      orgSlug,
      kind,
    } as unknown as ThreadFormInput);

    setSubmitting(false);

    if (!result.ok) {
      // Same `in` narrowing this codebase uses everywhere for result unions.
      if ("fieldErrors" in result && result.fieldErrors) {
        setFieldErrors(result.fieldErrors as Record<string, string[] | undefined>);
      }
      toast.error("error" in result ? result.error : "Could not save it");
      return;
    }

    toast.success(kind === "post" ? "Article published" : "Event published");
    onDone();
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <ContentComposer
        kind={kind}
        context={fieldContext}
        answers={answers}
        onChange={setAnswers}
        fieldErrors={fieldErrors}
        slots={{
          body: ({ value, onChange }) => (
            <RichTextEditor value={value} onChange={onChange} />
          ),
          // Upload *and* browse what the org already has, in the same pane —
          // the Library tab is the "media review" half, and it is the reason
          // this is a picker rather than a file input.
          media: ({ value, onChange }) => (
            <MediaPicker
              value={typeof value === "string" ? value : undefined}
              onChange={onChange}
              uploadEndpoint="/api/upload/image"
              libraryEndpoint={`/api/media/library?org=${encodeURIComponent(orgSlug)}`}
              uploadFields={{ orgSlug, context: "content" }}
              label="Cover image"
              hint="Shown in listings and at the top of the page."
            />
          ),
        }}
      />

      <div className="flex justify-end gap-2 border-t border-border pt-4">
        <Button type="button" variant="ghost" onClick={onDone} disabled={submitting}>
          Cancel
        </Button>
        <Button type="button" onClick={submit} disabled={submitting} aria-busy={submitting}>
          {submitting ? "Publishing…" : "Publish"}
        </Button>
      </div>
    </div>
  );
}

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
import { saveContentAction } from "@/lib/cms/actions";
import { toContentFormValues } from "@/lib/cms/compose-adapter";

/**
 * The complete CMS for this site, on the shared composer.
 *
 * The field list comes from `@elkdonis/cms-ui/compose`; what this file adds is
 * the three things that cannot be shared — this site's rich-text editor, its
 * media picker endpoints, and the fields that are first-class *here*:
 * recurrence, RSVP deadline and minimum attendance. The monthly sadhana is the
 * primary object on this site, so recurrence is not an advanced option.
 *
 * Draft and Publish are both real buttons, unlike the old flow where the
 * status was decided by which submit you pressed and drafts were never
 * exercised.
 */
export function ContentComposerBody({
  kind,
  feeds,
  onDone,
}: {
  kind: ContentKind;
  feeds: Array<{ slug: string; name: string }>;
  onDone: () => void;
}) {
  const router = useRouter();

  const fieldContext: ContentFieldContext = {
    feeds,
    // Both are wired on this site; the composer only offers what exists.
    canCreateDocument: true,
    canCreateTalkRoom: true,
    // Single-org site — there is no network front page to cross-post to.
    canShareToNetwork: false,
    defaultTimeZone: "America/Toronto",
  };

  const [answers, setAnswers] = React.useState<Record<string, unknown>>(() => ({
    ...emptyContentAnswers(kind, fieldContext),
    recurrence_pattern: "NONE",
    is_rsvp_enabled: true,
  }));
  const [submitting, setSubmitting] = React.useState(false);

  async function submit(status: "draft" | "published") {
    if (!String(answers.feed_slug ?? "").trim()) {
      toast.error("Choose which page this goes on");
      return;
    }

    setSubmitting(true);
    const result = await saveContentAction(toContentFormValues(kind, answers, status));
    setSubmitting(false);

    if (!result.ok) {
      toast.error("error" in result ? result.error : "Could not save it");
      return;
    }

    toast.success(status === "published" ? "Published" : "Saved as a draft");
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
        slots={{
          body: ({ value, onChange, tier }) => (
            <RichTextEditor value={value} onChange={onChange} toolbar={tier === "quick" ? "compact" : "full"} />
          ),
          // Never a URL box: upload, or choose from what this org already has.
          media: ({ value, onChange }) => (
            <MediaPicker
              value={typeof value === "string" ? value : undefined}
              onChange={onChange}
              uploadEndpoint="/api/upload"
              libraryEndpoint="/api/media/library"
              label="Cover image"
              hint="Shown on the page listing and at the top of the item."
            />
          ),
        }}
      />

      <div className="flex justify-end gap-2 border-t pt-4">
        <Button type="button" variant="ghost" onClick={onDone} disabled={submitting}>
          Cancel
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => submit("draft")}
          disabled={submitting}
        >
          Save draft
        </Button>
        <Button type="button" onClick={() => submit("published")} disabled={submitting}>
          {submitting ? "Saving…" : "Publish"}
        </Button>
      </div>
    </div>
  );
}

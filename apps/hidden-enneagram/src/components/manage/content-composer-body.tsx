"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ContentComposer,
  emptyContentAnswers,
  type ContentFieldContext,
} from "@elkdonis/cms-ui/compose";
import { MediaPicker } from "@elkdonis/cms-ui/files";
import { RichTextEditor } from "@elkdonis/cms-ui/editor";
import { Button } from "@/components/ui/button";
import { saveContentAction } from "@/lib/cms/actions";
import { toContentFormValues } from "@/lib/cms/compose-adapter";

/**
 * /manage's editor, on the shared composer (2026-09-27).
 *
 * The same field list the hub's compose popup and ArtDirect use —
 * `buildContentFields('post' | 'service')` from @elkdonis/cms-ui/compose — so
 * a service has the same booking fields wherever it is written. What stays
 * here is this site's rich-text editor, its media endpoints, and the save:
 * compose-adapter → saveContentAction → upsertServiceOffering for a service.
 * It replaced the hand-written content-form.tsx.
 */
export function ContentComposerBody({
  kind,
  feeds,
  initialAnswers,
  threadId,
}: {
  kind: "post" | "service";
  feeds: Array<{ slug: string; name: string }>;
  /** Editing: the saved record as compose answers. */
  initialAnswers?: Record<string, unknown>;
  threadId?: string;
}) {
  const router = useRouter();

  const fieldContext = React.useMemo<ContentFieldContext>(
    () => ({ feeds, canShareToNetwork: false, canCreateDocument: false, canCreateTalkRoom: false }),
    [feeds]
  );

  const [answers, setAnswers] = React.useState<Record<string, unknown>>(() => ({
    ...emptyContentAnswers(kind, fieldContext),
    // A new service files under Services when the site has that page.
    ...(kind === "service" && feeds.some((f) => f.slug === "services") ? { feed_slug: "services" } : {}),
    ...(initialAnswers ?? {}),
  }));
  const [submitting, setSubmitting] = React.useState<false | "draft" | "published">(false);

  async function submit(status: "draft" | "published") {
    if (!String(answers.title ?? "").trim()) {
      toast.error("Give it a title");
      return;
    }
    if (!String(answers.feed_slug ?? "").trim()) {
      toast.error("Choose which page this goes on");
      return;
    }
    setSubmitting(status);
    const result = await saveContentAction(toContentFormValues(kind, answers, status), threadId);
    setSubmitting(false);
    if (result.ok === false) {
      toast.error("error" in result ? String(result.error) : "Could not save it");
      return;
    }
    toast.success(status === "published" ? "Published" : "Saved as a draft");
    router.push("/manage");
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
          media: ({ value, onChange, label, hint }) => (
            <MediaPicker
              value={typeof value === "string" ? value : undefined}
              onChange={onChange}
              uploadEndpoint="/api/upload"
              libraryEndpoint="/api/media/library"
              label={label ?? "Cover image"}
              hint={hint ?? "Shown on the page listing and at the top of the item."}
            />
          ),
        }}
      />

      <div className="flex justify-end gap-2 border-t border-border pt-4">
        <Button type="button" variant="ghost" onClick={() => router.push("/manage")} disabled={Boolean(submitting)}>
          Cancel
        </Button>
        <Button type="button" variant="outline" onClick={() => submit("draft")} disabled={Boolean(submitting)}>
          {submitting === "draft" ? "Saving…" : "Save draft"}
        </Button>
        <Button type="button" onClick={() => submit("published")} disabled={Boolean(submitting)}>
          {submitting === "published" ? "Publishing…" : "Publish"}
        </Button>
      </div>
    </div>
  );
}

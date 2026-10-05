"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ContentComposer, emptyContentAnswers, type ContentFieldContext } from "@elkdonis/cms-ui/compose";
import { RichTextEditor } from "@elkdonis/cms-ui/editor";
import { Button } from "@/components/ui/button";
import { deleteServiceAction, saveServiceAction } from "@/app/hub/services/actions";
import "@elkdonis/cms-ui/fields.css";
import "@elkdonis/cms-ui/compose.css";
import "@elkdonis/cms-ui/editor.css";

/**
 * The service editor on the shared composer (2026-09-27; replaced the
 * app-local service-form.tsx). Same fields as hidden-enneagram and ArtDirect:
 * buildContentFields('service'). No media slot: this app has no upload route
 * yet, so the cover field is not offered rather than offered as a URL box.
 */
const FIELD_CONTEXT: ContentFieldContext = {
  canShareToNetwork: false,
  canCreateDocument: false,
  canCreateTalkRoom: false,
};

export function ServiceComposer({
  threadId,
  initialAnswers,
}: {
  threadId?: string;
  initialAnswers?: Record<string, unknown>;
}) {
  const router = useRouter();
  const [answers, setAnswers] = React.useState<Record<string, unknown>>(() => ({
    ...emptyContentAnswers("service", FIELD_CONTEXT),
    ...(initialAnswers ?? {}),
  }));
  const [busy, setBusy] = React.useState<false | "draft" | "published" | "delete">(false);

  async function save(status: "draft" | "published") {
    setBusy(status);
    const res = await saveServiceAction(answers, status, threadId);
    setBusy(false);
    if (res.ok === false) return void toast.error(res.error ?? "Could not save");
    toast.success(status === "published" ? "Published" : "Draft saved");
    if (!threadId && res.id) router.replace(`/hub/services/${res.id}`);
    router.refresh();
  }

  async function remove() {
    if (!threadId || !window.confirm("Take this service down? It will no longer be listed or bookable.")) return;
    setBusy("delete");
    const res = await deleteServiceAction(threadId);
    setBusy(false);
    if (res.ok === false) return void toast.error(res.error ?? "Could not remove it");
    router.replace("/hub/services");
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <ContentComposer
        kind="service"
        context={FIELD_CONTEXT}
        answers={answers}
        onChange={setAnswers}
        slots={{
          body: ({ value, onChange, tier }) => (
            <RichTextEditor value={value} onChange={onChange} toolbar={tier === "quick" ? "compact" : "full"} />
          ),
        }}
      />
      <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
        {threadId && (
          <Button type="button" variant="ghost" onClick={remove} disabled={Boolean(busy)} className="mr-auto">
            {busy === "delete" ? "Removing…" : "Take down"}
          </Button>
        )}
        <Button type="button" variant="outline" onClick={() => save("draft")} disabled={Boolean(busy)}>
          {busy === "draft" ? "Saving…" : "Save draft"}
        </Button>
        <Button type="button" onClick={() => save("published")} disabled={Boolean(busy)}>
          {busy === "published" ? "Publishing…" : "Publish"}
        </Button>
      </div>
    </div>
  );
}

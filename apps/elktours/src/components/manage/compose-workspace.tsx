"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ComposePicker,
  buildComposeCatalogue,
  type ComposeContext,
  type ComposeOption,
} from "@elkdonis/cms-ui/compose";
import { ContentComposerBody } from "@/components/manage/content-composer-body";
import { QuestionnaireComposerBody } from "@/components/manage/questionnaire-composer-body";

/**
 * The CMS as a page rather than a popup.
 *
 * Same catalogue and same composer as the sheet — this renders them inline,
 * because a full authoring session (a long post, a meeting with recurrence, a
 * questionnaire with eight questions) wants the whole width and does not want
 * to be one Escape key from losing itself.
 *
 * The sheet still exists for composing from somewhere else in the hub, where
 * a popup is the right weight. Both drive the same components.
 */
export function ComposeWorkspace({ context }: { context: ComposeContext }) {
  const router = useRouter();
  const catalogue = React.useMemo(() => buildComposeCatalogue(context), [context]);
  const [selected, setSelected] = React.useState<ComposeOption | null>(null);

  function done() {
    setSelected(null);
    router.refresh();
  }

  if (!selected) {
    return <ComposePicker options={catalogue} onSelect={setSelected} />;
  }

  return (
    <div className="space-y-5">
      <div className="flex items-baseline justify-between gap-4 border-b pb-3">
        <div>
          <h3 className="text-lg">{selected.title}</h3>
          <p className="text-sm text-muted-foreground">{selected.blurb}</p>
        </div>
        <button
          type="button"
          onClick={() => setSelected(null)}
          className="shrink-0 text-xs text-muted-foreground underline-offset-2 hover:underline"
        >
          ← Something else
        </button>
      </div>

      {selected.writes.table === "threads" ? (
        <ContentComposerBody
          kind={selected.writes.kind as "post" | "meeting"}
          feeds={context.feeds ?? []}
          onDone={done}
        />
      ) : (
        <QuestionnaireComposerBody
          kind={selected.writes.kind as "questionnaire" | "poll"}
          onDone={done}
        />
      )}
    </div>
  );
}

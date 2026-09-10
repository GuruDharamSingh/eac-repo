"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ComposeSheet,
  buildComposeCatalogue,
  type ComposeContext,
  type ComposeOption,
} from "@elkdonis/cms-ui/compose";
import { Button } from "@/components/ui/button";
import { ContentComposerBody } from "@/components/manage/content-composer-body";
import { QuestionnaireComposerBody } from "@/components/manage/questionnaire-composer-body";

/**
 * Compose from anywhere in the hub, as a popup.
 *
 * The full-page version is `ComposeWorkspace`; both drive the same catalogue
 * and the same composer bodies, so the only difference is the container. It
 * briefly handed thread kinds off to /manage/content/new — this site's own
 * 488-line form, itself a fork of arts-collective's dialog — and that redirect
 * was exactly the duplication being retired.
 */
export function ComposeLauncher({
  context,
  label = "Compose",
}: {
  context: ComposeContext;
  label?: string;
}) {
  const router = useRouter();
  const catalogue = React.useMemo(() => buildComposeCatalogue(context), [context]);

  const [open, setOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<ComposeOption | null>(null);

  function close() {
    setOpen(false);
    setSelected(null);
  }

  function done() {
    close();
    router.refresh();
  }

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        {label}
      </Button>
      <ComposeSheet
        open={open}
        onClose={close}
        options={catalogue}
        selected={selected}
        onSelect={setSelected}
        onBack={() => setSelected(null)}
      >
        {selected && selected.writes.table === "threads" && (
          <ContentComposerBody
            kind={selected.writes.kind as "post" | "meeting"}
            feeds={context.feeds ?? []}
            onDone={done}
          />
        )}

        {selected && selected.writes.table === "questionnaires" && (
          <QuestionnaireComposerBody
            kind={selected.writes.kind as "questionnaire" | "poll"}
            onDone={done}
          />
        )}
      </ComposeSheet>
    </>
  );
}

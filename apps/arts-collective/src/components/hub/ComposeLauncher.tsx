"use client";

import * as React from "react";
import {
  ComposeSheet,
  buildComposeCatalogue,
  type ComposeContext,
  type ComposeOption,
} from "@elkdonis/cms-ui/compose";
import { QuestionnaireComposer } from "@/components/cms/questionnaire-composer";
import { ContentComposerBody } from "@/components/cms/content-composer-body";

/**
 * The hub's compose popup.
 *
 * Holds the shared sheet and decides which body to render for the chosen kind.
 * The catalogue is derived from what this org actually has, so two orgs' hubs
 * offer different things without either app hardcoding a list — see
 * @elkdonis/cms-ui/compose.
 *
 * Every kind now composes here. Article, event and meeting render through
 * `ContentComposer`, whose field list is data — so they are the same form with
 * different groups rather than three forms.
 *
 * `CreateContentDialog` (696 lines) is still live for three OTHER entry points:
 * SubdomainEditorBar, the hub's guide announcements, and the network tab's
 * "contribute news". Those are next; its two forks in amrit-canada and
 * hidden-enneagram go when they are.
 */
export function ComposeLauncher({
  context,
  openWith,
  trigger,
}: {
  context: ComposeContext;
  /** Open straight into one kind, from a card that already names it. */
  openWith?: ComposeOption["id"];
  trigger: (open: () => void) => React.ReactNode;
}) {
  const catalogue = React.useMemo(
    () => buildComposeCatalogue(context).filter((o) => o.mode === "dialog"),
    [context]
  );

  const [open, setOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<ComposeOption | null>(null);

  function launch() {
    setSelected(openWith ? (catalogue.find((o) => o.id === openWith) ?? null) : null);
    setOpen(true);
  }

  function close() {
    setOpen(false);
    setSelected(null);
  }

  return (
    <>
      {trigger(launch)}
      <ComposeSheet
        open={open}
        onClose={close}
        options={catalogue}
        selected={selected}
        onSelect={setSelected}
        // No way back when the card that opened this already named the kind.
        onBack={openWith ? undefined : () => setSelected(null)}
      >
        {selected && (selected.id === "questionnaire" || selected.id === "poll") && (
          <QuestionnaireComposer
            orgSlug={context.orgSlug}
            kind={selected.id}
            onDone={close}
          />
        )}

        {selected && selected.writes.table === "threads" && (
          <ContentComposerBody
            orgSlug={context.orgSlug}
            // The catalogue's `writes.kind` is the vocabulary the database
            // uses, so the sheet never has to translate "Event" into a kind.
            kind={selected.writes.kind as "post" | "event" | "meeting" | "workshop"}
            fieldContext={{
              feeds: context.feeds,
              canShareToNetwork: context.canShareToNetwork,
              canCreateDocument: context.canCreateDocument,
              canCreateTalkRoom: context.canCreateTalkRoom,
            }}
            onDone={close}
          />
        )}
      </ComposeSheet>
    </>
  );
}

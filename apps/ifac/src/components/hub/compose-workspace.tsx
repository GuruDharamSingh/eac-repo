"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ComposePicker,
  ContentComposer,
  buildComposeCatalogue,
  emptyContentAnswers,
  type ComposeContext,
  type ComposeOption,
} from "@elkdonis/cms-ui/compose";
import { useSurface } from "@elkdonis/cms-ui/surface";
import { Button } from "@elkdonis/primitives";
import { siteConfig } from "@/config/site";
import { saveContentAction } from "@/lib/cms/actions";
import { toSaveContentInput } from "@/lib/cms/compose-adapter";
import { QuestionnaireBody } from "./questionnaire-composer";
import { WritingRoomPage } from "./writing-room-page";

/**
 * IFAC's compose surface, in the hub.
 *
 * This replaces a StubPanel that described exactly this — "build questions:
 * choice, text, number or image", "choose who sees the results", "open it,
 * then close it" — and noted that the schema and service already existed. They
 * did; what was missing was anything that wrote `questionnaires.fields`.
 *
 * The catalogue is the shared one, filtered by what IFAC actually has. It used
 * to be pinned to `canPublishContent: false` — "this site's product is its
 * roster and it has no content save path" — which was true and is no longer:
 * lib/cms/actions.ts now writes threads through the shared `createThread`, so
 * Article, Event and Meeting are real doors rather than doors onto nothing.
 * The caller decides, because a member and an owner see different grids.
 */
export function ComposeWorkspace({
  context,
  initialKind,
}: {
  context: ComposeContext;
  /** Preselect a kind, so a card's "Add an event" lands on the right form. */
  initialKind?: string;
}) {
  const router = useRouter();
  const catalogue = React.useMemo(() => buildComposeCatalogue(context), [context]);
  const [selected, setSelected] = React.useState<ComposeOption | null>(
    () => catalogue.find((option) => option.writes.kind === initialKind) ?? null
  );

  if (!selected) {
    return <ComposePicker options={catalogue} onSelect={setSelected} />;
  }

  return (
    <div className="eac-compose">
      <div className="ifac-compose-head">
        <p className="ifac-compose-blurb">{selected.blurb}</p>
        <Button type="button" variant="ghost" size="sm" onClick={() => setSelected(null)}>
          ← Something else
        </Button>
      </div>

      {/* A post gets the writing room — the words with the finished page beside
          them — not a textarea. It was the one kind whose page form was worse
          than its popup. Everything else keeps the shared composer. */}
      {selected.writes.kind === "post" ? (
        <WritingRoomPage />
      ) : selected.writes.table === "threads" ? (
        <ContentBody
          kind={selected.writes.kind as "post" | "event" | "meeting" | "workshop"}
          feeds={context.feeds ?? []}
          onDone={() => {
            setSelected(null);
            router.refresh();
          }}
        />
      ) : (
        <QuestionnaireBody
          kind={selected.writes.kind as "questionnaire" | "poll"}
          onDone={() => {
            setSelected(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

/**
 * Article / Event / Meeting / Workshop — the SHARED composer, on a page.
 *
 * This was ~200 lines of hand-written form: its own Title, Body textarea,
 * Section select, cover picker and schedule grid. It predated this app being
 * wired into the compose surface, and once it was, IFAC had two forms for the
 * same four kinds — the popup's (rich text, grouped fields, a disclosure for
 * the rarely-used ones) and this one (a flat column of plain inputs). They
 * drifted immediately: the "More about this gathering" drawer and the
 * irregular-schedule field were added to the shared field list and simply did
 * not exist here.
 *
 * So the page renders the same `ContentComposer` the popup did, against the
 * same `connectors.composeSlots` — which is what gets it the rich-text editor
 * and the org media picker — and saves through the same server action. The
 * only thing this file still owns is the page's own save bar, because a page
 * has no surface footer to put one in.
 *
 * The page survives, rather than the popup, for the reason that made compose
 * a route in the first place: this is a long form, and a modal's backdrop is
 * one stray click away from discarding it.
 */
function ContentBody({
  kind,
  feeds,
  onDone,
}: {
  kind: "post" | "event" | "meeting" | "workshop";
  feeds: Array<{ slug: string; name: string }>;
  onDone: () => void;
}) {
  const { connectors } = useSurface();
  const dated = kind !== "post";

  const fieldContext = React.useMemo(
    () => ({ feeds, orgSlug: siteConfig.orgId }),
    [feeds]
  );

  const [answers, setAnswers] = React.useState<Record<string, unknown>>(() =>
    emptyContentAnswers(kind, fieldContext)
  );
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string[]>>({});
  const [submitting, setSubmitting] = React.useState(false);

  async function submit(status: "draft" | "published") {
    const errors: Record<string, string[]> = {};
    if (!String(answers.title ?? "").trim()) errors.title = ["Give it a title"];
    if (dated && !String(answers.scheduled_at ?? "").trim()) {
      errors.scheduled_at = ["Pick a date and time"];
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length) {
      toast.error("Some fields still need filling in");
      return;
    }

    setSubmitting(true);
    const result = await saveContentAction(toSaveContentInput(kind, answers, status));
    setSubmitting(false);

    // The repo compiles with `strict: false`, so `!result.ok` does not narrow
    // a discriminated union. Compare explicitly — the house pattern.
    if (result.ok === false) {
      toast.error(result.error);
      return;
    }
    toast.success(status === "draft" ? "Saved as a draft" : "Published");
    onDone();
  }

  return (
    <>
      <ContentComposer
        kind={kind}
        context={fieldContext}
        answers={answers}
        onChange={setAnswers}
        slots={connectors.composeSlots}
        fieldErrors={fieldErrors}
      />

      <div className="ifac-compose-actions">
        <Button
          type="button"
          variant="outline"
          onClick={() => void submit("draft")}
          disabled={submitting}
        >
          Save draft
        </Button>
        <Button type="button" onClick={() => void submit("published")} disabled={submitting}>
          {submitting ? "Saving…" : "Publish"}
        </Button>
      </div>
    </>
  );
}

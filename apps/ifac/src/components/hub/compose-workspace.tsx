"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ComposeGroupSwitch,
  ComposePicker,
  ContentComposer,
  SeriesComposer,
  buildComposeCatalogue,
  emptyContentAnswers,
  groupOptions,
  seriesScheduleFromAnswers,
  switchContentKind,
  type ComposeContext,
  type ComposeOption,
  type ContentKind,
} from "@elkdonis/cms-ui/compose";
import { useSurface } from "@elkdonis/cms-ui/surface";
import { Button } from "@elkdonis/primitives";
import { siteConfig } from "@/config/site";
import { saveContentAction } from "@/lib/cms/actions";
import { toSaveContentInput } from "@/lib/cms/compose-adapter";
import { DEFAULT_SERIES_ZONE } from "@/lib/series-time";
import { QuestionnairePageBody } from "./questionnaire-composer";
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
  initialTitle,
  routed = false,
  studioHref,
}: {
  context: ComposeContext;
  /** Preselect a kind, so a card's "Add an event" lands on the right form. */
  initialKind?: string;
  /** A title typed elsewhere — the compose popup's "Open as a page". */
  initialTitle?: string;
  /**
   * On the /hub/compose page: the chosen kind lives in the URL (`?kind=`),
   * so the page's breadcrumb names it and leads back to the chooser, and the
   * in-panel "Something else" row is dropped. Off (the questionnaire popup),
   * the choice is local state and the row stays: a popup has no breadcrumb.
   */
  routed?: boolean;
  /** The network Studio, offered from the writing room. */
  studioHref?: string;
}) {
  const router = useRouter();
  const catalogue = React.useMemo(() => buildComposeCatalogue(context), [context]);
  const [picked, setPicked] = React.useState<ComposeOption | null>(
    () => catalogue.find((option) => option.writes.kind === initialKind) ?? null
  );
  // Routed, the kind is the URL's. The "One meeting | Series" switch sets it
  // here at once and replaces `?kind=` behind it, so the breadcrumb follows
  // (the server re-renders it) while the form keeps what was typed: Next
  // keys a page's client state without its search params.
  const [routedKind, setRoutedKind] = React.useState(initialKind);
  const [seenKind, setSeenKind] = React.useState(initialKind);
  if (initialKind !== seenKind) {
    setSeenKind(initialKind);
    setRoutedKind(initialKind);
  }
  const selected = routed
    ? (catalogue.find((option) => option.writes.kind === routedKind) ?? null)
    : picked;
  const siblings = groupOptions(catalogue, selected);

  const select = (option: ComposeOption) => {
    if (routed) router.push(`/hub/compose?kind=${encodeURIComponent(option.writes.kind)}`);
    else setPicked(option);
  };
  const switchKind = (option: ComposeOption) => {
    if (!routed) {
      setPicked(option);
      return;
    }
    setRoutedKind(option.writes.kind);
    router.replace(`/hub/compose?kind=${encodeURIComponent(option.writes.kind)}`, { scroll: false });
  };
  const backToChooser = () => {
    if (routed) {
      router.push("/hub/compose");
    } else {
      setPicked(null);
      router.refresh();
    }
  };

  if (!selected) {
    return <ComposePicker options={catalogue} onSelect={select} />;
  }

  return (
    <div className="eac-compose">
      {routed ? null : (
        <div className="ifac-compose-head">
          <p className="ifac-compose-blurb">{selected.blurb}</p>
          <Button type="button" variant="ghost" size="sm" onClick={() => setPicked(null)}>
            ← Something else
          </Button>
        </div>
      )}

      {/* "One meeting | Series": the kinds that share a door, as a switch at
          the top of the form. Nothing is drawn for a kind without siblings. */}
      {siblings.length > 1 ? (
        <ComposeGroupSwitch options={siblings} selected={selected} onSelect={switchKind} />
      ) : null}

      {/* A post gets the writing room — the words with the finished page beside
          them — not a textarea. It was the one kind whose page form was worse
          than its popup. Everything else keeps the shared composer. */}
      {selected.writes.kind === "post" ? (
        <WritingRoomPage studioHref={studioHref} />
      ) : selected.writes.table === "threads" ? (
        <ContentBody
          // Keyed by the door, not the kind: switching meeting ⇄ series keeps
          // the body mounted so its answers carry over.
          key={selected.group?.id ?? selected.id}
          kind={selected.writes.kind as "post" | "event" | "meeting" | "workshop" | "series"}
          context={context}
          initialTitle={initialTitle}
          onDone={backToChooser}
        />
      ) : (
        <QuestionnairePageBody
          key={selected.id}
          kind={selected.writes.kind as "questionnaire" | "poll"}
          onDone={backToChooser}
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
  context,
  onDone,
  initialTitle,
}: {
  kind: "post" | "event" | "meeting" | "workshop" | "series";
  /** The page's whole compose context — not just its feeds. */
  context: ComposeContext;
  onDone: () => void;
  /** Carried in from the popup, so the first field is already filled. */
  initialTitle?: string;
}) {
  const router = useRouter();
  const { connectors } = useSurface();
  const dated = kind !== "post";
  const isSeries = kind === "series";

  // The CAPABILITIES have to come through, not only the feeds: the shared
  // field list hides "make a Talk room" and "make a document" unless the host
  // says it can make them (content-fields.ts). Passing `{ feeds, orgSlug }`
  // alone is why this page offered neither, while the popup — which forwards
  // the same flags off `connectors.compose` — offered the document.
  // A series starts in the zone IFAC's series pages default to; other kinds
  // keep "your zone" (the field's empty choice).
  const fieldContext = React.useMemo(
    () => ({
      feeds: context.feeds ?? [],
      orgSlug: siteConfig.orgId,
      canShareToNetwork: context.canShareToNetwork,
      canCreateDocument: context.canCreateDocument,
      canCreateTalkRoom: context.canCreateTalkRoom,
      hostCandidates: context.hostCandidates,
      ...(isSeries ? { defaultTimeZone: DEFAULT_SERIES_ZONE } : {}),
    }),
    [context, isSeries]
  );

  const [answers, setAnswers] = React.useState<Record<string, unknown>>(() => ({
    ...emptyContentAnswers(kind, fieldContext),
    ...(initialTitle?.trim() ? { title: initialTitle.trim() } : {}),
  }));
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string[]>>({});
  const [submitting, setSubmitting] = React.useState(false);

  // The switch changed the kind under a mounted form: carry what was typed
  // into the new kind's answers (title, cover, description, first date).
  const [answersKind, setAnswersKind] = React.useState<ContentKind>(kind);
  if (answersKind !== kind) {
    setAnswersKind(kind);
    setAnswers((prev) => switchContentKind(prev, answersKind, kind, fieldContext));
    setFieldErrors({});
  }

  async function submit(status: "draft" | "published") {
    let errors: Record<string, string[]> = {};
    if (!String(answers.title ?? "").trim()) errors.title = ["Give it a title"];
    if (isSeries) {
      errors = { ...errors, ...seriesScheduleFromAnswers(answers).errors };
    } else if (dated && !String(answers.scheduled_at ?? "").trim()) {
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
    // The thread saved; something it asked for (a room, a series setting)
    // did not. Say which.
    for (const warning of result.warnings ?? []) toast.error(warning);
    if (isSeries) {
      if (result.href) {
        // The weeks are planned in the planner: go there.
        toast.success("Series published. Plan its weeks here.");
        router.push(result.href);
        return;
      }
      toast.success(
        result.status === "pending"
          ? "Sent to the guides. The planner opens once the series is published."
          : "Saved as a draft. The planner opens once the series is published."
      );
      onDone();
      return;
    }
    toast.success(status === "draft" ? "Saved as a draft" : "Published");
    onDone();
  }

  return (
    <>
      {isSeries ? (
        <SeriesComposer
          context={fieldContext}
          answers={answers}
          onChange={setAnswers}
          slots={connectors.composeSlots}
          fieldErrors={fieldErrors}
          orgName={siteConfig.shortName}
        />
      ) : (
        <ContentComposer
          kind={kind}
          context={fieldContext}
          answers={answers}
          onChange={setAnswers}
          slots={connectors.composeSlots}
          fieldErrors={fieldErrors}
        />
      )}

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
          {submitting ? "Saving…" : isSeries ? "Publish series" : "Publish"}
        </Button>
      </div>
    </>
  );
}

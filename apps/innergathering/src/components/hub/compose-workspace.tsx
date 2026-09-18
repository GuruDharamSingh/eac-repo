"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ComposePicker,
  ContentComposer,
  QuestionnaireBody,
  buildComposeCatalogue,
  emptyContentAnswers,
  type ComposeContext,
  type ComposeOption,
} from "@elkdonis/cms-ui/compose";
import { RichTextEditor } from "@elkdonis/cms-ui/editor";
import { MediaPicker } from "@elkdonis/cms-ui/files";
import { siteConfig } from "@/config/site";

const TIME_ZONE = "America/Toronto";
import { saveContentAction } from "@/lib/cms/actions";
import { saveWorkshopAction } from "@/lib/cms/workshop-actions";
import { createQuestionnaireAction } from "@/lib/cms/questionnaire-actions";
import { toContentFormValues } from "@/lib/cms/compose-adapter";
import { toWorkshopInput } from "@/lib/cms/workshop-adapter";

/**
 * Composing on a PAGE rather than in the popup.
 *
 * The hub's popup is right for a post and a gathering — a title, some lines, a
 * date. It is wrong for anything long: a modal's backdrop is one stray click
 * from discarding twenty minutes of typing, and the back button does not mean
 * what a person expects. So the catalogue offers both doors, and this is the
 * one behind the long ones.
 *
 * It writes through exactly the same actions the popup does. That is the whole
 * discipline here: two frames, one save path — IFAC learned it the hard way,
 * having had `/hub/compose` render a hand-written second form that had already
 * drifted from the shared one.
 */
export function ComposeWorkspace({
  context,
  initialKind,
}: {
  context: ComposeContext;
  /** Preselect, so "Questionnaire" on a card lands on the right form. */
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

  const done = () => {
    setSelected(null);
    router.refresh();
  };

  return (
    <div className="eac-compose">
      <div className="eac-compose-head">
        <p className="eac-compose-blurb">{selected.blurb}</p>
        <button type="button" className="eac-btn eac-btn--quiet" onClick={() => setSelected(null)}>
          ← Something else
        </button>
      </div>

      {selected.writes.table === "threads" ? (
        <ContentBody
          kind={selected.writes.kind as "post" | "event" | "meeting" | "workshop"}
          feeds={context.feeds ?? []}
          onDone={done}
        />
      ) : (
        <QuestionnaireBody
          kind={selected.writes.kind as "questionnaire" | "poll"}
          onSave={createQuestionnaireAction}
          privacyNote={PRIVACY}
          onDone={done}
        />
      )}
    </div>
  );
}

/** What this org promises about who reads the answers. */
const PRIVACY = {
  poll: "Everyone who answers sees the running result. It is never public.",
  questionnaire: "Answers are visible to this group's organisers only.",
} as const;

/**
 * A thread, through the shared composer.
 *
 * The two save paths mirror the connectors' `saveThread` exactly — a workshop
 * carries a page and sessions of its own and goes through the workshop
 * service; everything else is writing or a gathering.
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
  const [answers, setAnswers] = React.useState(() => emptyContentAnswers(kind));
  const [problem, setProblem] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  async function save(status: "draft" | "published") {
    setSaving(true);
    setProblem(null);
    try {
      const result =
        kind === "workshop"
          ? await saveWorkshopAction(toWorkshopInput(answers, status))
          : await saveContentAction(
              toContentFormValues(kind === "post" ? "post" : "meeting", answers, status)
            );
      if (!result.ok) {
        setProblem(("error" in result && result.error) || "Could not save it.");
        return;
      }
      onDone();
    } catch {
      setProblem("Could not reach the server.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <ContentComposer
        kind={kind}
        tier="full"
        answers={answers}
        onChange={setAnswers}
        // The same context the popup builds, so both frames offer the same
        // fields: filing into a feed, a collaborative document, a Talk room.
        context={{
          feeds,
          canCreateDocument: true,
          canCreateTalkRoom: true,
          canShareToNetwork: false,
          defaultTimeZone: TIME_ZONE,
        }}
        slots={{
          body: ({ value, onChange }) => (
            <RichTextEditor value={value} onChange={onChange} toolbar="full" />
          ),
          media: ({ value, onChange, label, hint, accept }) => (
            <MediaPicker
              value={typeof value === "string" ? value : undefined}
              onChange={onChange}
              uploadEndpoint="/api/upload"
              libraryEndpoint="/api/media/library"
              label={label ?? "Image"}
              hint={hint}
              accept={accept}
            />
          ),
        }}
      />

      {problem && (
        <p className="eac-compose-problem" role="alert">
          {problem}
        </p>
      )}

      <div className="eac-compose-actions">
        <button
          type="button"
          className="eac-btn"
          onClick={() => void save("draft")}
          disabled={saving}
        >
          Save as a draft
        </button>
        <button
          type="button"
          className="eac-btn eac-btn--primary"
          onClick={() => void save("published")}
          disabled={saving}
          aria-busy={saving}
        >
          {saving ? "Publishing…" : "Publish"}
        </button>
      </div>
    </>
  );
}

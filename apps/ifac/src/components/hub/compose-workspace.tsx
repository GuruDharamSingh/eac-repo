"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ComposePicker,
  QuestionBuilder,
  buildComposeCatalogue,
  validateQuestionFields,
  cleanQuestionFields,
  type ComposeContext,
  type ComposeOption,
} from "@elkdonis/cms-ui/compose";
import type { StoredQuestionnaireField } from "@elkdonis/cms-ui/wizard";
import { MediaPicker } from "@elkdonis/cms-ui/files";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createQuestionnaireAction } from "@/lib/cms/questionnaire-actions";
import { saveContentAction } from "@/lib/cms/actions";

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
    <div className="space-y-4">
      <div className="flex items-baseline justify-between gap-4">
        <p className="text-sm text-[hsl(var(--muted-foreground))]">{selected.blurb}</p>
        <button
          type="button"
          onClick={() => setSelected(null)}
          className="shrink-0 text-xs underline-offset-2 hover:underline"
        >
          ← Something else
        </button>
      </div>

      {selected.writes.table === "threads" ? (
        <ContentBody
          kind={selected.writes.kind as "post" | "event" | "meeting"}
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

function QuestionnaireBody({
  kind,
  onDone,
}: {
  kind: "questionnaire" | "poll";
  onDone: () => void;
}) {
  const isPoll = kind === "poll";
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [closesAt, setClosesAt] = React.useState("");
  const [fields, setFields] = React.useState<StoredQuestionnaireField[]>([]);
  const [submitting, setSubmitting] = React.useState(false);

  async function submit() {
    if (!title.trim()) {
      toast.error("Give it a title");
      return;
    }
    const problem = validateQuestionFields(fields);
    if (problem) {
      toast.error(problem);
      return;
    }

    setSubmitting(true);
    const result = await createQuestionnaireAction({
      title: title.trim(),
      description: description.trim() || undefined,
      fields: cleanQuestionFields(fields),
      kind,
      closesAt: closesAt ? new Date(closesAt).toISOString() : null,
    });
    setSubmitting(false);

    if (!result.ok) {
      toast.error("error" in result ? result.error : "Could not create it");
      return;
    }
    toast.success(isPoll ? "Poll opened" : "Questionnaire opened");
    onDone();
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="q-title">{isPoll ? "What is this poll about?" : "Title"}</Label>
        <Input id="q-title" value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="q-desc">Description</Label>
        <Textarea
          id="q-desc"
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional — context for the people answering."
        />
      </div>

      <div className="space-y-1.5">
        <Label>{isPoll ? "The question" : "Questions"}</Label>
        <QuestionBuilder value={fields} onChange={setFields} single={isPoll} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="q-closes">Closes</Label>
        <Input
          id="q-closes"
          type="datetime-local"
          value={closesAt}
          onChange={(e) => setClosesAt(e.target.value)}
        />
      </div>

      <p className="text-xs text-[hsl(var(--muted-foreground))]">
        {isPoll
          ? "Everyone who answers sees the running result. It is never public."
          : "Answers are visible to IFAC's administrators only."}
      </p>

      <div className="flex justify-end gap-2">
        <Button type="button" onClick={submit} disabled={submitting} aria-busy={submitting}>
          {submitting ? "Opening…" : isPoll ? "Open poll" : "Open questionnaire"}
        </Button>
      </div>
    </div>
  );
}

/**
 * Article / Event / Meeting.
 *
 * One form for all three rather than three forms: they differ only by whether
 * the schedule block is shown, and the columns behind them are the same
 * `threads` columns. Three near-identical forms is how the rest of the network
 * ended up with five diverging content editors.
 */
function ContentBody({
  kind,
  feeds,
  onDone,
}: {
  kind: "post" | "event" | "meeting";
  feeds: Array<{ slug: string; name: string }>;
  onDone: () => void;
}) {
  const dated = kind !== "post";
  const [title, setTitle] = React.useState("");
  const [body, setBody] = React.useState("");
  const [section, setSection] = React.useState("");
  const [coverImageUrl, setCoverImageUrl] = React.useState("");
  const [scheduledAt, setScheduledAt] = React.useState("");
  const [durationMinutes, setDurationMinutes] = React.useState("60");
  const [format, setFormat] = React.useState<"in_person" | "online" | "hybrid">("online");
  const [location, setLocation] = React.useState("");
  const [meetingUrl, setMeetingUrl] = React.useState("");
  const [recurrence, setRecurrence] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  async function submit(status: "draft" | "published") {
    if (!title.trim()) {
      toast.error("Give it a title");
      return;
    }
    if (dated && !scheduledAt) {
      toast.error("Pick a date and time");
      return;
    }

    setSubmitting(true);
    const result = await saveContentAction({
      kind,
      title: title.trim(),
      body: body.trim() || undefined,
      status,
      section: section || null,
      coverImageUrl: coverImageUrl.trim() || null,
      scheduledAt: dated ? new Date(scheduledAt).toISOString() : null,
      durationMinutes: dated ? Number(durationMinutes) || 60 : null,
      format: dated ? format : null,
      location: location.trim() || null,
      meetingUrl: meetingUrl.trim() || null,
      // The CHECK rejects 'NONE' — an empty choice must become null.
      recurrencePattern:
        (recurrence as "DAILY" | "WEEKLY" | "MONTHLY") || null,
    });
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
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="c-title">Title</Label>
        <Input id="c-title" value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="c-body">Body</Label>
        <Textarea
          id="c-body"
          rows={6}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="What is it, and who is it for?"
        />
      </div>

      {feeds.length > 0 && (
        <div className="space-y-1.5">
          <Label htmlFor="c-section">Section</Label>
          <select
            id="c-section"
            className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm"
            value={section}
            onChange={(e) => setSection(e.target.value)}
          >
            <option value="">No section</option>
            {feeds.map((feed) => (
              <option key={feed.slug} value={feed.slug}>
                {feed.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Never a URL box. Pasting a path means dead links, images hosted
          somewhere the org does not control, and nothing in the library to
          reuse — so a cover is always uploaded or chosen from what IFAC
          already has. */}
      <MediaPicker
        value={coverImageUrl || undefined}
        onChange={setCoverImageUrl}
        uploadEndpoint="/api/upload"
        libraryEndpoint="/api/media/library"
        label="Cover image"
        hint="Shown in listings and at the top of the item."
      />

      {dated && (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="c-when">Starts</Label>
              <Input
                id="c-when"
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-duration">Minutes</Label>
              <Input
                id="c-duration"
                type="number"
                min={5}
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="c-format">Format</Label>
              <select
                id="c-format"
                className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm"
                value={format}
                onChange={(e) => setFormat(e.target.value as typeof format)}
              >
                <option value="online">Online</option>
                <option value="in_person">In person</option>
                <option value="hybrid">Hybrid</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-repeat">Repeats</Label>
              <select
                id="c-repeat"
                className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm"
                value={recurrence}
                onChange={(e) => setRecurrence(e.target.value)}
              >
                <option value="">Does not repeat</option>
                <option value="WEEKLY">Weekly</option>
                <option value="DAILY">Daily</option>
                <option value="MONTHLY">Monthly</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="c-location">Where</Label>
            <Input
              id="c-location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="A venue, a city, or blank for online"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="c-url">Join link</Label>
            <Input
              id="c-url"
              value={meetingUrl}
              onChange={(e) => setMeetingUrl(e.target.value)}
              placeholder="https://…"
            />
          </div>

          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            Published dated items are mirrored to the group&rsquo;s Nextcloud
            calendar, so members can subscribe from a phone.
          </p>
        </>
      )}

      <div className="flex justify-end gap-2">
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

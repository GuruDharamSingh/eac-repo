"use client";

import * as React from "react";
import { buildComposeCatalogue, type ComposeOption } from "../../compose/catalogue";
import { ContentComposer } from "../../compose/ContentComposer";
import {
  emptyContentAnswers,
  type ContentFieldContext,
  type ContentKind,
  type ContentTier,
} from "../../compose/content-fields";
import type { SurfaceAction, SurfaceDescriptor, SurfaceIdentity, SurfaceThread } from "../types";
import { SCHEDULED_KINDS } from "../types";
import { useLayer, useSurface } from "../context";
import { asSurfaceKind, kindMeta } from "../kinds";
import { SurfaceCard } from "../SurfaceCard";
import { SurfaceFrame, SurfaceSkeleton } from "../SurfaceShell";
import { fmtDate, toDatetimeLocal } from "../format";

// ============================================================================
// Making something, in a popup.
//
// Two panes. Without a kind, the CATALOGUE: what this org can make, derived
// from what it has (feeds, meetings, workshops) by buildComposeCatalogue —
// never a hardcoded list. With a kind, the FORM: ContentComposer's field list
// at one of two tiers. "quick" is the calendar day's "+ add" — title, time,
// place, page — and "More options" opens the rest without losing what was
// typed. Same fields, one filter, so the two cannot drift.
//
// Publishing REPLACES this layer with the thread's own surface. The author
// sees what they made, where a reader will see it, with Edit one click away.
// ============================================================================

type Descriptor = Extract<SurfaceDescriptor, { type: "compose" }>;

export function ComposeSurface({ descriptor }: { descriptor: Descriptor }) {
  if (!descriptor.kind) return <CataloguePane />;
  return <FormPane descriptor={descriptor} />;
}

// ── the catalogue ──────────────────────────────────────────────────────────

function CataloguePane() {
  const { connectors, push } = useSurface();
  const options = React.useMemo(
    () => (connectors.compose ? buildComposeCatalogue(connectors.compose) : []),
    [connectors.compose]
  );

  const usable = options.filter((o) => {
    if (o.mode === "route") return Boolean(o.href);
    if (o.writes.table === "threads") return Boolean(connectors.saveThread);
    // Questionnaires and polls need a host-supplied surface (their save path
    // is per app). Offer them only when the host registered one.
    return Boolean(connectors.custom?.[`compose:${o.id}`]);
  });

  return (
    <SurfaceFrame kind="compose" title="Compose" kicker="What are you making?">
      {usable.length === 0 ? (
        <p className="eac-surface-empty">There is nothing to compose here yet.</p>
      ) : (
        <ul className="eac-options">
          {usable.map((option) => (
            <li key={option.id}>
              <SurfaceCard
                small
                kind={option.writes.kind}
                glyph={option.icon}
                kicker={null}
                title={option.title}
                blurb={option.blurb}
                cue={option.mode === "route" ? "→" : "+"}
                href={option.mode === "route" ? option.href : undefined}
                onClick={
                  option.mode === "route"
                    ? undefined
                    : () => pushFor(option, push, Boolean(connectors.custom?.[`compose:${option.id}`]))
                }
              />
            </li>
          ))}
        </ul>
      )}
    </SurfaceFrame>
  );
}

function pushFor(
  option: ComposeOption,
  push: (d: SurfaceDescriptor) => void,
  hasCustom: boolean
) {
  if (option.writes.table === "threads") {
    if (option.surface === "writing") push({ type: "write", kind: "post" });
    else push({ type: "compose", kind: option.writes.kind, tier: "full" });
  } else if (hasCustom) {
    push({
      type: "custom",
      key: `compose:${option.id}`,
      title: option.title,
      kind: asSurfaceKind(option.id),
    });
  }
}

// ── the form ───────────────────────────────────────────────────────────────

function FormPane({ descriptor }: { descriptor: Descriptor }) {
  const { connectors, replace, pop } = useSurface();
  const layer = useLayer();
  const fmt = { timeZone: connectors.timeZone, locale: connectors.locale };

  const kind = descriptor.kind as ContentKind;
  const editing = Boolean(descriptor.threadId);
  const fieldContext = React.useMemo<ContentFieldContext>(
    () => ({
      feeds: connectors.compose?.feeds,
      canShareToNetwork: connectors.compose?.canShareToNetwork,
      canCreateDocument: connectors.compose?.canCreateDocument,
      canCreateTalkRoom: connectors.compose?.canCreateTalkRoom,
    }),
    [connectors.compose]
  );

  const [tier, setTier] = React.useState<ContentTier>(
    descriptor.tier ?? (descriptor.prefill && !editing ? "quick" : "full")
  );
  const [answers, setAnswers] = React.useState<Record<string, unknown>>(() => ({
    ...emptyContentAnswers(kind, fieldContext),
    ...(descriptor.prefill ?? {}),
  }));
  const [original, setOriginal] = React.useState<SurfaceThread | null>(null);
  const [loading, setLoading] = React.useState(editing);
  const [saving, setSaving] = React.useState<false | "draft" | "published">(false);
  const [error, setError] = React.useState<string | null>(null);
  // Which name signs this. Null is the viewer's own, which is what every
  // caller that predates pen names supplies by saying nothing.
  const [actingAs, setActingAs] = React.useState<string | null>(descriptor.actingAs ?? null);
  const [bylines, setBylines] = React.useState<SurfaceIdentity[]>([]);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string[] | undefined>>();

  // Editing: the record becomes the starting answers.
  React.useEffect(() => {
    if (!descriptor.threadId) return;
    let cancelled = false;
    (async () => {
      const thread = await connectors.loadThread(descriptor.threadId!).catch(() => null);
      if (cancelled) return;
      if (thread) {
        setOriginal(thread);
        const map = connectors.threadToAnswers ?? defaultThreadToAnswers;
        setAnswers({ ...emptyContentAnswers(kind, fieldContext), ...map(thread, fmt) });
      } else {
        setError("Could not load it to edit.");
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [descriptor.threadId]);

  React.useEffect(() => {
    layer.setMeta({
      title: editing
        ? original
          ? `Edit: ${original.title}`
          : "Edit"
        : `New ${kindMeta(kind).label.toLowerCase()}`,
      kind,
      size: tier === "quick" ? "compact" : "standard",
    });
  }, [layer, editing, original, kind, tier]);

  function validate(): Record<string, string[]> | null {
    const errors: Record<string, string[]> = {};
    if (!String(answers.title ?? "").trim()) errors.title = ["Give it a title"];
    if (SCHEDULED_KINDS.has(kind) && !String(answers.scheduled_at ?? "").trim()) {
      errors.scheduled_at = ["Pick a date and time"];
    }
    if (fieldContext.feeds?.length && !String(answers.feed_slug ?? "").trim()) {
      errors.feed_slug = ["Choose which page this goes on"];
    }
    return Object.keys(errors).length ? errors : null;
  }

  // The byline choice is offered only where it is meaningful: the host has
  // wired identities, and this is a NEW thread. Re-signing something already
  // published would rewrite history under a different name, which is a
  // different act from choosing how to sign what you are writing now.
  const offersBylines = Boolean(connectors.identities) && !descriptor.threadId;
  React.useEffect(() => {
    if (!offersBylines) return;
    let live = true;
    void connectors
      .identities!.list()
      .then((rows) => {
        if (live) setBylines(rows.filter((r) => !r.retiredAt));
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [connectors.identities, offersBylines]);

  async function save(status: "draft" | "published") {
    if (!connectors.saveThread) return;
    setError(null);
    const invalid = validate();
    if (invalid) {
      setFieldErrors(invalid);
      // A quick form cannot show an error on a field it hides.
      if (tier === "quick" && Object.keys(invalid).some((k) => !QUICK_KEYS.has(k))) setTier("full");
      return;
    }
    setFieldErrors(undefined);
    setSaving(status);
    const result = await connectors.saveThread({
      kind,
      answers,
      status,
      threadId: descriptor.threadId,
      actingAs,
    });
    setSaving(false);

    // `=== false` rather than `!result.ok`: the apps compile without
    // strictNullChecks, where truthiness does not discriminate the union.
    if (result.ok === false) {
      setError(result.error);
      if (result.fieldErrors) {
        setFieldErrors(result.fieldErrors);
        if (tier === "quick") setTier("full");
      }
      return;
    }

    connectors.onMutated?.();
    // Show what was made, in its own surface, with Edit one click away.
    replace({
      type: "thread",
      id: result.id,
      preview: {
        title: String(answers.title ?? ""),
        kind,
        scheduledAt: typeof answers.scheduled_at === "string" ? answers.scheduled_at : null,
        coverImageUrl: typeof answers.cover_image_url === "string" ? answers.cover_image_url : null,
      },
    });
  }

  const canSave = Boolean(connectors.saveThread) && !loading;
  const actions: SurfaceAction[] = [
    // Writing has a bigger room one step in: same row, same answers, a
    // preview of the finished page beside them. Not a different kind.
    ...(kind === "post"
      ? [
          {
            label: "Writing room",
            quiet: true,
            onClick: () =>
              replace({ type: "write", kind: "post", threadId: descriptor.threadId, prefill: answers }),
          } satisfies SurfaceAction,
        ]
      : []),
    { label: "Cancel", quiet: true, onClick: pop, disabled: Boolean(saving) },
    {
      label: saving === "draft" ? "Saving…" : "Save draft",
      onClick: () => save("draft"),
      disabled: !canSave || Boolean(saving),
    },
    {
      label: saving === "published" ? "Publishing…" : editing ? "Save & publish" : "Publish",
      primary: true,
      onClick: () => save("published"),
      disabled: !canSave || Boolean(saving),
    },
  ];

  const prefillDate =
    !editing && typeof descriptor.prefill?.scheduled_at === "string"
      ? descriptor.prefill.scheduled_at
      : null;

  return (
    <SurfaceFrame
      kind={kind}
      title={editing ? (original ? `Edit: ${original.title}` : "Edit") : `New ${kindMeta(kind).label.toLowerCase()}`}
      kicker={tier === "quick" ? "Quick add" : kindMeta(kind).label}
      actions={actions}
      status={
        !connectors.saveThread
          ? "This app cannot save from here"
          : error ?? (tier === "quick" ? "Title, time and place — the rest can wait" : null)
      }
      statusTone={error ? "error" : "normal"}
    >
      {loading ? (
        <SurfaceSkeleton />
      ) : (
        <>
          {prefillDate && (
            <p className="eac-compose-prefill">
              <span aria-hidden>▦</span> Adding to {fmtDate(prefillDate, {})}
            </p>
          )}

          {/* The byline sits ABOVE the fields, not in the foot beside Save.
              Which name signs a piece changes how it is written, so it is a
              decision to make before typing rather than a switch to find
              afterwards. Drawn only when there is a real choice — one name is
              not a choice, and a select showing it would imply otherwise. */}
          {bylines.length > 1 && (
            <div className="eac-compose-byline">
              <label className="eac-compose-byline-label" htmlFor="eac-compose-byline">
                Signed
              </label>
              <select
                id="eac-compose-byline"
                className="eac-compose-byline-select"
                value={actingAs ?? ""}
                onChange={(e) => setActingAs(e.target.value || null)}
              >
                {bylines.map((identity) => (
                  <option
                    key={identity.id}
                    value={identity.relation === "self" ? "" : identity.id}
                  >
                    {identity.displayName}
                    {identity.relation === "organization" ? " (organisation)" : ""}
                  </option>
                ))}
              </select>
            </div>
          )}

          <ContentComposer
            kind={kind}
            context={fieldContext}
            tier={tier}
            answers={answers}
            onChange={setAnswers}
            fieldErrors={fieldErrors}
            slots={connectors.composeSlots}
          />

          {tier === "quick" && (
            <div className="eac-compose-tier">
              <button type="button" onClick={() => setTier("full")}>
                More options — description, cover image, attendance, visibility
              </button>
            </div>
          )}
        </>
      )}
    </SurfaceFrame>
  );
}

const QUICK_KEYS = new Set(["title", "scheduled_at", "duration_minutes", "format", "location", "feed_slug", "price"]);

/**
 * Shared columns → compose answers. Hosts with extra fields (recurrence, RSVP
 * deadlines) wrap this and add theirs via `connectors.threadToAnswers`.
 */
export function defaultThreadToAnswers(
  t: SurfaceThread,
  fmt: { timeZone?: string } = {}
): Record<string, unknown> {
  return {
    title: t.title,
    excerpt: t.excerpt ?? "",
    body: t.bodyHtml ?? "",
    cover_image_url: t.coverImageUrl ?? "",
    scheduled_at: t.scheduledAt ? toDatetimeLocal(new Date(t.scheduledAt), fmt) : "",
    time_zone: (t.extra?.time_zone as string | undefined) ?? fmt.timeZone ?? "",
    duration_minutes: t.durationMinutes ?? undefined,
    format: t.format ?? "in_person",
    location: t.location ?? "",
    meeting_url: t.meetingUrl ?? "",
    is_rsvp_enabled: t.isRsvpEnabled,
    attendee_limit: t.attendeeLimit ?? undefined,
    feed_slug: t.feed?.slug,
    visibility: t.visibility ?? "PUBLIC",
    price: t.price ?? undefined,
    currency: t.currency ?? "USD",
    recurrence_pattern: t.recurrencePattern ?? "NONE",
    recurrence_until: t.recurrenceUntil ? toDatetimeLocal(new Date(t.recurrenceUntil), fmt).slice(0, 10) : "",
    rsvp_deadline: t.rsvpDeadline ? toDatetimeLocal(new Date(t.rsvpDeadline), fmt) : "",
    min_attendees: (t.extra?.min_attendees as number | null | undefined) ?? undefined,
    notify_on_min_attendees: Boolean(t.extra?.notify_on_min_attendees),
    video_link: t.videoLink ?? "",
    // Workshop presentation and sessions ride in `extra`, keyed as the fields.
    ...(t.kind === "workshop" ? workshopExtras(t.extra ?? {}) : {}),
  };
}

function workshopExtras(x: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of ["subtitle", "discipline", "level", "banner_image_url", "banner_focal_y", "hero_media_url", "hero_text", "background_color", "sessions"]) {
    if (x[key] !== undefined) out[key] = x[key];
  }
  return out;
}

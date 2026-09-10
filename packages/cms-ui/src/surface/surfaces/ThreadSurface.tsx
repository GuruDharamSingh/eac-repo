"use client";

import * as React from "react";
import type { SurfaceAction, SurfaceDescriptor, SurfaceThread } from "../types";
import { SCHEDULED_KINDS } from "../types";
import { useLayer, useSurface } from "../context";
import { asSurfaceKind, kindMeta } from "../kinds";
import { SurfaceFrame, SurfaceSkeleton } from "../SurfaceShell";
import { threadViewParts } from "../ThreadView";
import { buildIcs, icsDataUrl } from "../ics";

// ============================================================================
// A thread, expanded.
//
// One surface for every kind, because `threads` is one table: a meeting and a
// piece of writing differ in which columns are filled, and this reads the ones
// that are. Scheduled kinds get a rail of facts (when, where, who is coming)
// beside the description; writing gets the description alone, set as prose;
// priced kinds add the price and the sessions.
//
// The masthead paints from the face's preview at once. The record arrives
// through `connectors.loadThread` and fills in beneath it.
// ============================================================================

type Descriptor = Extract<SurfaceDescriptor, { type: "thread" }>;

export function ThreadSurface({ descriptor }: { descriptor: Descriptor }) {
  const { connectors, push } = useSurface();
  const layer = useLayer();
  const fmt = { timeZone: connectors.timeZone, locale: connectors.locale };

  const [thread, setThread] = React.useState<SurfaceThread | null>(null);
  const [state, setState] = React.useState<"loading" | "ready" | "missing" | "error">("loading");
  const [notice, setNotice] = React.useState<string | null>(null);
  const [noticeTone, setNoticeTone] = React.useState<"normal" | "error">("normal");

  const load = React.useCallback(async () => {
    setState("loading");
    try {
      const result = await connectors.loadThread(descriptor.id);
      if (!result) {
        setState("missing");
        return;
      }
      setThread(result);
      setState("ready");
    } catch {
      setState("error");
    }
  }, [connectors, descriptor.id]);

  React.useEffect(() => {
    void load();
  }, [load]);

  React.useEffect(() => {
    if (!thread) return;
    layer.setMeta({
      title: thread.title,
      kind: asSurfaceKind(thread.kind),
      size: kindMeta(thread.kind).size,
    });
  }, [thread, layer]);

  const preview = descriptor.preview;
  const kind = thread?.kind ?? preview?.kind ?? "neutral";
  const meta = kindMeta(kind);
  const scheduled = SCHEDULED_KINDS.has(kind);

  // ── loading / missing ────────────────────────────────────────────────────

  if (state !== "ready" || !thread) {
    const kicker = [meta.label, preview?.feedName].filter(Boolean).join(" · ");
    return (
      <SurfaceFrame kind={kind} title={preview?.title} kicker={kicker || undefined}>
        {state === "loading" && (
          <>
            {preview?.coverImageUrl && (
              <img className="eac-surface-cover" src={preview.coverImageUrl} alt="" />
            )}
            <SurfaceSkeleton block={!preview?.coverImageUrl} />
          </>
        )}
        {state === "missing" && (
          <p className="eac-surface-empty">This is no longer here, or you cannot see it.</p>
        )}
        {state === "error" && (
          <p className="eac-surface-empty">
            Could not load it.{" "}
            <button type="button" className="eac-btn eac-btn--quiet" onClick={() => void load()}>
              Try again
            </button>
          </p>
        )}
      </SurfaceFrame>
    );
  }

  // ── ready ────────────────────────────────────────────────────────────────

  const when = thread.nextOccurrenceAt ?? thread.scheduledAt;
  const cancelled = thread.cycleStatus === "cancelled";
  const canEdit = connectors.viewer.canEdit
    ? connectors.viewer.canEdit(thread)
    : connectors.viewer.canCompose;

  const joinUrl =
    thread.meetingUrl ??
    (thread.talkToken && connectors.talkBaseUrl
      ? `${connectors.talkBaseUrl.replace(/\/$/, "")}/call/${thread.talkToken}`
      : null);

  const atCapacity =
    thread.attendeeLimit !== null && thread.rsvpCount >= thread.attendeeLimit && !thread.viewerAttending;
  const deadlinePassed = thread.rsvpDeadline ? new Date(thread.rsvpDeadline) < new Date() : false;

  async function toggleRsvp() {
    if (!connectors.rsvp || !thread) return;
    setNotice(null);
    const going = !thread.viewerAttending;
    const result = await connectors.rsvp(thread, going);
    if (result.ok === false) {
      setNotice(result.error);
      setNoticeTone("error");
      return;
    }
    setThread({
      ...thread,
      viewerAttending: result.attending,
      rsvpCount:
        result.count ??
        Math.max(0, thread.rsvpCount + (result.attending ? 1 : -1) * (result.attending !== !!thread.viewerAttending ? 1 : 0)),
    });
    setNoticeTone("normal");
    setNotice(result.attending ? "You're on the list." : "You're no longer marked as coming.");
    connectors.onMutated?.();
  }

  // ── actions ──────────────────────────────────────────────────────────────

  const actions: SurfaceAction[] = [];

  if (canEdit) {
    actions.push({
      label: "Edit",
      quiet: true,
      // Writing is edited in the writing room; everything else in the form.
      onClick: () =>
        push(
          thread.kind === "post"
            ? { type: "write", kind: "post", threadId: thread.id }
            : { type: "compose", kind: thread.kind, threadId: thread.id }
        ),
    });
  }

  if (thread.href) {
    actions.push({ label: "Open page", quiet: true, href: thread.href });
  }

  if (scheduled && when) {
    const ics = buildIcs(thread, typeof window !== "undefined" ? window.location.origin : undefined);
    if (ics) {
      actions.push({
        label: "Add to my calendar",
        quiet: true,
        href: icsDataUrl(ics),
        download: `${thread.slug || thread.id}.ics`,
      });
    }
  }

  for (const extra of connectors.threadActions?.(thread, { refresh: () => void load() }) ?? []) {
    actions.push(extra);
  }

  if (joinUrl) {
    actions.push({ label: "Join", href: joinUrl, external: true });
  }

  if (scheduled && thread.isRsvpEnabled && connectors.rsvp && connectors.viewer.signedIn) {
    actions.push(
      thread.viewerAttending
        ? { label: "You're coming ✓", done: true, onClick: toggleRsvp }
        : {
            label: "I'm coming",
            primary: true,
            onClick: toggleRsvp,
            disabled: cancelled || atCapacity || deadlinePassed,
          }
    );
  }

  // Exactly one filled button. If nothing claimed it, the strongest link does.
  if (!actions.some((a) => a.primary || a.done)) {
    const strongest = actions.find((a) => a.label === "Join") ?? actions.find((a) => a.label === "Open page");
    if (strongest) {
      strongest.primary = true;
      strongest.quiet = false;
    }
  }

  // ── status line ──────────────────────────────────────────────────────────

  let status: React.ReactNode = notice;
  if (!status) {
    if (cancelled) status = "Cancelled this cycle";
    else if (scheduled && thread.isRsvpEnabled) {
      if (atCapacity) status = "At capacity";
      else if (deadlinePassed) status = "RSVPs have closed";
      else if (!connectors.viewer.signedIn) status = "Sign in to say you're coming";
      else status = `${thread.rsvpCount} coming`;
    } else if (thread.status && thread.status !== "published") {
      status = thread.status === "draft" ? "Draft — not yet published" : "Archived";
    }
  }

  // ── body: shared with the page ───────────────────────────────────────────
  const parts = threadViewParts(thread, fmt);

  return (
    <SurfaceFrame
      kind={kind}
      title={thread.title}
      kicker={parts.kicker}
      rail={parts.rail}
      actions={actions}
      status={status}
      statusTone={noticeTone}
    >
      {parts.main}
    </SurfaceFrame>
  );
}

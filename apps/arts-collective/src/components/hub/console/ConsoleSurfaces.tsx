"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { SurfaceFrame, SurfaceSection } from "@elkdonis/cms-ui/surface";
import { publishDraftAction } from "@/lib/cms/draft-actions";
import type { ConsoleState, ConsolePerson } from "@/lib/org-console";

/**
 * The detail behind each band.
 *
 * Every one of these opens from a band that already showed its count, so the
 * surface's job is to turn a number into a list of specific things with a way
 * to act on each. They render from state the page already loaded — a band that
 * says "3" opens instantly on those three rather than showing a spinner to
 * fetch what the number was derived from.
 *
 * Nothing here is a settings form; configuration lives in ConsoleSettings.
 */

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function fmtWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-6 text-center text-sm text-muted-foreground">{children}</p>;
}

/** One item in a surface's list. */
function Row({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex w-full flex-col gap-1 border-b border-border/60 py-3 text-left last:border-b-0">
      {children}
    </div>
  );
}

// ─── Drafts ──────────────────────────────────────────────────────────────────

function DraftRow({ draft, orgHomeUrl }: { draft: ConsoleState["drafts"]["recent"][number]; orgHomeUrl: string }) {
  const router = useRouter();
  const [state, setState] = React.useState<"idle" | "working" | "done">("idle");
  const [error, setError] = React.useState<string | null>(null);
  const [slug, setSlug] = React.useState<string | null>(null);

  async function publish() {
    setState("working");
    setError(null);
    const result = await publishDraftAction(draft.id);
    if (result.ok) {
      setSlug(result.slug);
      setState("done");
      // The bands are server-rendered from these same counts, so the page
      // behind the surface must re-read or "Unfinished" keeps its old number.
      router.refresh();
    } else {
      setError(result.error);
      setState("idle");
    }
  }

  return (
    <Row>
      <span className="text-xs uppercase tracking-wider text-muted-foreground">
        {draft.kind} · last touched {fmtDate(draft.updatedAt)}
      </span>
      <span className="font-serif text-base leading-snug text-foreground">
        {draft.title || "Untitled"}
      </span>
      <span className="mt-1 flex flex-wrap items-center gap-3">
        {state === "done" && slug ? (
          <a
            href={`${orgHomeUrl}/${slug}`}
            target="_blank"
            rel="noopener"
            className="text-xs text-primary underline underline-offset-4"
          >
            Published — see it ↗
          </a>
        ) : (
          <button
            type="button"
            onClick={publish}
            disabled={state === "working"}
            className="rounded-md border border-border bg-background px-2.5 py-1 text-xs hover:bg-accent disabled:opacity-50"
          >
            {state === "working" ? "Publishing…" : "Publish"}
          </button>
        )}
        {error && <span className="text-xs text-destructive">{error}</span>}
      </span>
    </Row>
  );
}

export function DraftsSurface({
  state,
  orgHomeUrl,
}: {
  state: ConsoleState;
  orgHomeUrl: string;
}) {
  const { count, recent } = state.drafts;

  return (
    <SurfaceFrame
      kind="post"
      title="Unfinished"
      kicker={`${count} ${count === 1 ? "draft" : "drafts"}`}
    >
      <SurfaceSection>
        {recent.length === 0 ? (
          <Empty>Nothing unfinished. Everything written here is published.</Empty>
        ) : (
          <div>
            {recent.map((d) => (
              <DraftRow key={d.id} draft={d} orgHomeUrl={orgHomeUrl} />
            ))}
            {count > recent.length && (
              <p className="pt-3 text-xs text-muted-foreground">
                Showing {recent.length} of {count}, most recently touched first.
              </p>
            )}
          </div>
        )}
      </SurfaceSection>
    </SurfaceFrame>
  );
}

// ─── Schedule ────────────────────────────────────────────────────────────────

export function ScheduleSurface({ state }: { state: ConsoleState }) {
  const { items, rsvpTotal } = state.upcoming;

  return (
    <SurfaceFrame
      kind="calendar"
      title="Coming up"
      kicker={`${rsvpTotal} ${rsvpTotal === 1 ? "RSVP" : "RSVPs"} across ${items.length} ${items.length === 1 ? "date" : "dates"}`}
    >
      <SurfaceSection>
        {items.length === 0 ? (
          <Empty>Nothing scheduled ahead. Events, meetings and workshops appear here.</Empty>
        ) : (
          <div>
            {items.map((i) => {
              // Two things an owner needs at a glance and nowhere else shows:
              // whether a minimum is unmet, and whether a cap is nearly full.
              const short = i.minAttendees !== null && i.rsvpCount < i.minAttendees;
              const full = i.attendeeLimit !== null && i.rsvpCount >= i.attendeeLimit;
              return (
                <Row key={i.id}>
                  <span className="text-xs uppercase tracking-wider text-muted-foreground">
                    {i.kind} · {fmtWhen(i.scheduledAt)}
                  </span>
                  <span className="font-serif text-base leading-snug text-foreground">
                    {i.title}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {i.rsvpCount} going
                    {i.attendeeLimit !== null && ` of ${i.attendeeLimit}`}
                    {short && (
                      <span className="text-primary">
                        {" "}
                        · {i.minAttendees! - i.rsvpCount} short of the minimum
                      </span>
                    )}
                    {full && <span className="text-primary"> · full</span>}
                  </span>
                </Row>
              );
            })}
          </div>
        )}
      </SurfaceSection>
    </SurfaceFrame>
  );
}

// ─── Responses ───────────────────────────────────────────────────────────────

export function ResponsesSurface({ state }: { state: ConsoleState }) {
  const { count, recent } = state.responses;

  return (
    <SurfaceFrame
      kind="questionnaire"
      title="Waiting on you"
      kicker={`${count} submitted, unread`}
    >
      <SurfaceSection>
        {recent.length === 0 ? (
          <Empty>
            No unread answers. When a member submits a questionnaire or poll, it
            waits here.
          </Empty>
        ) : (
          <div>
            {recent.map((r) => (
              <Row key={r.id}>
                <span className="text-xs uppercase tracking-wider text-muted-foreground">
                  {r.questionnaireTitle} · {fmtDate(r.submittedAt)}
                </span>
                <span className="font-serif text-base leading-snug text-foreground">
                  {r.respondent}
                </span>
              </Row>
            ))}
          </div>
        )}
      </SurfaceSection>
    </SurfaceFrame>
  );
}

// ─── People ──────────────────────────────────────────────────────────────────

function ConnectionDot({ on, label }: { on: boolean; label: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 text-xs text-muted-foreground"
      title={on ? `${label}: connected` : `${label}: not set up`}
    >
      <span
        aria-hidden
        className={`inline-block h-1.5 w-1.5 rounded-full ${
          on ? "bg-primary" : "bg-border"
        }`}
      />
      {label}
      <span className="sr-only">{on ? " connected" : " not set up"}</span>
    </span>
  );
}

function PersonRow({ p }: { p: ConsolePerson }) {
  return (
    <Row>
      <span className="flex flex-wrap items-baseline gap-2">
        <span className="font-serif text-base leading-snug text-foreground">
          {p.displayName}
        </span>
        <span className="rounded border border-border px-1.5 py-0.5 text-[11px] uppercase tracking-wider text-muted-foreground">
          {p.role}
        </span>
      </span>
      <span className="text-xs text-muted-foreground">{p.email}</span>
      <span className="mt-1 flex flex-wrap gap-3">
        <ConnectionDot on={p.hasNextcloud} label="Nextcloud" />
        <ConnectionDot
          on={p.stripeOnboarded}
          label={p.hasStripe && !p.stripeOnboarded ? "Stripe (part-way)" : "Stripe"}
        />
        <span className="text-xs text-muted-foreground">joined {fmtDate(p.joinedAt)}</span>
      </span>
    </Row>
  );
}

export function PeopleSurface({
  state,
  orgSlug,
}: {
  state: ConsoleState;
  orgSlug: string;
}) {
  const { total, byRole, all, recent, waiting } = state.people;
  // Recent joiners if there are any, otherwise the whole roster — a section
  // headed "Everyone" that lists nobody because nobody joined this month is
  // the empty state of the wrong question.
  const listed = recent.length ? recent : all;
  const roles = Object.entries(byRole).sort((a, b) => b[1] - a[1]);

  return (
    <SurfaceFrame
      kind="neutral"
      title="People"
      kicker={roles.map(([role, n]) => `${n} ${role}`).join(" · ") || `${total} members`}
      actions={[
        {
          label: "Roles & removal",
          href: `/hub/organization?org=${encodeURIComponent(orgSlug)}&settings=people`,
        },
      ]}
    >
      {waiting.length > 0 && (
        <SurfaceSection title="No role yet">
          <p className="mb-2 text-sm text-muted-foreground">
            These people have an account with {orgSlug} but sit on{" "}
            <code>viewer</code> — they can read, not take part.
          </p>
          {waiting.map((p) => (
            <PersonRow key={p.userId} p={p} />
          ))}
        </SurfaceSection>
      )}

      <SurfaceSection title={recent.length ? "Joined recently" : "Everyone"}>
        {listed.length === 0 ? (
          <Empty>Nobody belongs to this organisation yet.</Empty>
        ) : (
          listed.map((p) => <PersonRow key={p.userId} p={p} />)
        )}
      </SurfaceSection>
    </SurfaceFrame>
  );
}

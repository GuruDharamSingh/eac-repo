"use client";

import * as React from "react";
import Link from "next/link";
import {
  ForumFace,
  SurfaceProvider,
  useSurfaceOptional,
  type SurfaceConnectors,
  type SurfaceEvent,
  type SurfaceForum,
  type SurfaceImage,
} from "@elkdonis/cms-ui/surface";
import { GalleryFace, StandingMeetingFace, type HubStandingMeeting } from "@elkdonis/cms-ui/hub";
import { HubCalendar } from "@elkdonis/cms-ui/hubsite";
import { ThreadCard } from "@/components/thread-card";
import { SignupCard } from "@/components/signup-card";
import type { Thread } from "@/lib/types";
import { TIME_ZONE, toDate } from "./shared";

// ============================================================================
// The browser halves of the data blocks.
//
// Kept in one "use client" file apart from the declarations in data-blocks.ts:
// a module marked "use client" turns its exports into client references, so a
// declaration living here would have `def.props` undefined on the server and
// break every page that imports the catalogue.
//
// Every face below calls useSurface(), which throws outside a SurfaceProvider.
// On the published page the root layout supplies one (HubSurfaces). Puck draws
// the canvas in an iframe that is still inside this React tree for the
// component but is a different document, and the editor route sits outside the
// layout's provider in practice, so `EnsureSurface` adds a bare one only when
// none is present. A face clicked in the editor then opens an empty popup
// rather than crashing the canvas.
// ============================================================================

const NO_CONNECTORS: SurfaceConnectors = {
  viewer: { signedIn: false, canCompose: false },
  loadThread: async () => null,
};

function EnsureSurface({ children }: { children: React.ReactNode }) {
  const existing = useSurfaceOptional();
  if (existing) return <>{children}</>;
  return (
    <SurfaceProvider connectors={NO_CONNECTORS} syncUrl={false}>
      {children}
    </SurfaceProvider>
  );
}

function Heading({ text, rule = false }: { text?: string; rule?: boolean }) {
  if (!text) return null;
  return (
    <>
      <h2 className="mb-4 font-serif text-2xl">{text}</h2>
      {rule ? <hr className="saffron-divider max-w-[12rem]" /> : null}
    </>
  );
}

// ── next gathering ──────────────────────────────────────────────────────────

export function StandingView({
  standing,
  canEdit,
  tall = true,
}: {
  standing?: (Omit<HubStandingMeeting, "at"> & { at: string | Date }) | null;
  canEdit?: boolean;
  tall?: boolean;
}) {
  const at = standing ? toDate(standing.at) : null;
  const value = standing && at ? ({ ...standing, at } as HubStandingMeeting) : null;
  return (
    <EnsureSurface>
      {/* `landing-standing` (globals.css) is what makes the face taller and
          takes the air out from around it; the face is shared, so the height
          belongs to the page rather than to every site that draws it. */}
      <div className={tall ? "landing-standing" : undefined}>
        <StandingMeetingFace standing={value} canEdit={Boolean(canEdit)} timeZone={TIME_ZONE} />
      </div>
    </EnsureSurface>
  );
}

// ── calendar ────────────────────────────────────────────────────────────────

export function CalendarView({ events }: { events?: SurfaceEvent[] }) {
  const list = events ?? [];
  return (
    <EnsureSurface>
      {/* HubCalendar keeps its events in state seeded once; a new list (the
          editor's resolver landing) has to remount it. */}
      <HubCalendar key={list.map((e) => e.id).join(",")} initialEvents={list} />
    </EnsureSurface>
  );
}

// ── threads: cards or a plain list ──────────────────────────────────────────

type WireThread = Record<string, unknown>;

function reviveThread(t: WireThread): Thread {
  return {
    ...t,
    scheduledAt: toDate(t.scheduledAt),
    rsvpDeadline: toDate(t.rsvpDeadline),
    recurrenceUntil: toDate(t.recurrenceUntil),
    publishedAt: toDate(t.publishedAt),
    createdAt: toDate(t.createdAt) ?? new Date(0),
    nextOccurrenceAt: toDate(t.nextOccurrenceAt),
  } as unknown as Thread;
}

export function ThreadsView({
  threads,
  heading,
  intro,
  rule = true,
  layout = "cards",
  cardLabel = "",
  emptyMessage = "Nothing here yet.",
  canEdit = false,
}: {
  threads?: WireThread[];
  heading?: string;
  intro?: string;
  rule?: boolean;
  layout?: string;
  cardLabel?: string;
  emptyMessage?: string;
  canEdit?: boolean;
}) {
  const rows = (threads ?? []).map(reviveThread);
  return (
    <EnsureSurface>
      {/* pb-6 on top of the column's own gap: two of these stacked in one
          column were 2.5rem apart on the original landing page. */}
      <div className="pb-6">
        {heading ? <h2 className="font-serif text-2xl">{heading}</h2> : null}
        {intro ? <p className="mt-2 text-sm text-muted-foreground">{intro}</p> : null}
        {heading || intro ? rule ? <hr className="saffron-divider max-w-[12rem]" /> : <div className="h-4" /> : null}

        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {emptyMessage}{" "}
            {canEdit ? (
              <Link href="/manage" className="underline underline-offset-2">
                Add something from Manage.
              </Link>
            ) : null}
          </p>
        ) : layout === "list" ? (
          <ul className="divide-y divide-border/70 border-y border-border/70">
            {rows.map((t) => {
              // A thread with no section has no page on this site (see
              // lib/gather.ts), so those are not linked.
              const href = t.feedSlug ? `/${t.feedSlug}/${t.slug}` : null;
              const when = t.publishedAt ?? t.scheduledAt ?? t.createdAt;
              const body = (
                <>
                  <span className="block font-medium text-foreground">{t.title}</span>
                  {t.excerpt && (
                    <span className="mt-1 block line-clamp-2 text-sm text-muted-foreground">
                      {t.excerpt}
                    </span>
                  )}
                  {when && (
                    <span className="mt-1 block text-xs uppercase tracking-[0.12em] text-muted-foreground">
                      {when.toLocaleDateString("en-CA", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        timeZone: TIME_ZONE,
                      })}
                    </span>
                  )}
                </>
              );
              return (
                <li key={t.id} className="py-3">
                  {href ? (
                    <Link href={href} className="block hover:text-[hsl(var(--primary))]">
                      {body}
                    </Link>
                  ) : (
                    <div className="block">{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="space-y-4">
            {rows.map((t) => (
              <ThreadCard
                key={t.id}
                thread={t}
                feedName={cardLabel || undefined}
              />
            ))}
          </div>
        )}
      </div>
    </EnsureSurface>
  );
}

// ── sign up, or your membership ─────────────────────────────────────────────

export interface MemberData {
  name: string;
  headline: string | null;
  avatarUrl: string | null;
  role: string | null;
  isMember: boolean;
  rsvps: Array<{ id: string; title: string; slug: string; section: string | null; scheduledAt: string | null }>;
}

export function MemberView({
  me,
  orgName = "",
  showMembership = true,
}: {
  me?: MemberData | null;
  orgName?: string;
  showMembership?: boolean;
}) {
  if (!me) return <SignupCard />;

  const role = me.role;
  return (
    <div className="space-y-6">
      {/* Who you are. */}
      <div className="card-natural p-6">
        <div className="flex items-center gap-4">
          {me.avatarUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={me.avatarUrl} alt="" className="h-16 w-16 shrink-0 object-cover" />
          ) : (
            <div
              className="flex h-16 w-16 shrink-0 items-center justify-center bg-muted text-xl text-muted-foreground"
              aria-hidden
            >
              {me.name.trim().charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <h2 className="truncate font-serif text-xl font-semibold">{me.name}</h2>
            {me.headline && <p className="truncate text-sm text-muted-foreground">{me.headline}</p>}
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            href={me.isMember ? "/hub" : "/center"}
            className="border border-[hsl(var(--primary))]/50 bg-[hsl(var(--primary))]/15 px-4 py-2 text-sm font-medium text-[hsl(var(--primary))] transition-colors hover:bg-[hsl(var(--primary))]/25"
          >
            {me.isMember ? "Go to the hub" : "Go to your center"}
          </Link>
          <Link
            href="/account"
            className="border border-input bg-background px-4 py-2 text-sm text-foreground transition-colors hover:border-[hsl(var(--primary))]"
          >
            Account
          </Link>
        </div>
      </div>

      {showMembership ? (
        <div className="card-natural p-6">
          <h3 className="font-serif text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Your membership
          </h3>
          <p className="mt-3 text-sm leading-relaxed">
            {/* The role words are the visitor's, not the schema's: a `viewer`
                row means someone who follows the site (CENTER_PAGE_BRIEF
                decision 2). */}
            {role === "owner" || role === "guide" ? (
              <>
                You help run <strong>{orgName}</strong>.
              </>
            ) : role === "member" ? (
              <>
                You are a member of <strong>{orgName}</strong>.
              </>
            ) : role ? (
              <>
                You follow <strong>{orgName}</strong>. Members can post and join the hub — ask if you
                would like to be one.
              </>
            ) : (
              <>
                You are signed in, but not connected to <strong>{orgName}</strong> yet.
              </>
            )}
          </p>

          <h4 className="mt-6 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
            You&rsquo;re coming to
          </h4>
          {me.rsvps.length > 0 ? (
            <ul className="mt-2 space-y-2">
              {me.rsvps.map((r) => {
                const at = toDate(r.scheduledAt);
                return (
                  <li key={r.id} className="text-sm">
                    <Link
                      href={r.section ? `/${r.section}/${r.slug}` : "/gatherings"}
                      className="font-medium hover:text-[hsl(var(--primary))]"
                    >
                      {r.title}
                    </Link>
                    {at && (
                      <span className="block text-xs text-muted-foreground">
                        {at.toLocaleString("en-CA", {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                          timeZone: TIME_ZONE,
                        })}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              Nothing yet — RSVP from the calendar and it will appear here.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}

// ── forum ───────────────────────────────────────────────────────────────────

export function ForumView({ forum, heading = "Forum" }: { forum?: SurfaceForum | null; heading?: string }) {
  return (
    <EnsureSurface>
      <Heading text={heading} />
      <ForumFace forum={forum ?? null} href="/forum" />
    </EnsureSurface>
  );
}

// ── gallery ─────────────────────────────────────────────────────────────────

export function GalleryView({
  images,
  heading = "Gallery",
  autoAdvanceSeconds = 0,
}: {
  images?: SurfaceImage[];
  heading?: string;
  autoAdvanceSeconds?: number;
}) {
  const list = images ?? [];
  if (list.length === 0) return null;
  return (
    <EnsureSurface>
      <Heading text={heading} />
      <GalleryFace
        key={list.map((i) => i.url).join("|")}
        images={list}
        title={heading || "Gallery"}
        autoAdvanceMs={autoAdvanceSeconds > 0 ? autoAdvanceSeconds * 1000 : undefined}
      />
    </EnsureSurface>
  );
}


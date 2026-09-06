"use client";

import { useState } from "react";
import type { WorkshopSession } from "@elkdonis/services";

export type MaterialFile = {
  filename: string;
  size: number;
  mimeType: string;
};

/**
 * The workshop's session navigation — Overview plus one pane per session.
 *
 * Ported from inner-gathering's workshop-sections-nav, which was written
 * Mantine-free (plain elements + CSS classes) and so carried over to Tailwind
 * almost unchanged. The information architecture is deliberately identical:
 * a participant who knows one app's workshop knows the other's.
 *
 * Everything here is already behind the page's enrolment gate, so unlike
 * inner-gathering there is no per-widget locking — if you can read this, you
 * are in the workshop.
 */
export function WorkshopSessions({
  sessions,
  description,
  accessibilityNotes,
  authorNote,
  talkToken,
  materials,
  threadId,
}: {
  sessions: WorkshopSession[];
  description: string | null;
  accessibilityNotes: string | null;
  authorNote: string | null;
  talkToken: string | null;
  materials: MaterialFile[];
  threadId: string;
}) {
  const [active, setActive] = useState<string>("overview");

  const now = Date.now();
  const ordered = [...sessions].sort((a, b) => a.sessionNumber - b.sessionNumber);

  return (
    <div className="grid gap-6 md:grid-cols-[220px_1fr]">
      <nav className="flex gap-2 overflow-x-auto md:flex-col md:overflow-visible">
        <TabButton active={active === "overview"} onClick={() => setActive("overview")}>
          Overview
        </TabButton>
        {ordered.map((s) => {
          const past = s.scheduledAt ? new Date(s.scheduledAt).getTime() < now : false;
          return (
            <TabButton
              key={s.id}
              active={active === s.id}
              onClick={() => setActive(s.id)}
            >
              <span className="flex items-center gap-2">
                <span
                  aria-hidden
                  className={
                    past
                      ? "h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/50"
                      : "h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
                  }
                />
                <span className="truncate">
                  {s.sessionNumber}. {s.title || "Untitled session"}
                </span>
              </span>
            </TabButton>
          );
        })}
      </nav>

      <div className="min-w-0">
        {active === "overview" ? (
          <OverviewPane
            description={description}
            accessibilityNotes={accessibilityNotes}
            authorNote={authorNote}
            talkToken={talkToken}
            materials={materials}
            threadId={threadId}
            sessions={ordered}
          />
        ) : (
          (() => {
            const s = ordered.find((x) => x.id === active);
            return s ? <SessionPane session={s} talkToken={talkToken} /> : null;
          })()
        )}
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "true" : undefined}
      className={
        active
          ? "shrink-0 rounded-md border border-border bg-card px-3 py-2 text-left text-sm font-medium text-foreground"
          : "shrink-0 rounded-md px-3 py-2 text-left text-sm text-muted-foreground hover:bg-accent/50 hover:text-foreground"
      }
    >
      {children}
    </button>
  );
}

function TalkCard({ token, label }: { token: string; label: string }) {
  return (
    <a
      href={`/api/talk/join?token=${encodeURIComponent(token)}`}
      target="_blank"
      rel="noopener"
      className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-accent"
    >
      {label} →
    </a>
  );
}

function MaterialsList({
  materials,
  threadId,
}: {
  materials: MaterialFile[];
  threadId: string;
}) {
  if (materials.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No materials have been added yet.
      </p>
    );
  }
  return (
    <ul className="divide-y divide-border rounded-md border border-border">
      {materials.map((f) => (
        <li key={f.filename}>
          <a
            href={`/api/workshops/${threadId}/materials/${encodeURIComponent(f.filename)}`}
            className="flex items-center justify-between gap-3 px-4 py-3 text-sm hover:bg-accent/50"
          >
            <span className="truncate">{f.filename}</span>
            <span className="shrink-0 font-mono text-xs text-muted-foreground">
              {formatSize(f.size)}
            </span>
          </a>
        </li>
      ))}
    </ul>
  );
}

function formatSize(bytes: number): string {
  if (!bytes) return "";
  const units = ["B", "KB", "MB", "GB"];
  let n = bytes;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i += 1;
  }
  return `${n < 10 && i > 0 ? n.toFixed(1) : Math.round(n)} ${units[i]}`;
}

function OverviewPane({
  description,
  accessibilityNotes,
  authorNote,
  talkToken,
  materials,
  threadId,
  sessions,
}: {
  description: string | null;
  accessibilityNotes: string | null;
  authorNote: string | null;
  talkToken: string | null;
  materials: MaterialFile[];
  threadId: string;
  sessions: WorkshopSession[];
}) {
  return (
    <div className="space-y-8">
      {description && (
        <section>
          <h2 className="font-serif text-xl">About this workshop</h2>
          <div
            className="tiptap-content mt-3 leading-relaxed"
            // biome-ignore lint: sanitized on write
            dangerouslySetInnerHTML={{ __html: description }}
          />
        </section>
      )}

      {talkToken && (
        <section>
          <h2 className="font-serif text-xl">Meeting room</h2>
          <p className="mt-2 mb-3 text-sm text-muted-foreground">
            The workshop&apos;s shared video room — the same link every session.
          </p>
          <TalkCard token={talkToken} label="Join the room" />
        </section>
      )}

      {sessions.length > 0 && (
        <section>
          <h2 className="font-serif text-xl">Schedule</h2>
          <ul className="mt-3 divide-y divide-border rounded-md border border-border">
            {sessions.map((s) => (
              <li
                key={s.id}
                className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3"
              >
                <span className="text-sm">
                  {s.sessionNumber}. {s.title || "Untitled session"}
                </span>
                <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                  {s.scheduledAt
                    ? new Date(s.scheduledAt).toLocaleString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })
                    : "To be scheduled"}
                  {s.durationMinutes ? ` · ${s.durationMinutes} min` : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="font-serif text-xl">Materials</h2>
        <p className="mt-2 mb-3 text-sm text-muted-foreground">
          Shared files for everyone in the workshop.
        </p>
        <MaterialsList materials={materials} threadId={threadId} />
      </section>

      {authorNote && (
        <section className="rounded-md border border-border bg-accent/20 p-5">
          <h2 className="font-mono text-xs uppercase tracking-[0.22em] text-muted-foreground">
            From the guide
          </h2>
          <p className="mt-2 whitespace-pre-line text-sm leading-relaxed">{authorNote}</p>
        </section>
      )}

      {accessibilityNotes && (
        <section>
          <h2 className="font-mono text-xs uppercase tracking-[0.22em] text-muted-foreground">
            Accessibility
          </h2>
          <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
            {accessibilityNotes}
          </p>
        </section>
      )}
    </div>
  );
}

function SessionPane({
  session,
  talkToken,
}: {
  session: WorkshopSession;
  talkToken: string | null;
}) {
  const joinUrl = session.videoConferenceUrl?.trim();

  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted-foreground">
          Session {session.sessionNumber}
          {session.scheduledAt &&
            ` · ${new Date(session.scheduledAt).toLocaleString(undefined, {
              weekday: "long",
              month: "long",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}`}
        </p>
        <h2 className="mt-2 font-serif text-2xl">{session.title || "Untitled session"}</h2>
        {(session.location || session.isOnline) && (
          <p className="mt-1 text-sm text-muted-foreground">
            {session.isOnline ? "Online" : session.location || "In person"}
            {session.durationMinutes ? ` · ${session.durationMinutes} min` : ""}
          </p>
        )}
      </div>

      {session.mediaUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={session.mediaUrl}
          alt=""
          className="w-full rounded-md border border-border object-cover"
        />
      )}

      {session.videoUrl && (
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <video controls src={session.videoUrl} className="w-full rounded-md border border-border" />
      )}

      {session.description && (
        <div
          className="tiptap-content leading-relaxed"
          // biome-ignore lint: sanitized on write
          dangerouslySetInnerHTML={{ __html: session.description }}
        />
      )}

      {joinUrl ? (
        <a
          href={joinUrl}
          target="_blank"
          rel="noopener"
          className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-accent"
        >
          Join this session →
        </a>
      ) : talkToken ? (
        <TalkCard token={talkToken} label="Join the room" />
      ) : null}

      {session.resources.length > 0 && (
        <section>
          <h3 className="font-mono text-xs uppercase tracking-[0.22em] text-muted-foreground">
            Resources
          </h3>
          <ul className="mt-3 divide-y divide-border rounded-md border border-border">
            {session.resources.map((r) => (
              <li key={r.id}>
                <a
                  href={r.url}
                  target="_blank"
                  rel="noopener"
                  className="flex items-center justify-between gap-3 px-4 py-3 text-sm hover:bg-accent/50"
                >
                  <span className="min-w-0">
                    <span className="block truncate">{r.title}</span>
                    {r.description && (
                      <span className="block truncate text-xs text-muted-foreground">
                        {r.description}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 font-mono text-xs uppercase text-muted-foreground">
                    {r.type}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

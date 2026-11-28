"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { CalendarLink, CalendarWhich } from "@elkdonis/services/google-calendar";
import {
  chooseGoogleCalendarRuns,
  connectGoogleCalendar,
  disconnectGoogleCalendar,
  syncGoogleCalendarNow,
} from "@/lib/google-calendar-actions";
import { siteConfig } from "@/config/site";

export interface CalendarSyncProps {
  link: CalendarLink | null;
  /** Owners may send every run, not only their own. */
  isOwner: boolean;
  /** What Google's redirect reported, if the page was just reached from there. */
  notice?: { ok: boolean; text: string } | null;
}

// A fixed zone, so the server's rendering and the browser's agree.
const when = (iso: string) =>
  `${new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: siteConfig.timeZone }).format(new Date(iso))} Paris time`;

/** "Sync to Google Calendar" on the hub's Tours offered card (2026-11-26). */
export function CalendarSync({ link, isOwner, notice }: CalendarSyncProps) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<null | "connect" | "sync" | "which" | "remove">(null);
  const [error, setError] = React.useState<string | null>(notice && !notice.ok ? notice.text : null);
  const [which, setWhich] = React.useState<CalendarWhich>(link?.which ?? "mine");
  React.useEffect(() => setWhich(link?.which ?? "mine"), [link?.which]);

  const connected = link?.status === "connected";
  const waiting = connected && !link.lastSyncedAt && !link.error;
  // The first sync runs after the redirect from Google: look again until it is done.
  React.useEffect(() => {
    if (!waiting) return;
    const t = setInterval(() => router.refresh(), 5000);
    const stop = setTimeout(() => clearInterval(t), 90_000);
    return () => {
      clearInterval(t);
      clearTimeout(stop);
    };
  }, [waiting, router]);

  async function run(kind: NonNullable<typeof busy>, fn: () => Promise<{ ok: true } | { ok: false; error: string }>) {
    setBusy(kind);
    setError(null);
    try {
      const r = await fn();
      if (r.ok === false) setError(r.error);
    } catch {
      setError("Could not reach the server.");
    }
    setBusy(null);
    router.refresh();
  }

  async function connect() {
    setBusy("connect");
    setError(null);
    try {
      const r = await connectGoogleCalendar(which);
      if (r.ok === false) setError(r.error);
      else return window.location.assign(r.url);
    } catch {
      setError("Could not reach the server.");
    }
    setBusy(null);
  }

  const picker = isOwner ? (
    <label className="el-gcal-which">
      <span>Runs</span>
      <select
        value={which}
        disabled={busy !== null}
        onChange={(e) => {
          const next = e.target.value as CalendarWhich;
          setWhich(next);
          if (connected) void run("which", () => chooseGoogleCalendarRuns(next));
        }}
      >
        <option value="mine">Mine</option>
        <option value="all">Every run</option>
      </select>
    </label>
  ) : null;

  return (
    <div className="el-gcal">
      <div className="el-gcal-row">
        {connected ? (
          <>
            <button type="button" className="el-gcal-main" disabled={busy !== null} onClick={() => run("sync", syncGoogleCalendarNow)}>
              {busy === "sync" || busy === "which" ? "Syncing…" : "Sync now"}
            </button>
            {picker}
            <button
              type="button"
              className="el-gcal-quiet"
              disabled={busy !== null}
              onClick={() => {
                if (!window.confirm("Disconnect Google Calendar? The “Elkdonis tours” calendar is removed from your Google account.")) return;
                void run("remove", disconnectGoogleCalendar);
              }}
            >
              {busy === "remove" ? "Disconnecting…" : "Disconnect"}
            </button>
          </>
        ) : (
          <>
            <button type="button" className="el-gcal-main" disabled={busy !== null} onClick={connect}>
              {busy === "connect" ? "Opening Google…" : link?.status === "error" ? "Connect Google Calendar again" : "Sync to Google Calendar"}
            </button>
            {picker}
          </>
        )}
      </div>
      <p className="el-gcal-note" role="status">
        {connected
          ? [
              link.email ? `Google Calendar: ${link.email}` : "Google Calendar connected",
              link.lastSyncedAt ? `${link.eventCount ?? 0} upcoming, synced ${when(link.lastSyncedAt)}` : "first sync running…",
            ].join(" · ")
          : which === "all"
            ? "Puts every scheduled run in a Google calendar of its own, and keeps it up to date."
            : "Puts the runs you guide in a Google calendar of its own, and keeps it up to date."}
      </p>
      {error || link?.error ? (
        <p className="el-gcal-error" role="alert">
          {error ?? link?.error}
        </p>
      ) : null}
    </div>
  );
}

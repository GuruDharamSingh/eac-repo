"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ANSWER_EVENT, SIGNIN_EVENT, announceAnswer, saveSeriesIntent, takeSeriesIntent, type AnswerDetail, type SigninDetail } from "./series-intent";

/**
 * "I'm coming" for one week. Signed in: one click, toggles; only that
 * week's row is written. The server decides what is allowed; this only
 * reflects its answer, then refreshes the page's server props so the card
 * at the top and this button agree without a reload (2026-10-10).
 *
 * Signed out: on the series page the inline sign-in form takes the press
 * (`SIGNIN_EVENT`); elsewhere the press is kept in sessionStorage, the
 * visitor goes to /login, and with `resumeIntent` the button marks that
 * week once they are back signed in.
 */
export function SeriesRsvp({
  seriesId,
  occurrenceAt,
  signedIn,
  initialStatus,
  initialCount,
  label,
  small = false,
  onCount,
  returnTo = "/",
  resumeIntent = false,
}: {
  seriesId: string;
  occurrenceAt: string;
  signedIn: boolean;
  initialStatus: "yes" | "maybe" | "no" | null;
  initialCount: number;
  label: string;
  small?: boolean;
  onCount?: (n: number) => void;
  /** Where sign-in returns to. */
  returnTo?: string;
  /** Act on a kept "I'm coming" for this week after a sign-in trip (pages without the inline form). */
  resumeIntent?: boolean;
}) {
  const router = useRouter();
  const [going, setGoing] = useState(initialStatus === "yes");
  useEffect(() => setGoing(initialStatus === "yes"), [initialStatus]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The card at the top answered for this week: follow it at once.
  useEffect(() => {
    const on = (e: Event) => {
      const d = (e as CustomEvent<AnswerDetail>).detail;
      if (d && d.seriesId === seriesId && d.at === occurrenceAt) setGoing(d.going);
    };
    window.addEventListener(ANSWER_EVENT, on);
    return () => window.removeEventListener(ANSWER_EVENT, on);
  }, [seriesId, occurrenceAt]);

  async function send(next: boolean): Promise<boolean> {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/series/rsvp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ seriesId, occurrenceAt, going: next }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string; status?: string; rsvpCount?: number };
      if (!res.ok) {
        setError(body.error && !/rsvp/i.test(body.error) ? body.error : "Could not save your answer.");
        return false;
      }
      if (typeof body.rsvpCount === "number") onCount?.(body.rsvpCount);
      setGoing(next);
      announceAnswer({ seriesId, at: occurrenceAt, going: next });
      router.refresh();
      return true;
    } catch {
      setError("Could not reach the server.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  // Back from /login after pressing "I'm coming" here while signed out.
  useEffect(() => {
    if (!signedIn || !resumeIntent) return;
    const intent = takeSeriesIntent(seriesId, (i) => i.action === "coming" && i.at === occurrenceAt);
    if (intent && initialStatus !== "yes") void send(true);
    // Runs once on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cls = `ifs-btn${small ? " ifs-btn--small" : ""}`;

  if (signedIn) {
    return (
      <div className="ifs-rsvp-form">
        <button type="button" className={`${cls}${going ? "" : " ifs-btn--primary"}`} disabled={busy} onClick={() => void send(!going)}>
          {busy ? "…" : going ? "You're coming · change" : label}
        </button>
        {error && <span className="ifs-rsvp-form__err">{error}</span>}
      </div>
    );
  }

  // Signed out: saying you're coming means joining the network first. No guest path.
  const loginHref = `/login?mode=signup&next=${encodeURIComponent(returnTo)}`;
  return (
    <div className="ifs-rsvp-form">
      <a
        className={`${cls} ifs-btn--primary`}
        href={loginHref}
        onClick={(e) => {
          const taken = !window.dispatchEvent(
            new CustomEvent<SigninDetail>(SIGNIN_EVENT, { detail: { seriesId, at: occurrenceAt }, cancelable: true })
          );
          if (taken) {
            e.preventDefault();
            return;
          }
          saveSeriesIntent({ action: "coming", seriesId, at: occurrenceAt, ts: Date.now() });
        }}
      >
        {label}
      </a>
      {!small && <span className="ifs-faint" style={{ fontSize: "0.92rem" }}>Sign in or create an account to say you&apos;re coming.</span>}
    </div>
  );
}

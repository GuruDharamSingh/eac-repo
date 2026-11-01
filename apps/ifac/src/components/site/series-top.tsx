"use client";

import { useCallback, useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ANSWER_EVENT, announceAnswer, takeSeriesIntent, type AnswerDetail } from "./series-intent";
import { SeriesSignIn, type SeriesSignInHandle } from "./series-signin";
import "./series-top.css";

/**
 * The top of the public series page. Since 2026-10-18 (mockup D,
 * docs/open/series-index-mockups-2026-10-18/d-series-page.html) it leads
 * with the series, not this week: the series' general card (About,
 * schedule, hosts: server-rendered `about`) beside "Follow the series"
 * (subscribe, talk, share, the sign-in form), then one band for the next
 * session (server-rendered `next`) with "I'm coming" and, past the join
 * gate, the join link. The other weeks are rows below, on the page.
 * Before 2026-10-18: a three-column card for this week and pills below it.
 *
 * Attendance is `/api/series/rsvp` (one week), subscribing is
 * `/api/series/subscribe` (the series); neither writes the other. The join
 * link is not tied to attendance: the server passes `joinSlot` to anyone
 * signed in with an IFAC role.
 *
 * Sign-in is the shared form in series-signin.tsx (also in the week page's
 * side column, 2026-10-13). What the visitor pressed before signing in
 * ("I'm coming" for a week, or "Subscribe") travels in sessionStorage
 * (series-intent.ts) and is done once the page is back signed in; a plain
 * sign-in from the form does neither.
 */

export interface SeriesTopWeek {
  at: string;
  number: number;
  /** "Monday", in the series' zone. */
  weekdayLong: string;
  calendarUrl: string;
}

/** Server messages that name the old wording are replaced: this page never says it. */
function plain(message: string | undefined, fallback: string): string {
  if (!message || /rsvp/i.test(message)) return fallback;
  return message;
}

/** Copy `text`: the async clipboard first, then a hidden textarea and `execCommand('copy')`. */
async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to the textarea */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.cssText = "position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none;";
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, text.length);
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

const Check = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
);

export function SeriesTop({
  seriesId,
  seriesTitle,
  href,
  signedIn,
  canJoin,
  week,
  initialGoing,
  initialSubscribed,
  about,
  next,
  readMoreHref,
  joinSlot,
  talkHref,
}: {
  seriesId: string;
  seriesTitle: string;
  /** `/series/<slug>`: where sign-in returns to and what Share shares. */
  href: string;
  signedIn: boolean;
  /** Signed in with an IFAC role: the server passes the join link and details in `joinSlot`. */
  canJoin: boolean;
  /** The week the card leads with; null when no week is published yet. */
  week: SeriesTopWeek | null;
  initialGoing: boolean;
  initialSubscribed: boolean;
  /** The general card's left side: About, schedule, hosts (server-rendered). */
  about: ReactNode;
  /** The next-session band's date and words (server-rendered); null with no published week. */
  next: ReactNode | null;
  /** The next session's own page. */
  readMoreHref: string | null;
  /** "Join the session" and the meeting details; the server passes it only past the join gate. */
  joinSlot: ReactNode | null;
  talkHref: string;
}) {
  const router = useRouter();
  const [, startRefresh] = useTransition();
  const refresh = useCallback(() => startRefresh(() => router.refresh()), [router]);

  // ── feedback: a short toast for confirmations ─────────────────────────
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);
  const showToast = useCallback((text: string) => {
    setToast(text);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 3200);
  }, []);
  useEffect(() => () => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
  }, []);

  // ── attendance ────────────────────────────────────────────────────────
  const [going, setGoing] = useState(initialGoing);
  useEffect(() => setGoing(initialGoing), [initialGoing]);
  const [answerBusy, setAnswerBusy] = useState(false);
  const [answerError, setAnswerError] = useState<string | null>(null);

  // A "Coming up" row answered for this card's week: follow it at once.
  useEffect(() => {
    if (!week) return;
    const on = (e: Event) => {
      const d = (e as CustomEvent<AnswerDetail>).detail;
      if (d && d.seriesId === seriesId && d.at === week.at) setGoing(d.going);
    };
    window.addEventListener(ANSWER_EVENT, on);
    return () => window.removeEventListener(ANSWER_EVENT, on);
  }, [seriesId, week]);

  /** Say yes or no for one week (`at`); only that week's row is written. */
  const answerFor = useCallback(
    async (at: string, next: boolean): Promise<boolean> => {
      setAnswerBusy(true);
      setAnswerError(null);
      try {
        const res = await fetch("/api/series/rsvp", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ seriesId, occurrenceAt: at, going: next }),
        });
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) {
          setAnswerError(res.status === 401 ? "Your sign-in has run out. Sign in again to say you're coming." : plain(body.error, "Could not save your answer. Try again."));
          return false;
        }
        if (week && at === week.at) setGoing(next);
        announceAnswer({ seriesId, at, going: next });
        refresh();
        return true;
      } catch {
        setAnswerError("Could not reach the server. Try again.");
        return false;
      } finally {
        setAnswerBusy(false);
      }
    },
    [seriesId, week, refresh]
  );

  // ── subscribe ─────────────────────────────────────────────────────────
  const [subscribed, setSubscribed] = useState(initialSubscribed);
  useEffect(() => setSubscribed(initialSubscribed), [initialSubscribed]);
  const [subBusy, setSubBusy] = useState(false);
  const [pillNote, setPillNote] = useState<string | null>(null);
  const subRef = useRef<HTMLDialogElement>(null);

  /** Write or remove the subscription row on the series thread; never touches attendance. */
  const setSubscription = useCallback(
    async (next: boolean): Promise<boolean> => {
      setSubBusy(true);
      setPillNote(null);
      try {
        const res = await fetch("/api/series/subscribe", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ seriesId, subscribe: next }),
        });
        const body = (await res.json().catch(() => ({}))) as { error?: string; subscribed?: boolean };
        if (!res.ok) {
          setPillNote(
            res.status === 401
              ? "Your sign-in has run out. Sign in again, then subscribe."
              : res.status === 503
                ? "Subscribing is not available yet. Nothing was changed."
                : `Could not change your subscription: ${plain(body.error, "try again")}.`
          );
          return false;
        }
        const now = body.subscribed ?? next;
        setSubscribed(now);
        showToast(now ? "Subscribed ✓" : "Unsubscribed");
        setPillNote(now ? "Subscribed. You'll get an email before each session." : "Unsubscribed. No more emails about this series.");
        return true;
      } catch {
        setPillNote("Could not reach the server. Nothing was changed. Try again.");
        return false;
      } finally {
        setSubBusy(false);
        subRef.current?.close();
      }
    },
    [seriesId, showToast]
  );

  // ── the sign-in form (series-signin.tsx) ────────────────────────────────
  const signInRef = useRef<SeriesSignInHandle>(null);
  const callForm = useCallback((next: Parameters<SeriesSignInHandle["call"]>[0]) => signInRef.current?.call(next), []);

  // ── arrival after sign-in: do what they pressed, then the welcome dialog ─
  const welcomeRef = useRef<HTMLDialogElement>(null);
  const [welcomeNote, setWelcomeNote] = useState<string | null>(null);
  useEffect(() => {
    if (!signedIn) return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("welcome") !== "1") return;
    url.searchParams.delete("welcome");
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
    const intent = takeSeriesIntent(seriesId);
    welcomeRef.current?.showModal();
    if (intent?.action === "coming") {
      const isCard = week && intent.at === week.at;
      if (isCard && initialGoing) {
        setWelcomeNote(`You're down as coming on ${week.weekdayLong}.`);
      } else {
        void answerFor(intent.at, true).then((ok) =>
          setWelcomeNote(ok ? (isCard ? `You're down as coming on ${week.weekdayLong}.` : "You're down as coming to that session.") : "We couldn't mark you as coming. Press “I'm coming” to try again.")
        );
      }
    } else if (intent?.action === "subscribe") {
      if (initialSubscribed) {
        setWelcomeNote("You're subscribed to the series.");
      } else {
        void setSubscription(true).then((ok) =>
          setWelcomeNote(ok ? "You're subscribed: we'll email you before each session. Subscribing does not mark you as coming." : "We couldn't subscribe you. Press “Subscribe to series” to try again.")
        );
      }
    }
    // Runs once on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onSubscribePill() {
    setPillNote(null);
    if (!signedIn) {
      callForm({ action: "subscribe" });
      return;
    }
    subRef.current?.showModal();
  }

  // ── share ─────────────────────────────────────────────────────────────
  const [copied, setCopied] = useState(false);
  /**
   * Phones and tablets get the system share sheet (closing it is an
   * AbortError and counts as done). Elsewhere, and whenever the sheet
   * fails, the link is copied: desktop share sheets (Windows) can close
   * without showing anything, which read as "Share does nothing". Every
   * path ends in visible feedback.
   */
  async function onShare() {
    setPillNote(null);
    const url = `${window.location.origin}${href}`;
    const touch = typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;
    if (touch && typeof navigator.share === "function") {
      try {
        await navigator.share({ title: seriesTitle, url });
        showToast("Shared");
        return;
      } catch (err) {
        if ((err as Error)?.name === "AbortError") return;
      }
    }
    if (await copyText(url)) {
      setCopied(true);
      showToast("Link copied");
      window.setTimeout(() => setCopied(false), 2600);
    } else {
      setPillNote(`Copy this link: ${url}`);
    }
  }

  // ── render ────────────────────────────────────────────────────────────
  const showForm = !signedIn;

  return (
    <>
      <article className="ist-gen" aria-label="About the series">
        <div className="ist-gen__about">{about}</div>

        <aside className="ist-act ist-gen__act" id="follow" aria-labelledby="ist-follow-h">
          <div className="ist-act__block">
            <h3 className="ist-act__h" id="ist-follow-h">Follow the series</h3>
            <p className="ist-muted ist-small">An email a couple of days before each session, with the join link.</p>
            <button
              type="button"
              className={`ifs-btn ist-btn-wide${subscribed ? " ist-btn-on" : " ifs-btn--primary"}`}
              onClick={subscribed ? () => subRef.current?.showModal() : onSubscribePill}
              disabled={subBusy}
            >
              {subBusy ? "Saving…" : subscribed ? "Subscribed ✓" : "Subscribe to the series"}
            </button>
            <div className="ist-pills ist-pills--panel" role="group" aria-label="The series">
              {/* TODO(E5): the series' own forum category once it exists
                  (docs/open/IFAC_SERIES_PLAN_2026-10-10.md E5). */}
              <a className="ist-pill" href={talkHref}>Talk about the series</a>
              <button type="button" className={`ist-pill${copied ? " is-on" : ""}`} onClick={() => void onShare()}>
                {copied ? "Link copied ✓" : "Share"}
              </button>
            </div>
          </div>
          {showForm && <SeriesSignIn ref={signInRef} seriesId={seriesId} returnTo={`${href}?welcome=1`} />}
        </aside>
      </article>

      {week && next && (
        <section className="ist-next" aria-label="Next session">
          <div className="ist-next__info">{next}</div>
          <div className="ist-next__act">
            {!signedIn ? (
              <button type="button" className="ifs-btn ifs-btn--primary" onClick={() => callForm({ action: "coming", at: week.at })}>
                I&apos;m coming
              </button>
            ) : going ? (
              <p className="ist-done"><Check />You&apos;re coming on {week.weekdayLong}</p>
            ) : (
              <button type="button" className="ifs-btn ifs-btn--primary" disabled={answerBusy} onClick={() => void answerFor(week.at, true)}>
                {answerBusy ? "Saving…" : "I'm coming"}
              </button>
            )}
            {readMoreHref && <a className="ifs-btn" href={readMoreHref}>Read more →</a>}
            <div className="ist-links">
              <a className="ist-textlink" href={week.calendarUrl}>Add to calendar</a>
              {signedIn && going && (
                <button type="button" className="ist-textlink" disabled={answerBusy} onClick={() => void answerFor(week.at, false)}>
                  I can&apos;t make it after all
                </button>
              )}
            </div>
          </div>
          {signedIn && (
            <div className="ist-joinbox ist-next__join">
              {joinSlot ?? (
                <p className="ist-small ist-muted">
                  {canJoin ? "The join link will be posted here before the session." : "The join link shows here to IFAC members and followers."}
                </p>
              )}
            </div>
          )}
          {answerError && <p className="ist-err ist-next__err" role="alert">{answerError}</p>}
        </section>
      )}
      {!week && (
        <section className="ist-next ist-next--empty" aria-label="Next session">
          <p className="ist-muted">The next session will be announced here. Subscribe to the series to get an email when it is.</p>
        </section>
      )}

      <p className="ist-pill-note" role="status" aria-live="polite">{pillNote ?? ""}</p>
      <p className={`ist-toast${toast ? " is-on" : ""}`} role="status" aria-live="polite">{toast ?? ""}</p>

      <dialog ref={subRef} className="ist-dialog" aria-labelledby="ist-sub-h">
        {subscribed ? (
          <>
            <h2 id="ist-sub-h">You&apos;re subscribed</h2>
            <p>You get a reminder email a couple of days before each session of {seriesTitle}. Unsubscribe to stop these emails; weeks you said you&apos;re coming to stay as they are.</p>
            <div className="ist-dialog__actions">
              <button type="button" className="ifs-btn" onClick={() => subRef.current?.close()}>Keep subscription</button>
              <button type="button" className="ifs-btn ifs-btn--primary" disabled={subBusy} onClick={() => void setSubscription(false)}>Unsubscribe</button>
            </div>
          </>
        ) : (
          <>
            <h2 id="ist-sub-h">Subscribe to the series?</h2>
            <p>We&apos;ll send you a reminder email a couple of days before each session, with its details, the join link and any updates.</p>
            <p className="ist-muted">Subscribing does not mark you as coming. Each email lets you say you&apos;re coming to that session.</p>
            <div className="ist-dialog__actions">
              <button type="button" className="ifs-btn" onClick={() => subRef.current?.close()}>Cancel</button>
              <button type="button" className="ifs-btn ifs-btn--primary" disabled={subBusy} onClick={() => void setSubscription(true)}>
                {subBusy ? "Subscribing…" : "Subscribe"}
              </button>
            </div>
          </>
        )}
      </dialog>

      <dialog ref={welcomeRef} className="ist-dialog ist-dialog--welcome" aria-labelledby="ist-welcome-h">
        <svg className="ist-dialog__mark" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" /><path d="M7.5 12.5l3 3 6-6.5" /></svg>
        <h2 id="ist-welcome-h">Welcome</h2>
        <p>Thanks for joining the Elkdonis Arts Collective platform and showing interest in {seriesTitle} by IFAC.</p>
        {welcomeNote && <p className="ist-muted" role="status">{welcomeNote}</p>}
        <div className="ist-dialog__actions">
          <button type="button" className="ifs-btn ifs-btn--primary" onClick={() => welcomeRef.current?.close()} autoFocus>Continue</button>
        </div>
      </dialog>
    </>
  );
}

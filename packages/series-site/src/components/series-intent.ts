/**
 * What a signed-out visitor asked for before signing in on a series page
 * (2026-10-10): "I'm coming" for one week, or "Subscribe to series". It is
 * kept in sessionStorage across the sign-in trip and acted on once the page
 * is back signed in. sessionStorage, not the URL, so a crafted link cannot
 * mark a signed-in visitor as coming or subscribe them.
 *
 * `coming` marks attendance for `at` only; `subscribe` writes the series
 * subscription only. Neither does the other's write.
 */

export type SeriesIntent =
  | { action: "coming"; seriesId: string; at: string; ts: number }
  | { action: "subscribe"; seriesId: string; ts: number };

const KEY = "ifs-series-intent";
const TTL_MS = 15 * 60 * 1000;

export function saveSeriesIntent(intent: SeriesIntent): boolean {
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(intent));
    return true;
  } catch {
    return false;
  }
}

export function clearSeriesIntent(): void {
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    /* storage unavailable */
  }
}

/** Read and remove the intent, if it is recent, for this series and (when given) passes `match`. */
export function takeSeriesIntent(seriesId: string, match?: (intent: SeriesIntent) => boolean): SeriesIntent | null {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as SeriesIntent;
    if (v.seriesId !== seriesId || (match && !match(v))) return null;
    window.sessionStorage.removeItem(KEY);
    return Date.now() - v.ts < TTL_MS ? v : null;
  } catch {
    return null;
  }
}

/**
 * Window events that keep the card and the "Coming up" rows in step without
 * a reload (both also get fresh props from `router.refresh()`).
 *
 * - `ifs:series-answer` {seriesId, at, going}: an answer was saved.
 * - `ifs:series-signin` {seriesId, at}: a signed-out "I'm coming" in a row;
 *   the page's inline sign-in form takes it (`preventDefault`), otherwise
 *   the row falls back to the /login page.
 */
export const ANSWER_EVENT = "ifs:series-answer";
export const SIGNIN_EVENT = "ifs:series-signin";

export type AnswerDetail = { seriesId: string; at: string; going: boolean };
export type SigninDetail = { seriesId: string; at: string };

export function announceAnswer(detail: AnswerDetail): void {
  window.dispatchEvent(new CustomEvent<AnswerDetail>(ANSWER_EVENT, { detail }));
}

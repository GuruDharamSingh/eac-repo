import type { SeriesJoinDetails } from "@elkdonis/services";

/**
 * Meeting ID, passcode and other ways to join a series. Render it only where
 * the join link itself is shown (signed in with an IFAC role, 2026-10-10):
 * the passcode is not for anonymous visitors. Renders nothing when empty.
 */
export function JoinDetails({ details }: { details: SeriesJoinDetails }) {
  const { meetingId, passcode, other } = details;
  if (!meetingId && !passcode && !other) return null;
  return (
    <dl className="ifs-join-details">
      {meetingId && (
        <>
          <dt>Meeting ID</dt>
          <dd>{meetingId}</dd>
        </>
      )}
      {passcode && (
        <>
          <dt>Passcode</dt>
          <dd>{passcode}</dd>
        </>
      )}
      {other && (
        <>
          <dt>Other ways</dt>
          <dd className="is-text">{other}</dd>
        </>
      )}
    </dl>
  );
}

/** The same details as plain lines, for mail. */
export function joinDetailLines(details: SeriesJoinDetails): string[] {
  const lines: string[] = [];
  if (details.meetingId) lines.push(`Meeting ID: ${details.meetingId}`);
  if (details.passcode) lines.push(`Passcode: ${details.passcode}`);
  if (details.other) {
    lines.push("Other ways to join:");
    for (const l of details.other.split("\n")) if (l.trim()) lines.push(l.trim());
  }
  return lines;
}

/** The same details on one line, for a mail field that collapses newlines. */
export function joinDetailsSentence(details: SeriesJoinDetails): string | null {
  const parts: string[] = [];
  if (details.meetingId) parts.push(`Meeting ID: ${details.meetingId}`);
  if (details.passcode) parts.push(`Passcode: ${details.passcode}`);
  if (details.other) {
    const ways = details.other.split("\n").map((l) => l.trim()).filter(Boolean);
    if (ways.length) parts.push(`Other ways to join: ${ways.join("; ")}`);
  }
  return parts.length ? parts.join(" · ") : null;
}

import * as React from "react";
import { sanitizeRichText } from "@elkdonis/utils";
import type { SurfaceGathered, SurfaceThread } from "./types";
import { PRICED_KINDS, SCHEDULED_KINDS } from "./types";
import { SurfaceFacts, SurfaceSection } from "./SurfaceShell";
import {
  fmtDateTime,
  fmtDuration,
  fmtFormat,
  fmtPrice,
  fmtRecurrence,
  fmtShortDate,
  fmtTime,
  relativeDay,
  type FormatOptions,
} from "./format";

// ============================================================================
// A thread's body and facts, with no chrome and no fetching.
//
// The same rendering serves the popup (ThreadSurface, client-side, loaded on
// open) and the full page (SurfacePage, server-rendered). That is the
// "card → popup → page" promise made literal: the page IS the surface at
// page size, so nobody has to learn two layouts for one thing.
//
// Pure — no hooks — so a server component can render it.
// ============================================================================

export interface ThreadViewOptions {
  showCover?: boolean;
  /**
   * How to open a gathered THREAD.
   *
   * The popup passes a pusher, so walking from a meeting into the document it
   * produced stacks a layer and keeps the occasion underneath; the page passes
   * nothing and the same rows render as ordinary links. One band, two hosts,
   * no second layout to maintain.
   */
  onOpenThread?: (threadId: string) => void;
}

export interface ThreadViewParts {
  /** The main pane: cover, dateline, lede, prose. */
  main: React.ReactNode;
  /** The rail: facts, sessions, workspace links. Null for kinds without any. */
  rail: React.ReactNode | null;
  kicker: string;
}

export function threadViewParts(
  thread: SurfaceThread,
  fmt: FormatOptions = {},
  options: ThreadViewOptions = {}
): ThreadViewParts {
  const scheduled = SCHEDULED_KINDS.has(thread.kind);
  const priced = PRICED_KINDS.has(thread.kind);
  const when = thread.nextOccurrenceAt ?? thread.scheduledAt;
  const relative = relativeDay(when, fmt);
  const cancelled = thread.cycleStatus === "cancelled";
  const attendance = thread.isRsvpEnabled
    ? `${thread.rsvpCount}${thread.attendeeLimit ? ` of ${thread.attendeeLimit}` : ""}`
    : null;

  const factList: Array<{ label: string; value: React.ReactNode }> = [];
  if (scheduled) {
    factList.push({
      label: thread.recurrencePattern && thread.recurrencePattern !== "NONE" ? "Next" : "When",
      value: when ? (
        <>
          {fmtDateTime(when, fmt)}
          {relative && <span className="eac-chip">{relative}</span>}
          {cancelled && <span className="eac-chip eac-chip--warn">Cancelled</span>}
        </>
      ) : (
        "Date to be announced"
      ),
    });
    factList.push({ label: "Runs", value: fmtDuration(thread.durationMinutes) });
    factList.push({ label: "Repeats", value: fmtRecurrence(thread.recurrencePattern) });
    factList.push({ label: "Format", value: fmtFormat(thread.format) });
  }
  factList.push({ label: "Where", value: thread.location });
  if (scheduled) factList.push({ label: "Coming", value: attendance });
  if (priced) factList.push({ label: "Price", value: fmtPrice(thread.price, thread.currency, fmt) });

  const rail =
    scheduled || priced ? (
      <>
        <SurfaceFacts facts={factList} />

        {thread.sessions && thread.sessions.length > 0 && (
          <SurfaceSection title="Sessions">
            <ul className="eac-occ-list">
              {thread.sessions.map((s, i) => (
                <li key={i} className="eac-occ" style={{ cursor: "default" }}>
                  <span className="eac-occ-glyph" aria-hidden>
                    {i + 1}
                  </span>
                  <span>
                    <span className="eac-occ-title">{s.title || `Session ${i + 1}`}</span>
                    <span className="eac-occ-meta">
                      {[
                        s.startsAt && `${fmtShortDate(s.startsAt, fmt)} · ${fmtTime(s.startsAt, fmt)}`,
                        fmtDuration(s.durationMinutes),
                        s.location,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </SurfaceSection>
        )}

        {(thread.documentUrl || thread.videoLink) && (
          <SurfaceSection title="Workspace">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {thread.documentUrl && (
                <a className="eac-btn" href={thread.documentUrl} target="_blank" rel="noreferrer">
                  Shared document
                </a>
              )}
              {thread.videoLink && (
                <a className="eac-btn" href={thread.videoLink} target="_blank" rel="noreferrer">
                  Recording
                </a>
              )}
            </div>
          </SurfaceSection>
        )}
      </>
    ) : null;

  const dateline = [thread.author?.name, thread.publishedAt && fmtShortDate(thread.publishedAt, fmt)]
    .filter(Boolean)
    .join(" · ");

  const gathered = thread.gathered ?? [];
  const terms = thread.terms ?? [];
  const gatheredBy = thread.gatheredBy ?? [];

  const main = (
    <>
      {options.showCover !== false && thread.coverImageUrl && (
        <img className="eac-surface-cover" src={thread.coverImageUrl} alt="" />
      )}
      {dateline && (
        <p className="eac-surface-record" style={{ margin: "0 0 12px" }}>
          {dateline}
        </p>
      )}
      {thread.excerpt && <p className="eac-surface-lede">{thread.excerpt}</p>}
      {thread.bodyHtml ? (
        // Sanitised here as well as on write: hosts' GET routes return the stored
        // body as-is, and rows written before the write path sanitised, or by a
        // hand-written INSERT, reach this renderer unchanged.
        <div
          className="eac-surface-prose"
          dangerouslySetInnerHTML={{ __html: sanitizeRichText(thread.bodyHtml) }}
        />
      ) : !thread.excerpt ? (
        <p className="eac-surface-muted">No description yet.</p>
      ) : null}

      {/* What the occasion holds. Curated and ordered, so it leads. */}
      {gathered.length > 0 && (
        <SurfaceSection title={GATHER_HEADING[thread.kind] ?? "In this gathering"}>
          <ul className="eac-occ-list">
            {gathered.map((item) => (
              <GatheredRow key={item.id} item={item} onOpenThread={options.onOpenThread} />
            ))}
          </ul>
        </SurfaceSection>
      )}

      {/* Derived from the prose rather than attached by hand, which is why it
          is a band of its own and not more rows above. */}
      {terms.length > 0 && (
        <SurfaceSection title="Defined here">
          <p className="eac-terms">
            {terms.map((t) =>
              t.href ? (
                <a key={t.id} className="eac-term" href={t.href}>
                  {t.title}
                </a>
              ) : (
                <span key={t.id} className="eac-term">
                  {t.title}
                </span>
              )
            )}
          </p>
        </SurfaceSection>
      )}

      {/* Provenance: the same edge read from the other end. */}
      {gatheredBy.length > 0 && (
        <p className="eac-surface-record eac-gathered-at">
          {gatheredBy[0].relation === "produced" ? "Came out of" : "Gathered at"}{" "}
          {gatheredBy.map((g, i) => (
            <React.Fragment key={g.id}>
              {i > 0 && ", "}
              {g.href ? <a href={g.href}>{g.title}</a> : g.title}
            </React.Fragment>
          ))}
        </p>
      )}
    </>
  );

  const kindLabel = KIND_LABELS[thread.kind] ?? "";
  const kicker = [kindLabel, thread.feed?.name].filter(Boolean).join(" · ");

  return { main, rail, kicker };
}

/**
 * One gathered thing.
 *
 * Three shapes, decided by what the row can actually do rather than by what
 * it is: a thread the host can open in place becomes a button, anything with
 * a URL becomes a link, and a row whose href was WITHHELD renders as neither.
 * That last case is the living document a non-member may know about but not
 * open — its share link grants write access, so it is never in the payload —
 * and it must still read as a real entry rather than a broken link.
 */
function GatheredRow({
  item,
  onOpenThread,
}: {
  item: SurfaceGathered;
  onOpenThread?: (threadId: string) => void;
}) {
  // Keyed on KIND first: a living document is a thread target since migration
  // 133, so keying only on target type would draw every one of them with the
  // generic thread mark and lose the distinction the glyph exists to make.
  const glyph = (item.kind && GATHER_GLYPH[item.kind]) ?? GATHER_GLYPH[item.targetType] ?? "▪";
  const meta = [item.subtitle, item.relation === "produced" ? "produced here" : null]
    .filter(Boolean)
    .join(" · ");

  const inner = (
    <>
      <span className="eac-occ-glyph" aria-hidden>
        {glyph}
      </span>
      <span>
        <span className="eac-occ-title">{item.title}</span>
        {meta && <span className="eac-occ-meta">{meta}</span>}
      </span>
    </>
  );

  if (item.threadId && onOpenThread) {
    const id = item.threadId;
    return (
      <li>
        <button type="button" className="eac-occ" onClick={() => onOpenThread(id)}>
          {inner}
        </button>
      </li>
    );
  }

  if (item.href) {
    return (
      <li>
        <a
          className="eac-occ"
          href={item.href}
          {...(item.external ? { target: "_blank", rel: "noreferrer" } : {})}
        >
          {inner}
        </a>
      </li>
    );
  }

  return (
    <li>
      <div className="eac-occ eac-occ--static">{inner}</div>
    </li>
  );
}

const GATHER_GLYPH: Record<string, string> = {
  thread: "▸",
  // Both a `kind` and a legacy target type; one entry serves both lookups.
  document: "▭",
  wiki_page: "\u203B",
  file: "▤",
  deck_card: "▦",
  deck_label: "▦",
  quote: "\u201C",
  link: "\u2197",
};

/** What the band is called depends on what is holding it. */
const GATHER_HEADING: Record<string, string> = {
  meeting: "From this meeting",
  event: "From this gathering",
  workshop: "In this workshop",
  wiki_page: "Referenced here",
};

const KIND_LABELS: Record<string, string> = {
  post: "Writing",
  event: "Event",
  meeting: "Meeting",
  workshop: "Workshop",
  service: "Service",
  product: "Product",
};

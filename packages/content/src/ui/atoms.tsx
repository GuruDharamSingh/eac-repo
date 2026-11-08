"use client";

import * as React from "react";
import {
  AlertTriangle,
  AtSign,
  Check,
  CircleUserRound,
  Clock,
  Facebook,
  FileText,
  Film,
  Globe,
  Instagram,
  Mail,
  Pencil,
  Radio,
  Store,
  Youtube,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { fmtDay, type ContentCellState, type ContentEvent, type ContentIdentity, type ContentOutlet, type ContentSuggestion, type ContentType } from "../model";
import { typeGlyph } from "../registry";
import { useContentConnectors } from "./connectors";

// Lifted from Channel (components/channel/icons.tsx and bits.tsx, 2026-11-08).
// Class names stay `chn-*` in pass 1, so the piece view renders on Channel's
// stylesheet exactly as before; see the proposal's "Pass 1 done" for the CSS.

export const OUTLET_ICON: Record<ContentOutlet, LucideIcon> = {
  site: Globe,
  page: CircleUserRound,
  market: Store,
  instagram: Instagram,
  facebook: Facebook,
  threads: AtSign,
  youtube: Youtube,
  video: Film,
  writing: FileText,
  live: Radio,
  newsletter: Mail,
};

export function OutletIcon({ outlet, state, size = 14, title }: { outlet: ContentOutlet; state?: ContentCellState | "suggestion"; size?: number; title?: string }) {
  const Icon = OUTLET_ICON[outlet] ?? Globe;
  return (
    <span className="chn-oi" data-state={state ?? "published"} title={title} aria-hidden={title ? undefined : true}>
      <Icon size={size} strokeWidth={1.6} />
    </span>
  );
}

/** Artist = circle, org = 2px-radius square. */
export function IdentityMark({ initials, kind, size = 18, title }: { initials: string; kind: "user" | "org"; size?: number; title?: string }) {
  return (
    <span className="chn-idm" data-kind={kind} style={{ width: size, height: size, fontSize: Math.max(7, Math.round(size * 0.42)) }} title={title} aria-label={title}>
      {initials}
    </span>
  );
}

export function StateMark({ state, size = 13 }: { state: ContentCellState; size?: number }) {
  const p = { size, strokeWidth: 1.8, "aria-hidden": true as const };
  switch (state) {
    case "published":
      return <Check {...p} className="chn-sm" data-state="published" />;
    case "scheduled":
      return <Clock {...p} className="chn-sm" data-state="scheduled" />;
    case "live":
      return <Radio {...p} className="chn-sm" data-state="live" />;
    case "draft":
      return <Pencil {...p} className="chn-sm" data-state="draft" />;
    case "failed":
      return <AlertTriangle {...p} className="chn-sm" data-state="failed" />;
    default:
      return null;
  }
}

const STATE_WORD: Record<ContentCellState, string> = {
  published: "Published",
  scheduled: "Scheduled",
  live: "Live",
  draft: "Draft",
  failed: "Failed",
  suggested: "Suggested",
  info: "Note",
  empty: "Not yet",
};

export function StatusTag({ state }: { state: ContentCellState }) {
  return (
    <span className="chn-tag" data-state={state}>
      {STATE_WORD[state]}
    </span>
  );
}

export function Thumb({ cover, type, size = 52, h }: { cover: string | null; type: ContentType; size?: number; h?: number }) {
  return cover ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img className="chn-thumb" src={cover} alt="" width={size} height={h ?? size} loading="lazy" style={{ width: size, height: h ?? size }} />
  ) : (
    <span className="chn-thumb is-empty" style={{ width: size, height: h ?? size }} aria-hidden>
      {typeGlyph(type)}
    </span>
  );
}

/** "Next" chip: opens the host's quick sheet for the suggestion. */
export function NextChip({ suggestion, compact }: { suggestion: ContentSuggestion; compact?: boolean }) {
  const { openSuggestion } = useContentConnectors();
  return (
    <button
      type="button"
      className={compact ? "chn-gap" : "chn-next"}
      title={suggestion.reason}
      onClick={(e) => {
        e.stopPropagation();
        openSuggestion?.(suggestion, e.currentTarget);
      }}
    >
      {compact ? suggestion.chip : (
        <>
          <Zap size={13} aria-hidden /> {suggestion.text}
        </>
      )}
    </button>
  );
}

export function Timeline({
  events,
  identities,
  timeZone,
  showIdentity,
  limit,
}: {
  events: ContentEvent[];
  identities: ContentIdentity[];
  timeZone: string;
  showIdentity?: boolean;
  limit?: number;
}) {
  const list = limit ? events.slice(-limit) : events;
  if (list.length === 0) return <p className="chn-quiet">Nothing has gone out yet.</p>;
  return (
    <ol className="chn-timeline">
      {list.map((e) => {
        const idn = e.identityId ? identities.find((i) => i.id === e.identityId) : undefined;
        return (
          <li key={e.id}>
            <span className="chn-tl-date">{fmtDay(e.at, timeZone)}</span>
            {showIdentity && <span className="chn-tl-id">{idn ? <IdentityMark initials={idn.initials} kind={idn.kind} title={idn.name} /> : null}</span>}
            <OutletIcon outlet={e.outlet} state={e.state} size={16} />
            <span className="chn-tl-text">
              {e.href ? (
                <a href={e.href} target="_blank" rel="noreferrer">
                  {e.label}
                </a>
              ) : (
                e.label
              )}
              <small>{e.sub}</small>
            </span>
            <StatusTag state={e.state} />
          </li>
        );
      })}
    </ol>
  );
}

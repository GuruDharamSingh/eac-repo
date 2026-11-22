import { DEFAULT_TOUR_STAGE, type TourStageOptions } from "@/components/tours/stage/types";

/**
 * The Hero stage block's stored props, checked. The layout is a Puck document
 * shared by every tour, so these are settings only. Anything stored that is not
 * a known value falls back to the global default; per-stop overrides are keyed
 * by stop id and are ignored for stops a tour does not have.
 */
export type StageMedia = TourStageOptions["media"];
export type StageLead = TourStageOptions["lead"];
export type StageStartAt = TourStageOptions["startAt"];
export type StopOverride = TourStageOptions["perStop"][string];

export const STAGE_MEDIA: { value: StageMedia; label: string }[] = [
  { value: "stop", label: "Stop's own" },
  { value: "stop-then-place", label: "Stop, then place" },
  { value: "place", label: "Place's" },
];
export const STAGE_LEAD: { value: StageLead; label: string }[] = [
  { value: "photos", label: "Photos" },
  { value: "streetview", label: "Street view" },
];
export const STAGE_START: { value: StageStartAt; label: string }[] = [
  { value: "overview", label: "Whole route" },
  { value: "first-stop", label: "First stop" },
];

export const STAGE_HEIGHT = { min: 480, max: 640 } as const;
export const STAGE_NARRATIVE = { min: 60, max: 280 } as const;
export const STAGE_CAPTION_MAX = 120;

const oneOf = <T extends string>(list: { value: T }[], v: unknown): v is T => list.some((o) => o.value === v);
const clamp = (v: unknown, lo: number, hi: number, fallback: number) => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) && v !== "" && v !== null ? Math.min(hi, Math.max(lo, Math.round(n))) : fallback;
};

/** One stop's overrides, checked; null when nothing usable is left (so the entry can be dropped). */
export function cleanOverride(v: unknown): StopOverride | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const out: StopOverride = {};
  if (oneOf(STAGE_MEDIA, o.media)) out.media = o.media;
  if (oneOf(STAGE_LEAD, o.lead)) out.lead = o.lead;
  if (o.hidden === true) out.hidden = true;
  if (typeof o.caption === "string" && o.caption.trim()) out.caption = o.caption.trim().slice(0, STAGE_CAPTION_MAX);
  return Object.keys(out).length ? out : null;
}

export function cleanPerStop(v: unknown): TourStageOptions["perStop"] {
  const out: TourStageOptions["perStop"] = {};
  if (!v || typeof v !== "object" || Array.isArray(v)) return out;
  for (const [id, raw] of Object.entries(v as Record<string, unknown>)) {
    const o = cleanOverride(raw);
    if (o) out[id] = o;
  }
  return out;
}

/** Block props (possibly from an older or hand-edited document) to the component's options. */
export function readStageOptions(p: Record<string, unknown>): TourStageOptions {
  const d = DEFAULT_TOUR_STAGE;
  return {
    startAt: oneOf(STAGE_START, p.startAt) ? p.startAt : d.startAt,
    lead: oneOf(STAGE_LEAD, p.lead) ? p.lead : d.lead,
    media: oneOf(STAGE_MEDIA, p.media) ? p.media : d.media,
    showStrip: typeof p.showStrip === "boolean" ? p.showStrip : d.showStrip,
    height: clamp(p.height, STAGE_HEIGHT.min, STAGE_HEIGHT.max, d.height),
    narrativeMax: clamp(p.narrativeMax, STAGE_NARRATIVE.min, STAGE_NARRATIVE.max, d.narrativeMax),
    perStop: cleanPerStop(p.perStop),
  };
}

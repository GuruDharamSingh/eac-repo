import type { TourStop } from "@elkdonis/commerce/server";
import type { Experience, Place } from "@/lib/catalogue-types";

/** A stop as the builder receives it; the link columns exist once migration 235 lands. */
export type BuilderStop = TourStop & { placeId?: string | null; experienceId?: string | null };

export interface StopDraft {
  key: string;
  id: string | null;
  title: string;
  body: string;
  guideNotes: string;
  lat: string;
  lng: string;
  heading: string;
  pitch: string;
  fov: string;
  imageUrl: string;
  durationMinutes: string;
  /** `undefined` = not known (old read path): the key is left out of the save so the column is untouched. */
  placeId: string | null | undefined;
  experienceId: string | null | undefined;
  dirty: boolean;
}

const s = (v: number | null | undefined) => (v != null ? String(v) : "");
export const num = (v: string) => (v.trim() === "" || !Number.isFinite(Number(v)) ? null : Number(v));
const newKey = () => `new-${Math.random().toString(36).slice(2)}`;

export function fromStop(stop: BuilderStop): StopDraft {
  return {
    key: stop.id,
    id: stop.id,
    title: stop.title,
    body: stop.body ?? "",
    guideNotes: stop.guideNotes ?? "",
    lat: s(stop.lat),
    lng: s(stop.lng),
    heading: s(stop.heading),
    pitch: s(stop.pitch),
    fov: s(stop.fov),
    imageUrl: stop.imageUrl ?? "",
    durationMinutes: s(stop.durationMinutes),
    placeId: "placeId" in stop ? (stop.placeId ?? null) : undefined,
    experienceId: "experienceId" in stop ? (stop.experienceId ?? null) : undefined,
    dirty: false,
  };
}

export function blankDraft(): StopDraft {
  return {
    key: newKey(), id: null, title: "", body: "", guideNotes: "", lat: "", lng: "", heading: "", pitch: "", fov: "",
    imageUrl: "", durationMinutes: "", placeId: null, experienceId: null, dirty: true,
  };
}

/** The place's fields a stop copies (copy on pick). Image, guide notes and minutes stay the stop's own. */
export function placeFields(p: Place): Partial<StopDraft> {
  return {
    title: p.title,
    body: p.body ?? "",
    lat: s(p.lat),
    lng: s(p.lng),
    heading: s(p.heading),
    pitch: s(p.pitch),
    fov: s(p.fov),
  };
}

export function experienceFields(e: Experience): Partial<StopDraft> {
  return {
    title: e.title,
    body: e.body ?? (e.excerpt ? `<p>${escapeHtml(e.excerpt)}</p>` : ""),
    lat: s(e.lat),
    lng: s(e.lng),
    heading: "",
    pitch: "",
    fov: "",
  };
}

export function fromPlace(p: Place): StopDraft {
  return { ...blankDraft(), ...placeFields(p), placeId: p.id };
}

export function fromExperience(e: Experience): StopDraft {
  return { ...blankDraft(), ...experienceFields(e), experienceId: e.id };
}

function escapeHtml(v: string): string {
  return v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Save payload: the commerce input plus the link keys, present only when known. */
export function toInput(d: StopDraft) {
  return {
    id: d.id,
    title: d.title,
    body: d.body,
    guideNotes: d.guideNotes,
    lat: num(d.lat),
    lng: num(d.lng),
    heading: num(d.heading),
    pitch: num(d.pitch),
    fov: num(d.fov),
    imageUrl: d.imageUrl || null,
    durationMinutes: num(d.durationMinutes),
    ...(d.placeId !== undefined ? { placeId: d.placeId } : {}),
    ...(d.experienceId !== undefined ? { experienceId: d.experienceId } : {}),
  };
}

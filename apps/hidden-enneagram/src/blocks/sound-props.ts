import { TIMBRES, isTimbre } from "@/lib/sound/engine";
import { isRhythm, RHYTHMS, SEVENTHS, isMelody } from "@/lib/sound/rhythm";
import { isTuning, TUNINGS } from "@/lib/sound/tuning";
import { DEFAULT_TIMBRES, type FigureSound, type WebOverlay } from "@/components/aeon/sound-config";

// ============================================================================
// The figure's sound settings as block props (The Figure, he-enneagram).
// Stored in page JSON: never rename a prop. All sound is opt-in for the
// visitor (a speaker toggle); "Offer sound" only decides whether the toggle
// is there. Tuning "Site default" follows Manage -> Music.
// ============================================================================

const timbreOptions = TIMBRES.map((t) => ({ value: t.value, label: t.label }));

export const SOUND_PROPS = [
  // Off unless a page asks for it (2026-11-07: sound lives on /enneagram and /music only).
  { name: "sound", kind: "boolean", label: "Offer sound (visitors turn it on)", default: false },
  {
    name: "tuning",
    kind: "select",
    label: "Tuning",
    description: "Site default is set in Manage, Music. The non-Ouspensky tunings are labelled 'an interpretation'.",
    default: "site",
    options: [{ value: "site", label: "Site default" }, ...TUNINGS.map((t) => ({ value: t.value, label: t.label }))],
  },
  {
    name: "melody",
    kind: "select",
    label: "What 'Play' plays first",
    default: "hexad",
    options: [
      { value: "hexad", label: "The line 1-4-2-8-5-7 (re-fa-mi-si-sol-la)" },
      { value: "walk", label: "The octave walked round the circle" },
      { value: "triangle", label: "The triangle 3-6-9 as one sound" },
    ],
  },
  {
    name: "rotation",
    kind: "select",
    label: "Read the line from",
    description: "Each seventh starts the same six digits from another point.",
    default: "1",
    options: SEVENTHS.map((d, i) => ({ value: String(i + 1), label: `${i + 1}/7 = 0.${d}…` })),
  },
  { name: "rhythm", kind: "select", label: "Rhythm of the line", default: "steady", options: RHYTHMS.map((r) => ({ value: r.value, label: r.label })) },
  { name: "timbreGut", kind: "select", label: "Gut timbre (8 · 9 · 1)", default: DEFAULT_TIMBRES.gut, options: timbreOptions },
  { name: "timbreHeart", kind: "select", label: "Heart timbre (2 · 3 · 4)", default: DEFAULT_TIMBRES.heart, options: timbreOptions },
  { name: "timbreHead", kind: "select", label: "Head timbre (5 · 6 · 7)", default: DEFAULT_TIMBRES.head, options: timbreOptions },
  {
    name: "web",
    kind: "select",
    label: "Music on the figure",
    default: "off",
    options: [
      { value: "off", label: "Nothing drawn" },
      { value: "notes", label: "Each point's note" },
      { value: "ring", label: "Notes and the twelve-note ring" },
    ],
  },
  { name: "mic", kind: "boolean", label: "Offer 'Sing a tone' (microphone, nothing recorded)", default: true },
] as const;

/** The props as the figure's sound config; null when sound is not offered. */
export function soundFromProps(p: Record<string, unknown>): FigureSound | null {
  if (p.sound !== true) return null;
  const web: WebOverlay = p.web === "notes" || p.web === "ring" ? p.web : "off";
  const rot = Number(p.rotation);
  return {
    tuning: isTuning(p.tuning) ? p.tuning : "site",
    melody: isMelody(p.melody) ? p.melody : "hexad",
    rotation: rot >= 1 && rot <= 6 ? Math.round(rot) : 1,
    rhythm: isRhythm(p.rhythm) ? p.rhythm : "steady",
    timbres: {
      gut: isTimbre(p.timbreGut) ? p.timbreGut : DEFAULT_TIMBRES.gut,
      heart: isTimbre(p.timbreHeart) ? p.timbreHeart : DEFAULT_TIMBRES.heart,
      head: isTimbre(p.timbreHead) ? p.timbreHead : DEFAULT_TIMBRES.head,
    },
    web,
    mic: p.mic !== false,
  };
}

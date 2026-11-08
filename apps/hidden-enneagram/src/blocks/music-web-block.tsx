import { defineBlock, RichText, type PropsOf } from "@elkdonis/blocks";
import { editingOf, type PuckEditing } from "@elkdonis/blocks/record";
import { WebOfMusic } from "@/components/music-web/web-of-music";
import { isTuning, TUNINGS } from "@/lib/sound/tuning";
import { MUSIC_NOTE } from "@/lib/music-copy";

// ============================================================================
// The web of music (he-music-web): the twelve-note world beside the nine, as
// a ring (layout E of the research report) or a Tonnetz, sounding when
// touched and lit by the microphone. Server component; the web itself is one
// client island, inert in the editor.
// ============================================================================


const props = [
  { name: "eyebrow", kind: "string", label: "Eyebrow", default: "Sound", inlineEditable: true },
  { name: "heading", kind: "string", label: "Heading", default: "The web of music", inlineEditable: true },
  {
    name: "intro",
    kind: "richtext",
    label: "Introduction",
    default: "<p>Twelve notes make the musical world; the enneagram has nine points. Here they sit side by side. Turn the sound on and touch a note, a point or a triad, or sing and see where your voice lands.</p>",
  },
  {
    name: "view",
    kind: "select",
    label: "Opens on",
    default: "ring",
    options: [
      { value: "ring", label: "The ring of 9 and 12" },
      { value: "tonnetz", label: "The Tonnetz" },
    ],
  },
  { name: "tuning", kind: "select", label: "The nine as notes", default: "ouspensky", options: TUNINGS.map((t) => ({ value: t.value, label: t.label })) },
  { name: "note", kind: "richtext", label: "Note under it", default: MUSIC_NOTE },
] as const;

type Props = PropsOf<typeof props> & { puck?: PuckEditing };

export function HeMusicWeb(p: Props) {
  const { drawn } = editingOf(p.puck);
  const web = <WebOfMusic view={p.view === "tonnetz" ? "tonnetz" : "ring"} tuning={isTuning(p.tuning) ? p.tuning : "ouspensky"} drawn={drawn} />;
  return (
    <section className="blk he-music-web">
      {p.eyebrow || p.heading || p.intro ? (
        <header className="he-section-head">
          {p.eyebrow ? <p className="he-eyebrow">{p.eyebrow}</p> : null}
          {p.heading ? <h2>{p.heading}</h2> : null}
          {typeof p.intro === "string" && p.intro.trim() ? <RichText className="he-lede" body={p.intro} /> : null}
        </header>
      ) : null}
      {drawn ? <div inert>{web}</div> : web}
      {typeof p.note === "string" && p.note.trim() ? <RichText className="he-mw-credit he-sound-note" body={p.note} /> : null}
    </section>
  );
}

export const heMusicWeb = defineBlock(
  {
    id: "he-music-web",
    label: "Web of music",
    category: "content",
    description: "The twelve notes beside the enneagram's nine: a ring or a Tonnetz that sounds when touched and lights up when someone sings.",
    memberSafe: true,
    styling: "tokens",
    props,
    parts: {
      root: { label: "Block", sel: "> .he-music-web" },
      heading: { label: "Heading", sel: "> .he-music-web .he-section-head h2", prop: "heading" },
      stage: { label: "The web", sel: ".he-mw-stage" },
      controls: { label: "Controls", sel: ".he-mw-controls" },
      note: { label: "Note under it", sel: ".he-mw-credit" },
    },
    tokens: [
      { name: "--he-aurum", label: "Gold (lit notes)", type: "color" },
      { name: "--he-heart", label: "Major triads", type: "color" },
      { name: "--he-head", label: "Minor triads", type: "color" },
    ],
  },
  HeMusicWeb,
);

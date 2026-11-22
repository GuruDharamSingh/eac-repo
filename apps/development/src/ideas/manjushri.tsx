import { OneDocument } from "./manjushri/OneDocument";
import { Findings } from "./manjushri/Findings";
import type { Idea } from "./types";

// Metadata lives here, not in the "use client" file: a server page reads these fields, and a
// client module exports references, not values.

// The rules of docs/open/MANJUSHRI_2026-11-20/DOCTRINE.md, in the words a site owner would use.
const RULES: readonly { rule: string; means: string }[] = [
  { rule: "One document, in Puck's format", means: "No second copy of a page, and no private format. What Puck saves is what the public page draws." },
  { rule: "Words on one side, look on the other", means: "Every block keeps what it says apart from how it looks. Neither side can be written through the other's door." },
  { rule: "One door for every change", means: "A click in the look panel, typing in a field and an assistant's request are the same kind of step, checked the same way." },
  { rule: "Our canvas is where you edit", means: "Puck holds the document, moves blocks and shows a block's settings. It does not own the screen." },
  { rule: "Every value knows its owner", means: "A title on a card belongs to the card or to the gathering behind it. Editing it changes the right one, and says which." },
  { rule: "A machine proposes, a person publishes", means: "An assistant's change waits as a draft. Nothing it writes goes live on its own." },
  { rule: "Blocks declare, editors do not guess", means: "A block lists its parts, colours and fields once. Every editor and every assistant tool is built from that list." },
  { rule: "A block reads its surroundings before it asks for settings", means: "A smart block works out what to show from the site, the page it is on, who is looking and what sits beside it. It offers a setting only for what it cannot know." },
];

function Manjushri() {
  return (
    <>
      <p className="dev-lede">
        A page is one stored document. Today Puck is the only thing that may change it, through its own panels. The idea here: Puck keeps the document and the dragging, and steps back from everything else. The look
        belongs to our own editor, the words to the on-page field editor, and an assistant can do what either does by sending the same steps. Try all three below, on a real block.
      </p>
      <OneDocument />
      <div className="mjf">
        <h2>What we would hold to</h2>
        <p>These rules came out of reading Puck's code, our look editor and our field editors side by side. The demo above follows the second and third.</p>
        <ol className="mjf-steps">
          {RULES.map((r) => (
            <li key={r.rule}>
              <div>
                <strong>{r.rule}</strong>
                <span>{r.means}</span>
              </div>
            </li>
          ))}
        </ol>
      </div>
      <Findings />
    </>
  );
}

const idea: Idea = {
  slug: "one-document-three-hands",
  title: "One document, three hands",
  summary: "Restyle a real block, retype its words, or send the change as an assistant would. All three write one document, and neither side can overwrite the other.",
  status: "exploring",
  added: "2026-11-20",
  refs: ["docs/open/MANJUSHRI_2026-11-20 (DOCTRINE.md, puck-internals.md, aesthetic-layer.md, fields-and-mcp.md)", "packages/direct-edit/src/block/morph.ts", "packages/house-editor"],
  Component: Manjushri,
};

export default idea;

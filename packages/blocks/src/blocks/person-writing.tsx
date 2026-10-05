import { WritingSection, type ShelfItem } from "@elkdonis/cms-ui/writing";
import { defineBlock, type PropsOf } from "../registry";
import { PersonBlockNote, type PuckContext } from "./person-note";

// ============================================================================
// The writing shelf — PersonPage's writing section as a block.
//
// cms-ui WritingSection, as the plain page draws it: pieces read at the
// host's writing route (`basePath`), drafts listed only for the owner (the
// loader decides which pieces reach `pieces`; `editable` only marks them).
// ============================================================================

const props = [
  { name: "heading", kind: "string", label: "Heading", default: "Writing" },
  { name: "limit", kind: "number", label: "How many pieces", default: 4, min: 1, max: 12 },
] as const;

export type PersonWritingProps = PropsOf<typeof props> & {
  pieces?: ShelfItem[];
  basePath?: string;
  off?: boolean;
  editable?: boolean;
  puck?: PuckContext;
};

export function PersonWriting({ heading = "Writing", limit = 4, pieces = [], basePath = "", off, editable, puck }: PersonWritingProps) {
  if (off) return <PersonBlockNote puck={puck}>Writing is switched off in your page settings.</PersonBlockNote>;
  if (pieces.length === 0 && !editable) return <PersonBlockNote puck={puck}>No writing published yet.</PersonBlockNote>;
  return (
    <div className="blk-person-section blk-person-writing">
      <WritingSection items={pieces} basePath={basePath} editable={Boolean(editable)} heading={heading || "Writing"} limit={limit} />
    </div>
  );
}

export const personWriting = defineBlock(
  {
    id: "person-writing",
    category: "listings",
    label: "Their writing",
    description: "Their writing shelf: the latest pieces, with a link to the rest.",
    props,
    memberSafe: true,
    styling: "tokens",
    dataDriven: true,
  },
  PersonWriting,
  () => ({
    heading: "Writing",
    limit: 4,
    basePath: "#",
    pieces: [
      { id: "sample-1", slug: "notes-on-infrared-film", title: "Notes on infrared film", lede: "A darkroom process worked out over one winter.", status: "published" as const },
    ],
  })
);

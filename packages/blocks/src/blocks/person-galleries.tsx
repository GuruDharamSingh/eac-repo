import { PersonGalleryCards, type PersonGalleryCard } from "@elkdonis/cms-ui/profile";
import { defineBlock, type PropsOf } from "../registry";
import { PersonBlockNote, type PuckContext } from "./person-note";

// ============================================================================
// Their galleries, as cards — PersonPage's galleries section as a block.
// ============================================================================

const props = [
  { name: "heading", kind: "string", label: "Heading", default: "Galleries" },
] as const;

export type PersonGalleriesProps = PropsOf<typeof props> & {
  galleries?: PersonGalleryCard[];
  off?: boolean;
  editable?: boolean;
  puck?: PuckContext;
};

export function PersonGalleries({ heading = "Galleries", galleries = [], off, puck }: PersonGalleriesProps) {
  if (off) return <PersonBlockNote puck={puck}>Galleries are switched off in your page settings.</PersonBlockNote>;
  if (galleries.length === 0) return <PersonBlockNote puck={puck}>No galleries yet.</PersonBlockNote>;
  return (
    <div className="blk-person-section">
      <PersonGalleryCards title={heading || "Galleries"} items={galleries} />
    </div>
  );
}

export const personGalleries = defineBlock(
  {
    id: "person-galleries",
    category: "listings",
    label: "Their galleries",
    description: "Each of their galleries as a card with its cover.",
    props,
    memberSafe: true,
    styling: "tokens",
    dataDriven: true,
  },
  PersonGalleries,
  () => ({
    heading: "Galleries",
    galleries: [
      { href: "#", title: "Cold room editions", coverUrl: null, meta: "12 works" },
      { href: "#", title: "Lake studies", coverUrl: null, meta: "8 works" },
    ],
  })
);

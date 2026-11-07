import type { PlaceLink, PlaceLinkKind } from "@/lib/catalogue-types";

const LABEL: Record<PlaceLinkKind, string> = {
  wikipedia_en: "Wikipedia",
  wikipedia_fr: "Wikipédia (français)",
  website: "Official site",
  wikidata: "Wikidata",
  osm: "OpenStreetMap",
};

const SOURCE: Record<PlaceLink["source"], string> = {
  wikidata: "via Wikidata",
  osm: "via OpenStreetMap",
  manual: "added by the editors",
};

/** Outbound links for a place, each with where the link came from. Server- and client-safe. */
export function PlaceLinks({ links, compact = false }: { links: PlaceLink[]; compact?: boolean }) {
  if (!links.length) return null;
  return (
    <ul className={`flex flex-wrap gap-x-4 gap-y-1 ${compact ? "text-xs" : "text-sm"}`} aria-label="Links">
      {links.map((l) => (
        <li key={`${l.kind}-${l.url}`}>
          <a href={l.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
            {LABEL[l.kind] ?? l.kind} ↗
          </a>{" "}
          <span className="opacity-70">{SOURCE[l.source] ?? l.source}</span>
        </li>
      ))}
    </ul>
  );
}

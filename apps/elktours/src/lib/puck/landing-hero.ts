/**
 * The desktop landing's heading, in code (2026-11-20). The saved `puck:landing` tree stores the heading as a words
 * node ("See the City / with Local Artists"). The page now draws it as the block `hero-city-title` (one centred
 * line with a city chooser, its two phrases are settings; it was the live part `hero-title` for a day), so this swaps that one node at read time and leaves the stored row alone. A heading
 * the owner has since rewritten (anything not starting "See the City") is left as saved.
 */
type Node = { type?: string; props?: Record<string, unknown> };

const text = (html: unknown) => String(html ?? "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();

export function swapHeroTitle<T>(data: T): { data: T; swapped: boolean } {
  let swapped = false;
  const walk = (list: unknown): unknown => {
    if (!Array.isArray(list)) return list;
    return (list as Node[]).map((n) => {
      if (!n || typeof n !== "object" || !n.props) return n;
      // A page saved while the heading was still the live part: the same block.
      if (!swapped && n.type === "part" && n.props.part === "hero-title") {
        swapped = true;
        return { type: "hero-city-title", props: { id: n.props.id, before: "See", after: "with Local Artists." } };
      }
      if (!swapped && n.type === "words" && n.props.tag === "h1" && /^see the city\b/i.test(text(n.props.html))) {
        swapped = true;
        return { type: "hero-city-title", props: { id: n.props.id, before: "See", after: "with Local Artists." } };
      }
      // The tour list was the live part `tour-cards` (2026-11-21): the same list as a block, every setting at its default.
      if (n.type === "part" && n.props.part === "tour-cards") return { type: "tour-cards", props: { id: n.props.id } };
      const props = Object.fromEntries(Object.entries(n.props).map(([k, v]) => [k, Array.isArray(v) ? walk(v) : v]));
      return { ...n, props };
    });
  };
  const d = data as unknown as { content?: unknown };
  const content = walk(d.content);
  return { data: { ...(data as object), content } as T, swapped };
}

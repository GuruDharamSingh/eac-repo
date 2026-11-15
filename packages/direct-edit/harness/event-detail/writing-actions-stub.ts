// Stand-in for apps/sunjay/src/lib/puck/writing-actions.ts in the harness (2026-11-14): pieces shaped like the
// actions' answers, and a count of each call. Aliased in by run.sh's ALIAS.
const g = globalThis as any;
g.__pieceCalls = { sources: 0, choices: 0, draw: 0 };

const post = (slug: string, title: string, series: string | null) => ({
  id: `p-${slug}`, slug, title, lede: `${title}: its standfirst.`, bodyHtml: `<p>The body of ${title}.</p>`, coverImageUrl: null,
  layout: "essay", series, authorName: "Jason Ford aka sunjye", bylineName: null, readingMinutes: 4, publishedAt: "2026-10-19T12:00:00.000Z",
});
const MASKS = post("why-masks", "Why we wear masks", "Notes from the lab");
const BREATH = post("on-breath", "On breath", null);
const ALL: Record<string, any> = { [MASKS.slug]: MASKS, [BREATH.slug]: BREATH };

export async function pieceSourcesAction() {
  g.__pieceCalls.sources++;
  return [
    { ref: "all", label: "Writing shown on this site", hint: "2 pieces" },
    { ref: "series:Notes from the lab", label: "Notes from the lab", hint: "series, 1 piece" },
  ];
}
export async function pieceChoicesAction(source: string) {
  g.__pieceCalls.choices++;
  if (source === "all") return [
    { value: MASKS.slug, label: MASKS.title, hint: "Oct 19, 2026 · Jason Ford aka sunjye · Notes from the lab" },
    { value: BREATH.slug, label: BREATH.title, hint: "Oct 19, 2026 · Jason Ford aka sunjye" },
  ];
  if (source === "series:Notes from the lab") return [{ value: MASKS.slug, label: MASKS.title, hint: "Oct 19, 2026 · Jason Ford aka sunjye" }];
  return [];
}
export async function pieceDrawAction(slug: string) {
  g.__pieceCalls.draw++;
  await new Promise((r) => setTimeout(r, 40));
  const p = ALL[slug];
  return p ? { post: p } : null;
}

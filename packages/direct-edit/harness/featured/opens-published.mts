// Read-only: elktours' resolvers for Opens and Card against the live database, and what the published config draws
// (2026-11-06). Bundled by bundle-opens.cjs inside the elktours container.
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { resolveAllData } from "@puckeditor/core";
import { serverPuckConfig } from "@/lib/puck/config.server";
import { resolveOpens, cardRecord } from "@/lib/opens-server";

const DANA = "4eebc495-1db6-4b1e-a5b3-399326c78fe6", TOUR = "elkNapol001tour000003";
async function main() {
  const cases: Array<[string, string, boolean]> = [
    ["page", "page:/walking-notes", true],
    ["tour popup", `popup:tour:${TOUR}`, true],
    ["reviews of a tour, then its page", `popup:reviews:tour:${TOUR}>page:/tours/heritage-de-napoleon-bonaparte`, true],
    ["reviews of a public place", "popup:reviews:place:e634e4c2-990c-44b6-87d8-c2546b7aef44", true],
    ["person, then their page", `popup:person:${DANA}>page:/about/danamccool`, true],
    ["draft tour", "popup:tour:elkMediev01tour000004", false],
    ["archived tour", "popup:reviews:tour:mzyc19DNtQCRsvTa7r3w", false],
    ["draft experience", "popup:experience:elkPlaceholderExp0001", false],
    ["private place", "popup:reviews:place:9cbdb133-75e0-4899-a251-3e9677df97ba", false],
    ["another org's thread", "popup:tour:bl0whFnG6dS_7J9NvvLyS", false],
    ["a place profile as a person", "popup:person:c3985b44-5f64-4013-b87d-50e4f72fbfe0", false],
  ];
  let f = 0;
  for (const [name, v, want] of cases) {
    const o = await resolveOpens(v);
    const ok = want ? !!o : o === null;
    if (!ok) f++;
    console.log(ok ? "pass" : "  FAIL", name, "->", o ? `${o.href} ${o.popup?.key ?? "(page)"} ${JSON.stringify(o.popup?.props?.then ?? null)}` : null);
  }
  const card = await cardRecord(`thread:${TOUR}`);
  console.log(card?.title ? "pass" : "  FAIL", "card from a tour ->", card?.title, card?.meta, card?.href);
  const cardDraft = await cardRecord("thread:elkMediev01tour000004");
  console.log(cardDraft === null ? "pass" : "  FAIL", "card from a draft tour -> null");
  const doc = { root: { props: {} }, content: [
    { type: "link-button", props: { id: "b", label: "Read the reviews", href: "/tours", opens: `popup:reviews:tour:${TOUR}>page:/tours/heritage-de-napoleon-bonaparte` } },
    { type: "link-button", props: { id: "b2", label: "Plain", href: "/tours", opens: "" } },
    { type: "feature-card", props: { id: "c", record: `thread:${TOUR}`, opens: `popup:tour:${TOUR}`, tone: "panel" } },
    { type: "featured-person", props: { id: "p", person: `user:${DANA}`, opens: `popup:person:${DANA}` } },
    { type: "link-button", props: { id: "b3", label: "Forged", href: "/tours", opens: "popup:tour:elkMediev01tour000004", opened: { href: "javascript:alert(1)", popup: { key: "tour" } } } },
  ] };
  const filled = await resolveAllData(doc as never, serverPuckConfig as never, {});
  for (const n of filled.content as any[]) {
    const C = (serverPuckConfig.components as any)[n.type];
    const html = renderToStaticMarkup(h(C.render, { ...n.props, puck: { isEditing: false, metadata: {} } }));
    const a = /<a [^>]*>/.exec(html)?.[0] ?? "(no link)";
    console.log(n.props.id, a.replace(/&quot;/g, '"').slice(0, 260));
  }
  console.log(f ? `${f} failed` : "resolver cases passed");
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });

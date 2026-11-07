// Read-only: elktours' published config resolves Featured person references against the live database and draws them
// (2026-11-06). Run in the elktours container from apps/elktours, so "@/..." resolves.
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { resolveAllData } from "@puckeditor/core";
import { serverPuckConfig } from "@/lib/puck/config.server";

const DANA = "user:4eebc495-1db6-4b1e-a5b3-399326c78fe6";
const doc = { root: { props: {} }, content: [
  { type: "featured-person", props: { id: "a", person: DANA, morph: { v: 1, parts: { name: { color: "#b85c3a" } } } } },
  { type: "featured-person", props: { id: "b", person: "thread:elkNapol001tour000003:author" } },
  { type: "featured-person", props: { id: "c", person: "thread:elkNapol001tour000003:next-guide" } },
  { type: "featured-person", props: { id: "d", person: "thread:bl0whFnG6dS_7J9NvvLyS:next-host" } },
  { type: "featured-person", props: { id: "e", person: "user:c3985b44-5f64-4013-b87d-50e4f72fbfe0" } },
  { type: "featured-person", props: { id: "f", person: "", who: { displayName: "Forged" } } },
] };
async function main() {
const filled = await resolveAllData(doc as never, serverPuckConfig as never, {});
for (const n of filled.content as any[]) {
  const C = (serverPuckConfig.components as any)[n.type];
  const html = renderToStaticMarkup(h(C.render, { ...n.props, puck: { isEditing: false, metadata: {} } }));
  console.log(n.props.id, n.props.person || "(none)", "->", n.props.who?.displayName ?? null, "|", html.replace(/\s+/g, " ").slice(0, 160));
}
process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });

// elktours' save strip: the shared stripResolvedKeys (@elkdonis/blocks/record) with elktours' RESOLVED_KEYS
// (apps/elktours/src/lib/puck/resolved.ts), 2026-11-06. It replaced elktours' own walker after both were run on these
// documents and the shared one removed at least as much in every case (and more in "slot inside an object prop").
import { stripResolvedKeys } from "../../../blocks/src/record/resolved.ts";
import { RESOLVED_KEYS } from "../../../../apps/elktours/src/lib/puck/resolved.ts";

const strip = (d: unknown) => stripResolvedKeys(d, RESOLVED_KEYS) as any;
const who = { displayName: "D" };
const checks: Array<[string, boolean]> = [];
const t = (name: string, ok: boolean) => checks.push([name, ok]);

const top = { root: { props: { title: "t" } }, content: [{ type: "featured-person", props: { id: "a", person: "user:1", opens: "page:/x", who, opened: { href: "/x" }, morph: { v: 1, parts: { name: { color: "#000" } } } } }], zones: { "s:z": [{ type: "link-button", props: { id: "z", label: "L", opened: {} } }] } };
const before = JSON.stringify(top);
const a = strip(top);
t("Featured person: who and opened removed", !("who" in a.content[0].props) && !("opened" in a.content[0].props));
t("Featured person: person, opens and morph kept", a.content[0].props.person === "user:1" && a.content[0].props.opens === "page:/x" && a.content[0].props.morph.parts.name.color === "#000");
t("zone: Button's opened removed, label kept", !("opened" in a.zones["s:z"][0].props) && a.zones["s:z"][0].props.label === "L");
t("input untouched", JSON.stringify(top) === before);

const card = strip({ root: { props: {} }, content: [{ type: "feature-card", props: { id: "c", record: "thread:x", opens: "", bound: { title: "T" }, opened: null, title: "Typed" } }] });
t("Card: bound and opened removed, record and typed title kept", !("bound" in card.content[0].props) && !("opened" in card.content[0].props) && card.content[0].props.record === "thread:x" && card.content[0].props.title === "Typed");

const nested = strip({ root: { props: {} }, content: [{ type: "split-row", props: { id: "s", who: "split-row's own prop", left: [{ type: "box", props: { id: "bx", items: [{ type: "featured-person", props: { id: "n", who } }] } }] } }] });
t("nested in slots: who removed two levels down", !("who" in nested.content[0].props.left[0].props.items[0].props));
t("another block's own prop called who kept", nested.content[0].props.who === "split-row's own prop");

const deep = strip({ root: { props: {} }, content: [{ type: "x-block", props: { id: "o", region: { items: [{ type: "featured-person", props: { id: "deep", who } }] } } }] });
t("slot inside an object prop: who removed", !("who" in deep.content[0].props.region.items[0].props));

const rows = strip({ root: { props: {} }, content: [{ type: "faq", props: { id: "f", items: [{ q: "who?", a: "opened" }] } }] });
t("rows untouched", JSON.stringify(rows.content[0].props.items) === JSON.stringify([{ q: "who?", a: "opened" }]));

const hostile = strip(JSON.parse('{"root":{"props":{}},"content":[{"type":"featured-person","props":{"id":"h","__proto__":{"polluted":true},"constructor":"c","who":{}}}]}'));
const hp = hostile.content[0].props;
t("a stored __proto__ stays data, not the prototype", Object.getPrototypeOf(hp) === Object.prototype && Object.prototype.hasOwnProperty.call(hp, "__proto__") && (hp as any).polluted === undefined);
t("no global pollution", ({} as any).polluted === undefined);
t("not a document passes through", strip("text") === "text" && strip(null) === null);

let f = 0;
for (const [n, ok] of checks) { if (!ok) f++; console.log(ok ? "pass" : "  FAIL", n); }
console.log(f ? `${f} failed` : `all ${checks.length} passed`);

import { createRoot } from "react-dom/client";
import { FieldsLens } from "@elkdonis/house-editor/fields";
import { defineFields } from "@elkdonis/house-editor/fields/server";

const w = window as any;
w.__calls = [];
const registry = defineFields({
  thread: {
    capability: "thread-edit", label: "Post", shared: "This changes the post itself, everywhere it appears.",
    fields: {
      title: { label: "Title", input: "text", inline: true, max: 200, optional: false },
      excerpt: { label: "Summary", input: "textarea", readOnly: "The summary is made from the post's own text." },
      meta: { label: "Details", input: "text", readOnly: "The date comes from the gathering itself." },
    },
  },
});
const stored: Record<string, Record<string, string>> = {
  "block:home:h-1": { title: "Hero words", subtitle: "Sub words" },
  "block:home:c-typed": { kicker: "", title: "Typed card", body: "Typed body words", meta: "", marker: "" },
  "thread:abc123": { title: "A post title", excerpt: "A post summary", meta: "" },
};
createRoot(document.getElementById("lens")!).render(
  <FieldsLens
    registry={registry}
    blocks={{ map: w.__MAP__ }}
    load={async (a) => { w.__calls.push({ op: "load", ...a }); const v = stored[`${a.kind}:${a.id}`]; return v ? { ok: true, values: v, version: "v1" } : { ok: false, error: "No such record." }; }}
    save={async (i) => { w.__calls.push({ op: "save", ...i }); return { ok: true, values: i.values, version: "v2" }; }}
    labels={{ edit: "Edit wording", done: "Done" }}
  />,
);

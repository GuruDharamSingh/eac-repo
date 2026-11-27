// Harness page for the Edit button and Live edit (lane LIVE, 2026-11-23). The real EditEntry and the real FieldsLens,
// on a page with one of each kind of editable thing and stub load/save that only record what they were asked.
// Query: ?hide=<path> hides the button there (hiddenOn); ?nolive=1 mounts only the button.
import { createRoot } from "react-dom/client";
import { EditEntry, registerEditPage, setLive, useEditEntry } from "../src/entry/index";
import { FieldsLens, defineFields } from "../src/fields/index";

const registry = defineFields({
  section: {
    label: "Page section",
    records: {
      about: {
        label: "About",
        fields: {
          title: { input: "text", label: "Title", inline: true, max: 120 },
          body: { input: "rich", label: "Body" },
          photo: { input: "image", label: "Photo" },
        },
      },
    },
  },
  thread: {
    label: "Post",
    heading: "This post",
    shared: "This changes the post itself, everywhere it appears.",
    fields: { title: { input: "text", label: "Title", inline: true, max: 120 } },
  },
});

declare global { interface Window { __saves: unknown[]; __editPage: number; __loads: unknown[] } }
window.__saves = [];
window.__loads = [];
window.__editPage = 0;

const q = new URLSearchParams(location.search);

function App() {
  const e = useEditEntry();
  return (
    <>
      <EditEntry hiddenOn={q.get("hide") ? [q.get("hide")!] : []} editPageHref={() => null} />
      {!q.get("nolive") && (
        <FieldsLens
          registry={registry}
          live={{ on: e.live, onExit: () => setLive(false) }}
          load={async (t) => { window.__loads.push(t); return { ok: true, values: t.kind === "thread" ? { title: "A post" } : { title: "About us", body: "<p>Some <b>words</b> here.</p>", photo: "/old.jpg" }, version: "1" }; }}
          save={async (i) => { window.__saves.push(i); return { ok: true, version: "2" }; }}
          choosePicture={(host, o) => {
            host.innerHTML = '<div role="tablist"><button role="tab" data-t="upload">Upload</button><button role="tab" data-t="site">This site</button></div><input type="file" data-test-upload><button type="button" data-test-pick>Use this one</button>';
            host.querySelector("[data-test-pick]")!.addEventListener("click", () => o.onPick("/x.jpg"));
            return () => { host.innerHTML = ""; };
          }}
        />
      )}
    </>
  );
}

registerEditPage(async () => { window.__editPage++; });
createRoot(document.getElementById("app")!).render(<App />);

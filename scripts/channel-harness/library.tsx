// Harness: the unified content library (ContentLibrary) and the MediaLibrary wrapper, on mock endpoints.
// Build: build-library.mjs. Pages are listed in library-pages.json.
import * as React from "react";
import { createRoot } from "react-dom/client";
import { ContentLibrary, MediaLibrary } from "@elkdonis/content/ui";
import type { ContentListItem } from "@elkdonis/content/model";
// @ts-expect-error absolute path inside the build container (/repo is the repo root)
import { parseContentQuery } from "/repo/packages/content/src/query-string";
import { installMock, setSearchHandler } from "./library-mock";
import { DATA, IDS, TZ, answer } from "./library-data";

installMock();
setSearchHandler((u) => {
  const q = parseContentQuery(u.searchParams);
  if (!q) return { status: 400, body: { error: "scope is required" } };
  const slow = u.searchParams.get("q") === "slow";
  return { status: 200, body: answer(q), delay: slow ? 800 : 120 };
});
const page = (window as unknown as { __PAGE__: string }).__PAGE__;
const w = window as unknown as { __log: string[]; __pick?: unknown };
w.__log = [];

const SOURCES = [
  { key: "mine", label: "My files", endpoint: "/api/m/mine" },
  { key: "org", label: "Org", endpoint: "/api/m/org" },
];
const FOLDERS = { endpoint: "/api/content/folders", sources: [{ key: "mine", label: "My files" }, { key: "org", label: "Org" }] };

function Click({ sel, text, ms = 900 }: { sel: string; text?: string; ms?: number }) {
  React.useEffect(() => {
    const t = setTimeout(() => {
      const els = [...document.querySelectorAll(sel)] as HTMLElement[];
      (text ? els.find((e) => e.textContent?.includes(text)) : els[0])?.click();
    }, ms);
    return () => clearTimeout(t);
  }, [sel, text, ms]);
  return null;
}

const Frame = ({ title, children, width }: { title: string; children: React.ReactNode; width?: number }) => (
  <div className="hx-page">
    <header className="hx-ch">
      <div>
        <p className="chn-kicker">Harness</p>
        <h1>{title}</h1>
      </div>
    </header>
    <div style={width ? { maxWidth: width } : undefined}>{children}</div>
  </div>
);

function Media({ mode, view, open, extra }: { mode?: "browse" | "pick" | "pickMany"; view?: "list"; open?: boolean; extra?: Partial<React.ComponentProps<typeof MediaLibrary>> }) {
  const [picked, setPicked] = React.useState<string[]>([]);
  const [value, setValue] = React.useState<string | undefined>();
  return (
    <Frame title={`MediaLibrary ${mode ?? "pick"}`}>
      <MediaLibrary
        sources={SOURCES}
        mode={mode}
        accept="image/*,video/*,application/pdf,audio/*"
        defaultView={view === "list" ? "list" : "grid"}
        rememberAs={`h-${page}`}
        upload={{ endpoint: "/api/m-upload", label: "Upload" }}
        value={value}
        picked={picked}
        onPick={(f) => {
          setValue(f.url);
          w.__pick = { ...f, url: f.url.slice(0, 20) };
        }}
        onToggle={(f) => setPicked((p) => (p.includes(f.url) ? p.filter((x) => x !== f.url) : [...p, f.url]))}
        fileAction={(f) => ({ label: `Use ${f.name}`, onClick: () => undefined })}
        {...extra}
      />
      {open && <Click sel=".chn-brick" text="marsh-dawn" />}
    </Frame>
  );
}

const published = DATA.filter((i) => !i.key.startsWith("file:"));

/** A library on the mock search endpoint (or a function source). */
function Remote(p: Partial<React.ComponentProps<typeof ContentLibrary>> & { title: string; width?: number; click?: { sel: string; text?: string } }) {
  const { title, width, click, ...rest } = p;
  return (
    <Frame title={title} width={width}>
      <ContentLibrary identities={IDS} timeZone={TZ} source={{ endpoint: "/api/content/search" }} pageSize={6} {...rest} />
      {click && <Click {...click} />}
    </Frame>
  );
}

function Pick({ many }: { many?: boolean }) {
  const [value, setValue] = React.useState<string | undefined>();
  const [picked, setPicked] = React.useState<string[]>(many ? ["artwork:a2"] : []);
  return (
    <Frame title={many ? "pickMany (published pieces)" : "pick (published pieces)"}>
      <ContentLibrary
        items={published}
        identities={IDS}
        timeZone={TZ}
        mode={many ? "pickMany" : "pick"}
        value={value}
        picked={picked}
        onPick={(i) => setValue(i.key)}
        onToggle={(i) => setPicked((p) => (p.includes(i.key) ? p.filter((x) => x !== i.key) : [...p, i.key]))}
        countLabel={(a, b) => `${a} of ${b} · ${many ? picked.length : value ? 1 : 0} chosen`}
      />
    </Frame>
  );
}

function PickImage() {
  const [got, setGot] = React.useState<string>("");
  return (
    <Frame title="pickPart=image (published pieces)">
      <ContentLibrary
        items={published.filter((i) => i.key.startsWith("artwork"))}
        identities={IDS}
        timeZone={TZ}
        mode="pick"
        pickPart="image"
        onPick={(i, part) => {
          setGot(part?.image ? "image" : "item");
          w.__pick = { key: i.key, image: part?.image ? part.image.slice(0, 24) : null };
        }}
      />
      <p className="chn-quiet" data-got={got}>{got ? `Picked: ${got}` : ""}</p>
      <Click sel=".chn-brick" text="Salt Marsh" />
    </Frame>
  );
}

function FilesPick({ many }: { many?: boolean }) {
  const [value, setValue] = React.useState<string | undefined>();
  const [picked, setPicked] = React.useState<string[]>([]);
  return (
    <Frame title={many ? "Files pickMany (ContentLibrary)" : "Files pick (ContentLibrary)"}>
      <ContentLibrary
        view="files"
        lockView
        folders={FOLDERS}
        mode={many ? "pickMany" : "pick"}
        accept="image/*"
        value={value}
        picked={picked}
        rememberAs={`h-${page}`}
        upload={{ endpoint: "/api/m-upload" }}
        onPick={(i) => {
          setValue(i.links.public ?? undefined);
          w.__pick = { key: i.key, source: i.file?.source, path: i.file?.path };
        }}
        onToggle={(i) => setPicked((p) => (p.includes(i.links.public!) ? p.filter((x) => x !== i.links.public) : [...p, i.links.public!]))}
      />
    </Frame>
  );
}

let body: React.ReactNode;
switch (page) {
  // ── MediaLibrary wrapper (the old fixtures; DOM must match the pre-change build) ──
  case "media-pick":
    body = <Media mode="pick" />;
    break;
  case "media-pickmany":
    body = <Media mode="pickMany" />;
    break;
  case "media-list":
    body = <Media mode="browse" view="list" />;
    break;
  case "media-lightbox":
    body = <Media mode="browse" open />;
    break;
  case "media-flat":
    body = <Media mode="pick" extra={{ sources: [{ key: "flat", label: "Library", endpoint: "/api/m/flat" }] }} />;
    break;
  case "media-error":
    body = <Media mode="pick" extra={{ sources: [{ key: "locked", label: "Locked", endpoint: "/api/m/locked" }] }} />;
    break;
  case "media-browse":
    body = <Media mode="browse" />;
    break;
  // ── new: ContentLibrary v1 ──
  case "remote":
  case "remote-dark":
    body = <Remote title="Remote mode (endpoint)" />;
    break;
  case "remote-fn":
    body = (
      <Remote
        title="Remote mode (search function)"
        source={{ search: async (q) => { w.__log.push(JSON.stringify({ q: q.q, view: q.view, scope: q.scope.kind, limit: q.limit })); return answer(q); } }}
        view="published"
      />
    );
    break;
  case "remote-all":
    body = <Remote title="Published | Files | All, view=all" view="all" />;
    break;
  case "remote-files":
    body = <Remote title="Files from the index" view="files" />;
    break;
  case "remote-error":
    body = <Remote title="Remote error" source={{ search: async () => { throw new Error("The index is not reachable."); } }} />;
    break;
  case "remote-missing":
    body = <Remote title="Remote missing" source={{ search: async (q) => ({ ...answer(q), missing: ["Instagram", "Letters"] }) }} />;
    break;
  case "files-folders":
    body = (
      <Frame title="Files view with folders">
        <ContentLibrary view="files" lockView folders={FOLDERS} rememberAs={`h-${page}`} upload={{ endpoint: "/api/m-upload" }} />
      </Frame>
    );
    break;
  case "files-toggle":
    body = (
      <Frame title="Files view with folders, with the view toggle">
        <ContentLibrary view="files" folders={FOLDERS} rememberAs={`h-${page}`} />
      </Frame>
    );
    break;
  case "pick":
    body = <Pick />;
    break;
  case "pickmany":
    body = <Pick many />;
    break;
  case "files-pick":
    body = <FilesPick />;
    break;
  case "files-pickmany":
    body = <FilesPick many />;
    break;
  case "pick-image":
    body = <PickImage />;
    break;
  case "pick-attribution":
    body = (
      <Frame title="Pick: attribution on others' pieces">
        <ContentLibrary items={published.filter((i) => i.key.startsWith("artwork"))} identities={IDS} timeZone={TZ} mode="pick" onPick={() => undefined} />
      </Frame>
    );
    break;
  case "compact":
    body = <Remote title="Compact density (Puck side panel, 340 wide)" width={340} density="compact" view="all" lockView />;
    break;
  case "groupby-store":
    body = <Remote title="groupBy store" groupBy="store" types={["artwork"]} pageSize={20} lockView view="published" />;
    break;
  case "groupby-store-list":
    body = <Remote title="groupBy store, list" groupBy="store" types={["artwork"]} pageSize={20} lockView view="published" initial={{ view: "list" }} />;
    break;
  case "badges":
    body = (
      <Frame title="Sale and hidden badges (items mode, keeper)">
        <ContentLibrary items={published.filter((i) => i.key.startsWith("artwork"))} identities={IDS} timeZone={TZ} now="2026-11-26T12:00:00Z" />
      </Frame>
    );
    break;
  case "lightbox-extras":
    body = (
      <Frame title="Lightbox: itemActions and railSlot">
        <ContentLibrary
          items={published.filter((i) => i.key.startsWith("artwork"))}
          identities={IDS}
          timeZone={TZ}
          primaryAction={() => ({ label: "Manage this piece" })}
          itemActions={(i: ContentListItem) => (i.can?.hide ? [{ label: i.hidden ? "Show" : "Hide", onClick: () => undefined }] : [])}
          railSlot={() => <button type="button" className="chn-btn">Write about it</button>}
        />
        <Click sel=".chn-brick" text="Ash Vase" />
      </Frame>
    );
    break;
  case "onopen":
    body = (
      <Frame title="onOpen returns true: no lightbox">
        <ContentLibrary items={published} identities={IDS} timeZone={TZ} onOpen={(i) => { w.__log.push("host-open " + i.key); return true; }} />
        <Click sel=".chn-brick" text="Ash Vase" />
      </Frame>
    );
    break;
  default:
    body = <Media mode="browse" />;
}
createRoot(document.getElementById("root")!).render(<div className="chn hx">{body}</div>);

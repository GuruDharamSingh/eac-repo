// Para Theater's canvas editor outside Next: sunjay's own client config and contract, its compiled CSS and the try
// document. Saving runs what the host's save action runs, short of the database: stripResolved, cleanBoxDoc,
// sanitizeRichValues, validatePage. No network. Modes, by hash:
//   (none)        the editor on the saved document, else the try document
//   #doc=<file>   the editor on a JSON file served beside this page
//   #published    the saved document through <Render> with the server config's shape and no editor stylesheet
//   #puck         Puck's editor, on the saved document (the way back)
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { Render } from "@puckeditor/core/rsc";
import { MorphMark } from "/app/packages/direct-edit/src/puck/morph-mark";
import { BOX_BLOCKS, mountTreePage } from "/app/packages/direct-edit/src/puck/index";
import { cleanBoxDoc } from "/app/packages/direct-edit/src/block/puck-tree";
import { buildPuckConfig } from "/app/packages/page-builder/src/config";
import { PuckEditor } from "/app/packages/page-builder/src/editor";
import { validatePage } from "/app/packages/page-builder/src/validate";
import { sanitizeRichValues } from "/app/packages/blocks/src/text";
import { canvasConfig, canvasContract, puckConfig } from "/app/apps/sunjay/src/lib/puck/config.client";
import { CATALOGUE } from "/app/apps/sunjay/src/lib/puck/catalogue";
import { PublishedRoot } from "/app/apps/sunjay/src/lib/puck/page-root";
import { stripResolved } from "/app/apps/sunjay/src/blocks/resolved-keys";
import { choosePicture } from "/app/apps/sunjay/src/components/studio/page-picture-chooser";
import seed from "./sunjay-try-page.json";

const w = window as any;
const SAVED = "sunjay-try-saved";
const stored = () => { const raw = sessionStorage.getItem(SAVED); return raw ? JSON.parse(raw) : null; };
/** The save action's path through to what `savePage` writes. */
const chain = (d: unknown) => { const out: any = sanitizeRichValues(cleanBoxDoc(stripResolved(d))); return { out, check: validatePage(out) }; };

// config.server.ts's shape, without its resolvers: those read the database.
const blocks = [...CATALOGUE, ...(BOX_BLOCKS as any)] as any;
const publishedConfig: any = buildPuckConfig({ blocks, root: { props: [], wrap: PublishedRoot as any }, morph: MorphMark as any });
/** config.server.ts as it was before the canvas editor. */
const beforeConfig: any = buildPuckConfig({ blocks: CATALOGUE as any });
const toHtml = (config: any, data: any) => renderToStaticMarkup(createElement(Render as any, { config, data }));

w.kit = { seed, contract: canvasContract, chain, toHtml, publishedConfig, beforeConfig, stored };

async function main() {
  const host = document.getElementById("host")!;
  const hash = location.hash;
  if (hash === "#published") {
    createRoot(host).render(createElement(Render as any, { config: publishedConfig, data: stored() ?? seed }));
    w.ready = true;
    return;
  }
  if (hash === "#puck") {
    const initial = stored() ?? seed;
    w.published = [];
    createRoot(host).render(createElement(PuckEditor as any, { slug: "try", orgId: "sunjay", initial, config: puckConfig, title: "/try", onPublish: async (_: string, d: unknown) => { w.published.push(d); return { ok: true }; } }));
    w.ready = true;
    return;
  }
  await import("./sunjay-editor-css");
  const file = hash.startsWith("#doc=") ? hash.slice(5) : null;
  const doc = file ? await (await fetch(`/${file}`)).json() : stored() ?? seed;
  w.saved = [];
  const open = (d: any) => {
    const inner = document.createElement("div");
    host.replaceChildren(inner);
    w.ed = mountTreePage({
      host: inner,
      config: canvasConfig as any,
      contract: canvasContract as any,
      doc: d,
      resolved: {},
      metadata: { orgId: "sunjay", slug: "try" },
      choosePicture,
      pageName: (d.root?.props?.title as string) || "/try",
      blockEditorHref: "/studio/try",
      onSave: async (x: any) => {
        const { out, check } = chain(x);
        if (!check.ok) return { ok: false, error: "That page is not in a shape we can store." };
        w.saved.push(out);
        sessionStorage.setItem(SAVED, JSON.stringify(out));
        return { ok: true };
      },
      onDone: () => { w.done = (w.done ?? 0) + 1; },
    });
  };
  open(doc);
  w.ready = true;
}
main().catch((e) => { w.failed = String(e?.stack ?? e); console.error(e); });

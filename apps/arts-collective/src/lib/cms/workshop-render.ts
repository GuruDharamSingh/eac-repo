/**
 * Arts-collective adapter: reads workshop HTML/CSS from the filesystem and
 * delegates rendering to @elkdonis/cms-bindings.
 *
 * The pure types and render logic live in packages/cms-bindings — this file
 * only knows about filesystem paths.
 */
import fs from "fs";
import path from "path";
import {
  renderWorkshopTemplate as _render,
  type WorkshopTemplates,
} from "@elkdonis/cms-bindings";

// Re-export the canonical type so callers can import it from here.
export type { WorkshopPageData } from "@elkdonis/cms-bindings";

// ─── Template path resolution ─────────────────────────────────────────────────

function resolveTemplateDir(): string {
  const candidates = [
    path.join(process.cwd(), "../../packages/silex-nextcloud-connector/src/templates/workshop"),
    path.join(process.cwd(), "../../../packages/silex-nextcloud-connector/src/templates/workshop"),
    path.join(process.cwd(), "packages/silex-nextcloud-connector/src/templates/workshop"),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  throw new Error(`Workshop template dir not found. cwd=${process.cwd()}`);
}

let _dir: string | null = null;
function templateDir(): string {
  if (!_dir) _dir = resolveTemplateDir();
  return _dir;
}

function read(file: string): string {
  return fs.readFileSync(path.join(templateDir(), file), "utf-8");
}

function loadTemplates(): WorkshopTemplates {
  return {
    nav: read("html/eac-ws-nav.html"),
    hero: read("html/eac-ws-hero.html"),
    detailStrip: read("html/eac-ws-detail-strip.html"),
    about: read("html/eac-ws-about.html"),
    facilitator: read("html/eac-ws-facilitator.html"),
    schedule: read("html/eac-ws-schedule.html"),
    gallery: read("html/eac-ws-gallery.html"),
    testimonials: read("html/eac-ws-testimonials.html"),
    related: read("html/eac-ws-related.html"),
    register: read("html/eac-ws-register.html"),
  };
}

export function readWorkshopCss(): string {
  const tokenPath = path.join(templateDir(), "../tokens/eac-tokens.css");
  const sections = [
    "css/eac-ws-nav.css",
    "css/eac-ws-hero.css",
    "css/eac-ws-detail-strip.css",
    "css/eac-ws-about.css",
    "css/eac-ws-facilitator.css",
    "css/eac-ws-schedule.css",
    "css/eac-ws-gallery.css",
    "css/eac-ws-testimonials.css",
    "css/eac-ws-related.css",
    "css/eac-ws-register.css",
  ];
  const tokens = fs.existsSync(tokenPath) ? fs.readFileSync(tokenPath, "utf-8") : "";
  return [tokens, ...sections.map((f) => read(f))].join("\n");
}

export function renderWorkshopTemplate(
  data: import("@elkdonis/cms-bindings").WorkshopPageData
): string {
  return _render(data, loadTemplates());
}

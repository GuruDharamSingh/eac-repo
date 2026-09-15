import fs from "fs";
import path from "path";
import type { BindingMap } from "@elkdonis/cms-bindings";

/**
 * The Silex hub template, read from the connector package.
 *
 * The hub is a Silex TEMPLATE, not a hand-written page: the sections, their
 * markup and their stylesheet all live in
 * `packages/silex-nextcloud-connector/src/templates/hub/`, which is also what
 * the editor offers as the "EAC Hub Template" block category. Reading the
 * same files here means the page an org sees before they have touched Silex
 * is exactly the page they will get when they open it.
 *
 * The moment this org publishes its own `hub` page from Silex, that published
 * file should win — see `SilexSiteBySlug`, which the public pages already use.
 * Until then this is the fallback, and the two cannot drift because they are
 * the same template.
 */

type HubManifest = {
  id: string;
  tokens?: string;
  cssOrder: string[];
  sections: Array<{
    id: string;
    label: string;
    html: string;
    css: string;
    defaultVisible?: boolean;
    bindings?: BindingMap;
  }>;
};

/** Mirrors the resolver in the template CSS routes; dev, docker and standalone
 *  all put the monorepo root somewhere different relative to cwd. */
function resolveTemplatesDir(): string {
  const candidates = [
    path.join(process.cwd(), "../../packages/silex-nextcloud-connector/src/templates"),
    path.join(process.cwd(), "packages/silex-nextcloud-connector/src/templates"),
    path.join(process.cwd(), "../../../../packages/silex-nextcloud-connector/src/templates"),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error(`Silex templates dir not found. cwd=${process.cwd()}`);
}

function readManifest(): { dir: string; manifest: HubManifest } {
  const dir = path.join(resolveTemplatesDir(), "hub");
  const manifest: HubManifest = JSON.parse(
    fs.readFileSync(path.join(dir, "manifest.json"), "utf-8")
  );
  return { dir, manifest };
}

/** The manifest's sections, in the shape the binding engine wants. */
export function hubTemplateSections(): Array<{ id: string; bindings?: BindingMap }> {
  try {
    return readManifest().manifest.sections;
  } catch {
    return [];
  }
}

let cachedHtml: string | null = null;
let cachedCss: string | null = null;

/**
 * The template's default page: every section marked `defaultVisible`, in
 * manifest order, wrapped in the page element its stylesheet expects.
 *
 * Returns null rather than throwing if the template cannot be read — a hub
 * that loses its masthead is a worse outcome than a hub without one, and the
 * page renders its own content either way.
 */
export function hubTemplateHtml(): string | null {
  if (cachedHtml !== null) return cachedHtml;
  try {
    const { dir, manifest } = readManifest();
    const inner = manifest.sections
      .filter((section) => section.defaultVisible !== false)
      .map((section) => fs.readFileSync(path.join(dir, section.html), "utf-8"))
      .join("\n");
    cachedHtml = `<main class="eac-hub">\n${inner}\n</main>`;
    return cachedHtml;
  } catch (error) {
    console.error("[hidden-enneagram] hub template:", error);
    return null;
  }
}

/** Tokens, then every stylesheet in `cssOrder` — the pen included. */
export function hubTemplateCss(): string {
  if (cachedCss !== null) return cachedCss;
  const { dir, manifest } = readManifest();
  const parts: string[] = [];
  if (manifest.tokens) {
    parts.push(fs.readFileSync(path.resolve(dir, manifest.tokens), "utf-8"));
  }
  const seen = new Set<string>();
  for (const rel of manifest.cssOrder) {
    const body = fs.readFileSync(path.join(dir, rel), "utf-8");
    if (seen.has(body)) continue;
    seen.add(body);
    parts.push(`/* hub/${rel} */\n${body}`);
  }
  cachedCss = parts.join("\n\n");
  return cachedCss;
}

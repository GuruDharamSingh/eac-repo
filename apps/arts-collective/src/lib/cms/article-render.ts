import path from "path";
import fs from "fs";
import { applyManifestBindings } from "@elkdonis/cms-bindings";
import {
  loadTemplateManifest,
  readTemplateFile,
  templateDir,
} from "@elkdonis/cms-bindings/node";
import { sanitizePostBody } from "@elkdonis/utils";

/**
 * Render a published post through the `article` Silex template.
 *
 * This is the source of truth for what a published post looks like, and it is
 * the template — not `ArticleView` — deliberately. An org can edit a template
 * in the Silex editor; it cannot edit a React component. Making the template
 * the source is what turns "how our blog looks" into something an org owns
 * rather than something we ship.
 *
 * The two renderers agree by construction, not by discipline: the template's
 * CSS uses the same `--read-*` tokens and the same measurements as
 * `@elkdonis/cms-ui/article.css`. So a post reads identically whether it is
 * served live from the database by `ArticleView` or from a published artifact
 * by this. One reading environment, two ways in.
 *
 * `renderArticleDocument` produces a COMPLETE html document, because the
 * artifact is served as a file — there is no app shell around it.
 */

const TEMPLATE_ID = "article";

export interface ArticleContext {
  kind_label: string;
  org_name: string;
  title: string;
  excerpt: string | null;
  body_html: string;
  author_name: string | null;
  published_at_label: string | null;
  reading_time_label: string | null;
  cover_image_url: string | null;
  published_on_label: string | null;
  record_url: string | null;
  more_items_html: string | null;
}

export function readArticleCss(): string {
  const manifest = loadTemplateManifest(TEMPLATE_ID);
  const dir = templateDir(TEMPLATE_ID);
  const tokenRel = manifest.tokens ?? "../tokens/eac-tokens.css";
  const tokenPath = path.join(dir, tokenRel);
  const tokens = fs.existsSync(tokenPath) ? fs.readFileSync(tokenPath, "utf-8") : "";

  // Every section of this template shares one stylesheet, so de-duplicate
  // rather than emitting the reading CSS four times into the artifact.
  const order = manifest.cssOrder ?? manifest.sections.map((s) => s.css).filter(Boolean);
  const seen = new Set<string>();
  const sections = (order as string[])
    .filter((rel) => {
      if (seen.has(rel)) return false;
      seen.add(rel);
      return true;
    })
    .map((rel) => readTemplateFile(TEMPLATE_ID, rel));

  return [tokens, ...sections].join("\n");
}

/**
 * Compose the sections in manifest order and bind the post into them.
 *
 * Returns a fragment. `sectionIds` lets a caller drop optional sections — the
 * "more from this page" nav is `defaultVisible: false` and only makes sense
 * when there is something to link to.
 */
export function renderArticleFragment(
  ctx: ArticleContext,
  sectionIds?: string[]
): string {
  const manifest = loadTemplateManifest(TEMPLATE_ID);
  const sections = manifest.sections.filter((s) =>
    sectionIds ? sectionIds.includes(s.id) : s.defaultVisible !== false
  );

  const page = sections
    .map((s) => readTemplateFile(TEMPLATE_ID, s.html))
    .join("\n");

  // The engine binds per section, scoped by `data-gjs-type` — trait names are
  // only unique within a section (`authorName` appears in both the masthead
  // and the colophon and must resolve independently in each).
  return applyManifestBindings(page, sections, { article: ctx });
}

/**
 * A complete, standalone document — what gets written to Nextcloud.
 *
 * Self-contained on purpose: the CSS is inlined rather than linked, so the
 * artifact renders correctly served from anywhere, mirrored, or opened from
 * disk years later. That portability is most of the reason to publish a file
 * at all.
 */
export function renderArticleDocument(
  ctx: ArticleContext,
  options: { reading?: "journal" | "gazette" | "quiet"; lang?: string } = {}
): string {
  const { reading = "journal", lang = "en" } = options;

  // The body arrives as author HTML and is sanitized HERE, once, on the way
  // into a file that will be served verbatim forever after. An artifact is not
  // re-sanitized on read.
  const safe: ArticleContext = { ...ctx, body_html: sanitizePostBody(ctx.body_html) };

  const fragment = renderArticleFragment(safe);
  const css = readArticleCss();
  const title = escapeHtml(ctx.title);
  const description = ctx.excerpt ? escapeHtml(ctx.excerpt) : "";

  return `<!doctype html>
<html lang="${escapeHtml(lang)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
${description ? `<meta name="description" content="${description}">\n` : ""}<meta property="og:title" content="${title}">
${description ? `<meta property="og:description" content="${description}">\n` : ""}<meta property="og:type" content="article">
${ctx.cover_image_url ? `<meta property="og:image" content="${escapeHtml(ctx.cover_image_url)}">\n` : ""}<style>
${css}
</style>
</head>
<body>
<article class="eac-art" data-reading="${escapeHtml(reading)}">
${fragment}
</article>
</body>
</html>
`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

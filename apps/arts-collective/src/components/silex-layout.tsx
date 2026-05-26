import { unstable_cache } from "next/cache";
import type { OrgSummary } from "@/lib/org";
import { getOrgWorkshopForTemplate } from "@/lib/org";
import {
  downloadPublishedFile,
  parseSilexPublishedRef,
} from "@/lib/silex-published";
import { renderSilexHtmlWithEmbeds } from "@/components/silex-embeds";
import { applyWorkshopTraits } from "@elkdonis/cms-bindings";

/**
 * Strips <script> tags from artist-authored HTML.
 *
 * Phase 1 baseline sanitization (plan §Q4 option b). Full sanitization with a
 * proper allow-list lands in Phase 3 hardening. The publishing endpoint is
 * already owner-gated, but we belt-and-suspenders here because the rendered
 * HTML is inlined into the org's public surface.
 */
function stripScripts(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, "")
    .replace(/\son\w+\s*=\s*'[^']*'/gi, "")
    .replace(/javascript:/gi, "");
}

async function fetchPublishedHtml(ref: string): Promise<string | null> {
  const parsed = parseSilexPublishedRef(ref);
  if (!parsed) return null;
  const buf = await downloadPublishedFile(parsed);
  return buf?.toString("utf8") ?? null;
}

function rewriteAssetUrls(html: string, slug: string): string {
  const base = `/api/silex/assets/${encodeURIComponent(slug)}`;
  return html
    .replace(/(href|src)=(['"])\/(css|assets)\//gi, `$1=$2${base}/$3/`)
    .replace(/url\((['"]?)\/(css|assets)\//gi, `url($1${base}/$2/`);
}

export async function SilexLayout({ org }: { org: OrgSummary }) {
  const path = org.silex_published_path;
  const cacheKey = org.silex_published_at ?? "no-publish";

  const html = path
    ? await unstable_cache(
        () => fetchPublishedHtml(path),
        ["silex-published-html", org.id, cacheKey],
        { revalidate: 60 }
      )()
    : null;

  if (!html) {
    return (
      <section className="border-b border-border bg-accent/20">
        <div className="mx-auto max-w-5xl px-6 py-16">
          <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
            {org.name} custom layout
          </p>
          <h1 className="mt-3 font-serif text-3xl leading-tight md:text-4xl">
            Custom layout coming soon.
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground">
            Your design will appear here once Silex is live and you&apos;ve
            published your first version.
          </p>
        </div>
      </section>
    );
  }

  let safe = stripScripts(rewriteAssetUrls(html, org.slug));

  // If the published HTML contains workshop data-trait slots, bind live DB
  // values from the org's primary published workshop into them.
  if (safe.includes('data-trait=')) {
    const workshopData = await getOrgWorkshopForTemplate(org.id);
    if (workshopData) {
      safe = applyWorkshopTraits(safe, workshopData);
    }
  }

  const content = await renderSilexHtmlWithEmbeds(safe, org);

  return (
    <section className="silex-layout" data-org={org.slug}>
      <link rel="stylesheet" href="/api/silex/templates/workshop.css" />
      <style>{`
        .eac-compound{box-sizing:border-box;margin:28px 0;padding:34px;border:1px solid #d8ddd8;border-radius:8px;background:#f7f4ee;color:#17201b;font-family:Inter,Arial,sans-serif}
        .eac-compound *{box-sizing:border-box}.eac-compound h2{margin:0;font-size:34px;line-height:1.12;letter-spacing:0}.eac-compound p{margin:10px 0 0;line-height:1.6;color:#4f5e55}
        .eac-kicker{margin:0 0 10px!important;font-size:12px!important;font-weight:700;text-transform:uppercase;letter-spacing:0;color:#0f766e!important}
        .eac-compound-copy,.eac-compound-header{max-width:680px}.eac-compound-stack{display:grid;gap:14px;margin-top:22px}.eac-compound-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin-top:22px}.eac-two-col{grid-template-columns:repeat(2,minmax(0,1fr))}
        .eac-mini-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:22px}.eac-mini-grid div{padding:14px;border:1px solid #d8ddd8;border-radius:8px;background:#fff}.eac-mini-grid strong{display:block;font-size:24px}.eac-mini-grid span{font-size:12px;color:#647067}.eac-wide{margin-bottom:18px}
        @media(max-width:540px){.eac-compound{padding:22px}.eac-compound-grid,.eac-two-col,.eac-mini-grid{grid-template-columns:1fr}.eac-compound h2{font-size:28px}}
      `}</style>
      {content}
    </section>
  );
}
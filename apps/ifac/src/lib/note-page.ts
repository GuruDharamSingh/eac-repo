import { NextResponse } from "next/server";
import { siteConfig } from "@/config/site";

/**
 * A small standalone HTML page for the series' one-click mail links
 * (unsubscribe, "I'm coming"): a title, a few lines, an optional link and an
 * optional one-button form. Inline styles only, so it renders without the
 * site's CSS. Measured 2026-10-10 (WCAG): ink #1f1b16 on #fbf8f2 16.15:1,
 * muted #5b5348 7.14:1, link/button #6b4e16 7.27:1, #fff on #6b4e16 7.70:1.
 */
export function notePage(
  body: {
    title: string;
    lines: string[];
    link?: { label: string; href: string };
    form?: { action: string; fields: Record<string, string>; button: string };
  },
  status = 200
): NextResponse {
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const form = body.form
    ? `<form method="post" action="${esc(body.form.action)}">${Object.entries(body.form.fields)
        .map(([k, v]) => `<input type="hidden" name="${esc(k)}" value="${esc(v)}">`)
        .join("")}<button type="submit" style="font:inherit;font-size:1rem;padding:12px 22px;border:0;border-radius:6px;background:#6b4e16;color:#fff;cursor:pointer">${esc(body.form.button)}</button></form>`
    : "";
  const link = body.link
    ? `<p style="margin:24px 0 0"><a href="${esc(body.link.href)}" style="color:#6b4e16;text-decoration:underline">${esc(body.link.label)}</a></p>`
    : "";
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>${esc(body.title)} · ${esc(siteConfig.shortName ?? siteConfig.orgName)}</title></head>
<body style="margin:0;background:#fbf8f2;color:#1f1b16;font-family:Georgia,'Times New Roman',serif">
<main style="max-width:32rem;margin:0 auto;padding:72px 20px">
<p style="font-family:Arial,Helvetica,sans-serif;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#5b5348;margin:0 0 12px">${esc(siteConfig.orgName)}</p>
<h1 style="font-size:2rem;line-height:1.2;margin:0 0 16px;font-weight:normal">${esc(body.title)}</h1>
${body.lines.map((l) => `<p style="font-size:1.05rem;line-height:1.6;color:#5b5348;margin:0 0 12px">${esc(l)}</p>`).join("")}
${form}${link}
</main></body></html>`;
  return new NextResponse(html, { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}

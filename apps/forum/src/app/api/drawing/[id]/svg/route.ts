import { getDrawing } from "@elkdonis/services";

/**
 * GET — the picture. This is what the post's <img> points at, on every host.
 *
 * Served as an image, not a document: `Content-Disposition: inline` with an
 * image type and a sandboxing CSP, so an SVG someone drew can never run as
 * a page of this origin. Cached briefly and revalidated — a save replaces it
 * and the thread page should not show yesterday's picture for long.
 */
export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const drawing = await getDrawing(id);
  if (!drawing || !drawing.svg) return new Response("Not found", { status: 404 });
  return new Response(drawing.svg, {
    status: 200,
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Content-Disposition": "inline",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; font-src data:; img-src data:",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "public, max-age=60, must-revalidate",
      "Last-Modified": new Date(drawing.updatedAt).toUTCString(),
    },
  });
}

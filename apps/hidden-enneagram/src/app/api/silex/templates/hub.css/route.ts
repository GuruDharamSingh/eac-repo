import { hubTemplateCss } from "@/lib/hub-template";

/**
 * The hub template's stylesheet — tokens, the spotlight-grid pen, then the
 * hub's own layout. Linked by /hub, and by any page that renders a published
 * hub, so the two are styled by one file.
 */
export async function GET() {
  return new Response(hubTemplateCss(), {
    headers: {
      "content-type": "text/css; charset=utf-8",
      "cache-control": "public, max-age=300",
    },
  });
}

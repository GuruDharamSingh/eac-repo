import { readTemplateCss } from "@elkdonis/cms-bindings/node";
import { DOSSIER_TEMPLATE_ID } from "@elkdonis/cms-bindings/dossier";

/**
 * The dossier template's stylesheet.
 *
 * Reading order — tokens, then cssOrder — belongs to the template, not to this
 * app, so it comes from `readTemplateCss`. This route used to re-derive it AND
 * append the file frame (`.eac-dossier-file`, the desk, the sheet), which meant
 * a page published from Silex got the sections with no file around them. The
 * frame lives in the template's own chrome.css now.
 */
let cached: string | null = null;

export async function GET() {
  if (cached === null) cached = readTemplateCss(DOSSIER_TEMPLATE_ID);
  return new Response(cached, {
    headers: {
      "content-type": "text/css; charset=utf-8",
      "cache-control": "public, max-age=300",
    },
  });
}

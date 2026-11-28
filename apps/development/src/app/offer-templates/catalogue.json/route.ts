import { getNetworkAdmin } from "@/lib/gate";
import { buildCatalogue } from "@/offer-templates/catalogue";

// ============================================================================
// The offer-page catalogue as one JSON document, for agents (backend ones too).
//
//   GET /development/offer-templates/catalogue.json
//
// Every template's data needs, actions, patterns, files and status; every layer
// (popup) and flow; the design tokens; the data contract. Built from
// src/offer-templates/catalogue.ts, which imports each template's own meta file,
// so it follows the code. `generatedFrom` lists the files it was read from.
//
// Gated like the rest of the app: a network admin only. Not an admin (or signed
// out): 401 with a JSON body. Send the same session cookie the browser has.
// ============================================================================

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await getNetworkAdmin())) {
    return Response.json({ error: "unauthorized", message: "Network admin session required." }, { status: 401, headers: { "cache-control": "no-store" } });
  }
  return Response.json(buildCatalogue(), { headers: { "cache-control": "private, no-store" } });
}

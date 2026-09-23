import { NextResponse } from "next/server";
import { getApiEditor } from "@/lib/auth";
import { loadEmailSuite } from "@/lib/email-suite";

/**
 * The suite's data, fetched by the popup when it opens.
 *
 * It is a route rather than a prop because the surface provider lives in the
 * ROOT layout — passing the suite down would put seven queries on every page
 * of the site to serve a popup most visitors never open. The hub page still
 * loads it directly for the tile, which has to draw real correspondence.
 */
export async function GET() {
  const editor = await getApiEditor();
  if (!editor) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ data: await loadEmailSuite(), canEdit: editor.canEdit });
}

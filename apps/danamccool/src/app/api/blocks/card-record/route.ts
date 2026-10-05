import { NextResponse } from "next/server";
import { loadCardRecord } from "@/lib/card-records";

/**
 * One Card's live record, for the editor's canvas: `?ref=artwork:<id>` or
 * `?ref=gallery:<id>`. Ungated for the artworks route's reason: it returns
 * only what the published page itself shows, scoped to this site's owner.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const ref = new URL(request.url).searchParams.get("ref");
  return NextResponse.json({ record: await loadCardRecord(ref) });
}

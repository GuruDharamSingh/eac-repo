import { NextResponse, type NextRequest } from "next/server";
import { timeZoneAt } from "@elkdonis/astro/server";

/** IANA time zone at a coordinate, for when coordinates are typed in by hand. */
export async function GET(request: NextRequest) {
  const lat = Number(request.nextUrl.searchParams.get("lat"));
  const lon = Number(request.nextUrl.searchParams.get("lon"));
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return NextResponse.json({ error: "Invalid coordinates" }, { status: 400 });
  }
  return NextResponse.json({ timezone: timeZoneAt(lat, lon) });
}

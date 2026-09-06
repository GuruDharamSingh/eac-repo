/**
 * The card as a shareable PNG.
 *
 * Rendered with next/og (Satori), which does NOT run Tailwind — every style
 * here is inline, and this layout is a deliberate sibling of the web card
 * rather than a reuse of it. Trying to share JSX between the two always ends
 * in a hunt for whichever CSS property Satori doesn't implement.
 *
 * ?og=1 gives the 1200x630 landscape variant for link previews; the default is
 * a 1200x1600 portrait card for downloading and messaging.
 */

import { ImageResponse } from "next/og";
import { getCardBySlug, listTiers } from "@/lib/data";
import { displayTier } from "@/lib/rubric";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const card = await getCardBySlug(slug);
  if (!card) return new Response("Not found", { status: 404 });

  const tiers = await listTiers();
  const { tier, provisional } = displayTier(tiers, card);
  const accent = tier?.accentHex ?? "#8A8A8A";

  const og = new URL(request.url).searchParams.get("og") === "1";
  const width = 1200;
  const height = og ? 630 : 1600;

  const front = card.images.find((i) => i.role === "front") ?? card.images[0];
  // Satori can't fetch a relative URL, and it needs a real origin. This is also
  // why both derivatives are JPEG: resvg's WebP support is unreliable.
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
  const photo = front ? `${origin}${front.url}` : null;

  const place = card.areaName ?? card.cityName ?? "Toronto";

  return new ImageResponse(
    (
      <div
        style={{
          width,
          height,
          display: "flex",
          flexDirection: og ? "row" : "column",
          background: "#12171d",
          padding: 28,
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            flex: 1,
            borderRadius: 24,
            padding: 8,
            background: accent,
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              flex: 1,
              borderRadius: 18,
              overflow: "hidden",
              background: "#f4f5f6",
            }}
          >
            {/* Satori has no percentage heights inside a flex child, so the
                photo box is sized explicitly. These numbers are the frame
                interior minus the nameplate — change one, change both. */}
            <div
              style={{
                display: "flex",
                width: og ? 560 : 1128,
                height: og ? 498 : 1304,
                background: "#d8dbde",
                overflow: "hidden",
              }}
            >
              {photo && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={photo}
                  width={og ? 560 : 1128}
                  height={og ? 498 : 1304}
                  style={{ objectFit: "cover" }}
                />
              )}
            </div>

            <div style={{ display: "flex", flexDirection: "column", padding: 28 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: og ? 34 : 52, fontWeight: 700, color: "#1b2430" }}>
                  {card.title.slice(0, 40)}
                </span>
                {tier && (
                  <span
                    style={{
                      fontSize: og ? 18 : 26,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: 2,
                      color: provisional ? accent : "#fff",
                      background: provisional ? "transparent" : accent,
                      border: `3px solid ${accent}`,
                      borderRadius: 999,
                      padding: "6px 18px",
                    }}
                  >
                    {tier.label}
                  </span>
                )}
              </div>

              <div style={{ display: "flex", gap: 20, marginTop: 12 }}>
                <span style={{ fontSize: og ? 22 : 30, color: "#5a6472" }}>
                  {card.species?.name ?? card.proposedSpeciesName ?? "Unidentified"}
                </span>
                <span style={{ fontSize: og ? 22 : 30, color: "#5a6472" }}>· {place}</span>
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            paddingTop: 18,
            fontSize: og ? 20 : 26,
            color: "#8b95a3",
          }}
        >
          <span>pigeonshoot</span>
          <span>
            {provisional ? "provisional " : ""}
            {card.autoScore}/{card.autoMax}
          </span>
        </div>
      </div>
    ),
    {
      width,
      height,
      headers: {
        // Busted by the ?v= the share links append when a card is re-rated.
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      },
    }
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getArtworkById } from "@elkdonis/commerce/queries";
import { PriceBlock, BuyNowButton } from "@elkdonis/commerce/components";
import { formatMoney } from "@elkdonis/commerce/money";
import { ArtworkGallery } from "@/components/artwork-gallery";
import { addArtworkToCart } from "@/app/actions";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const artwork = await getArtworkById(id);
  return { title: artwork?.title ?? "Artwork" };
}

export default async function ArtworkDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const artwork = await getArtworkById(id);
  if (!artwork) notFound();

  const variant = artwork.variants?.[0];
  const lot = artwork.lot;
  const dims = [artwork.heightCm, artwork.widthCm, artwork.depthCm]
    .filter((d): d is number => d != null);

  const specs: Array<[string, string]> = [];
  if (artwork.medium) specs.push(["Medium", artwork.medium]);
  if (artwork.yearCreated) specs.push(["Year", String(artwork.yearCreated)]);
  if (dims.length >= 2)
    specs.push([
      "Dimensions",
      `${dims.join(" × ")} cm  ·  ${dims.map((d) => (d / 2.54).toFixed(1)).join(" × ")} in`,
    ]);
  if (artwork.style) specs.push(["Style", artwork.style]);
  if (artwork.subject) specs.push(["Subject", artwork.subject]);
  specs.push(["Kind", artwork.kind.replace("_", " ")]);
  if (artwork.certificateOfAuthenticity)
    specs.push(["Authenticity", "Certificate of authenticity included"]);

  return (
    <main className="mx-auto max-w-7xl px-6 py-12">
      <nav className="mb-8 text-sm text-muted-foreground">
        <Link href="/artworks" className="underline-offset-4 hover:underline">
          Artworks
        </Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">{artwork.title}</span>
      </nav>

      <div className="grid grid-cols-1 gap-12 lg:grid-cols-2">
        <ArtworkGallery
          images={(artwork.media ?? []).map((m) => ({ url: m.url, alt: m.alt }))}
          title={artwork.title}
        />

        <div className="flex flex-col gap-6">
          <div>
            <h1 className="font-serif text-4xl leading-tight tracking-tight">
              {artwork.title}
            </h1>
            {artwork.artistName && (
              <p className="mt-2 text-lg text-muted-foreground">
                {artwork.artistSlug ? (
                  <Link
                    href={`/artists/${artwork.artistSlug}`}
                    className="underline-offset-4 hover:underline"
                  >
                    {artwork.artistName}
                  </Link>
                ) : (
                  artwork.artistName
                )}
              </p>
            )}
          </div>

          <PriceBlock artwork={artwork} variant={variant} lot={lot} size="lg" />

          {/* Purchase / auction action */}
          {lot ? (
            <div className="rounded-lg border border-border bg-accent/30 p-5">
              <p className="font-medium">This piece is being sold at auction.</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Place a bid before {new Date(lot.endAt).toLocaleString("en-CA")}.
                {lot.buyNowMinor
                  ? ` Or buy it now for ${formatMoney(lot.buyNowMinor, lot.currency)}.`
                  : ""}
              </p>
              <Link
                href={`/lots/${lot.id}`}
                className="mt-4 inline-flex h-11 items-center justify-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                View auction & bid
              </Link>
            </div>
          ) : variant && artwork.status === "available" ? (
            <BuyNowButton
              artwork={artwork}
              variant={variant}
              onAdd={addArtworkToCart}
            />
          ) : (
            <div className="rounded-md bg-muted p-4 text-sm text-muted-foreground">
              {artwork.status === "sold"
                ? "This piece has sold."
                : artwork.status === "reserved"
                ? "This piece is reserved pending payment."
                : "This piece is not currently available for purchase."}
            </div>
          )}

          {/* Specs */}
          <dl className="divide-y divide-border border-y border-border">
            {specs.map(([k, v]) => (
              <div key={k} className="flex gap-4 py-3 text-sm">
                <dt className="w-32 shrink-0 text-muted-foreground">{k}</dt>
                <dd className="capitalize">{v}</dd>
              </div>
            ))}
          </dl>

          {artwork.descriptionHtml && (
            <div className="prose prose-sm max-w-none">
              <h2 className="font-serif text-xl">About this work</h2>
              <div
                className="mt-2 text-sm leading-relaxed text-foreground/90"
                dangerouslySetInnerHTML={{ __html: artwork.descriptionHtml }}
              />
            </div>
          )}

          {artwork.provenanceNotes && (
            <div>
              <h2 className="font-serif text-xl">Provenance</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {artwork.provenanceNotes}
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

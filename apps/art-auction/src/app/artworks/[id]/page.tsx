import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  getArtworkById,
  getStore,
  incrementArtworkView,
  isArtworkFavorited,
} from "@elkdonis/commerce/queries";
import { isPresentedBy } from "@elkdonis/commerce/server";
import { PresentButtons } from "@/components/present-buttons";
import { Button } from "@/components/ui/button";
import { PriceBlock, BuyNowButton } from "@elkdonis/commerce/components";
import { formatMoney } from "@elkdonis/commerce/money";
import { sanitizeRichText } from "@elkdonis/utils";
import { ArtworkGallery } from "@/components/artwork-gallery";
import { FavoriteButton } from "@/components/favorite-button";
import { MessageArtistButton } from "@/components/message-artist-button";
import { addArtworkToCart } from "@/app/actions";
import { getCurrentUserId, listActableStores } from "@/lib/marketplace-auth";

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
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ via?: string }>;
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const artwork = await getArtworkById(id);
  if (!artwork) notFound();

  // The window the visitor came through, honoured only if that store really
  // presents this piece (and is not simply the seller).
  const viaStoreId =
    sp.via && sp.via !== artwork.storeId && (await isPresentedBy(sp.via, artwork.id)) ? sp.via : null;
  const viaStore = viaStoreId ? await getStore(viaStoreId) : null;

  // Count this view (fire-and-forget; never blocks render).
  void incrementArtworkView(artwork.id);

  const userId = await getCurrentUserId();
  const [favorited, actable] = await Promise.all([
    userId ? isArtworkFavorited(userId, artwork.id) : Promise.resolve(false),
    userId ? listActableStores() : Promise.resolve([]),
  ]);

  const variant = artwork.variants?.[0];
  const lot = artwork.lot;
  const atAuction = Boolean(lot && (lot.status === "live" || lot.status === "scheduled"));
  const priceOnRequest = !variant || variant.priceMinor <= 0;

  // Fronts the viewer runs (owner/manager) that could present this piece —
  // i.e. not the store that already sells it.
  const presentable = actable.filter(
    (s) => s.status === "active" && s.id !== artwork.storeId && (s.ownerKind === "user" || s.myRole !== "staff")
  );
  const presentOptions = await Promise.all(
    presentable.map(async (s) => ({
      storeId: s.id,
      name: s.displayName ?? "Store",
      presented: await isPresentedBy(s.id, artwork.id),
    }))
  );
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
        <Link href="/" className="underline-offset-4 hover:underline">
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

          <div className="flex items-start justify-between gap-4">
            <PriceBlock artwork={artwork} variant={variant} lot={lot} size="lg" />
            <FavoriteButton
              artworkId={artwork.id}
              initialFavorited={favorited}
              variant="full"
            />
          </div>

          {/* Purchase / auction action. While a lot is open the lot is the
              only way to own the piece (addToCart refuses it), so buy-now is
              offered only when nothing is at auction. */}
          {viaStore && (
            <p className="text-sm text-muted-foreground">
              Presented by{" "}
              <Link href={`/artists/${viaStore.slug ?? viaStore.id}`} className="underline underline-offset-4">
                {viaStore.displayName ?? "a front"}
              </Link>
              . Sold by the artist; the presenting organisation’s share, if any, is by agreement.
            </p>
          )}

          {variant && artwork.status === "available" && !atAuction && !priceOnRequest ? (
            <div className="flex flex-col gap-3">
              <BuyNowButton
                artwork={artwork}
                variant={variant}
                onAdd={addArtworkToCart.bind(null, viaStoreId)}
              />
            </div>
          ) : artwork.status === "available" && !atAuction && priceOnRequest ? (
            <div className="rounded-lg border border-border bg-accent/30 p-5">
              <p className="font-medium">Price on request.</p>
              <p className="mt-1 text-sm text-muted-foreground">
                This piece is shown without a listed price. Message the artist to ask
                about it or to arrange a sale.
              </p>
            </div>
          ) : lot && atAuction ? (
            <div className="rounded-lg border border-border bg-accent/30 p-5">
              <p className="font-medium">This piece is being sold at auction.</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Place a bid before {new Date(lot.endAt).toLocaleString("en-CA")}.
                {lot.buyNowMinor
                  ? ` Or buy it now for ${formatMoney(lot.buyNowMinor, lot.currency)}.`
                  : ""}
              </p>
              <Button asChild size="lg" className="mt-4">
                <Link href={`/lots/${lot.id}`}>View auction & bid</Link>
              </Button>
            </div>
          ) : (
            <div className="rounded-md bg-muted p-4 text-sm text-muted-foreground">
              {artwork.status === "sold"
                ? "This piece has sold."
                : artwork.status === "reserved"
                ? "This piece is reserved pending payment."
                : "This piece is not currently available for purchase."}
            </div>
          )}

          {/* Ask the artist (hidden on your own piece) */}
          {userId !== artwork.artistUserId && (
            <MessageArtistButton
              artworkId={artwork.id}
              artistName={artwork.artistName ?? null}
            />
          )}

          {/* Fronts the viewer runs: present this piece in them */}
          {presentOptions.length > 0 && (
            <PresentButtons artworkId={artwork.id} options={presentOptions} />
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
                dangerouslySetInnerHTML={{ __html: sanitizeRichText(artwork.descriptionHtml) }}
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

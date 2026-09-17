import type { Metadata } from "next";
import Link from "next/link";
import { listArtworks } from "@elkdonis/commerce/queries";
import { VirtualGallery } from "@/components/virtual-gallery";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "The gallery",
  description:
    "Walk a room hung with work from the marketplace, and buy a piece from in front of it.",
};

/**
 * How many pieces the room holds before it starts to crowd. The layout refuses
 * the overflow rather than double-hang, so this is kept in step with what the
 * six walls can take.
 */
const ROOM_CAPACITY = 40;

export default async function GalleryPage() {
  const artworks = await listArtworks({ limit: ROOM_CAPACITY });

  if (artworks.length === 0) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-24 text-center">
        <h1 className="font-serif text-4xl tracking-tight">The gallery</h1>
        <p className="mt-4 text-muted-foreground">
          Nothing is hung yet. Once artists publish work to the marketplace it
          appears in this room.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-[1600px] px-4 py-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4 px-2">
        <div>
          <h1 className="font-serif text-4xl tracking-tight">The gallery</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            A room hung with work from the marketplace. Walk up to a piece to
            read it, and buy it from where you are standing.
          </p>
        </div>
        <Link
          href="/"
          className="text-sm underline underline-offset-4 hover:no-underline"
        >
          See everything as a list →
        </Link>
      </header>

      <div className="overflow-hidden rounded-xl border border-border bg-muted">
        <VirtualGallery artworks={artworks} />
      </div>
    </main>
  );
}

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  listStoresForUser,
  listArtworksForPerson,
  listSeriesForUser,
  listStoreArtworks,
} from "@elkdonis/commerce/queries";
import { ProductGrid } from "@elkdonis/commerce/components";
import { getCurrentUserId, getCurrentUser } from "@/lib/marketplace-auth";
import { siteConfig } from "@/config/site";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Profile · My art" };

/**
 * The Profile tab (ORG_STORE_BRIEF D9): where this person shows across the
 * network — their ArtDirect page, every store they run or sit on, the series
 * they are in, and how their cards read — so the connections between stores,
 * organisations and credited work can be checked in one place.
 */
export default async function PresencePage() {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/login?next=/studio/presence");
  const [user, stores, pieces, series] = await Promise.all([
    getCurrentUser(),
    listStoresForUser(userId),
    listArtworksForPerson(userId, { status: ["available", "reserved", "sold"] }),
    listSeriesForUser(userId),
  ]);
  const net = siteConfig.network;
  const own = stores.find((s) => s.ownerUserId === userId) ?? null;
  const orgStores = stores.filter((s) => s.ownerKind === "org");
  const sample = pieces.filter((a) => a.status === "available").slice(0, 6);
  const byStore = new Map<string, number>();
  for (const a of pieces) byStore.set(a.storeId, (byStore.get(a.storeId) ?? 0) + 1);
  const storeShowcases = await Promise.all(
    orgStores.map(async (s) => ({ store: s, count: (await listStoreArtworks(s.id).catch(() => [])).length }))
  );

  const Card = ({ title, href, blurb, external }: { title: string; href: string; blurb: string; external?: boolean }) => (
    <a href={href} target={external ? "_blank" : undefined} rel={external ? "noopener" : undefined} className="rounded-lg border border-border p-4 text-sm hover:bg-muted/40">
      <p className="font-medium">{title}</p>
      <p className="mt-1 text-muted-foreground">{blurb}</p>
    </a>
  );

  return (
    <div className="space-y-12">
      <section>
        <h2 className="mb-4 font-serif text-2xl tracking-tight">Where you show</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Card
            title="ArtDirect page"
            href={user?.slug ? `${net.artdirectUrl}/${user.slug}` : net.artdirectUrl}
            blurb={user?.slug ? "Your network profile: bio, galleries, services, your store and work credited to you." : "Your network profile."}
            external
          />
          {own && (
            <Card
              title={`${own.displayName ?? "Your store"} (your store)`}
              href={own.slug ? `/artists/${own.slug}` : "/artists"}
              blurb={`${byStore.get(own.id) ?? 0} of your pieces listed here. ${own.status === "active" ? "Active." : own.status}`}
            />
          )}
          {storeShowcases.map(({ store, count }) => (
            <Card
              key={store.id}
              title={`${store.displayName ?? "Organisation store"} (you are ${store.myRole})`}
              href={store.slug ? `/artists/${store.slug}` : "/artists"}
              blurb={`${count} listed · ${byStore.get(store.id) ?? 0} credited to you.`}
            />
          ))}
          {series.map((s) => (
            <Card
              key={s.id}
              title={s.title}
              href={`/series/${s.slug}`}
              blurb={`Auction series · ${s.roles.map((r) => (r === "artist" ? "your work" : r)).join(", ")} · ${s.phase}.`}
            />
          ))}
          <Card title="Arts Collective hub" href={`${net.artsCollectiveUrl}/hub`} blurb="Your organisations, workshops and community." external />
        </div>
      </section>

      <section>
        <h2 className="mb-1 font-serif text-2xl tracking-tight">How your cards read</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          The same card appears on the marketplace, on your ArtDirect page and on any organisation
          site that shows your store. Credited pieces name you as the artist with the holding store
          as seller.
        </p>
        {sample.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No listed pieces yet.</p>
        ) : (
          <ProductGrid items={sample} hrefBuilder={(a) => `/artworks/${a.id}`} artistHrefBuilder={() => null} density="tight" label="Your cards" />
        )}
      </section>
    </div>
  );
}

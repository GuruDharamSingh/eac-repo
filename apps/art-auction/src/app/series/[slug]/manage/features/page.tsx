import { listStores } from "@elkdonis/commerce/queries";
import { loadHeroSettings } from "@/lib/home-hero";
import { HeroForm } from "@/app/admin/pages/hero-form";
import { loadWorkspace } from "../load";

/** Features: what the marketplace home leads with during this series (the hero's artist slides). */
export default async function FeaturesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { series } = await loadWorkspace(slug);
  const [stores, hero] = await Promise.all([listStores({ limit: 60 }).catch(() => []), loadHeroSettings()]);
  const artists = stores.filter((st) => st.ownerKind === "user" && st.displayName).map((st) => ({ id: st.id, name: st.displayName! }));
  return (
    <>
      <div>
        <h1 className="sw-h1">Features</h1>
        <p className="sw-sub">
          The band at the top of the marketplace home rotates between this series (once published, with one of its lots) and
          featured artists, each shown with their newest pictured work. Choose the artists and their order here.
        </p>
      </div>
      <HeroForm artists={artists} initial={hero.featuredStoreIds} viaSeriesSlug={series.slug} dark />
      <p className="sw-hint">
        The series slide uses the series&rsquo; own page copy and lots; the same list is in Admin → Pages for the site&rsquo;s owners.
        {series.status !== "published" ? " This series is a draft, so its slide is not on the home page yet." : ""}
      </p>
    </>
  );
}

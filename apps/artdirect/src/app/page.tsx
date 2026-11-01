import Link from "next/link";
import { listDossiers, listDirectoryFacets } from "@/lib/oad";
import type { EntityType } from "@elkdonis/services";
import { OadCard } from "@/components/site/OadCard";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ region?: string; entity?: string }> };

const NETWORK_URL = process.env.NEXT_PUBLIC_ARTS_COLLECTIVE_URL;

export default async function ArtDirectHome({ searchParams }: Props) {
  const { region, entity } = await searchParams;
  const entityType: EntityType | undefined = entity === "organization" ? "organization" : entity === "person" ? "person" : undefined;
  const [dossiers, facets] = await Promise.all([listDossiers({ region, entityType }), listDirectoryFacets()]);

  const chip = (active: boolean) => (active ? "oad-chip oad-chip--on" : "oad-chip");

  return (
    <main className="oad-index">
      <div className="oad-index-head">
        <div>
          <p className="oad-kicker">
            {NETWORK_URL ? (
              <a href={NETWORK_URL} title="Elkdonis Arts Collective — the network">
                ArtDirect · an Arts Collective commons
              </a>
            ) : (
              "ArtDirect · an Arts Collective commons"
            )}
          </p>
          <h1 className="oad-index-title">The Artist Directory</h1>
          <p className="oad-index-lede">
            An open, community-built record of artists — a wiki and classifieds for the field.
            Anyone can open a file on an artist they know; artists can claim and verify their own;
            the network vouches. {dossiers.length} on record{region ? ` in ${region}` : ""}.
          </p>
        </div>
        <Link href="/new" className="oad-chip oad-chip--on oad-chip--lead">
          + Open a file
        </Link>
      </div>

      <form method="get" className="oad-filter">
        <input
          className="oad-input"
          name="region"
          defaultValue={region ?? ""}
          list="ad-filter-regions"
          autoComplete="off"
          placeholder="Filter by region…"
          aria-label="Filter by region"
        />
        <datalist id="ad-filter-regions">
          {facets.regions.map((r) => <option key={r} value={r} />)}
        </datalist>
        <button type="submit" className="oad-chip oad-chip--on">Filter</button>
        {region && <Link href="/" className="oad-chip">Clear</Link>}
      </form>

      <div className="oad-facets">
        {([
          [undefined, "All"],
          ["person", "Artists"],
          ["organization", "Organizations"],
        ] as const).map(([value, label]) => (
          <Link
            key={label}
            href={{ pathname: "/", query: { ...(region ? { region } : {}), ...(value ? { entity: value } : {}) } }}
            className={chip(entityType === value)}
          >
            {label}
          </Link>
        ))}
      </div>

      {dossiers.length === 0 ? (
        <p className="oad-empty">
          No dossiers on file yet. <Link href="/new">Open the first file →</Link>
        </p>
      ) : (
        <ul className="oad-grid">
          {dossiers.map((d) => (
            <OadCard key={d.slug} item={d} />
          ))}
        </ul>
      )}
    </main>
  );
}

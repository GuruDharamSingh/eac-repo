import Link from "next/link";
import { listDossiers, listDirectoryFacets, type DossierListItem } from "@/lib/oad";
import type { EntityType } from "@elkdonis/services";
import { searchContent, type ContentSearchResult } from "@elkdonis/content/server";
import type { ContentPerson } from "@elkdonis/content/model";
import { contentHost } from "@/lib/content-host";
import { OadCard } from "@/components/site/OadCard";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ region?: string; entity?: string; kind?: string; q?: string; after?: string }> };

/** The directory's three kinds (content library v1.3 §16, Justin 2026-11-27). */
type Kind = "artist" | "organization" | "associated";
const KINDS: ReadonlyArray<readonly [Kind | undefined, string]> = [
  [undefined, "All"],
  ["artist", "Artists"],
  ["organization", "Organizations"],
  ["associated", "Associated"],
];

const NETWORK_URL = process.env.NEXT_PUBLIC_ARTS_COLLECTIVE_URL;
const PAGE = 48;

/**
 * The directory as one search (content library v1.3, 2026-11-26): the people view
 * of searchContent over content_index (store person, migration 298), with text
 * search, region and kind filters, counts, and keyset pages (`after`). Signed out
 * or in, the same public rows: the people view admits listed identities only.
 *
 * Until migration 298 is applied and the people are indexed, the search fails or
 * comes back empty; the page then draws the earlier list (listDossiers, first 60,
 * no search) so the directory never goes blank.
 */
export default async function ArtDirectHome({ searchParams }: Props) {
  const { region, entity, kind: kindParam, q, after } = await searchParams;
  // `kind` is the three-way split; the older `entity` links still work (person = artists, organization = both org kinds).
  const kind: Kind | undefined =
    kindParam === "artist" || kindParam === "organization" || kindParam === "associated" ? kindParam
    : entity === "person" ? "artist" : undefined;
  const entityType: EntityType | undefined = !kind && entity === "organization" ? "organization" : undefined;
  const text = (q ?? "").trim().slice(0, 200);

  let found: ContentSearchResult | null = null;
  try {
    found = await searchContent(null, {
      scope: { kind: "network" },
      view: "people",
      q: text || undefined,
      region: region || undefined,
      entityTypes: entityType ? [entityType] : undefined,
      listingKinds: kind ? [kind] : undefined,
      cursor: after ?? null,
      limit: PAGE,
    }, contentHost);
  } catch (err) {
    console.error("[artdirect] directory search:", err instanceof Error ? err.message : err);
  }
  const indexed = Boolean(found && (found.items.length > 0 || text || region || entityType || kind || after));

  let dossiers: DossierListItem[];
  let regions: string[];
  let total: number;
  let counts: Record<Kind | "all", number> | null = null;
  let nextAfter: string | null = null;
  if (found && indexed) {
    dossiers = found.items.flatMap((it) => (it.person ? [toDossier(it.title, it.cover, it.person)] : []));
    const people = found.facets.people;
    regions = (people?.regions ?? []).map((r) => r.value);
    const by = Object.fromEntries((people?.listingKinds ?? []).map((e) => [e.value, e.count])) as Partial<Record<Kind, number>>;
    counts = {
      artist: by.artist ?? 0, organization: by.organization ?? 0, associated: by.associated ?? 0,
      all: (by.artist ?? 0) + (by.organization ?? 0) + (by.associated ?? 0),
    };
    total = kind ? counts[kind] : entityType === "organization" ? counts.organization + counts.associated : counts.all;
    nextAfter = found.nextCursor;
  } else {
    const fallbackType: EntityType | undefined = entityType ?? (kind === "artist" ? "person" : kind ? "organization" : undefined);
    const [list, facets] = await Promise.all([listDossiers({ region, entityType: fallbackType }), listDirectoryFacets()]);
    dossiers = list;
    regions = facets.regions;
    total = list.length;
  }

  const chip = (active: boolean) => (active ? "oad-chip oad-chip--on" : "oad-chip");
  const keep = (extra: Record<string, string | undefined>) =>
    Object.fromEntries(Object.entries({ q: text || undefined, region: region || undefined, kind, entity: entityType, ...extra }).filter(([, v]) => v)) as Record<string, string>;

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
            the network vouches. {total} on record{region ? ` in ${region}` : ""}{text ? ` matching “${text}”` : ""}.
          </p>
        </div>
        <Link href="/new" className="oad-chip oad-chip--on oad-chip--lead">
          + Open a file
        </Link>
      </div>

      <form method="get" className="oad-filter" data-directory={indexed ? "search" : "list"}>
        {indexed && (
          <input
            className="oad-input"
            name="q"
            type="search"
            defaultValue={text}
            autoComplete="off"
            placeholder="Search names, places, work…"
            aria-label="Search the directory"
          />
        )}
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
          {regions.map((r) => <option key={r} value={r} />)}
        </datalist>
        {kind && <input type="hidden" name="kind" value={kind} />}
        {entityType && <input type="hidden" name="entity" value={entityType} />}
        <button type="submit" className="oad-chip oad-chip--on">{indexed ? "Search" : "Filter"}</button>
        {(region || text) && <Link href="/" className="oad-chip">Clear</Link>}
      </form>

      <div className="oad-facets">
        {KINDS.map(([value, label]) => {
          const n = counts ? counts[value ?? "all"] : null;
          return (
            <Link
              key={label}
              href={{ pathname: "/", query: keep({ kind: value, entity: undefined }) }}
              className={chip(kind === value && !entityType)}
            >
              {label}{n != null ? ` · ${n}` : ""}
            </Link>
          );
        })}
      </div>

      {dossiers.length === 0 ? (
        <p className="oad-empty">
          {text || region ? "Nobody on record matches that. " : "No dossiers on file yet. "}
          <Link href="/new">Open a file →</Link>
        </p>
      ) : (
        <ul className="oad-grid">
          {dossiers.map((d) => (
            <OadCard key={d.slug} item={d} />
          ))}
        </ul>
      )}

      {(nextAfter || after) && (
        <nav className="oad-facets" aria-label="More of the directory" data-directory-pager>
          {after && <Link href={{ pathname: "/", query: keep({}) }} className="oad-chip">← First page</Link>}
          {nextAfter && <Link href={{ pathname: "/", query: keep({ after: nextAfter }) }} className="oad-chip oad-chip--on">Next page →</Link>}
        </nav>
      )}
    </main>
  );
}

function toDossier(
  name: string,
  cover: string | null,
  p: ContentPerson
): DossierListItem {
  return {
    slug: p.slug,
    name,
    occupation: p.headline,
    location: p.location,
    region: p.region,
    country: p.country,
    portrait_url: cover,
    claim_status: p.claimStatus,
    verified: p.verified,
    vouch_count: p.vouches,
    entity_type: p.entityType,
  };
}

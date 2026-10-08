import Link from "next/link";
import type { PropDef } from "@elkdonis/blocks";
import type { EntityType } from "@elkdonis/services";
import type { DirectoryFacets, DossierListItem } from "@/lib/oad";
import { LOOK_PROPS } from "./look";

// ============================================================================
// The directory home, as sections.
//
// Each section is a presentational component plus its content props declared
// as @elkdonis/blocks `PropDef`s — the same split the shared block library
// uses — with the shared look fields (./look) appended. That is what
// `defineBlock` needs, and page-builder adds the generic Style field to every
// block itself, so opening these to an editor later means registering
// DIRECTORY_SECTIONS, not rewriting the page.
//
// Content props come from the page definition (./directory-page). Live data
// (the dossiers, the region list, the current filter) comes from the request
// and is passed as `data`, never stored in the page — the same rule as a
// data-driven block's server half.
// ============================================================================

export type DirectoryData = {
  dossiers: DossierListItem[];
  facets: DirectoryFacets;
  region?: string;
  entityType?: EntityType;
};

const networkUrl = process.env.NEXT_PUBLIC_ARTS_COLLECTIVE_URL;

// ── Intro ────────────────────────────────────────────────────────────────────

const introProps = [
  { name: "eyebrow", kind: "string", label: "Small label above", default: "ArtDirect · an Elkdonis commons" },
  { name: "title", kind: "string", label: "Heading", default: "The Artist Directory" },
  {
    name: "body",
    kind: "text",
    label: "Introduction",
    default:
      "An open, community-built record of artists — a wiki and classifieds for the field. Anyone can open a file on an artist they know; artists can claim and verify their own; the network vouches.",
  },
  { name: "ctaLabel", kind: "string", label: "Button label", default: "+ Open a file" },
] as const satisfies readonly PropDef[];

export type IntroProps = { eyebrow?: string; title?: string; body?: string; ctaLabel?: string };

export function DirectoryIntro({ props, data }: { props: IntroProps; data: DirectoryData }) {
  const { eyebrow, title, body, ctaLabel } = props;
  const count = data.dossiers.length;
  return (
    <div className="ad-intro">
      <div className="ad-intro-text">
        {eyebrow && <p className="ad-eyebrow">{eyebrow}</p>}
        <h1 className="ad-title">{title}</h1>
        {body && <p className="ad-lede">{body}</p>}
        <p className="ad-record">
          <span className="ad-record-count">{count}</span> on record{data.region ? ` in ${data.region}` : ""}
          {networkUrl && (
            <>
              {" · "}
              <a href={networkUrl} title="Elkdonis Arts Collective — the network">
                part of the Elkdonis network
              </a>
            </>
          )}
        </p>
      </div>
      {ctaLabel && (
        <Link href="/new" className="ad-button" data-variant="stamp">
          {ctaLabel}
        </Link>
      )}
    </div>
  );
}

// ── Filters ──────────────────────────────────────────────────────────────────

const filterProps = [
  { name: "placeholder", kind: "string", label: "Region box hint", default: "Filter by region…" },
] as const satisfies readonly PropDef[];

export type FilterProps = { placeholder?: string };

const ENTITY_TABS = [
  [undefined, "All"],
  ["person", "Artists"],
  ["organization", "Organizations"],
] as const;

export function DirectoryFilters({ props, data }: { props: FilterProps; data: DirectoryData }) {
  const { region, entityType, facets } = data;
  return (
    <div className="ad-filters">
      <form method="get" className="ad-filter-form" role="search">
        {entityType && <input type="hidden" name="entity" value={entityType} />}
        <label className="ad-visually-hidden" htmlFor="ad-filter-region">
          Region
        </label>
        <input
          id="ad-filter-region"
          className="ad-input"
          name="region"
          defaultValue={region ?? ""}
          list="ad-filter-regions"
          autoComplete="off"
          placeholder={props.placeholder}
        />
        <datalist id="ad-filter-regions">
          {facets.regions.map((r) => (
            <option key={r} value={r} />
          ))}
        </datalist>
        <button type="submit" className="ad-button">
          Filter
        </button>
        {region && (
          <Link
            href={{ pathname: "/", query: entityType ? { entity: entityType } : {} }}
            className="ad-button"
            data-variant="quiet"
          >
            Clear
          </Link>
        )}
      </form>

      <nav className="ad-tabs" aria-label="Kind of entry">
        {ENTITY_TABS.map(([value, label]) => (
          <Link
            key={label}
            href={{ pathname: "/", query: { ...(region ? { region } : {}), ...(value ? { entity: value } : {}) } }}
            className="ad-tab"
            aria-current={entityType === value ? "page" : undefined}
          >
            {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}

// ── Listing ──────────────────────────────────────────────────────────────────

const listingProps = [
  {
    name: "emptyMessage",
    kind: "string",
    label: "Shown when nothing is on file",
    default: "No dossiers on file yet.",
  },
  {
    name: "density",
    kind: "select",
    label: "Card size",
    default: "regular",
    options: [
      { value: "compact", label: "Compact" },
      { value: "regular", label: "Regular" },
      { value: "wide", label: "Wide" },
    ],
  },
] as const satisfies readonly PropDef[];

export type ListingProps = { emptyMessage?: string; density?: string };

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]!.toUpperCase())
      .join("") || "?"
  );
}

export function DirectoryListing({ props, data }: { props: ListingProps; data: DirectoryData }) {
  const { dossiers } = data;
  if (dossiers.length === 0) {
    return (
      <p className="ad-empty">
        {props.emptyMessage} <Link href="/new">Open the first file →</Link>
      </p>
    );
  }
  return (
    <ul className="ad-cards" data-density={props.density ?? "regular"}>
      {dossiers.map((d) => {
        const org = d.entity_type === "organization";
        const place = d.region || d.location;
        return (
          <li key={d.slug}>
            <Link href={`/${d.slug}`} className="ad-card">
              {/* A portrait where there is one; otherwise a monogram on the
                  page's own manila rather than a hotlinked placeholder. */}
              {d.portrait_url ? (
                <img className="ad-card-portrait" data-shape={org ? "square" : "portrait"} src={d.portrait_url} alt="" />
              ) : (
                <span className="ad-card-portrait" data-shape={org ? "square" : "portrait"} aria-hidden="true">
                  {org ? "◆" : initials(d.name)}
                </span>
              )}
              <span className="ad-card-body">
                <strong className="ad-card-name">{d.name}</strong>
                {d.occupation && <span className="ad-card-occupation">{d.occupation}</span>}
                {place && <span className="ad-card-place">{place}</span>}
              </span>
              <span className="ad-card-meta">
                <span className="ad-status" data-verified={d.verified ? "" : undefined}>
                  ● {d.verified ? "Verified" : d.claim_status}
                </span>
                {d.vouch_count > 0 && (
                  <span>
                    {d.vouch_count} vouch{d.vouch_count === 1 ? "" : "es"}
                  </span>
                )}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

// ── The catalogue ────────────────────────────────────────────────────────────

/**
 * Every section the directory home can hold: id, label, its content props
 * and the shared look props, and the component. Ids appear in the page
 * definition (and later in stored page JSON), so never rename one casually.
 */
export const DIRECTORY_SECTIONS = {
  "directory-intro": {
    label: "Directory introduction",
    props: [...introProps, ...LOOK_PROPS],
    Component: DirectoryIntro,
  },
  "directory-filters": {
    label: "Directory filters",
    props: [...filterProps, ...LOOK_PROPS],
    Component: DirectoryFilters,
  },
  "directory-listing": {
    label: "Directory listing",
    props: [...listingProps, ...LOOK_PROPS],
    Component: DirectoryListing,
  },
} as const;

export type DirectorySectionType = keyof typeof DIRECTORY_SECTIONS;

const LOOK_NAMES = new Set<string>(LOOK_PROPS.map((p) => p.name));

/** A section's content props (not its look), defaulted from its declaration. */
export function sectionDefaults(type: DirectorySectionType): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const p of DIRECTORY_SECTIONS[type].props) {
    if (!LOOK_NAMES.has(p.name) && "default" in p) out[p.name] = p.default;
  }
  return out;
}

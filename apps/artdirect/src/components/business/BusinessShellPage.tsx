import type { BusinessConnections, BusinessListing } from "@elkdonis/services/businesses";
import { BusinessForms } from "./BusinessForms";
import styles from "./BusinessShellPage.module.css";

/**
 * The business page on ArtDirect (`/[slug]`) for a network business listing
 * (@elkdonis/services/businesses). A shell is always marked "Unclaimed · listed by
 * <steward>", shows only sourced facts with their sources and licence lines, and offers
 * "Is this your business? Claim it" and "Ask us to remove it". No reviews, no vouches,
 * nothing for sale (docs/open/ASSOCIATED_BUSINESSES_2026-11-04.md, rules 1-3).
 */

const ELKTOURS_URL = (process.env.NEXT_PUBLIC_ELKTOURS_URL ?? process.env.ELKTOURS_URL ?? "https://elkdonisexperiences.com").replace(/\/$/, "");

const FIELD_LABEL: Record<string, string> = {
  name: "Name",
  address: "Address",
  openingHours: "Opening hours",
  phone: "Phone",
  website: "Website",
  category: "Category",
  position: "Map position",
  wikidata: "Wikidata",
};

function sourceLabel(s: { source: string; ref?: string | null; note?: string | null }): string {
  const what =
    s.source === "osm" ? "OpenStreetMap" : s.source === "photon" ? "OpenStreetMap (via Photon)" : s.source === "wikidata" ? "Wikidata" : s.source === "web" ? "the venue's page" : "the steward";
  return [what, s.ref && s.source !== "steward" ? s.ref : null, s.note].filter(Boolean).join(" · ");
}

export function BusinessShellPage({ business: b, connections, signedIn }: { business: BusinessListing; connections: BusinessConnections; signedIn: boolean }) {
  const address = [b.streetAddress, [b.postalCode, b.city].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  const mapUrl = b.lat != null && b.lng != null ? `https://www.openstreetmap.org/?mlat=${b.lat}&mlon=${b.lng}#map=18/${b.lat}/${b.lng}` : null;
  const stewardName = b.steward?.name ?? b.listedBy?.name ?? null;
  return (
    <main className={styles.page}>
      {b.marking ? (
        <p className={styles.banner} role="note">
          <strong>{b.marking}</strong>. The facts below come from open sources and our own visits. This is not the business&rsquo;s own page.
        </p>
      ) : null}

      <header className={styles.head}>
        {b.categoryLabel ? <p className={styles.kicker}>{b.categoryLabel}</p> : null}
        <h1 className={styles.title}>{b.name}</h1>
        {address ? <p className={styles.address}>{address}</p> : null}
      </header>

      {b.photoUrl ? (
        <figure className={styles.photo}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={b.photoUrl} alt={`Street front of ${b.name}`} />
          {b.photoCredit ? <figcaption>Photo: {b.photoCredit}</figcaption> : null}
        </figure>
      ) : null}

      <dl className={styles.facts}>
        {b.website ? (
          <>
            <dt>Website</dt>
            <dd>
              <a href={b.website} rel="noopener nofollow" target="_blank">
                {b.website.replace(/^https:\/\/(www\.)?/, "").replace(/\/$/, "")}
              </a>
            </dd>
          </>
        ) : null}
        {b.openingHours ? (
          <>
            <dt>Opening hours</dt>
            <dd>
              <code>{b.openingHours}</code> <span className={styles.muted}>(as listed on OpenStreetMap; check before you go)</span>
            </dd>
          </>
        ) : null}
        {b.phone ? (
          <>
            <dt>Phone</dt>
            <dd>
              <a href={`tel:${b.phone.replace(/\s+/g, "")}`}>{b.phone}</a>
            </dd>
          </>
        ) : null}
        {mapUrl ? (
          <>
            <dt>Map</dt>
            <dd>
              <a href={mapUrl} rel="noopener" target="_blank">
                Open on OpenStreetMap
              </a>
            </dd>
          </>
        ) : null}
      </dl>

      {connections.tours.length > 0 || connections.steward ? (
        <section className={styles.section}>
          <h2>Connections</h2>
          <ul className={styles.list}>
            {connections.steward ? <li>Listed by {connections.steward.name}</li> : null}
            {connections.tours.map((t) => (
              <li key={t.threadId}>
                Visited on the tour{" "}
                {t.orgId === "elktours" ? (
                  <a href={`${ELKTOURS_URL}/tours/${t.slug}`}>{t.title}</a>
                ) : (
                  t.title
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className={styles.section}>
        <h2>Sources</h2>
        <ul className={styles.list}>
          {Object.entries(b.factsSource).map(([field, s]) => (
            <li key={field}>
              <span className={styles.muted}>{FIELD_LABEL[field] ?? field}:</span> {sourceLabel(s)}
            </li>
          ))}
        </ul>
        {b.attributions.length ? <p className={styles.muted}>{b.attributions.join(" · ")}</p> : null}
      </section>

      {b.status === "shell" ? <BusinessForms businessUserId={b.userId} businessName={b.name} stewardName={stewardName} signedIn={signedIn} slug={b.slug} /> : null}
    </main>
  );
}

/** A removed listing: nothing but the fact that it was removed (the row is a tombstone). */
export function BusinessRemovedPage() {
  return (
    <main className={styles.page}>
      <h1 className={styles.title}>This listing was removed</h1>
      <p className={styles.muted}>At the business&rsquo;s request, it is no longer listed on the network.</p>
    </main>
  );
}

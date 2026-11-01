import Link from "next/link";
import type { DossierListItem } from "@/lib/oad";

/** Up to two initials from a display name ("Jim Hodgkinson" → "JH"). */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] ?? "" : "";
  return (first + last).toUpperCase();
}

/**
 * A directory card: portrait (or an initials tile when there is none), name,
 * role, place, claim status and vouches. Styles: app/artdirect.css `.oad-card*`.
 */
export function OadCard({ item: d }: { item: DossierListItem }) {
  const org = d.entity_type === "organization";
  const place = d.region || d.location;
  return (
    <li>
      <Link href={`/${d.slug}`} className="oad-card">
        <div className="oad-card-row">
          {d.portrait_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              className={org ? "oad-card-portrait oad-card-portrait--org" : "oad-card-portrait"}
              src={d.portrait_url}
              alt=""
              width={org ? 64 : 56}
              height={org ? 64 : 70}
              loading="lazy"
            />
          ) : (
            <span className={org ? "oad-card-initials oad-card-initials--org" : "oad-card-initials"} aria-hidden="true">
              {initials(d.name)}
            </span>
          )}
          <div className="oad-card-text">
            <strong className="oad-card-name">{d.name}</strong>
            {d.occupation ? <span className="oad-card-role">{d.occupation}</span> : null}
            {place ? <span className="oad-card-place">{place}</span> : null}
          </div>
        </div>
        <div className="oad-card-foot">
          <span className={d.verified ? "oad-card-status oad-card-status--verified" : "oad-card-status"}>
            {d.verified ? "● Verified" : `● ${d.claim_status}`}
          </span>
          {d.vouch_count > 0 ? (
            <span>
              {d.vouch_count} vouch{d.vouch_count === 1 ? "" : "es"}
            </span>
          ) : null}
        </div>
      </Link>
    </li>
  );
}

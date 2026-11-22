import Link from "next/link";

/** Brass kicker, a fading rule, and an optional "more" link. */
export function SectionHeader({ label, more }: { label: string; more?: { label: string; href: string } }) {
  return (
    <div className="m-section">
      <span className="m-kicker m-section-label">{label}</span>
      <span className="m-rule" aria-hidden="true" />
      {more ? (
        <Link href={more.href} className="m-section-more">
          {more.label}
        </Link>
      ) : null}
    </div>
  );
}

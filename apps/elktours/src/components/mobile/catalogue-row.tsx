import Link from "next/link";
import type { ReactNode } from "react";

export interface CatalogueRowProps {
  thumb?: ReactNode;
  kicker?: string;
  title: string;
  meta?: string;
  href?: string;
  onClick?: () => void;
}

/** Card row: thumbnail, kicker, title, meta, chevron. A link with `href`, else a button. */
export function CatalogueRow({ thumb, kicker, title, meta, href, onClick }: CatalogueRowProps) {
  const body = (
    <>
      {thumb ? <span className="m-row-thumb">{thumb}</span> : null}
      <span className="m-row-text">
        {kicker ? <span className="m-kicker m-row-kicker">{kicker}</span> : null}
        <span className="m-row-title">{title}</span>
        {meta ? <span className="m-row-meta">{meta}</span> : null}
      </span>
      <span className="m-row-chev" aria-hidden="true">›</span>
    </>
  );
  if (href) {
    return (
      <Link href={href} className="m-row m-cusp" onClick={onClick}>
        {body}
      </Link>
    );
  }
  return (
    <button type="button" className="m-row m-cusp" onClick={onClick}>
      {body}
    </button>
  );
}

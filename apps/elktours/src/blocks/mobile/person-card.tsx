import Link from "next/link";
import type { MobilePerson } from "./types";

/** People card (grid and About slider): a square picture across the top, the same picture blurred behind the whole
 * card for its colour (no computation), a dark wash for the text. No picture: a brass (guide) or verdigris (artist) tint. */
export function PersonCard({ x, slide }: { x: MobilePerson; slide?: boolean }) {
  return (
    <Link href={`/people/${x.slug}`} className={`blk-mpc ${x.kind === "guide" ? "is-guide" : "is-artist"}${slide ? " blk-mpc-slide" : ""}`}>
      <span className="blk-mpc-back" aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {x.photo ? <img src={x.photo} alt="" loading="lazy" /> : null}
      </span>
      <span className="blk-mpc-wash" aria-hidden="true" />
      <span className="blk-mpc-pic">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {x.photo ? <img src={x.photo} alt="" loading="lazy" /> : <span className="blk-mpc-initial">{x.initial}</span>}
      </span>
      <span className="blk-mpc-text">
        <span className="blk-mpg-name">{x.name}</span>
        <span className="blk-mpg-sub">{[x.craft, x.area].filter(Boolean).join(" \u00b7 ")}</span>
        {x.status && <span className="blk-mpg-status">{x.status}</span>}
      </span>
    </Link>
  );
}

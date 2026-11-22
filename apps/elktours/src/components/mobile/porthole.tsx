import type { CSSProperties } from "react";
import { cx } from "./cx";

export interface PortholeProps {
  size: number;
  src?: string | null;
  alt?: string;
  /** Verdigris ring (experiences and artists) instead of brass. */
  verdigris?: boolean;
  /** Letter shown when there is no picture. */
  initial?: string;
}

/** Round picture for experiences, artists and guides. */
export function Porthole({ size, src, alt = "", verdigris, initial }: PortholeProps) {
  const style = { width: size, height: size, fontSize: Math.round(size * 0.42) } as CSSProperties;
  return (
    <div className={cx("m-porthole", verdigris && "is-verdigris")} style={style}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} className="m-fill" loading="lazy" />
      ) : initial ? (
        <span className="m-porthole-initial">{initial}</span>
      ) : null}
    </div>
  );
}

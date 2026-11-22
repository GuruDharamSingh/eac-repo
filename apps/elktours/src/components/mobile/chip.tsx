import type { ReactNode } from "react";
import { cx } from "./cx";

/** Pill filter. Selected = brass fill. */
export function Chip({ children, selected, onClick }: { children: ReactNode; selected?: boolean; onClick?: () => void }) {
  return (
    <button type="button" className={cx("m-chip", selected && "is-selected")} aria-pressed={selected ?? false} onClick={onClick}>
      {children}
    </button>
  );
}

/** Horizontally scrolling row of chips. */
export function ChipRow({ children }: { children: ReactNode }) {
  return <div className="m-chip-row">{children}</div>;
}

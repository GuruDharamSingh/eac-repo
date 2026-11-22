import type { ReactNode } from "react";
import "./he-mock.css";

/** The app's section head (eyebrow, heading, lede) used by several blocks. */
export function SectionHead({ eyebrow, title, lede, as = "h2" }: { eyebrow?: string; title: string; lede?: ReactNode; as?: "h1" | "h2" }) {
  const H = as;
  return (
    <header className="he-section-head">
      {eyebrow ? <p className="he-eyebrow">{eyebrow}</p> : null}
      <H>{title}</H>
      {lede ? <p className="he-lede">{lede}</p> : null}
    </header>
  );
}

export function BandHead({ eyebrow, title, intro }: { eyebrow?: string; title: string; intro?: string }) {
  return (
    <header className="he-band-head">
      {eyebrow ? <p className="he-eyebrow">{eyebrow}</p> : null}
      <h2 className="he-band-title">{title}</h2>
      {intro ? <p className="he-band-intro">{intro}</p> : null}
    </header>
  );
}

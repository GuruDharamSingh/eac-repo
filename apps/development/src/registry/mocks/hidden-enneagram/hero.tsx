import { SIGIL } from "./sigil-real";
import "./he-mock.css";

export default function Mock() {
  const title = "The story you framed your life around";
  const at = title.indexOf("your life");
  return (
    <section className="blk he-hero" data-side="yes" style={{ ["--he-hero-title-size" as string]: "64px" }}>
      <div className="he-hero-grid">
        <div className="he-hero-copy">
          <p className="he-eyebrow he-hero-eyebrow">Readings in the Enneagram</p>
          <h1 className="he-hero-title">
            {title.slice(0, at)}
            <span className="he-accent">your life</span>
            {title.slice(at + "your life".length)}
          </h1>
          <p className="he-lede he-hero-lede">
            The Enneagram is a map of how your core motivations became a recurring psychological fixation, and how that reaction shaped the way you relate, protect, desire, and disconnect.
          </p>
          <div className="he-hero-actions">
            <a className="he-btn he-primary" href="#mock">
              Readings and counselling
            </a>
            <a className="he-btn" href="#mock">
              The enneagram
            </a>
          </div>
        </div>
        <div className="he-hero-figure" aria-hidden="true">
          {SIGIL}
        </div>
      </div>
    </section>
  );
}

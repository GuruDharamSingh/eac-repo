interface FeedBannerProps {
  eyebrow: string | null;
  title: string;
  subtitle: string | null;
  /** HSL triplet from the feed's accent, e.g. "45 79% 52%". */
  accent: string | null;
}

/**
 * The dark section header from the original site: charcoal gradient, a thick
 * accent rule beneath, the title in the feed's own colour with a soft text
 * shadow, and an italic subtitle. Previously hand-written three times, once
 * per section page.
 */
export function FeedBanner({ eyebrow, title, subtitle, accent }: FeedBannerProps) {
  const accentColor = accent ? `hsl(${accent})` : "#f4c430";

  return (
    <div
      className="bg-header-footer border-b-4 py-12 text-center"
      style={{ borderBottomColor: accentColor }}
    >
      <div className="mx-auto max-w-5xl px-5">
        {eyebrow && (
          <span
            className="inline-block rounded-full border px-4 py-1 text-sm"
            style={{
              color: accentColor,
              borderColor: `color-mix(in srgb, ${accentColor} 40%, transparent)`,
              backgroundColor: `color-mix(in srgb, ${accentColor} 20%, transparent)`,
            }}
          >
            {eyebrow}
          </span>
        )}
        <h1
          className="mt-4 font-serif text-[clamp(1.8rem,5vw,2.8rem)] leading-tight"
          style={{ color: accentColor, textShadow: "2px 2px 8px rgba(0,0,0,0.4)" }}
        >
          {title}
        </h1>
        {subtitle && (
          <p
            className="mt-3 text-lg italic"
            style={{ color: `color-mix(in srgb, ${accentColor} 80%, white)` }}
          >
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}

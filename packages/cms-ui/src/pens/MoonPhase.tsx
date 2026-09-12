import type { CSSProperties, ReactNode } from "react";

/**
 * MoonPhase — React twin of the `moon-phase` pen
 * (packages/silex-nextcloud-connector/src/pens/moon-phase).
 *
 * Same markup, same class names, same stylesheet, so a moon an org owner
 * drops into a Silex page and a moon an app renders are the same object. What
 * the twin adds is the thing a static block cannot have: real numbers, from
 * a real ephemeris, that move.
 *
 * It stays purely presentational — the `phase` prop is structural, so this
 * package does not take on @elkdonis/astro (and its native Swiss Ephemeris)
 * for every app that wants a moon. Callers that have a chart pass
 * `moonPhase(chart)` from @elkdonis/astro straight in; callers that only know
 * the numbers pass those.
 *
 * No hooks and no effects — it renders the same on the server and the client,
 * so it can sit in a server component or inside a clock that rescrubs it
 * sixty times a second.
 *
 *   <MoonPhase phase={moonPhase(sky.chart)} size={40} />
 *   <MoonPhase illumination={0.72} angle={24} caption />
 */
/** What this needs out of @elkdonis/astro's moonPhase(), structurally. */
export interface MoonPhaseReading {
  /** Fraction of the disc lit, 0–1. */
  illumination: number;
  /** Clockwise tilt in degrees for the observer; null when unknown. */
  angle: number | null;
  /** "Waxing gibbous". */
  label: string;
}

export interface MoonPhaseProps {
  /** A computed phase — `moonPhase(chart)` from @elkdonis/astro. */
  phase?: MoonPhaseReading;
  /** Or the raw numbers: 0–1 lit, and a clockwise tilt in degrees. */
  illumination?: number;
  angle?: number | null;
  /** A CSS length, or a number of pixels. Defaults to the pen's own 4rem. */
  size?: number | string;
  /** Draw the phase name (and how much is lit) under the disc. */
  caption?: boolean | ReactNode;
  glow?: boolean;
  /** A photographic face: any CSS image, e.g. `url(/moon.jpg)`. */
  face?: string;
  /** Overrides the generated one ("Waxing gibbous moon, 72% lit"). */
  label?: string;
  className?: string;
  style?: CSSProperties;
}

function resolve(props: MoonPhaseProps): { lit: number; angle: number; label: string; caption: string } {
  const phase = props.phase ?? null;
  const lit = Math.min(1, Math.max(0, props.illumination ?? phase?.illumination ?? 0));
  const angle = props.angle ?? phase?.angle ?? 0;
  const percent = Math.round(lit * 100);
  const name = phase?.label ?? (lit < 0.02 ? "New" : lit > 0.98 ? "Full" : "Moon");
  return {
    lit,
    angle,
    label: props.label ?? `${name} moon, ${percent}% lit`,
    caption: `${name} · ${percent}% lit`,
  };
}

export function MoonPhase(props: MoonPhaseProps) {
  const { lit, angle, label, caption } = resolve(props);
  const { size, glow = false, face, caption: showCaption, className, style } = props;

  // The pen splits crescent from gibbous because each needs a different
  // construction (add the ellipse, or punch it out) and CSS has no abs().
  const shape = lit <= 0.5 ? "crescent" : "gibbous";

  const vars: CSSProperties = {
    "--eac-pen-moon-illumination": String(Math.round(lit * 1000) / 10),
    "--eac-pen-moon-rotate": `${angle}deg`,
    ...(size !== undefined ? { "--eac-pen-moon-size": typeof size === "number" ? `${size}px` : size } : null),
    ...(face ? { "--eac-pen-moon-face": face } : null),
    ...style,
  } as CSSProperties;

  const disc = (
    <div
      className={["eac-pen-moon", showCaption ? "" : className ?? ""].filter(Boolean).join(" ")}
      data-pen="moon-phase"
      data-shape={shape}
      data-glow={glow ? "on" : "off"}
      style={vars}
      role="img"
      aria-label={label}
    >
      <span className="eac-pen-moon-disc">
        <span className="eac-pen-moon-shadow" />
        <span className="eac-pen-moon-terminator" />
      </span>
    </div>
  );

  if (!showCaption) return disc;
  return (
    <figure className={className} style={{ margin: 0 }}>
      {disc}
      <figcaption className="eac-pen-moon-label">{showCaption === true ? caption : showCaption}</figcaption>
    </figure>
  );
}

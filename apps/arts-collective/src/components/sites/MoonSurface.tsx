"use client";

import { MoonPhase, type MoonPhaseReading } from "@elkdonis/cms-ui/pens";

import { SurfaceFrame } from "@elkdonis/cms-ui/surface";
import { MOON_CREDIT, moonFace } from "@/lib/moon-image";

/**
 * The Moon, big.
 *
 * Registered as connectors.custom.moon, so the disc in the newsroom's sky
 * column opens it. It is a STILL of the moment it was opened rather than a
 * live view: the column is the live one, and a photograph the size of the
 * screen wants to be looked at, not scrubbed.
 *
 * This is where the master earns its place. The column draws the 512px
 * variant; here the same photograph comes down at 1024, both derived by
 * @elkdonis/services from one five-thousand-pixel original that never leaves
 * storage.
 */
export function MoonSurface({ phase }: { phase: MoonPhaseReading }) {
  const percent = Math.round(phase.illumination * 100);

  return (
    <SurfaceFrame
      kind="calendar"
      title={`${phase.label} moon`}
      kicker={`${percent}% lit`}
      actions={[{ label: "The photograph", href: MOON_CREDIT.source, external: true }]}
    >
      <div className="flex flex-col items-center gap-4 py-2">
        <MoonPhase
          phase={phase}
          face={moonFace(1024)}
          size="min(62vh, 420px)"
          glow
        />
        <p className="max-w-[46ch] text-center text-[13px] leading-relaxed text-muted-foreground">
          Lit as it is now, and turned the way it hangs from here — the tilt is the
          Moon&rsquo;s bright limb measured against your own zenith, so it leans one way
          in Toronto and the other in Sydney.
        </p>
        <p className="text-center text-[11px] leading-relaxed text-muted-foreground/80">
          {MOON_CREDIT.title} ·{" "}
          <a className="underline underline-offset-2" href={MOON_CREDIT.source} target="_blank" rel="noreferrer">
            {MOON_CREDIT.author}
          </a>{" "}
          · {MOON_CREDIT.license}
        </p>
      </div>
    </SurfaceFrame>
  );
}

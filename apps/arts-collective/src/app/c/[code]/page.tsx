import type { Metadata } from "next";
import { PhoneCapture, capturePreset } from "@elkdonis/studio/capture";
import { captureValid, normalizeCode } from "@elkdonis/services/recordings";
import "@elkdonis/studio/capture.css";

/**
 * Record with a phone for the Studio (/c/<code>): the computer showed this
 * short link (PhoneHandoff); the phone records and sends the video into the
 * Recordings of whoever made the code. No account on the phone: the code is
 * the credential (8 characters, 30 minutes, one recording).
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Record — Elkdonis Arts Collective",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function PhoneCapturePage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ preset?: string | string[] }>;
}) {
  const code = normalizeCode((await params).code);
  // ?preset=V27 turns on the shot director for that preset (aids/presets.ts); unknown ids are ignored.
  const p = (await searchParams).preset;
  const preset = capturePreset(Array.isArray(p) ? p[0] : p) ?? undefined;
  if (!captureValid(code)) {
    return (
      <div className="pc">
        <header className="pc-head">Elkdonis Arts Collective</header>
        <div className="pc-done">
          <p>
            <b>This code has expired or was already used.</b>
          </p>
          <p className="pc-faint">Make a new one on your computer (Studio → Recordings → Phone).</p>
        </div>
      </div>
    );
  }
  return <PhoneCapture endpoint={`/api/capture/${code}`} studioName="Elkdonis Arts Collective" preset={preset} />;
}

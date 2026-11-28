import type { Metadata } from "next";
import Link from "next/link";
import { requireNetworkAdmin } from "@/lib/gate";
import { capById, readiness } from "@/rails/data";
import { NexusGraph, type NexusTrack } from "@/rails/NexusGraph";
import { Legend, SampleBanner } from "@/rails/ui";

export const metadata: Metadata = { title: "Trail map" };
export const dynamic = "force-dynamic";

const AREA_ORDER = ["profile", "organisation", "publishing", "business", "artwork", "site", "production", "email"];

export default async function NexusPage() {
  await requireNetworkAdmin("/rails/nexus");
  const tracks: NexusTrack[] = readiness.tracks.map((t) => ({
    id: t.id,
    label: t.label,
    area: t.area,
    levels: t.steps.map((s) => (s.cap ? (capById.get(s.cap)?.level ?? s.level) : 0)),
    leads_to: t.leads_to,
    gates: t.gates,
    courses: readiness.courses.filter((c) => c.tracks.includes(t.id)).map((c) => ({ id: c.id, label: c.label })),
    steps: t.steps.map((s) => ({ label: s.cap ? (capById.get(s.cap)?.label ?? s.cap) : `Missing: ${s.gap}`, level: s.cap ? (capById.get(s.cap)?.level ?? s.level) : 0 })),
  }));
  const areas = [...new Set([...AREA_ORDER, ...tracks.map((t) => t.area)])];
  return (
    <div className="dev-page dev-r-page" style={{ maxWidth: "none" }}>
      <Link href="/rails" className="dev-back">
        All trails
      </Link>
      <h1>How the modules connect</h1>
      <p className="dev-lede">
        {readiness.tracks.length} modules. Courses are made by picking modules in order; this map shows which module usually comes after which, and what each one needs before it makes sense.
      </p>
      <SampleBanner sample={readiness.sample} />
      <Legend />
      <NexusGraph tracks={tracks} areas={areas} />
    </div>
  );
}

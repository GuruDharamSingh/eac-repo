import type { Metadata } from "next";
import Link from "next/link";
import { requireNetworkAdmin } from "@/lib/gate";
import { CapabilityMap } from "@/map/CapabilityMap";
import { readiness } from "@/rails/data";
import { SampleBanner } from "@/rails/ui";
import "@/rails/rails.css";

export const metadata: Metadata = { title: "Map" };
export const dynamic = "force-dynamic";

export default async function MapPage() {
  await requireNetworkAdmin("/map");
  // Cards show the first few hosts; keep the page light by sending only those, plus the real count.
  const caps = readiness.capabilities.map((c) => ({ ...c, hostCount: c.hosts.length, hosts: c.hosts.slice(0, 4) }));
  const courseNames = Object.fromEntries(readiness.courses.map((c) => [c.id, c.label]));
  return (
    <div className="dev-page dev-r-page" style={{ maxWidth: "none" }}>
      <h1>Map</h1>
      <p className="dev-lede">
        Everything a person can do on the platform, one card each. The level says how far it is built: from not built, to a place we can send people, to a form inside the dock, to something the assistant can use.
      </p>
      <div className="dev-r-sub">
        <Link href="/map/code" className="dev-r-link">
          The code behind it (apps and packages)
        </Link>
        <Link href="/rails" className="dev-r-link">
          The trails that use these
        </Link>
        <span className="dev-r-muted">Snapshot of {readiness.generated.slice(0, 16).replace("T", " ")} UTC</span>
      </div>
      <SampleBanner sample={readiness.sample} />
      <CapabilityMap caps={caps} courseNames={courseNames} />
    </div>
  );
}

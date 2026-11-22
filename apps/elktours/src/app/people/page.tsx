import type { Metadata } from "next";
import { Render, resolveAllData } from "@puckeditor/core/rsc";
import type { Data } from "@puckeditor/core";
import Link from "next/link";
import "@/blocks/mobile/people.css";
import { getViewer } from "@/lib/auth";
import { loadMobileDoc } from "@/lib/puck/mobile";
import { mobileServerConfig } from "@/lib/puck/config.mobile.server";
import { readMobileContent } from "@/lib/puck/mobile-content";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = { title: "Local Artists", description: "The guides and artists behind the tours." };
export const dynamic = "force-dynamic";

/** Screen 10, Local Artists (G4): the m-people document. No desktop equivalent, so desktop shows it in a 480px column. */
export default async function PeoplePage() {
  const [{ data }, mobileContent, viewer] = await Promise.all([loadMobileDoc("m-people"), readMobileContent(), getViewer().catch(() => null)]);
  const meta = { orgId: siteConfig.orgId, slug: "m-people", mobileContent };
  const filled = await resolveAllData(data, mobileServerConfig, meta);
  return (
    <div className="elk-m m-col">
      <Render config={mobileServerConfig} data={filled as Data} metadata={meta} />
      {viewer?.canEdit && (
        <p style={{ padding: "20px 20px 0" }}>
          <Link href="/studio/m-people" className="underline underline-offset-4">Edit phone layout</Link>
        </p>
      )}
    </div>
  );
}

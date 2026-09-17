import type { Metadata } from "next";
import { getSiteSections } from "@/lib/data";
import { siteConfig } from "@/config/site";
import { Invitation } from "@/components/home/bands";

export const metadata: Metadata = { title: "About" };

export default async function AboutPage() {
  const about = (await getSiteSections()).about;
  const body = typeof about?.body === "string" ? about.body : null;
  return (
    <div className="column band">
      <p className="eyebrow">About</p>
      <h1 style={{ fontSize: "1.8rem", marginTop: 4 }}>{siteConfig.orgName}</h1>
      <p className="creed" style={{ marginTop: 20 }}>{siteConfig.missionLine}</p>
      <div className="split" style={{ marginTop: 26 }}>
        {body ? (
          // Sanitised on write by /api/manage/section.
          <div className="prose" dangerouslySetInnerHTML={{ __html: body }} />
        ) : (
          <div className="empty">The circle hasn&rsquo;t written its own introduction yet.</div>
        )}
        <Invitation />
      </div>
    </div>
  );
}

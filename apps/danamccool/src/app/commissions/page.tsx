import { COMMISSION_INQUIRIES_INTRO, COMMISSION_PAST } from "@/lib/content";
import { siteConfig } from "@/config/site";

export const metadata = { title: "Commission Inquiries" };

export default function CommissionInquiriesPage() {
  return (
    <article className="content-page">
      <h1 className="page-title">Commission Inquiries</h1>
      <p>{COMMISSION_INQUIRIES_INTRO}</p>
      <p>
        Email <a href={`mailto:${siteConfig.ownerEmail}`}>{siteConfig.ownerEmail}</a> with a proposal or
        short description of your idea.
      </p>

      <h2 style={{ fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: "2rem" }}>
        Past Commissions
      </h2>
      {COMMISSION_PAST.map((c, i) => (
        <div key={i} style={{ marginBottom: "1rem" }}>
          <p style={{ fontWeight: 600, marginBottom: "0.15rem" }}>{c.title}</p>
          <p>{c.detail}</p>
        </div>
      ))}
    </article>
  );
}

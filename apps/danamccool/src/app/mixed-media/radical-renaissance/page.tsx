import { RADICAL_RENAISSANCE } from "@/lib/content";
import { siteConfig } from "@/config/site";

export const metadata = { title: "Radical Renaissance" };

export default function RadicalRenaissancePage() {
  return (
    <article className="content-page">
      <h1 className="page-title">Radical Renaissance</h1>
      <p style={{ fontWeight: 600 }}>{RADICAL_RENAISSANCE.subtitle}</p>
      <p>{RADICAL_RENAISSANCE.body}</p>
      <p>
        For inquiries on availability of stock, email{" "}
        <a href={`mailto:${siteConfig.ownerEmail}`}>{siteConfig.ownerEmail}</a>.
      </p>
    </article>
  );
}

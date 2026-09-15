import { siteConfig } from "@/config/site";

export const metadata = { title: "Contact" };

// Real contact info: her own email, per artists.ts and the scraped contact
// page ("Please use the form for inquiries of all kinds. Email:
// Danamccoolart@gmail.com"). A form isn't wired up here — mailto is the
// honest current state, not a fabricated working form.
export default function ContactPage() {
  return (
    <article className="content-page">
      <h1 className="page-title">Contact</h1>
      <p>Please use the address below for inquiries of all kinds.</p>
      <p>
        Email: <a href={`mailto:${siteConfig.ownerEmail}`}>{siteConfig.ownerEmail}</a>
      </p>
    </article>
  );
}

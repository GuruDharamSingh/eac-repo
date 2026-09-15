import { BIOGRAPHY } from "@/lib/content";
import { siteConfig } from "@/config/site";

export const metadata = { title: "Biography" };

/**
 * Centered narrow column under a centered rectangular portrait — matching
 * her real Biography page (danascreenshots/*BIOGRAPHY*.png), not the
 * circle-crop treatment Manifestos uses.
 */
export default function BiographyPage() {
  return (
    <article className="content-page content-page--centered">
      <div className="hero-portrait">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/portrait.png" alt="Dana McCool" />
      </div>
      {BIOGRAPHY.map((p, i) => (
        <p key={i}>{p}</p>
      ))}
      <p>
        For more information on my work, feel free to{" "}
        <a href={`mailto:${siteConfig.ownerEmail}`}>contact</a> me.
      </p>
    </article>
  );
}

import Link from "next/link";

/**
 * Home. Her real index page (index.txt) was just the name, "Artist", and a
 * three-word nav (Collections ~ Events ~ About) plus the Elkdonis Arts link —
 * the sidebar already carries the full nav, so this stays as spare as the
 * original.
 */
export default function HomePage() {
  return (
    <div className="content-page content-page--centered" style={{ paddingTop: "3rem" }}>
      <h1 style={{ fontSize: "2rem", fontWeight: 300, letterSpacing: "0.02em", margin: "0 0 0.25rem" }}>
        Dana McCool
      </h1>
      <p style={{ textTransform: "uppercase", letterSpacing: "0.15em", fontSize: "0.85rem", margin: "0 0 2rem" }}>
        Artist
      </p>
      <p style={{ textTransform: "uppercase", letterSpacing: "0.08em", fontSize: "0.8rem" }}>
        <Link href="/collections">Collections</Link> ~ <Link href="/exhibitions">Events</Link> ~{" "}
        <Link href="/biography">About</Link>
      </p>
    </div>
  );
}

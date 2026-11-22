export function ArtistDirectoryCTA() {
  return (
    <section id="directory-cta" className="directory-cta-section">
      <div className="section-inner" style={{ textAlign: "center" }}>
        <p className="section-eyebrow">Our Network</p>
        <h2 className="section-heading">Artist Directory</h2>
        <hr
          className="gold-rule"
          style={{ "--rule-width": "50px", margin: "1.5rem auto 2rem" } as React.CSSProperties}
        />
        <p
          style={{
            fontFamily: "var(--font-sans)",
            color: "#9ca3af",
            lineHeight: 1.8,
            maxWidth: "560px",
            margin: "0 auto 2.5rem",
          }}
        >
          The Elkdonis Artist Directory is a curated registry of practising artists,
          musicians, writers, and performers connected to our community. Browse by
          discipline, book for events, or apply to be listed.
        </p>

        <div style={{ display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap" }}>
          <a
            href="https://directory.elkdonisarts.ca"
            target="_blank"
            rel="noopener noreferrer"
            className="cta-btn"
          >
            Browse the Directory
          </a>
          <a
            href="https://directory.elkdonisarts.ca/apply"
            target="_blank"
            rel="noopener noreferrer"
            className="cta-btn-outline"
          >
            Apply for a Listing
          </a>
        </div>
      </div>
    </section>
  );
}

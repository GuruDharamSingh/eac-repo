import { Mail } from "lucide-react";

export function Footer() {
  return (
    <footer className="site-footer">
      <div
        style={{
          maxWidth: "var(--content-max)",
          margin: "0 auto",
          padding: "0 1.5rem",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "2rem",
          textAlign: "center",
        }}
      >
        {/* Contact */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.75rem" }}>
          <p className="footer-contact-prompt">
            Interested in volunteering or joining the collective?
          </p>
          <address style={{ fontStyle: "normal" }}>
            <a href="mailto:info@elkdonis-arts.org" className="footer-email">
              <Mail size={17} aria-hidden="true" />
              info@elkdonis-arts.org
            </a>
          </address>
        </div>

        {/* Gold divider */}
        <hr
          className="gold-rule"
          style={{ "--rule-width": "100px" } as React.CSSProperties}
        />
      </div>
    </footer>
  );
}

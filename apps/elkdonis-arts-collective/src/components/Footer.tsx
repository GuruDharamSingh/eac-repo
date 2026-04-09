import { Mail } from "lucide-react";

export function Footer() {
  const currentYear = new Date().getFullYear();

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

        {/* Sacred space */}
        <p className="footer-sacred">
          We consider online spaces to be real sacred spaces held in the minds,
          hearts, and bodies of the members.
        </p>

        {/* Welcome */}
        <p className="footer-welcome">Welcome.</p>

        {/* Legal */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginTop: "1rem" }}>
          <p className="footer-legal">
            Elkdonis Arts Collective operates as a private membership
            association. Using this website means you agree to our terms and
            conditions and privacy policies. The material on this site may not
            be reproduced, distributed, transmitted, cached, or otherwise used,
            except with the prior written permission of Elkdonis Arts
            Collective.
          </p>
          <p className="footer-copyright">
            &copy; 2019&ndash;{currentYear} Elkdonis Arts Collective. All
            rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}

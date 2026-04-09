"use client";

import { useEffect, useRef, useState } from "react";

export function About() {
  const [isVisible, setIsVisible] = useState(false);
  const [fields, setFields] = useState({ name: "", email: "", message: "" });
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const sectionRef = useRef<HTMLElement>(null);

  function setField(key: keyof typeof fields, value: string) {
    setFields((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setErrorMsg("");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error ?? "Something went wrong.");
        setStatus("error");
      } else {
        setStatus("done");
      }
    } catch {
      setErrorMsg("Network error — please try again.");
      setStatus("error");
    }
  }

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setIsVisible(true);
      },
      { threshold: 0.1 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section id="about" ref={sectionRef} className="about-section">
      <div style={{ maxWidth: "var(--content-max)", margin: "0 auto", padding: "0 1.5rem" }}>

        {/* Section header */}
        <div
          className={`reveal ${isVisible ? "in-view" : ""}`}
          style={{ textAlign: "center", marginBottom: "4rem" }}
        >
          <p className="section-eyebrow">About Us</p>
          <h2 className="section-heading">A Fourth-Way Mutual Aid Society</h2>
          <hr
            className="gold-rule"
            style={{ "--rule-width": "60px" } as React.CSSProperties}
          />
        </div>

        {/* Two-column body */}
        <div
          className={`reveal ${isVisible ? "in-view" : ""}`}
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 440px), 1fr))",
            gap: "4rem",
            marginBottom: "4rem",
            transitionDelay: "0.1s",
          }}
        >
          {/* Left — history */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <p className="about-lead">
              We are Elkdonis Arts Collective, a performance and visual arts
              group. We work to restore the necessity of art in life for all.
            </p>
            <p className="about-body-text">
              Our name comes from a word found in G.I. Gurdjieff&apos;s{" "}
              <em>Beelzebub&apos;s Tales</em>: &ldquo;helkdonis&rdquo;, meaning
              objective prayer for God (not prayer for self).
            </p>
            <p className="about-body-text">
              Our membership is largely comprised of students and teachers of
              the fourth-way attempting to work objectively as artists or
              entrepreneurs. We function as a mutual aid society helping each
              other apply the fourth-way teachings, to self-observe and
              self-remember, to learn and grow.
            </p>
            <p className="about-body-text">
              Our original group was formed in Newmarket, Ontario, Canada in
              1990. We opened the first internet cafe in town and held concerts
              and events. The form the Work takes is always changing.
            </p>
          </div>

          {/* Right — philosophy */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <p className="about-body-text">
              There are but two paths an artist may take. One may depict or
              convey a subjective idea, such as an advertisement or political
              statement. The viewer will find it beautiful or ugly based on
              their conditioning.
            </p>
            <p className="about-body-text">
              The other choice is to be a guide into transcendent sensations —
              this is{" "}
              <strong className="gold-highlight">objective art</strong>. The
              artist holds an inquiry into something bigger than themselves
              until the force affects them inwardly. Outwardly this produces a
              gesture, and the gesture produces an artifact.
            </p>
            <p className="about-body-text">
              The artifact is completed by the viewer, who will be moved into
              the same emotional experience as the artist during the inquiry.
              This is an objective communication — an act of revelation.
            </p>

            <blockquote className="pull-quote">
              <p>
                &ldquo;While working together in an asocial climate, a unique
                group unity unfolds from each person&apos;s heightened
                commitment to their own internal sources while sharing that
                Presence with others and being acted on by the Presence of
                others.&rdquo;
              </p>
              <cite>— Antero Alli</cite>
            </blockquote>
          </div>
        </div>

        {/* Final Antero Alli quote */}
        <div
          className={`about-final-quote reveal ${isVisible ? "in-view" : ""}`}
          style={{ transitionDelay: "0.2s" }}
        >
          <p>
            &ldquo;To cultivate resonance with vertical sources is not easy.
            This kind of inner work persists as an uphill struggle against the
            grain of decades of horizontal, socially-conditioned,
            externally-directed habit patterns. Accessing our verticality can
            act as an irritant to anyone identified exclusively with the
            horizontal plane of existence. The shock of authentic vertical
            contact, no matter how fleeting, can shatter unchecked assumptions
            about the world around us and who we think we are.&rdquo;
          </p>
          <cite>— Antero Alli</cite>
        </div>

        {/* Contact form */}
        <div
          className={`signup-wrap reveal ${isVisible ? "in-view" : ""}`}
          style={{ transitionDelay: "0.3s" }}
        >
          <h3 className="signup-heading">Stay in Touch</h3>
          <p className="signup-sub">
            Interested in the Work? Leave a message and we&apos;ll reach out
            when gatherings, courses, or community events are announced.
          </p>

          {status === "done" ? (
            <p className="signup-thanks">
              Thank you — we&apos;ll be in touch.
            </p>
          ) : (
            <form className="signup-form-full" onSubmit={handleSubmit}>
              <div className="signup-row">
                <input
                  className="signup-input"
                  type="text"
                  placeholder="Your name"
                  value={fields.name}
                  onChange={(e) => setField("name", e.target.value)}
                  aria-label="Name"
                />
                <input
                  className="signup-input"
                  type="email"
                  required
                  placeholder="your@email.com"
                  value={fields.email}
                  onChange={(e) => setField("email", e.target.value)}
                  aria-label="Email address"
                />
              </div>
              <textarea
                className="signup-input signup-textarea"
                placeholder="A brief message (optional)"
                rows={3}
                value={fields.message}
                onChange={(e) => setField("message", e.target.value)}
                aria-label="Message"
              />
              {status === "error" && (
                <p className="signup-error">{errorMsg}</p>
              )}
              <button
                type="submit"
                className="signup-btn-sm"
                disabled={status === "sending"}
              >
                {status === "sending" ? "Sending…" : "Send Message"}
              </button>
            </form>
          )}
        </div>

      </div>
    </section>
  );
}

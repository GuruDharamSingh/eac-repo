"use client";

import { useEffect, useRef, useState } from "react";

const INNER_GATHERING_URL =
  process.env.NEXT_PUBLIC_INNER_GATHERING_URL ?? "http://localhost:3004";

export function CurrentWorkQuestion() {
  const [answer, setAnswer] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setVisible(true); },
      { threshold: 0.1 }
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (answer.trim().length < 2) return;
    setStatus("loading");
    try {
      const res = await fetch("/api/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: "What is art for?", answer: answer.trim() }),
      });
      if (!res.ok) throw new Error();
      setStatus("done");
    } catch {
      setStatus("error");
    }
  }

  return (
    <section ref={ref} className="cwq-section">
      <div
        className={`section-inner reveal ${visible ? "in-view" : ""}`}
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "clamp(2rem, 5vw, 4rem)",
          alignItems: "start",
          maxWidth: 1100,
        }}
      >
        {/* ── Left: question + answer ── */}
        <div>
          <p className="section-eyebrow">Current Work Question</p>
          <h2 className="section-heading" style={{ marginBottom: "1.25rem" }}>
            What is Art For?
          </h2>
          <hr className="gold-rule" style={{ "--rule-width": "40px", margin: "0 0 1.5rem" } as React.CSSProperties} />

          {status === "done" ? (
            <div style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", lineHeight: 1.8 }}>
              <p style={{ color: "var(--eac-ink, #01124E)", margin: "0 0 0.75rem" }}>
                Thank you. Your answer is part of the inquiry.
              </p>
              <a
                href={`${INNER_GATHERING_URL}/forum`}
                style={{ fontFamily: "var(--font-sans)", fontStyle: "normal", fontSize: "0.75rem", color: "var(--color-gold, #b79a55)", letterSpacing: "0.08em", textDecoration: "none" }}
              >
                Continue the discussion on our forum →
              </a>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <textarea
                className="form-input"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="Take a moment. Anything you write is enough."
                rows={5}
                maxLength={2000}
                style={{ resize: "vertical", marginBottom: "0.75rem" }}
              />
              {status === "error" && (
                <p className="form-error" role="alert" style={{ marginBottom: "0.5rem" }}>
                  Could not send — please try again.
                </p>
              )}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
                <button
                  type="submit"
                  className="cta-btn"
                  disabled={status === "loading" || answer.trim().length < 2}
                >
                  {status === "loading" ? "Sending…" : "Offer your answer"}
                </button>
                <a
                  href={`${INNER_GATHERING_URL}/forum`}
                  style={{ fontFamily: "var(--font-sans)", fontSize: "0.75rem", color: "var(--color-gold)", letterSpacing: "0.08em", textDecoration: "none", opacity: 0.8 }}
                >
                  Continue on the forum →
                </a>
              </div>
            </form>
          )}
        </div>

        {/* ── Right: excerpt + context ── */}
        <aside style={{ paddingTop: "5rem" }}>
          <p style={{
            fontFamily: "var(--font-serif)",
            fontSize: "clamp(1rem, 1.4vw, 1.1rem)",
            lineHeight: 1.85,
            color: "var(--eac-ink, #01124E)",
            fontStyle: "italic",
            margin: 0,
          }}>
            The artist endeavours to penetrate experience in order to know the self
            and the world. It is a difficult and never ending process to find ways of
            using a medium to interpret something seen and experienced into a form which
            can be received and seen by another. To persevere in this process despite
            frustration and failure requires commitment and work, driven in large part
            by human necessity.
          </p>
        </aside>
      </div>
    </section>
  );
}

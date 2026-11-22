import { Sparkles, Heart, Globe, Eye } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface Feature {
  icon: LucideIcon;
  title: string;
  description: string;
}

const features: Feature[] = [
  {
    icon: Sparkles,
    title: "Objective Art",
    description:
      "We guide artists into transcendent sensations through inquiry into forces bigger than themselves.",
  },
  {
    icon: Heart,
    title: "Mutual Aid Society",
    description:
      "A circle of friends accelerating each other's growth while maintaining a non-hierarchical structure.",
  },
  {
    icon: Globe,
    title: "International Community",
    description:
      "Members worldwide, all welcome to join our exploration of paratheatre and fourth-way work.",
  },
  {
    icon: Eye,
    title: "Self-Observation",
    description:
      "Applying fourth-way teachings to self-observe, self-remember, and cultivate presence.",
  },
];

export function Features() {
  return (
    <section id="features" className="features-section">
      <div style={{ maxWidth: "var(--content-max)", margin: "0 auto", padding: "0 1.5rem" }}>

        {/* Section header */}
        <div style={{ textAlign: "center", marginBottom: "3rem" }}>
          <p className="section-eyebrow">What We Do</p>
          <h2 className="section-heading">Pillars of the Work</h2>
          <hr
            className="gold-rule"
            style={{ "--rule-width": "60px" } as React.CSSProperties}
          />
        </div>

        {/* 4-card grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))",
            gap: "1.25rem",
          }}
        >
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <article key={feature.title} className="feature-card">
                <div className="feature-icon-wrap" aria-hidden="true">
                  <Icon size={28} color="#c9a962" strokeWidth={1.5} />
                </div>
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
              </article>
            );
          })}
        </div>

      </div>
    </section>
  );
}

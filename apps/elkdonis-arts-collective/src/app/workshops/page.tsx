import { db } from "@elkdonis/db";
import SiteNav from "@/components/SiteNav";
import styles from "./workshops.module.css";

export const metadata = {
  title: "Workshops & Projects | Elkdonis Arts Collective",
  description:
    "Current workshops, experiential labs, and upcoming offerings from the Elkdonis Arts Collective.",
};

// ─── Types ────────────────────────────────────────────────────────────────────

type FeaturedWorkshop = {
  id: string;
  number: string;
  title: string;
  subtitle: string;
  lead: string;
  location: string;
  status: string;
  colour: string;
  accentColour: string;
  description: string;
  format: string;
  capacity: string;
  enquireUrl?: string;
};

type UpcomingOffering = {
  title: string;
  lead: string;
  type: string;
  format: string;
  status: string;
};

// ─── Default colours (cycled by position when card_colour is null) ─────────────

const DEFAULT_COLOURS = [
  { colour: "#1a3a2a", accentColour: "#4a9a6a" },
  { colour: "#1a1a3a", accentColour: "#6a6ac9" },
  { colour: "#3a1a1a", accentColour: "#c9626a" },
];

// ─── Static fallback data (shown when DB has no showcased workshops yet) ──────

const staticFeatured: FeaturedWorkshop[] = [
  {
    id: "exquisite-corpse",
    number: "01",
    title: "Exquisite Corpse",
    subtitle: "Creative Writing Laboratory",
    lead: "Dana McCool",
    location: "Online · Paris",
    status: "Available Now",
    colour: "#1a3a2a",
    accentColour: "#4a9a6a",
    description:
      "A surrealist writing practice in which participants construct narratives without knowledge of what came before — an exercise in radical trust, discontinuity, and collective authorship. Participants are confronted with the necessity of continuation without context, which is the fundamental condition of the creative act.",
    format: "Online workshop · 3 sessions",
    capacity: "6–12 participants",
    enquireUrl: "https://www.danamccool.com/workshops-teaching",
  },
  {
    id: "balance-assemblage",
    number: "02",
    title: "Balance Assemblage",
    subtitle: "Performance & Stone Sculpture Lab",
    lead: "Jason Ford",
    location: "Toronto · On-site",
    status: "Available Now",
    colour: "#1a1a3a",
    accentColour: "#6a6ac9",
    description:
      "The Elkdonis Performance Lab is a hands-on encounter with gravity-defying stone assemblage — impossible structures of rock and rubble, just barely balancing. Participants first witness then participate in the creation of ephemeral sculptures in public or natural spaces. The practice cultivates extreme presence, fine motor attunement, and a direct encounter with impermanence.",
    format: "In-person intensive · Full day",
    capacity: "4–8 participants",
  },
  {
    id: "enneagram",
    number: "03",
    title: "The Hidden Enneagram",
    subtitle: "Self-Knowledge & Inner Landscape",
    lead: "Ario",
    location: "Online · Los Angeles",
    status: "Available Now",
    colour: "#3a1a1a",
    accentColour: "#c9626a",
    description:
      "An exploration of the Enneagram not as personality typing but as a dynamic map of internal forces — a tool for observing the habitual patterns of attention, feeling, and instinct that govern daily life below the threshold of awareness. This workshop draws on Fourth Way principles and Sufi psychology to make the ancient diagram alive and practically useful.",
    format: "Online · 4-week course",
    capacity: "8–16 participants",
  },
];

const staticUpcoming: UpcomingOffering[] = [
  {
    title: "Drum Circles & Rhythm Attunement",
    lead: "Ario",
    type: "Music Workshop",
    format: "Online / In-person",
    status: "In Development",
  },
  {
    title: "Paratheater Performance Laboratory",
    lead: "Jason Ford",
    type: "Experiential Lab",
    format: "In-person Intensive",
    status: "In Development",
  },
  {
    title: "Guided Readings & Open Book Circle",
    lead: "Collective",
    type: "Reading Group",
    format: "Online, recurring",
    status: "Forming",
  },
  {
    title: "Healing Arts & Spiritual Attunement",
    lead: "Collective",
    type: "Healing Workshop",
    format: "Online",
    status: "In Development",
  },
  {
    title: "Earth Art Fundamentals",
    lead: "Jason Ford",
    type: "Nature Arts",
    format: "On-site, outdoor",
    status: "Seasonal",
  },
];

// ─── DB row type ───────────────────────────────────────────────────────────────

type WorkshopRow = {
  id: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  location: string | null;
  is_online: boolean;
  meeting_url: string | null;
  attendee_limit: number | null;
  card_colour: string | null;
  card_accent_colour: string | null;
  workshop_order: number | null;
  metadata: Record<string, unknown>;
  display_name: string | null;
};

// ─── Mapping helpers ───────────────────────────────────────────────────────────

function workshopMeta(row: WorkshopRow) {
  return (row.metadata?.workshop ?? {}) as Record<string, string>;
}

function mapFeatured(row: WorkshopRow, index: number): FeaturedWorkshop {
  const meta = workshopMeta(row);
  const defaults = DEFAULT_COLOURS[index % DEFAULT_COLOURS.length];

  const locationStr =
    meta.location ??
    (row.location
      ? row.is_online
        ? `Online · ${row.location}`
        : row.location
      : row.is_online
        ? "Online"
        : "");

  const capacityStr =
    meta.capacity ??
    (row.attendee_limit ? `Up to ${row.attendee_limit} participants` : "");

  return {
    id: row.id,
    number: String(index + 1).padStart(2, "0"),
    title: row.title,
    subtitle: row.subtitle ?? meta.subtitle ?? "",
    lead: meta.lead ?? row.display_name ?? "",
    location: locationStr,
    status: meta.workshopStatus ?? "Available Now",
    colour: row.card_colour ?? defaults.colour,
    accentColour: row.card_accent_colour ?? defaults.accentColour,
    description: row.description ?? "",
    format: meta.format ?? "",
    capacity: capacityStr,
    enquireUrl: row.meeting_url ?? meta.enquireUrl,
  };
}

function mapUpcoming(row: WorkshopRow): UpcomingOffering {
  const meta = workshopMeta(row);
  return {
    title: row.title,
    lead: meta.lead ?? row.display_name ?? "",
    type: meta.workshopType ?? "",
    format: meta.format ?? "",
    status: meta.workshopStatus ?? "In Development",
  };
}

// ─── Data fetching ─────────────────────────────────────────────────────────────

async function fetchWorkshopRows(): Promise<WorkshopRow[] | null> {
  try {
    const rows = await db<WorkshopRow[]>`
      SELECT
        m.id,
        m.title,
        m.subtitle,
        m.description,
        m.location,
        m.is_online,
        m.meeting_url,
        m.attendee_limit,
        m.card_colour,
        m.card_accent_colour,
        m.workshop_order,
        m.metadata,
        u.display_name
      FROM meetings m
      LEFT JOIN users u ON u.id::text = m.guide_id::text
      WHERE m.show_on_workshops_page = true
      ORDER BY
        m.workshop_order ASC NULLS LAST,
        m.created_at DESC
    `;
    return rows.length > 0 ? rows : null;
  } catch {
    // DB not yet migrated or unavailable — fall back to static data
    return null;
  }
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default async function WorkshopsPage() {
  const rows = await fetchWorkshopRows();

  const featuredWorkshops: FeaturedWorkshop[] = rows
    ? rows
        .filter((r) => r.workshop_order !== null)
        .slice(0, 3)
        .map((r, i) => mapFeatured(r, i))
    : staticFeatured;

  const upcomingOfferings: UpcomingOffering[] = rows
    ? rows.filter((r) => r.workshop_order === null).map(mapUpcoming)
    : staticUpcoming;

  return (
    <div className={styles.root}>
      <SiteNav />

      {/* Hero */}
      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <h1 className={styles.heroTitle}>Workshops<br />&amp; Projects</h1>
          <p className={styles.heroBody}>
            Each offering is a structured encounter with a particular question
            grounded in what it is to be human. Placement and the relationships
            between participants creates an experience to participate in.
            This is how this work evolves.
          </p>
        </div>
      </section>

      {/* Featured workshops */}
      <section className={styles.featured}>
        {featuredWorkshops.map((w) => (
          <article
            key={w.id}
            className={styles.workshopCard}
            style={{ "--card-bg": w.colour, "--card-accent": w.accentColour } as React.CSSProperties}
          >
            <div className={styles.cardLeft}>
              <span className={styles.cardNumber}>{w.number}</span>
              <span
                className={styles.statusBadge}
                style={{ color: w.accentColour, borderColor: w.accentColour }}
              >
                {w.status}
              </span>
            </div>
            <div className={styles.cardMain}>
              <div className={styles.cardHeader}>
                <div>
                  <h2 className={styles.cardTitle}>{w.title}</h2>
                  <p className={styles.cardSubtitle}>{w.subtitle}</p>
                </div>
                <div className={styles.cardMeta}>
                  <span>{w.lead}</span>
                  <span>{w.location}</span>
                </div>
              </div>
              <p className={styles.cardDescription}>{w.description}</p>
              <div className={styles.cardFooter}>
                <span className={styles.cardDetail}>{w.format}</span>
                <span className={styles.cardDot} />
                <span className={styles.cardDetail}>{w.capacity}</span>
                <a
                  href={w.enquireUrl ?? "#contact"}
                  className={styles.cardCta}
                  style={{ color: w.accentColour }}
                  {...(w.enquireUrl ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                >
                  Enquire →
                </a>
              </div>
            </div>
          </article>
        ))}
      </section>

      {/* Upcoming table */}
      <section className={styles.upcomingSection}>
        <div className={styles.upcomingInner}>
          <h2 className={styles.upcomingTitle}>Also on the Horizon</h2>
          <p className={styles.upcomingIntro}>
            The following offerings are in preparation. Contact us to register
            your interest and be notified when they open.
          </p>
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Workshop</th>
                  <th>Facilitator</th>
                  <th>Type</th>
                  <th>Format</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {upcomingOfferings.map((o, i) => (
                  <tr key={i}>
                    <td className={styles.tableTitle}>{o.title}</td>
                    <td>{o.lead}</td>
                    <td>{o.type}</td>
                    <td>{o.format}</td>
                    <td>
                      <span className={styles.tableBadge}>{o.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className={styles.contactSection}>
        <div className={styles.contactInner}>
          <h2 className={styles.contactTitle}>Join the Work</h2>
          <p className={styles.contactBody}>
            All of our work is offered in the spirit of mutual aid. To enquire
            about a workshop, register interest, or propose a collaboration,
            write to us.
          </p>
          <a href="mailto:info@elkdonis-arts.org" className={styles.contactLink}>
            info@elkdonis-arts.org
          </a>
        </div>
      </section>
    </div>
  );
}

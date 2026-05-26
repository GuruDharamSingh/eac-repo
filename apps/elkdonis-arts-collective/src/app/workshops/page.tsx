import SiteNav from "@/components/SiteNav";
import styles from "./workshops.module.css";

export const metadata = {
  title: "Workshops | Elkdonis Arts Collective",
  description:
    "Current offerings from Elkdonis Arts Collective: residency, workshops, lectures, seminars, and interactive events.",
};

const offerings = [
  {
    title: "Current Offerings - Spring 2026",
    subtitle: "Residency",
    status: "Stay tuned",
    date: "Spring 2026",
    place: "Close to conservation areas",
    description:
      "The collective has just purchased some beautiful secluded land close to conservation areas, and we are very excited to be developing from the ground up, a permaculture design principles aligned compound. The compound will feature permaculture food forest, artist residences, studios, and galleries. Horseback riding and hiking trails are nearby.",
    details: ["Permaculture food forest", "Artist residences", "Studios and galleries"],
    accent: "#c9a962",
    bg: "#10100c",
  },
  {
    title: "Short term and recurring workshops & events",
    subtitle: "Local and online",
    status: "Developing",
    date: "Spring 2026",
    place: "Toronto and online",
    description:
      "In collaboration with the founders, we are currently developing several short term and recurring workshops & events - offered both locally and online - which focus on interactive & reflexive, group oriented processes.",
    details: ["Creative writing salons", "Paratheater laboratories", "Lectures and seminars"],
    accent: "#a78bfa",
    bg: "#0d0b14",
  },
  {
    title: "Education & Community Networking",
    subtitle: "Demonstrations, workshops, interactive events",
    status: "Forthcoming",
    date: "Spring 2026",
    place: "Elkdonis Arts Collective",
    description:
      "Providing Education & Community Networking. We hope to cultivate these by providing demonstrations, workshops, and interactive events which welcome access to our creative process as it happens.",
    details: ["Demonstrations", "Workshops", "Interactive events"],
    accent: "#8b1a1a",
    bg: "#120808",
  },
];

export default function WorkshopsPage() {
  return (
    <div className={styles.root}>
      <SiteNav />

      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <span className={styles.heroLabel}>Current Offerings</span>
          <h1 className={styles.heroTitle}>Workshops</h1>
          <p className={styles.heroBody}>
            We provide accessible educational programs, workshops, lectures, and
            learning opportunities across diverse disciplines, including visual
            arts, theatre, philosophy, literature and cultural studies.
          </p>
        </div>
      </section>

      <section className={styles.featured} aria-label="Featured offerings">
        {offerings.map((offering, index) => (
          <article
            key={offering.title}
            className={styles.workshopCard}
            style={
              {
                "--card-bg": offering.bg,
                "--card-accent": offering.accent,
              } as React.CSSProperties
            }
          >
            <div className={styles.cardLeft}>
              <span className={styles.cardNumber}>
                {String(index + 1).padStart(2, "0")}
              </span>
              <span
                className={styles.statusBadge}
                style={{ borderColor: offering.accent, color: offering.accent }}
              >
                {offering.status}
              </span>
            </div>
            <div className={styles.cardMain}>
              <div className={styles.cardHeader}>
                <div>
                  <h2 className={styles.cardTitle}>{offering.title}</h2>
                  <p className={styles.cardSubtitle}>{offering.subtitle}</p>
                </div>
                <div className={styles.cardMeta}>
                  <span>{offering.date}</span>
                  <span>{offering.place}</span>
                </div>
              </div>
              <p className={styles.cardDescription}>{offering.description}</p>
              <div className={styles.cardFooter}>
                {offering.details.map((detail) => (
                  <span key={detail} className={styles.cardDetail}>
                    {detail}
                  </span>
                ))}
                <a href="#contact" className={styles.cardCta}>
                  Make an inquiry
                </a>
              </div>
            </div>
          </article>
        ))}
      </section>

      <section className={styles.upcomingSection}>
        <div className={styles.upcomingInner}>
          <h2 className={styles.upcomingTitle}>The Collective is presently committed to three major programs</h2>
          <p className={styles.upcomingIntro}>
            Creativity & The Creative Act as the medium to inquire into our
            shared human existence. Providing a Sanctuary where beauty and
            inquiry can meet. Providing Education & Community Networking.
          </p>
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Program</th>
                  <th>Form</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className={styles.tableTitle}>Creativity & The Creative Act</td>
                  <td>Inquiry into our shared human existence</td>
                  <td><span className={styles.tableBadge}>Present commitment</span></td>
                </tr>
                <tr>
                  <td className={styles.tableTitle}>Sanctuary</td>
                  <td>Where beauty and inquiry can meet</td>
                  <td><span className={styles.tableBadge}>Present commitment</span></td>
                </tr>
                <tr>
                  <td className={styles.tableTitle}>Education & Community Networking</td>
                  <td>Demonstrations, workshops, and interactive events</td>
                  <td><span className={styles.tableBadge}>Present commitment</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section id="contact" className={styles.contactSection}>
        <div className={styles.contactInner}>
          <h2 className={styles.contactTitle}>Inquiries</h2>
          <p className={styles.contactBody}>
            Prospective grantees are welcomed to make inquiries and proposals.
          </p>
          <a href="mailto:info@elkdonis-arts.org" className={styles.contactLink}>
            info@elkdonis-arts.org
          </a>
        </div>
      </section>
    </div>
  );
}

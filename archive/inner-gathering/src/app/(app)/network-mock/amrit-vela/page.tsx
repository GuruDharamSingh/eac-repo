import Link from "next/link";
import styles from "./page.module.css";

export const metadata = {
  title: "Morning Sadhana · Amrit Vela · elkdonis network",
};

const sequence = [
  { name: "Japji Sahib", note: "20 min · recitation" },
  { name: "Kundalini Yoga Kriya", note: "30 min · movement" },
  { name: "Savasana", note: "5 min · rest" },
  { name: "Long Chant — Ong Namo", note: "7 min · tuning in" },
  { name: "Seven Aquarian Sadhana Chants", note: "62 min · kirtan" },
  { name: "Long Time Sun", note: "3 min · blessing" },
];

const upcoming = [
  { date: "Sun, May 3, 2026", label: "Next circle" },
  { date: "Sun, Jun 7, 2026" },
  { date: "Sun, Jul 5, 2026" },
];

export default function AmritVelaNetworkDetailPage() {
  return (
    <div className={styles.root}>
      <nav className={styles.crumb}>
        <span className={styles.brand}>elkdonis network</span>
        <span className={styles.crumbSep}>/</span>
        <span>amrit-vela</span>
      </nav>

      <header className={styles.hero}>
        <div className={styles.heroGlow} aria-hidden />
        <div className={styles.heroInner}>
          <p className={styles.eyebrow}>Monthly · First Sunday · Free</p>
          <h1 className={styles.title}>Morning Sadhana</h1>
          <p className={styles.subtitle}>
            Crown yourself in the ambrosial hours before dawn. A 2.5&#8209;hour
            journey of Japji, Kundalini yoga and Aquarian kirtan.
          </p>
          <div className={styles.metaRow}>
            <MetaPill label="Starts" value="4:00 AM" />
            <MetaPill label="Runs" value="2.5 hours" />
            <MetaPill label="Price" value="Free" accent />
          </div>
        </div>
      </header>

      <main className={styles.main}>
        <section className={styles.pitch}>
          <h2 className={styles.h2}>A practice the ancients kept</h2>
          <p className={styles.prose}>
            Amrit Vela — the ambrosial hours before dawn — is when the veil is
            thinnest and the mind most receptive. We gather once a month to sit
            together in that window and move through the full Aquarian
            Sadhana. No prior experience needed. Bring a cushion, a shawl, and
            a willingness to arrive early.
          </p>
          <p className={styles.prose}>
            The circle is held by Guru Dharam Singh at Amrit Vela Toronto. It
            is free and open to anyone drawn to the practice — you only need
            to reserve a seat so we can hold space for you.
          </p>
        </section>

        <section className={styles.sequence}>
          <h2 className={styles.h2}>The sequence</h2>
          <ol className={styles.seqList}>
            {sequence.map((s, i) => (
              <li key={s.name} className={styles.seqItem}>
                <span className={styles.seqIndex}>{String(i + 1).padStart(2, "0")}</span>
                <span className={styles.seqName}>{s.name}</span>
                <span className={styles.seqNote}>{s.note}</span>
              </li>
            ))}
          </ol>
        </section>

        <section className={styles.sessions}>
          <h2 className={styles.h2}>Upcoming circles</h2>
          <div className={styles.sessionGrid}>
            {upcoming.map((u, i) => (
              <div
                key={u.date}
                className={`${styles.sessionCard} ${i === 0 ? styles.sessionCardPrimary : ""}`}
              >
                {u.label && <span className={styles.sessionTag}>{u.label}</span>}
                <div className={styles.sessionDate}>{u.date}</div>
                <div className={styles.sessionTime}>4:00 AM &mdash; 6:30 AM</div>
                {i === 0 ? (
                  <button className={styles.reserve}>Reserve a seat</button>
                ) : (
                  <button className={styles.reserveGhost}>Notify me</button>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className={styles.guide}>
          <div className={styles.guideCard}>
            <div className={styles.guideAvatar} aria-hidden>GD</div>
            <div>
              <p className={styles.guideLabel}>Held by</p>
              <h3 className={styles.guideName}>Guru Dharam Singh</h3>
              <p className={styles.guideBio}>
                Longtime teacher of Kundalini yoga and keeper of the Aquarian
                Sadhana circle in Toronto.
              </p>
              <Link href="#" className={styles.guideLink}>
                Amrit Vela Toronto &rarr;
              </Link>
            </div>
          </div>
        </section>

        <section className={styles.bring}>
          <h2 className={styles.h2}>What to bring</h2>
          <ul className={styles.bringList}>
            <li>A cushion or meditation seat</li>
            <li>A shawl or blanket (dawn is cold)</li>
            <li>Water, and an empty stomach if possible</li>
            <li>Yourself, as early as 3:45 AM</li>
          </ul>
        </section>

        <section className={styles.faq}>
          <h2 className={styles.h2}>Questions</h2>
          <Detail q="Do I need to know the chants?">
            No. Lyrics are shared on arrival and the room carries you.
          </Detail>
          <Detail q="Can I come late?">
            We ask that you arrive before 4:00 AM so the container stays
            undisturbed. Doors close at start.
          </Detail>
          <Detail q="Is there parking?">
            Street parking is free overnight until 7 AM.
          </Detail>
        </section>
      </main>

      <aside className={styles.stickyBar}>
        <div className={styles.stickyInner}>
          <div>
            <div className={styles.stickyTitle}>Morning Sadhana &middot; May 3</div>
            <div className={styles.stickySub}>Free &middot; first Sunday of every month</div>
          </div>
          <button className={styles.reserve}>Reserve a seat</button>
        </div>
      </aside>

      <footer className={styles.footer}>
        <span className={styles.footerMark}>&bull; elkdonis network</span>
        <span className={styles.footerMeta}>
          Hosted at <Link href="#" className={styles.footerLink}>amritvela.ca</Link>
        </span>
      </footer>
    </div>
  );
}

function MetaPill({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`${styles.pill} ${accent ? styles.pillAccent : ""}`}>
      <span className={styles.pillLabel}>{label}</span>
      <span className={styles.pillValue}>{value}</span>
    </div>
  );
}

function Detail({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <details className={styles.detail}>
      <summary className={styles.detailQ}>{q}</summary>
      <div className={styles.detailA}>{children}</div>
    </details>
  );
}

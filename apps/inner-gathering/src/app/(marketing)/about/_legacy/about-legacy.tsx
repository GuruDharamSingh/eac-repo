import styles from "./about.module.css";

export const metadata = {
  title: "About | Elkdonis Arts Collective",
  description:
    "The founding story and members of the Elkdonis Arts Collective — an international anarchist arts and education collective.",
};

const members = [
  {
    name: "Jason Ford",
    roles: ["Co-Founder", "Performance Artist", "Facilitator"],
    location: "Toronto, Canada",
    about:
      "Inventor of the balance assemblage sculptural performance and game. Jason brings expertise in performance art, paratheater, rock balancing, and facilitation. He leads the Elkdonis Labs curriculum.",
  },
  {
    name: "Dana McCool",
    roles: ["Co-Founder", "Writer", "Researcher"],
    location: "Paris, France",
    about:
      "Historical tour guide, storyteller, and autodidactic researcher focused on folklore, sociology, art history, colonialism, and land-based knowledge. European outreach lead and content creator.",
  },
  {
    name: "Ario",
    roles: ["Musician", "Educator", "Workshop Facilitator"],
    location: "Los Angeles, USA",
    about:
      "Music educator offering drum circle and rhythm attunement programs (sangrehouse.com) as well as enneagram workshops (hiddenenneagram.com). Active in seeking funding and exposure in the US.",
  },
  {
    name: "Justin Gillis",
    roles: ["Web & Technology", "Design"],
    location: "Toronto, Canada",
    about:
      "Lead architect of the collective's digital infrastructure and web design vision. Developing a unified book-themed website concept and may host an artist residency at the ashram.",
  },
  {
    name: "Stephan",
    roles: ["IT", "Legal & Incorporation"],
    location: "Toronto, Canada",
    about:
      "Overseeing the Nextcloud infrastructure and co-leading the legal incorporation of the collective as a Canadian not-for-profit organization.",
  },
  {
    name: "Sarah",
    roles: ["Marketing & Strategy"],
    location: "Toronto, Canada",
    about:
      "Professional marketing strategist with academic and career experience. Leading the development of the collective's outreach strategy and social media presence.",
  },
];

export default function AboutPage() {
  return (
    <div className={styles.root}>
      {/* Opening — large parchment panel */}
      <section className={styles.hero}>
        <div className={styles.heroLeft}>
          <span className={styles.heroLabel}>Founding Story</span>
          <h1 className={styles.heroTitle}>About</h1>
        </div>
        <div className={styles.heroRight}>
          <p className={styles.heroPullQuote}>
            &ldquo;We are a fourth way school in the Chisti tradition.
            We publicly front as an arts collective with nothing to prove.&rdquo;
          </p>
          <p className={styles.heroAttr}>— Jason Ford</p>
        </div>
      </section>

      {/* Origin */}
      <section className={styles.originSection}>
        <div className={styles.originInner}>
          <div className={styles.originLabel}>The Name</div>
          <div className={styles.originText}>
            <h2 className={styles.originTitle}>
              From Helkdonis — <em>prayer not for self</em>
            </h2>
            <p>
              The name Elkdonis derives from the ancient Greek word{" "}
              <em>Helkdonis</em>, which carries the meaning of objective prayer —
              prayer not for the self, but outward, selfless, directed toward
              something greater. It is this orientation that undergirds
              everything the collective does.
            </p>
            <p>
              Jason Ford and Dana McCool officially founded the Elkdonis Arts
              Collective as a duo of artists working at the cutting edge of
              experimentation — minimizing habitual elaboration so that the
              viewer&apos;s experiential expectations, previously stored perceptual
              patterns, may be confronted and temporarily dissolved, allowing
              direct perception of self in the moment.
            </p>
            <p>
              The collective has since grown into an international network with
              key members based in Toronto, Los Angeles, and Paris — operating
              across disciplines of performance art, creative writing, music,
              philosophy, digital infrastructure, and marketing.
            </p>
          </div>
        </div>
      </section>

      {/* What we do */}
      <section className={styles.whatSection}>
        <div className={styles.whatInner}>
          <h2 className={styles.whatTitle}>What We Do</h2>
          <div className={styles.whatGrid}>
            <div className={styles.whatBlock}>
              <h3>Balance Assemblage</h3>
              <p>
                Our signature practice: gravity-defying formations of stone and
                rubble, delicately balanced in public and natural spaces. These
                ephemeral sculptures reach the viewer on deeper levels of being
                and cultivate a transcendental view. Viewers become respectful of
                the magnificence and exaltation — the sculptures disarm and take
                one&apos;s breath away.
              </p>
            </div>
            <div className={styles.whatBlock}>
              <h3>Paratheater &amp; Ritual</h3>
              <p>
                Performance laboratories, energy healing rituals, immersive
                readings, and creative writing workshops that embody our
                collective&apos;s anarchist and reductionist principles. Art as
                vehicle — using creative expression to access deeper states of
                consciousness and inner transformation.
              </p>
            </div>
            <div className={styles.whatBlock}>
              <h3>Education &amp; Community</h3>
              <p>
                Workshops, reading groups, and seminars accessible to all. A
                nomadic reading room and open-concept bookstore, online workshops
                for freelance writers and artists, and entrepreneurial development
                programs for independent creatives. A sanctuary where beauty and
                inquiry can meet.
              </p>
            </div>
            <div className={styles.whatBlock}>
              <h3>Documentary &amp; Archive</h3>
              <p>
                An in-progress documentary — <em>Earth, Art, and Anarchy:
                Between Worlds with the Elkdonis Collective</em> — capturing
                balance assemblage performances across Canada alongside
                paratheater, music, and philosophy, to introduce the collective
                and its vision to a global audience.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Members */}
      <section className={styles.membersSection}>
        <div className={styles.membersInner}>
          <h2 className={styles.membersTitle}>The Collective</h2>
          <p className={styles.membersIntro}>
            Auto-didactic creatives, occultists, musicians, performance artists,
            writers, and historians — embodying rhizomatic, non-hierarchical
            learning across three continents.
          </p>
          <div className={styles.membersGrid}>
            {members.map((m) => (
              <div key={m.name} className={styles.memberCard}>
                <div className={styles.memberInitial}>
                  {m.name.charAt(0)}
                </div>
                <div className={styles.memberInfo}>
                  <h3 className={styles.memberName}>{m.name}</h3>
                  <div className={styles.memberRoles}>
                    {m.roles.join(" · ")}
                  </div>
                  <div className={styles.memberLocation}>{m.location}</div>
                  <p className={styles.memberAbout}>{m.about}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Cities */}
      <section className={styles.citiesSection}>
        <div className={styles.citiesInner}>
          <div className={styles.cityBlock}>
            <span className={styles.cityName}>Toronto</span>
            <span className={styles.cityRole}>Operations · Technology · Performance</span>
          </div>
          <div className={styles.cityDivider} />
          <div className={styles.cityBlock}>
            <span className={styles.cityName}>Los Angeles</span>
            <span className={styles.cityRole}>Music · Education · Outreach</span>
          </div>
          <div className={styles.cityDivider} />
          <div className={styles.cityBlock}>
            <span className={styles.cityName}>Paris</span>
            <span className={styles.cityRole}>Research · Writing · European Networks</span>
          </div>
        </div>
      </section>

      {/* Vision statement */}
      <section className={styles.visionSection}>
        <blockquote className={styles.visionQuote}>
          &ldquo;The collective is committed to using art as the means of inquiry.
          Each inquiry focuses on a particular question that is grounded in
          what it is to be human. We are unique in our purpose and are not
          commercial. Our works are intended to be experienced, not sold.&rdquo;
        </blockquote>
        <p className={styles.visionCaption}>
          Elkdonis Arts Collective &mdash; Founded, Toronto
        </p>
      </section>
    </div>
  );
}

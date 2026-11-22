"use client";

import { M_EXPERIENCES, M_GUIDES, M_PEOPLE, M_PLACES, M_TOUR as T, art } from "./data";
import { ArchFrame, CatalogueRow, Chip, ChipRow, FactsGrid, FactsStrip, PhoneFrame, Porthole, PrimaryButton, SectionHeader, StopTimeline } from "./phone-parts";

// Static mocks of the phone blocks (apps/elktours/src/blocks/mobile/*). Each draws the block's own markup and class
// names, with the block's default words as props and the invented sample from ./data in place of the resolver data.

const glass = <span className="blk-mtl-glass" />;

/* ---------------------------------------------------------------- Discover */

export function MMasthead() {
  return (
    <PhoneFrame>
      <header className="blk blk-mmast-root">
        <div className="blk-mmast">
          <div className="blk-mmast-word">
            <span className="blk-mmast-word1">Elkdonis</span>
            <span className="blk-mmast-word2">Experiences</span>
          </div>
          <button type="button" className="blk-mmast-city">
            <span className="blk-mmast-burger" aria-hidden="true">{"☰"}</span>
            <span className="blk-mmast-cityname">Paris</span>
          </button>
        </div>
      </header>
    </PhoneFrame>
  );
}

export function MSearchRow() {
  return (
    <PhoneFrame>
      <div className="blk blk-msr-wrap">
        <a href="#" className="blk-msr">
          {glass}
          <span className="blk-msr-text">Search walks, ateliers, museums</span>
        </a>
        <a href="#" className="blk-msr-filter" aria-label="Filter tours">
          <span />
          <span />
          <span />
        </a>
      </div>
    </PhoneFrame>
  );
}

export function MFeaturedTour() {
  return (
    <PhoneFrame>
      <div className="blk-mft-root">
        <SectionHeader label="Featured Tour" />
        <a href="#" className="blk-mft m-cusp">
          <ArchFrame w={338} h={250} bottom={16} src={T.cover}>
            <span className="blk-mft-badge">4 places left</span>
          </ArchFrame>
          <span className="blk-mft-foot">
            <span className="blk-mft-text">
              <span className="m-kicker blk-mft-meta">Walking tour {"·"} 2 h 30</span>
              <span className="blk-mft-title">{T.title}</span>
              <span className="blk-mft-by">with Marguerite {"·"} Next {"·"} Sat 21 Nov, 10:00</span>
            </span>
            <span className="blk-mft-go">{"→"}</span>
          </span>
        </a>
      </div>
    </PhoneFrame>
  );
}

export function MPlacesShelf() {
  return (
    <PhoneFrame>
      <section className="blk blk-mps">
        <SectionHeader label="Favourite places" more={"All ›"} />
        <div className="blk-mps-shelf">
          {M_PLACES.map((p) => (
            <button key={p.id} type="button" className="blk-mps-card">
              <ArchFrame w={168} h={196} bottom={18} src={p.img} />
              <span className="m-kicker blk-mps-kind">{p.kind}</span>
              <span className="blk-mps-name">{p.name}</span>
              <span className="blk-mps-area">{p.area}</span>
            </button>
          ))}
          <a href="#" className="blk-mps-all">
            <span>See all 75</span>
          </a>
        </div>
      </section>
    </PhoneFrame>
  );
}

export function MExperiencesPanel() {
  return (
    <PhoneFrame>
      <section className="blk blk-mxp">
        <span className="m-kicker blk-mxp-label">Experiences coming</span>
        <h2 className="blk-mxp-heading">Something strange on the way</h2>
        <p className="blk-mxp-line">Local artists and residents waiting at a stop, or open to you by request.</p>
        <div className="blk-mxp-rows">
          {M_EXPERIENCES.map((e) => (
            <a key={e.id} href="#" className="blk-mxp-row">
              <Porthole size={72} verdigris src={e.img} initial={e.title.slice(0, 1)} />
              <span className="blk-mxp-text">
                <span className="blk-mxp-title">{e.title}</span>
                <span className="blk-mxp-by">{e.artist} {"·"} {e.craft}</span>
                <span className="blk-mxp-where">{e.where}</span>
              </span>
            </a>
          ))}
        </div>
      </section>
    </PhoneFrame>
  );
}

export function MGuides() {
  return (
    <PhoneFrame>
      <section className="blk blk-mg">
        <SectionHeader label="Your guides" more={"Local Artists ›"} />
        <div className="blk-mg-list">
          {M_GUIDES.map((g, i) => {
            const open = i === 0;
            return (
              <div key={g.id} className="blk-mg-card">
                <button type="button" className="blk-mg-head" aria-expanded={open}>
                  <Porthole size={52} src={g.photo} initial={g.initial} />
                  <span className="blk-mg-text">
                    <span className="blk-mg-name">
                      {g.name}
                      <span className="blk-mg-craft"> {"·"} {g.craft}</span>
                    </span>
                    <span className="blk-mg-bio">{g.bio}</span>
                  </span>
                  <span className="blk-mg-mark">{open ? "–" : "+"}</span>
                </button>
                {open && (
                  <div className="blk-mg-open m-fade">
                    <span className="m-kicker blk-mg-now">Leading now</span>
                    {g.tours.map((t) => (
                      <a key={t.slug} href="#" className="blk-mg-tour">
                        <span className="blk-mg-tour-title">{t.title}</span>
                        <span className="blk-mg-tour-sub">{t.sub}</span>
                      </a>
                    ))}
                    <a href="#" className="blk-mg-profile">Full profile {"→"}</a>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </PhoneFrame>
  );
}

export function MLinkRows() {
  return (
    <PhoneFrame>
      <div className="blk blk-mlr">
        <a href="#" className="m-row blk-mlr-feed">
          <span className="blk-mlr-feed-top">
            <span className="m-kicker blk-mlr-feed-kicker">From the guides {"·"} Feed</span>
            <span className="blk-mlr-feed-count">3</span>
            <span className="m-row-chev">{"›"}</span>
          </span>
          <span className="blk-mlr-feed-body">
            <ArchFrame w={52} h={60} bottom={8}>
              <span className="m-porthole-initial blk-mlr-initial">M</span>
            </ArchFrame>
            <span className="blk-mlr-feed-text">
              <span className="blk-mlr-feed-title">A new route through the passages</span>
              <span className="blk-mlr-feed-excerpt">Three glass roofs, one very good bookbinder.</span>
              <span className="blk-mlr-feed-by">Marguerite Delmas</span>
            </span>
          </span>
        </a>
        <div className="blk-mlr-places">
          <CatalogueRow thumb={<ArchFrame w={44} h={52} bottom={7} brass />} kicker="The places catalogue" title="Every stop, gallery and table" meta="75 places the guides know well" />
        </div>
        <div className="blk-mlr-pair">
          <a href="#" className="m-row blk-mlr-forum">
            <span className="blk-mmast-dot blk-mlr-forum-dot" />
            <span className="m-row-text blk-mlr-forum-title">Elkdonis Forum</span>
            <span className="m-row-chev">{"›"}</span>
          </a>
          <a href="#" className="m-row blk-mlr-login">
            <span className="blk-mlr-login-text">Log in</span>
          </a>
        </div>
      </div>
    </PhoneFrame>
  );
}

/* ---------------------------------------------------------------- Tour list */

const TOUR_ROWS = [
  { id: "r1", title: T.title, typeLabel: "Walk", duration: "2 h 30", guide: "Marguerite", nextLabel: "Sat 21 Nov, 10:00", priceLabel: "€45", img: art(28, "", 224, 288) },
  { id: "r2", title: "Ateliers of the Marais", typeLabel: "Atelier", duration: "3 h", guide: "Jules", nextLabel: "Sun 22 Nov, 14:00", priceLabel: "€60", img: art(20, "", 224, 288) },
  { id: "r3", title: "A morning at the market", typeLabel: "Food", duration: "2 h", guide: "Ines", nextLabel: "Sat 21 Nov, 09:00", priceLabel: "", img: null },
];

export function MTourList() {
  const chips = ["All", "Walks", "Ateliers", "Museums", "Food & markets", "Private"];
  return (
    <PhoneFrame>
      <section className="blk blk-mtl">
        <div className="blk-mtl-search">
          {glass}
          <input className="blk-mtl-input" placeholder="Search walks, ateliers, museums" aria-label="Search tours" readOnly />
        </div>
        <ChipRow>
          {chips.map((c, i) => (
            <Chip key={c} selected={i === 0}>
              <span className={`blk-mtl-chip-${["all", "walks", "ateliers", "museums", "food", "private"][i]}`}>{c}</span>
            </Chip>
          ))}
        </ChipRow>
        <div className="blk-mtl-list">
          {TOUR_ROWS.map((t) => (
            <a key={t.id} href="#" className="blk-mtl-card m-cusp" style={{ ["--cusp" as string]: "16px" }}>
              <span className="blk-mtl-thumb">
                <ArchFrame w={112} h={144} bottom={14} brass src={t.img} />
              </span>
              <span className="blk-mtl-text">
                <span className="m-kicker blk-mtl-meta">{t.typeLabel} {"·"} {t.duration}</span>
                <span className="blk-mtl-title">{t.title}</span>
                <span className="blk-mtl-guide"><span className="blk-mtl-with">with</span> {t.guide}</span>
                <span className="blk-mtl-foot">
                  <span className="blk-mtl-next">{t.nextLabel}</span>
                  <span className="blk-mtl-price">{t.priceLabel || "On request"}</span>
                </span>
              </span>
            </a>
          ))}
        </div>
      </section>
    </PhoneFrame>
  );
}

/* ---------------------------------------------------------------- Experiences, people, About */

export function MExperienceList() {
  return (
    <PhoneFrame>
      <div className="blk blk-mxl">
        {M_EXPERIENCES.map((c) => (
          <a key={c.id} href="#" className="blk-mxl-card">
            <span className="blk-mxl-head">
              <Porthole size={76} verdigris src={c.img} initial={c.title.slice(0, 1)} />
              <span className="blk-mxl-text">
                <span className="m-kicker blk-mxl-meta">{c.meta}</span>
                <span className="blk-mxl-title">{c.title}</span>
                <span className="blk-mxl-by">{c.artist} {"·"} {c.craft}</span>
              </span>
            </span>
            <span className="blk-mxl-pitch">{c.pitch}</span>
            <span className="blk-mxl-where">{c.where}</span>
          </a>
        ))}
      </div>
    </PhoneFrame>
  );
}

export function MArtistsRow() {
  const artists = M_PEOPLE.filter((p) => p.kind === "artist");
  return (
    <PhoneFrame>
      <section className="blk blk-mar">
        <SectionHeader label="The artists" more={"All ›"} />
        <div className="blk-mar-row">
          {artists.map((a) => (
            <a key={a.slug} href="#" className="blk-mar-card">
              <Porthole size={84} verdigris src={a.photo} initial={a.initial} />
              <span className="blk-mar-name">{a.name}</span>
              <span className="blk-mar-craft">{a.craft}</span>
              {a.status && <span className="blk-mar-status">{a.status}</span>}
            </a>
          ))}
        </div>
      </section>
    </PhoneFrame>
  );
}

export function MSuggestPill() {
  return (
    <PhoneFrame>
      <a href="#" className="blk blk-msp">
        <span className="blk-msp-label">Know an artist we should meet?</span>
      </a>
    </PhoneFrame>
  );
}

function PersonCardMock({ x, slide }: { x: (typeof M_PEOPLE)[number]; slide?: boolean }) {
  return (
    <a href="#" className={`blk-mpc ${x.kind === "guide" ? "is-guide" : "is-artist"}${slide ? " blk-mpc-slide" : ""}`}>
      <span className="blk-mpc-back" aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {x.photo ? <img src={x.photo} alt="" /> : null}
      </span>
      <span className="blk-mpc-wash" aria-hidden="true" />
      <span className="blk-mpc-pic">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {x.photo ? <img src={x.photo} alt="" /> : <span className="blk-mpc-initial">{x.initial}</span>}
      </span>
      <span className="blk-mpc-text">
        <span className="blk-mpg-name">{x.name}</span>
        <span className="blk-mpg-sub">{[x.craft, x.area].filter(Boolean).join(" · ")}</span>
        {x.status && <span className="blk-mpg-status">{x.status}</span>}
      </span>
    </a>
  );
}

export function MPeopleGrid() {
  return (
    <PhoneFrame>
      <div className="blk-mpg">
        <div className="m-chip-row">
          <Chip selected><span className="blk-mpg-chip-all">Everyone</span></Chip>
          <Chip><span className="blk-mpg-chip-guides">Guides</span></Chip>
          <Chip><span className="blk-mpg-chip-artists">Artists</span></Chip>
        </div>
        <div className="blk-mpg-grid">
          {M_PEOPLE.map((x) => (
            <PersonCardMock key={x.slug} x={x} />
          ))}
        </div>
      </div>
    </PhoneFrame>
  );
}

export function MPeopleSlider() {
  return (
    <PhoneFrame>
      <section className="blk blk-mpsl">
        <SectionHeader label="Local Artists" more={"All ›"} />
        <div className="blk-mpsl-row">
          {M_PEOPLE.map((x) => (
            <PersonCardMock key={x.slug} x={x} slide />
          ))}
        </div>
      </section>
    </PhoneFrame>
  );
}

export function MAboutPhoto() {
  return (
    <PhoneFrame>
      <div className="blk blk-map">
        <ArchFrame w={358} h={300} bottom={22} brass src={art(28, "Paris", 716, 600)} />
      </div>
    </PhoneFrame>
  );
}

export function MProseSections() {
  const sec = [
    ["I · Tours", "Walks led by a guide on set dates. Pick a date, say how many you are, and pay by card."],
    ["II · Experiences", "Time with the artists we work with: a studio visit, a workshop, a performance."],
    ["III · Places & the forum", "Every stop the guides know well, and a forum to talk about it."],
  ];
  return (
    <PhoneFrame>
      <section className="blk blk-mpr">
        <p className="blk-mpr-intro m-dropcap">Guided walks and experiences in Paris. Small groups, on foot, led by people who live here.</p>
        {sec.map(([l, t], i) => (
          <div key={l} className="blk-mpr-sec">
            <span className="m-kicker"><span className={`blk-mpr-l${i + 1}`}>{l}</span></span>
            <span className="m-rule" aria-hidden="true" />
            <p className={`blk-mpr-t${i + 1}`}>{t}</p>
          </div>
        ))}
      </section>
    </PhoneFrame>
  );
}

export function MExpHero() {
  const e = M_EXPERIENCES[0]!;
  return (
    <PhoneFrame>
      <header className="blk blk-mxh">
        <Porthole size={220} verdigris src={art(340, "", 440, 440)} initial={e.title.slice(0, 1)} />
        <h1 className="blk-mxh-title">{e.title}</h1>
        <p className="blk-mxh-pitch">{e.pitch}</p>
        <a href="#" className="blk-mxh-host">
          <Porthole size={40} verdigris src={art(340, "", 80, 80)} initial="O" />
          <span>Odile Ferrant</span>
        </a>
      </header>
    </PhoneFrame>
  );
}

export function MExpFacts() {
  return (
    <PhoneFrame>
      <div className="blk blk-mxf">
        <FactsGrid items={[{ label: "Length", value: "1 h 30" }, { label: "Format", value: "In person" }, { label: "Where", value: "Belleville" }, { label: "Group", value: "up to 4" }]} />
      </div>
    </PhoneFrame>
  );
}

export function MExpBody() {
  return (
    <PhoneFrame>
      <div className="blk blk-mtb m-dropcap" dangerouslySetInnerHTML={{ __html: "<p>A small studio at the back of a courtyard. The artist shows how a plate is inked and wiped, then you pull your own proof on the press.</p><p>Tea is provided. Groups of up to four.</p>" }} />
    </PhoneFrame>
  );
}

export function MExpTours() {
  return (
    <PhoneFrame>
      <section className="blk blk-mxt">
        <SectionHeader label="On these tours" />
        <div className="blk-mxt-list">
          <CatalogueRow thumb={<ArchFrame w={44} h={52} bottom={7} brass />} title="Ateliers of the Marais" />
          <CatalogueRow thumb={<ArchFrame w={44} h={52} bottom={7} brass />} title={T.title} />
        </div>
      </section>
    </PhoneFrame>
  );
}

export function MExpDates() {
  return (
    <PhoneFrame>
      <section className="blk blk-mxd">
        <SectionHeader label="Upcoming dates" />
        <div className="blk-mxd-list">
          {[["Sun 22 Nov, 14:00", "Ateliers of the Marais"], ["Sat 28 Nov, 10:30", "Ateliers of the Marais"]].map(([d, t]) => (
            <a key={d} href="#" className="blk-mtd-chip">
              <span className="blk-mtd-chip-day">{d}</span>
              <span className="blk-mtd-chip-left">{t}</span>
            </a>
          ))}
        </div>
      </section>
    </PhoneFrame>
  );
}

export function MExpPrivate() {
  return (
    <PhoneFrame>
      <section className="blk blk-mxe">
        <p className="blk-mxe-note">This one is arranged with you. Tell us when and how many, and we reply to arrange it.</p>
        <button type="button" className="blk-mxe-cta">Ask about a private visit</button>
      </section>
    </PhoneFrame>
  );
}

/* ---------------------------------------------------------------- Places catalogue and Feed */

export function MPlacesCatalogue() {
  return (
    <PhoneFrame>
      <section className="blk blk-mpc">
        <ChipRow>
          <Chip selected><span className="blk-mpc-chip-all">All</span></Chip>
          <Chip><span className="blk-mpc-chip-fav">Favourites</span></Chip>
          <Chip>Passage</Chip>
          <Chip>Atelier</Chip>
          <Chip>Cafe</Chip>
        </ChipRow>
        <div className="blk-mpc-list">
          {M_PLACES.map((r) => (
            <div key={r.id} className="blk-mpc-row">
              <CatalogueRow thumb={<ArchFrame w={52} h={64} bottom={10} src={r.img} />} kicker={`${r.kind} · ${r.area}`} title={r.name} meta={[r.tags.join(" · "), r.favourite ? "A guide favourite" : ""].filter(Boolean).join(" · ")} />
            </div>
          ))}
        </div>
      </section>
    </PhoneFrame>
  );
}

const FEED = [
  { id: "f1", title: "A new route through the passages", kind: "post", host: "", author: "Marguerite", initial: "M", whenLabel: "2 h ago", replyCount: 3 },
  { id: "f2", title: "An exhibition worth the detour", kind: "link", host: "example.org", author: "Jules", initial: "J", whenLabel: "3 days ago", replyCount: 0 },
  { id: "f3", title: "Where to find the best bread near the market", kind: "post", host: "", author: "Ines", initial: "I", whenLabel: "last week", replyCount: 7 },
];

export function MFeedList() {
  return (
    <PhoneFrame>
      <section className="blk blk-mfl">
        {FEED.map((r) => (
          <div key={r.id} className="blk-mfl-row">
            <CatalogueRow
              thumb={
                <ArchFrame w={52} h={60} bottom={10}>
                  <span className="blk-mfl-initial">{r.initial}</span>
                </ArchFrame>
              }
              kicker={r.kind === "link" ? `Link · ${r.host}` : "Post"}
              title={r.title}
              meta={`${r.author} · ${r.whenLabel}${r.replyCount ? ` · ${r.replyCount} comments` : ""}`}
            />
          </div>
        ))}
      </section>
    </PhoneFrame>
  );
}

/* ---------------------------------------------------------------- Tour template */

export function MTourTopbar() {
  return (
    <PhoneFrame>
      <div className="em-topbar-stage">
        <div className="blk blk-mttop">
          <button type="button" className="m-back" aria-label="Back">{"←"}</button>
          <button type="button" className="m-back blk-mttop-heart is-saved" aria-pressed="true" aria-label="Save this tour">{"♥"}</button>
        </div>
      </div>
    </PhoneFrame>
  );
}

export function MTourHero() {
  return (
    <PhoneFrame>
      <section className="blk blk-mth">
        <div className="blk-mth-stage">
          <ArchFrame w={358} h={330} bottom={26} brass src={T.cover}>
            <span className="m-kicker blk-mth-count">I / III</span>
          </ArchFrame>
        </div>
        <div className="blk-mth-pills">
          <Chip selected>Photos {"·"} 3</Chip>
          <Chip>Fly-over</Chip>
        </div>
        <div className="blk-mth-filmrow">
          <button type="button" className="blk-mth-filmbtn">
            <span aria-hidden="true">{"▶"}</span> Fly-over film {"·"} 1:12
          </button>
        </div>
      </section>
    </PhoneFrame>
  );
}

export function MTourHead() {
  return (
    <PhoneFrame>
      <header className="blk blk-mtt">
        <h1 className="blk-mtt-title">{T.title}</h1>
        <div className="blk-mtt-guide">
          <Porthole size={40} src={T.guide.photo} initial="M" />
          <div>
            <div className="blk-mtt-guide-name">{T.guide.name}</div>
            <div className="blk-mtt-guide-sub">{T.guide.craft} {"·"} leads in {T.guide.languages}</div>
          </div>
        </div>
        <FactsStrip items={T.facts} />
      </header>
    </PhoneFrame>
  );
}

export function MTourBlurb() {
  return (
    <PhoneFrame>
      <div className="blk blk-mtb m-dropcap" dangerouslySetInnerHTML={{ __html: T.bodyHtml }} />
    </PhoneFrame>
  );
}

export function MTourMeet() {
  return (
    <PhoneFrame>
      <p className="blk blk-mtm">
        <span className="m-kicker blk-mtm-label">Meet at</span> {T.meetAt}
      </p>
    </PhoneFrame>
  );
}

export function MTourRoute() {
  return (
    <PhoneFrame>
      <section className="blk blk-mtr">
        <div className="m-section">
          <span className="m-kicker m-section-label blk-mtr-heading">The route</span>
          <span className="m-rule" aria-hidden="true" />
        </div>
        <StopTimeline
          openIndex={1}
          stops={T.stops.map((s) => ({
            name: s.name,
            when: s.when,
            note: s.note,
            // eslint-disable-next-line @next/next/no-img-element
            thumb: <img className="blk-mtr-thumb" src={s.still} alt="" />,
            // eslint-disable-next-line @next/next/no-img-element
            extra: <><img className="blk-mtr-still" src={s.still} alt="" /><a href="#" className="blk-mtr-pill">About this place</a></>,
          }))}
        />
      </section>
    </PhoneFrame>
  );
}

export function MTourDates() {
  return (
    <PhoneFrame>
      <section className="blk blk-mtd">
        <span className="m-kicker blk-mtd-dates-label">Next dates</span>
        <div className="blk-mtd-chips">
          {T.slots.map((s) => (
            <a key={s.slotId} href="#" className="blk-mtd-chip">
              <span className="blk-mtd-chip-day">{s.day}</span>
              <span className="blk-mtd-chip-left">{s.left}</span>
            </a>
          ))}
        </div>
      </section>
    </PhoneFrame>
  );
}

export function MTourBookbar() {
  return (
    <PhoneFrame>
      <div className="blk blk-mtbar">
        <div className="blk-mtbar-price">
          <span className="blk-mtbar-amount">{T.priceLabel}</span>
          <span className="blk-mtbar-per">per person</span>
        </div>
        <PrimaryButton>{"Choose a date →"}</PrimaryButton>
      </div>
    </PhoneFrame>
  );
}

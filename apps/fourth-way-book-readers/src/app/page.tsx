import Link from "next/link";
import Image from "next/image";
import { activeProgram, groups, newsletterQueue, units, weekWorkspace } from "@/lib/sample-reading";

export default function HomePage() {
  const progress = Math.round((activeProgram.week / activeProgram.totalWeeks) * 100);

  return (
    <main className="app-shell">
      <header className="site-header">
        <Link className="brand" href="/">
          <span className="brand-mark">4W</span>
          <span>
            <strong>4th Way Book Readers</strong>
            <span>Reading groups</span>
          </span>
        </Link>
        <nav className="header-actions" aria-label="Primary">
          <a href="#program">Program</a>
          <a href="#schedule">Schedule</a>
          <a href="#meeting">Meeting</a>
          <Link href="/admin/import">Import Wizard</Link>
        </nav>
      </header>

      <div className="workspace">
        <div className="dashboard-grid">
          <aside className="panel" aria-label="Reading groups">
            <p className="eyebrow">Groups</p>
            <h2>Reading circles</h2>
            <p className="muted">Choose the circle, then follow its active book program and weekly meeting flow.</p>
            <div className="group-list">
              {groups.map((group) => (
                <div className="group-item" data-active={group.active} key={group.name}>
                  <strong>{group.name}</strong>
                  <span>{group.members} readers · {group.cadence}</span>
                </div>
              ))}
            </div>
          </aside>

          <section className="middle-stack">
            <article className="current-program" id="program">
              <figure className="book-photo">
                <Image
                  src={activeProgram.imageUrl}
                  alt="Open book on a study table"
                  fill
                  priority
                  sizes="(max-width: 760px) 100vw, 190px"
                />
              </figure>
              <div className="program-copy">
                <div>
                  <p className="eyebrow">Current book</p>
                  <h1>{activeProgram.title}</h1>
                  <div className="program-meta">
                    <span className="pill" data-tone="blue">{activeProgram.author}</span>
                    <span className="pill" data-tone="green">Week {activeProgram.week} of {activeProgram.totalWeeks}</span>
                    <span className="pill">{activeProgram.nextMeeting}</span>
                  </div>
                </div>
                <div>
                  <div className="progress-track" style={{ "--progress": `${progress}%` } as React.CSSProperties}>
                    <span />
                  </div>
                  <p className="muted">{progress}% through this reading program · {activeProgram.location}</p>
                </div>
                <div className="program-actions">
                  <a className="button button-primary" href="#schedule">Open Week {activeProgram.week}</a>
                  <Link className="button button-secondary" href="/admin/import">Prepare Next Book</Link>
                </div>
              </div>
            </article>

            <section className="panel" id="schedule">
              <p className="eyebrow">Schedule</p>
              <h2>Weekly reading path</h2>
              <div className="unit-list">
                {units.map((unit, index) => (
                  <article className="unit-row" key={unit.id}>
                    <div className="unit-number">{index + 1}</div>
                    <div>
                      <h3>{unit.title}</h3>
                      <p className="muted">{unit.label} · {unit.locator} · {unit.estimatedMinutes} min</p>
                      <div className="resource-tags">
                        <span>Discussion</span>
                        <span>Notes</span>
                        {unit.resourceUrl ? <span>Resource linked</span> : <span>Resource slot</span>}
                      </div>
                    </div>
                    <div className="unit-date">Wednesday<br />7:00 PM</div>
                  </article>
                ))}
              </div>
            </section>

            <section className="panel">
              <p className="eyebrow">Week {activeProgram.week} workspace</p>
              <h2>Reading, discussion, notes</h2>
              <div className="workspace-list">
                {weekWorkspace.map((item) => (
                  <article className="workspace-item" key={item.title}>
                    <strong>{item.title}</strong>
                    <span>{item.detail}</span>
                  </article>
                ))}
              </div>
            </section>
          </section>

          <aside className="side-stack">
            <section className="panel" id="meeting">
              <p className="eyebrow">Meeting</p>
              <h3>Next gathering</h3>
              <div className="metric-grid">
                <div className="metric">
                  <strong>18</strong>
                  <span>RSVP yes</span>
                </div>
                <div className="metric">
                  <strong>6</strong>
                  <span>New replies</span>
                </div>
                <div className="metric">
                  <strong>2</strong>
                  <span>Media links</span>
                </div>
                <div className="metric">
                  <strong>1</strong>
                  <span>Notes doc</span>
                </div>
              </div>
            </section>

            <section className="panel">
              <p className="eyebrow">Notes to recap</p>
              <h3>Meeting capture</h3>
              <div className="queue-list">
                {newsletterQueue.map((item) => (
                  <div className="queue-item" key={item.title}>
                    <strong>{item.title}</strong>
                    <span className="muted">{item.status}</span>
                  </div>
                ))}
              </div>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
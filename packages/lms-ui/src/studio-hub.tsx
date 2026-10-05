import { canCurateHub, isOrgStaff, listGuides, listOfferings, listTraditions } from "@elkdonis/lms";
import type { LmsConnectors } from "./connectors";
import type { PageQuery, PageResult } from "./pages";
import { ActionForm, Flash, RealmChoice } from "./parts";

function StudioCrumbs({ c }: { c: LmsConnectors }) {
  return <nav className="so-crumbs" aria-label="Breadcrumb"><a href={c.hrefs.studio()}>Studio</a></nav>;
}

// ── /studio/guides ──────────────────────────────────────────────────────────
export async function StudioGuidesPage({ c, q }: { c: LmsConnectors; q: PageQuery }): Promise<PageResult> {
  const viewer = await c.viewer();
  if (!viewer.userId) return { kind: "redirect", to: c.hrefs.signIn(c.hrefs.studioGuides()) };
  if (!canCurateHub(viewer)) return { kind: "not-found" };
  const [guides, traditions] = await Promise.all([listGuides(), listTraditions()]);
  const back = c.hrefs.studioGuides();
  const node = (
    <main className="so-page">
      <Flash {...q} />
      <StudioCrumbs c={c} />
      <header className="so-hero">
        <span className="so-kicker">Studio</span>
        <h1>Guides</h1>
        <p>The people listed on the <a href={c.hrefs.guides()}>Guides page</a>. Add someone by the email of their network account, then give them a short bio, a side, and the traditions they teach from. <a href={c.hrefs.studioTraditions()}>Manage traditions →</a></p>
      </header>
      <ActionForm c={c} action="studio-guide-add" back={back} className="so-form so-form--row">
        <label className="so-sr" htmlFor="guide-email">Email of their account</label>
        <input id="guide-email" name="email" type="email" required placeholder="Email of their network account" />
        <button type="submit" className="so-btn">Add guide</button>
      </ActionForm>
      {guides.length === 0 ? <p className="so-empty">No guides yet.</p> : guides.map((g) => (
        <section key={g.userId} id={`guide-${g.userId}`} className="so-smodule" aria-labelledby={`gh-${g.userId}`}>
          <h2 id={`gh-${g.userId}`} className="so-bycourse__h">{g.name}{!g.isListed && <span className="so-meta"> · hidden</span>}</h2>
          <ActionForm c={c} action="studio-guide-save" back={`${back}#guide-${g.userId}`} fields={{ user: g.userId }} className="so-form so-fields">
            <label className="so-check"><input type="checkbox" name="listed" value="1" defaultChecked={g.isListed} /><span>Show on the Guides page</span></label>
            <RealmChoice value={g.realm} legend="Which side they teach on" />
            {traditions.length > 0 ? (
              <fieldset className="so-vis">
                <legend>Traditions they teach from</legend>
                {traditions.map((t) => (
                  <label key={t.id}><input type="checkbox" name="tradition" value={t.id} defaultChecked={g.traditions.some((x) => x.id === t.id)} /><span>{t.name}</span></label>
                ))}
              </fieldset>
            ) : <p className="so-meta">No traditions yet — <a href={c.hrefs.studioTraditions()}>add some</a> to link them here.</p>}
            <label>Short bio — leave empty to use the one on their account
              <textarea name="bio" rows={4} defaultValue={g.bio ?? ""} />
            </label>
            <label>Photo — a web address; leave empty to use their account picture
              <input name="photo" defaultValue={g.photoUrl ?? ""} placeholder="https://" />
            </label>
            <button type="submit" className="so-btn">Save</button>
          </ActionForm>
          <details className="so-response__tools">
            <summary className="so-linkbtn">Take off the list</summary>
            <ActionForm c={c} action="studio-guide-remove" back={back} fields={{ user: g.userId }}>
              <p className="so-meta">Removes {g.name} from the Guides page and their traditions. Their account and anything they teach are not touched.</p>
              <button type="submit" className="so-btn so-btn--quiet">Yes, take them off</button>
            </ActionForm>
          </details>
        </section>
      ))}
    </main>
  );
  return { kind: "ok", node };
}

// ── /studio/traditions ──────────────────────────────────────────────────────
export async function StudioTraditionsPage({ c, q }: { c: LmsConnectors; q: PageQuery }): Promise<PageResult> {
  const viewer = await c.viewer();
  if (!viewer.userId) return { kind: "redirect", to: c.hrefs.signIn(c.hrefs.studioTraditions()) };
  if (!canCurateHub(viewer)) return { kind: "not-found" };
  const traditions = await listTraditions();
  const back = c.hrefs.studioTraditions();
  const node = (
    <main className="so-page">
      <Flash {...q} />
      <StudioCrumbs c={c} />
      <header className="so-hero">
        <span className="so-kicker">Studio</span>
        <h1>Traditions</h1>
        <p>The traditions guides teach from, listed on the <a href={c.hrefs.traditions()}>Traditions page</a>. Link guides to them on <a href={c.hrefs.studioGuides()}>Guides</a>.</p>
      </header>
      <section aria-labelledby="new-t">
        <h2 id="new-t" className="so-h2">Add a tradition</h2>
        <ActionForm c={c} action="studio-tradition-save" back={back} className="so-form so-fields">
          <label>Name<input name="name" required maxLength={120} /></label>
          <label>A few lines about it<textarea name="description" rows={3} /></label>
          <button type="submit" className="so-btn">Add</button>
        </ActionForm>
      </section>
      {traditions.map((t) => (
        <section key={t.id} id={`trad-${t.id}`} className="so-smodule" aria-label={t.name}>
          <ActionForm c={c} action="studio-tradition-save" back={`${back}#trad-${t.id}`} fields={{ id: t.id }} className="so-form so-fields">
            <label>Name<input name="name" required maxLength={120} defaultValue={t.name} /></label>
            <label>A few lines about it<textarea name="description" rows={3} defaultValue={t.description ?? ""} /></label>
            <button type="submit" className="so-btn">Save</button>
          </ActionForm>
          <details className="so-response__tools">
            <summary className="so-linkbtn">Remove</summary>
            <ActionForm c={c} action="studio-tradition-delete" back={back} fields={{ id: t.id }}>
              <p className="so-meta">Removes {t.name} and unlinks it from every guide.</p>
              <button type="submit" className="so-btn so-btn--quiet">Yes, remove it</button>
            </ActionForm>
          </details>
        </section>
      ))}
    </main>
  );
  return { kind: "ok", node };
}

// ── /studio/schedule ────────────────────────────────────────────────────────
export async function StudioSchedulePage({ c, q }: { c: LmsConnectors; q: PageQuery }): Promise<PageResult> {
  const viewer = await c.viewer();
  if (!viewer.userId) return { kind: "redirect", to: c.hrefs.signIn(c.hrefs.studioSchedule()) };
  if (!c.offerings || !isOrgStaff(viewer, c.offerings.orgId)) return { kind: "not-found" };
  const offerings = await listOfferings(c.offerings);
  const back = c.hrefs.studioSchedule();
  const node = (
    <main className="so-page">
      <Flash {...q} />
      <StudioCrumbs c={c} />
      <header className="so-hero">
        <span className="so-kicker">Studio</span>
        <h1>The schedule’s offerings</h1>
        <p>These are the published, public offerings on the inner group’s site, as the <a href={c.hrefs.schedule()}>weekly schedule</a> shows them. Add or change an offering on that site; here you only choose which side of the hub it belongs to.</p>
      </header>
      {offerings.length === 0 ? <p className="so-empty">No public offerings are published.</p> : offerings.map((o) => (
        <section key={o.id} id={`o-${o.id}`} className="so-smodule" aria-labelledby={`oh-${o.id}`}>
          <h2 id={`oh-${o.id}`} className="so-bycourse__h">{o.title}</h2>
          <p className="so-meta">{[o.leader && `with ${o.leader}`, o.recurrencePattern && o.recurrencePattern !== "NONE" ? o.recurrencePattern.toLowerCase() : "once", o.durationMinutes && `${o.durationMinutes} min`].filter(Boolean).join(" · ")}</p>
          <ActionForm c={c} action="studio-realm" back={`${back}#o-${o.id}`} fields={{ kind: "thread", id: o.id }} className="so-form so-fields">
            <RealmChoice value={o.realm} />
            <button type="submit" className="so-btn">Save</button>
          </ActionForm>
        </section>
      ))}
    </main>
  );
  return { kind: "ok", node };
}

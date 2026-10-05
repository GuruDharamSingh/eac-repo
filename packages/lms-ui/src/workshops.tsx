import { getRealms, listHubWorkshops, listManageableWorkshops, type HubWorkshop } from "@elkdonis/lms";
import type { LmsConnectors } from "./connectors";
import type { PageQuery, PageResult } from "./pages";
import { ActionForm, Flash, RealmChoice } from "./parts";

const workshopHref = (c: LmsConnectors, w: HubWorkshop) => c.workshopUrl?.(w) ?? c.hrefs.forumThread(w.id, w.slug);
const money = (n: number, currency: string) =>
  new Intl.NumberFormat("en-CA", { style: "currency", currency, maximumFractionDigits: Number.isInteger(n) ? 0 : 2 }).format(n);
const day = (d: Date) => new Date(d).toLocaleDateString("en-CA", { month: "long", day: "numeric", year: "numeric", timeZone: "America/Toronto" });

function when(w: HubWorkshop): string {
  if (!w.startsAt) return "Dates to come";
  const sessions = w.sessionCount > 1 ? ` · ${w.sessionCount} sessions` : "";
  const range = w.endsAt && day(w.endsAt) !== day(w.startsAt) ? `${day(w.startsAt)} – ${day(w.endsAt)}` : day(w.startsAt);
  return `${range}${sessions}`;
}

/** Workshop cards: coming up (their price to join) or previous (what they offer now). */
export function WorkshopCards({ c, items, past }: { c: LmsConnectors; items: HubWorkshop[]; past?: boolean }) {
  return (
    <ul className="so-cards">
      {items.map((w) => (
        <li key={w.id} className="so-card">
          <span className="so-kicker">{w.orgName}</span>
          <h3><a href={workshopHref(c, w)}>{w.title}</a></h3>
          <p className="so-meta">{past ? `Held ${when(w)}` : when(w)}</p>
          {w.summary && <p>{w.summary}</p>}
          <p className="so-price">
            {past
              ? w.afterAccess === "paid" && w.afterPrice ? `Recordings and materials · ${money(w.afterPrice, w.currency)}` : "Recordings and materials · free"
              : w.price && w.price > 0 ? money(w.price, w.currency) : "Free"}
          </p>
          <a className="so-btn so-btn--quiet" href={workshopHref(c, w)}>See the workshop →</a>
        </li>
      ))}
    </ul>
  );
}

// ── /workshops ─────────────────────────────────────────────────────────────
export async function WorkshopsPage({ c, q }: { c: LmsConnectors; q: PageQuery }): Promise<React.ReactNode> {
  const { upcoming, previous } = await listHubWorkshops();
  return (
    <main className="so-page">
      <Flash {...q} />
      <header className="so-hero">
        <span className="so-kicker">Workshops</span>
        <h1>Workshops</h1>
        <p>Gatherings led by the collective’s guides. Sign up on each workshop’s own page; many past ones can still be taken up from their recordings and materials.</p>
      </header>

      <section aria-labelledby="up-h">
        <h2 id="up-h" className="so-h2">Coming up</h2>
        {upcoming.length === 0 ? <p className="so-empty">Nothing is scheduled just now.</p> : <WorkshopCards c={c} items={upcoming} />}
      </section>

      <section aria-labelledby="past-h">
        <h2 id="past-h" className="so-h2">Previous workshops</h2>
        {previous.length === 0 ? <p className="so-empty">No past workshops are offered yet.</p> : <WorkshopCards c={c} items={previous} past />}
      </section>
    </main>
  );
}

// ── /studio/workshops ──────────────────────────────────────────────────────
export async function StudioWorkshopsPage({ c, q }: { c: LmsConnectors; q: PageQuery }): Promise<PageResult> {
  const viewer = await c.viewer();
  if (!viewer.userId) return { kind: "redirect", to: c.hrefs.signIn(c.hrefs.studioWorkshops()) };
  const workshops = await listManageableWorkshops(viewer);
  const realms = await getRealms("thread", workshops.map((w) => w.id));
  const back = c.hrefs.studioWorkshops();
  const now = Date.now();

  const node = (
    <main className="so-page">
      <Flash {...q} />
      <nav className="so-crumbs" aria-label="Breadcrumb"><a href={c.hrefs.studio()}>Studio</a></nav>
      <header className="so-hero">
        <span className="so-kicker">Studio</span>
        <h1>Workshops in the {c.site.name}</h1>
        <p>Choose which of your workshops appear on the <a href={c.hrefs.workshops()}>Workshops page</a>, and what each offers once it has ended. People sign up and pay on the workshop’s own page; the {c.site.name} only lists it and links there.</p>
      </header>
      {workshops.length === 0 ? <p className="so-empty">None of your organisations has a published or archived workshop.</p> : workshops.map((w) => {
        const ended = w.endsAt !== null && new Date(w.endsAt).getTime() < now;
        return (
          <section key={w.id} id={`w-${w.id}`} className="so-smodule" aria-labelledby={`wh-${w.id}`}>
            <span className="so-kicker">{w.orgName} · {w.status === "archived" ? "archived" : ended ? "ended" : "coming up"}</span>
            <h2 id={`wh-${w.id}`} className="so-bycourse__h"><a href={workshopHref(c, w)}>{w.title}</a></h2>
            <p className="so-meta">{when(w)}{w.price && w.price > 0 ? ` · ${money(w.price, w.currency)} to join` : " · free to join"}</p>
            <ActionForm c={c} action="studio-workshop-listing" back={`${back}#w-${w.id}`} fields={{ thread: w.id }} className="so-form so-fields">
              <label className="so-check">
                <input type="checkbox" name="listed" value="1" defaultChecked={w.listed} />
                <span>List it on the Workshops page</span>
              </label>
              <RealmChoice value={realms.get(w.id) ?? null} />
              <fieldset className="so-vis">
                <legend>Once it has ended, its recordings and materials are</legend>
                <label><input type="radio" name="after" value="none" defaultChecked={w.afterAccess === "none"} /><span><strong>Not offered</strong> — it leaves the page when it ends.</span></label>
                <label><input type="radio" name="after" value="free" defaultChecked={w.afterAccess === "free"} /><span><strong>Free</strong></span></label>
                <label><input type="radio" name="after" value="paid" defaultChecked={w.afterAccess === "paid"} /><span><strong>For purchase</strong> — at the price below.</span></label>
              </fieldset>
              <label>Price for the recordings and materials ({w.currency})
                <input name="price" type="number" min="1" step="0.01" defaultValue={w.afterPrice ?? ""} />
              </label>
              <label>Link to its page — leave empty to use <a href={c.workshopUrl?.({ ...w, linkOverride: null }) ?? c.hrefs.forumThread(w.id, w.slug)}>the usual one</a>
                <input name="link" type="url" defaultValue={w.linkOverride ?? ""} placeholder="https://" />
              </label>
              <button type="submit" className="so-btn">Save</button>
            </ActionForm>
          </section>
        );
      })}
    </main>
  );
  return { kind: "ok", node };
}

// The site-forms harness entry (2026-11-14): a site's form in its two hosts, with stub saves.
//   window.__PAGE__ = "sf-<kind>-surface" | "sf-<kind>-page"
// The surface host opens `compose:<kind>` inside a real cms-ui SurfaceProvider; the page host draws
// SiteFormPage. Saves echo a record (published when Publish was pressed); a series returns a planner
// address ("#planner"), so the hand-off shows as the page's hash. Nothing is saved anywhere.
import * as React from "react";
import { createRoot } from "react-dom/client";
import { SurfaceProvider, useSurface } from "/repo/packages/cms-ui/src/surface";
import { SiteFormPage, siteFormConnectors, type SiteFormSite } from "/repo/packages/site-forms/src";
import type { Answers, FormActions, FormKindId, MediaSlot } from "/repo/packages/studio-forms/src/forms";
import { MEETING_SAMPLE, MEETING_SAMPLE_CONTEXT } from "/repo/packages/studio-forms/src/forms/kinds/meeting/sample";
import { SERVICE_SAMPLE, SERVICE_SAMPLE_CONTEXT } from "/repo/packages/studio-forms/src/forms/kinds/service/sample";
import { POST_SAMPLE, POST_SAMPLE_CONTEXT, SAMPLE_PICTURE } from "/repo/packages/studio-forms/src/forms/kinds/post/sample";

declare global {
  interface Window {
    __PAGE__: string;
    __LOOK__?: "site";
    __SAVES__: Array<{ kind: string; intent: string; id: string | null; answers: Answers }>;
  }
}
window.__SAVES__ = [];

const FEEDS = [
  { slug: "news", name: "News" },
  { slug: "gatherings", name: "Gatherings" },
];

function fieldsFor(kind: FormKindId): Record<string, unknown> {
  const base = kind === "post" ? POST_SAMPLE_CONTEXT.fields : kind === "service" ? SERVICE_SAMPLE_CONTEXT.fields : MEETING_SAMPLE_CONTEXT.fields;
  return { ...base, canEdit: true, feeds: FEEDS, currencies: ["CAD", "USD", "EUR", "GBP"] };
}

/** What an "-edit" page opens with: a filled, valid item of each kind (a draft). */
const FILLED: Record<string, Answers> = {
  meeting: { ...MEETING_SAMPLE, where_mode: "place" },
  event: { ...MEETING_SAMPLE, title: "Spring print fair", where_mode: "place" },
  post: { ...POST_SAMPLE, feed_slug: "news" },
  service: SERVICE_SAMPLE,
  workshop: { kind: "workshop", title: "Linocut in a day", excerpt: "Cut, ink and print", scheduled_at: "2026-12-05T10:00", duration_minutes: 360, format: "in_person", location: "Studio 4", price: 85, currency: "CAD", feed_slug: "gatherings", visibility: "PUBLIC" },
  series: { kind: "series", title: "Thursday printmaking", excerpt: "", series_mode: "dates", series_dates: ["2026-11-26T19:00", "2026-12-10T19:00"], duration_minutes: 90, series_every_weeks: 1, time_zone: "America/Toronto" },
};

function stub(kind: FormKindId): FormActions {
  return {
    context: async () => fieldsFor(kind),
    load: async (id) => ({ answers: FILLED[kind]!, record: { id, slug: "sample", status: "draft", publishedAt: null, updatedAt: new Date().toISOString(), href: "https://site.example/sample" } }),
    save: async (_orgId, answers, intent, id) => {
      window.__SAVES__.push({ kind, intent, id, answers });
      const now = new Date().toISOString();
      return {
        ok: true as const,
        value: {
          record: {
            id: id ?? `${kind}-1`,
            slug: "sample",
            title: String(answers.title ?? ""),
            status: kind === "series" ? "published" : intent,
            publishedAt: intent === "published" || kind === "series" ? now : null,
            updatedAt: now,
            href: "https://site.example/sample",
            plannerHref: kind === "series" ? "#planner" : undefined,
          },
          warnings: [],
        },
      };
    },
  };
}

const media: MediaSlot = ({ onChange }) => (
  <button type="button" className="frm-btn frm-btn--secondary" onClick={() => onChange(SAMPLE_PICTURE)}>
    Use the sample picture
  </button>
);

const KINDS: FormKindId[] = ["meeting", "event", "post", "series", "workshop", "service"];
const site: SiteFormSite = {
  orgId: "sample-org",
  orgName: "Para Theater",
  timeZone: "America/Toronto",
  feeds: FEEDS,
  kinds: Object.fromEntries(KINDS.map((k) => [k, { actions: stub(k) }])),
  network: { origin: "https://arts-collective.example" },
  slots: { media },
  // A materials upload that answers at once (no file leaves the page).
  materials: { upload: async (file) => ({ ok: true as const, item: { id: `m-${file.name}`, url: "#", filename: file.name, mimeType: file.type, size: file.size } }) },
  meetingOptions: { cycleBadge: true },
  // Para Theater look pages (build.mjs "-pt"): the site look; every other page keeps the default.
  look: window.__LOOK__,
};

/** "-focus" pages: press "Open full form" once the popup has drawn, so the screenshot is at the focus tier. */
function OpenFull() {
  React.useEffect(() => {
    const t = setInterval(() => {
      const b = [...document.querySelectorAll("button")].find((x) => x.textContent?.trim() === "Open full form") as HTMLButtonElement | undefined;
      if (b) {
        b.click();
        clearInterval(t);
      }
    }, 100);
    return () => clearInterval(t);
  }, []);
  return null;
}

function OpenOnLoad({ kind, edit }: { kind: FormKindId; edit: boolean }) {
  const { open } = useSurface();
  React.useEffect(() => {
    open({ type: "custom", key: `compose:${kind}`, title: "New", props: edit ? { threadId: "sample-1" } : undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <p style={{ padding: 16, font: "14px system-ui" }}>Behind the popup.</p>;
}

/** The old entry points, through SurfaceRouter: they must open the shared form (2026-11-14). */
const ROUTES: Record<string, Parameters<ReturnType<typeof useSurface>["open"]>[0]> = {
  "sf-route-calendar": { type: "compose", kind: "meeting", tier: "quick", prefill: { scheduled_at: "2026-12-03T10:00" } },
  "sf-route-write": { type: "write", kind: "post", prefill: { title: "Typed in the compose bar" } },
  "sf-route-edit": { type: "compose", kind: "post", threadId: "sample-1" },
  "sf-route-acting": { type: "compose", kind: "meeting", actingAs: "someone-else" },
};

function OpenRoute({ page }: { page: string }) {
  const { open } = useSurface();
  React.useEffect(() => {
    open(ROUTES[page]!);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <p style={{ padding: 16, font: "14px system-ui" }}>Behind the popup.</p>;
}

function App() {
  if (ROUTES[window.__PAGE__]) {
    // The catalogue registers the post as "article", as the sites do.
    const custom = siteFormConnectors(site, ["meeting", "event", { id: "article", kind: "post" }, "series", "workshop", "service"]);
    return (
      <SurfaceProvider connectors={{ custom, onMutated: () => undefined } as never} syncUrl={false}>
        <OpenRoute page={window.__PAGE__} />
      </SurfaceProvider>
    );
  }
  const m = /^sf-([a-z]+)-(surface|page)(-edit)?(-focus)?$/.exec(window.__PAGE__);
  if (!m) return <p>Unknown page {window.__PAGE__}</p>;
  const kind = m[1] as FormKindId;
  if (m[2] === "page") {
    return (
      <main style={{ maxWidth: window.__LOOK__ ? 940 : 720, margin: "0 auto", padding: "24px 16px" }}>
        <SiteFormPage kind={kind} site={site} threadId={m[3] ? "sample-1" : null} closeHref="#closed" />
      </main>
    );
  }
  return (
    <SurfaceProvider connectors={{ custom: siteFormConnectors(site, KINDS), onMutated: () => undefined } as never} syncUrl={false}>
      {m[4] ? <OpenFull /> : null}
      <OpenOnLoad kind={kind} edit={Boolean(m[3])} />
    </SurfaceProvider>
  );
}

createRoot(document.getElementById("root")!).render(<App />);

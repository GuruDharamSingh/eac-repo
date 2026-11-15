// Harness: the summary gate in front of the real meeting form (packages/studio/src/forms/focus.tsx
// formExtension + packages/studio/src/summary/gate.tsx), 2026-11-14. Stub actions save nothing; the frame is
// a StudioFrameApi stub with the left column ("All pieces" / "This piece") so the rail's portal is exercised.
// Pages: gate (a published meeting: loading line, then its summary; Edit → the form), gate-draft (a draft: the
// form directly), gate-stuck (the item never loads: the form after the gate's timeout).
import * as React from "react";
import { createRoot } from "react-dom/client";
import { StudioFrameContext, type StudioFrameApi } from "/repo/packages/studio/src/frame";
import { formExtension } from "/repo/packages/studio/src/forms/focus";
import { PieceSummaryHostContext } from "/repo/packages/studio/src/summary/gate";
import type { PieceSummaryView } from "@elkdonis/content/summary";
import { ledgerFormTheme, meetingKind, type Answers, type FormActions, type FormContext } from "@elkdonis/studio-forms";

const page = (window as unknown as { __PAGE__: string }).__PAGE__;

const CTX: FormContext = { orgId: "larkspur", orgName: "Larkspur Ceramics", fields: {}, timeZone: "America/Toronto", now: new Date("2026-11-14T15:00:00Z") };
const ANSWERS: Answers = {
  ...meetingKind.empty(CTX),
  title: "Glaze lab · November",
  excerpt: "An evening with the ash glazes.",
  scheduled_at: "2026-11-19T18:30",
  location: "The studio, Unit 4",
  attendee_limit: 12,
};

const actions: FormActions = {
  context: async () => ({}),
  load: (id) =>
    page === "gate-stuck"
      ? new Promise(() => {})
      : Promise.resolve({
          answers: ANSWERS,
          record:
            page === "gate-draft"
              ? { id, status: "draft", publishedAt: null }
              : { id, status: "published", publishedAt: "2026-11-03T15:00:00Z" },
        }),
  save: async (_o, _a, _i, id) => ({ ok: true as const, value: { record: { id: id ?? "m1", slug: "glaze-lab-november" }, warnings: [] } }),
};

const VIEW: PieceSummaryView = {
  key: "thread:m1",
  type: "meeting",
  typeLabel: "Meeting",
  byline: "Larkspur Ceramics · credited to Noa",
  title: "Glaze lab · November",
  excerpt: "An evening with the ash glazes: mixing, dipping, and loading the kiln for the second firing.",
  meta: null,
  pictures: [],
  pictureCount: 0,
  facts: [{ label: "When", value: "Wed 19 Nov · 18:30" }],
  status: { label: "published", at: "2026-11-03T15:00:00Z" },
  out: [{ id: "o1", label: "Larkspur calendar and site", sub: null, at: "2026-11-03T15:00:00Z", state: "published", href: "#" }],
  next: [{ id: "n1", title: "Post a reminder on Instagram, 2 days before", reason: "Channel suggests · 17 Nov", label: "Plan it", href: "#" }],
  links: { view: "#", channel: "#", plan: "#" },
};

const ext = formExtension({
  id: "meeting",
  label: "Meetings",
  listLabel: "Meetings",
  schema: meetingKind,
  actions,
  initialId: "m1",
  theme: ledgerFormTheme,
  host: () => ({
    studioHref: () => "#",
    viewHref: () => null,
    channelHref: () => null,
    loginHref: () => "#",
    preview: {},
    feeds: [{ slug: "gatherings", name: "Gatherings" }],
    slots: {},
  }),
  items: async () => [{ id: "m1", title: "Glaze lab · November", status: page === "gate-draft" ? "draft" : "published", updatedAt: "2026-11-03T15:00:00Z", when: "2026-11-19T18:30:00Z" }],
});

function App() {
  const [colTab, setColTab] = React.useState<"list" | "piece">("piece");
  const frame: StudioFrameApi = {
    orgId: "larkspur",
    orgs: [{ orgId: "larkspur", name: "Larkspur Ceramics", slug: "larkspur" }],
    viewer: { userId: "u1", displayName: "Noa", slug: "noa" },
    setError: (m) => m && console.warn("frame error:", m),
    drawer: true,
    settings: true,
    sheet: null,
    setSheet: () => {},
    actionsSlot: null,
    statusSlot: null,
    newRequest: 0,
    colTab,
    setColTab,
    kindIndex: [{ id: "meeting", label: "Meetings", current: true }],
    switchKind: () => {},
    setHasColumn: () => {},
    setPiece: () => {},
    dark: false,
    query: "",
  };
  return (
    <div className="studio" data-theme="light">
      <header className="studio-top">
        <span className="studio-wordmark">Studio</span>
      </header>
      <StudioFrameContext.Provider value={frame}>
        <PieceSummaryHostContext.Provider value={{ load: async () => VIEW, makeBase: "/studio/make" }}>{ext.render()}</PieceSummaryHostContext.Provider>
      </StudioFrameContext.Provider>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);

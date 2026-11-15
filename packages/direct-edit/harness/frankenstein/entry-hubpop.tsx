// Harness entry for the Site Builder card pop-up (2026-11-14, hand-test #6): Para Theater's real card mount
// (apps/sunjay/src/components/hub/hub-card-host.tsx) at the foot of a long page, with a template row
// (event-detail) and an ordinary page row (visiting). Fixture data; no server.
import { createElement as h } from "react";
import { createRoot } from "react-dom/client";
import "/app/packages/hub/src/theme/hub-cards.css";
import "/app/packages/hub/src/theme/industry.css";
import { SiteBuilderCardMount } from "/app/apps/sunjay/src/components/hub/hub-card-host";

const page = (id: string, title: string, kind: "editor" | "template") => ({
  id, title, path: id, depth: 0, kind, thumbnailUrl: null, updatedAt: "2026-11-14T12:00:00Z", updatedBy: null,
  notes: null, linkPreview: null, sharedLayoutFor: null, copySlots: [], exception: null,
});
const data = {
  org: { name: "Para Theater", mark: "PT", domain: "paratheater.arts-collective.com" },
  pages: [page("", "Home", "editor"), page("event-detail", "Event page layout", "editor"), page("visiting", "Visiting", "editor")],
  lastEdited: null,
  theme: { look: "paper", headingFont: "Fraunces", bodyFont: "Spectral", colors: { paper: "#1B1E20", surface: "#24282A", ink: "#E9E5DD", line: "#373C3F", accent: "#C9AE79" } },
  identity: { name: "Para Theater", line: "", where: "", markUrl: null, markName: null, primaryKind: null, alsoKinds: [] },
  can: { editPages: true, createPages: true, editTheme: true, editIdentity: true, notes: false, savedTemplates: false, kinds: false },
};
const root = document.getElementById("host")!;
createRoot(root).render(
  h("div", null,
    h("div", { style: { height: 3000, background: "repeating-linear-gradient(#eee 0 40px, #ddd 40px 80px)" } }, "filler"),
    h("section", { id: "cards", style: { padding: 24 } }, h(SiteBuilderCardMount as any, { data }))
  )
);

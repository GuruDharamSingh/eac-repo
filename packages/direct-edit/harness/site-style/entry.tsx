// Harness: elktours' real header, footer and Site style button over the site's served CSS. The stored style
// comes from localStorage ("stored") and is drawn the way app/layout.tsx draws it.
import { createElement as h, Fragment } from "react";
import { createRoot } from "react-dom/client";
import { SiteHeader } from "/app/apps/elktours/src/components/site-header";
import { SiteFooter } from "/app/apps/elktours/src/components/site-footer";
import { SiteStyleButton } from "/app/apps/elktours/src/components/site-style/SiteStyleButton";
import { SITE_STYLE } from "/app/apps/elktours/src/lib/site-style-schema";
import { cleanSiteStyle, siteStyleCss } from "/app/packages/direct-edit/src/site/style";

const g = globalThis as any;
let stored: unknown = null;
try { stored = JSON.parse(localStorage.getItem("stored") ?? "null"); } catch { stored = null; }
const css = siteStyleCss(stored, SITE_STYLE);
if (css) { const el = document.createElement("style"); el.setAttribute("data-site-style", ""); el.textContent = css; document.body.prepend(el); }
g.__lib = { siteStyleCss, cleanSiteStyle, SITE_STYLE };
g.__css = css;

createRoot(document.getElementById("host")!).render(
  h(Fragment, null,
    h(SiteHeader, { signedIn: true, canEdit: true, isMember: true, offerings: [{ slug: "try", title: "Try" }, { slug: "journal", title: "Journal" }] }),
    h("main", { className: "flex-1 mx-auto max-w-6xl px-5 py-12" },
      h("h1", { className: "text-4xl" }, "Paris on foot"),
      h("p", { className: "mt-4 text-muted-foreground" }, "Guided walks through the rooftops and courtyards."),
      h("div", { className: "mt-6 bg-card p-6 rounded-[var(--radius)]", "data-test": "card" }, "A card"),
      h("a", { href: "#", className: "mt-6 inline-block bg-primary px-4 py-2 text-primary-foreground", "data-test": "cta" }, "Book a walk")),
    h(SiteFooter, {}),
    h(SiteStyleButton, { initial: cleanSiteStyle(stored, SITE_STYLE) })));

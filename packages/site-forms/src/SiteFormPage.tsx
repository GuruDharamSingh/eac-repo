"use client";

import * as React from "react";
import { FormRoot, type FormHost, type FormKindId } from "@elkdonis/studio-forms";
import { makeFormHost, type SiteFormSite } from "./host";
import { SiteFormInner, formThemeOf, schemaOf, useSiteFormBoot } from "./SiteForm";

/**
 * The same form on a plain page (2026-11-14): a site's compose or edit route. Same sections, actions and
 * tiers as SiteFormSurface; the frame is a title, the form, and a button row under it. `closeHref` is where
 * Cancel and Done go. Needs no SurfaceProvider: widgets come from `site.slots`.
 */
export function SiteFormPage({
  kind,
  site,
  threadId = null,
  closeHref,
  initialAnswers = null,
  tier,
}: {
  kind: FormKindId;
  site: SiteFormSite;
  threadId?: string | null;
  closeHref: string;
  /** A new item's starting answers, e.g. `{ section: feed }` from `?feed=`; `section` means the feed. Ignored when editing. */
  initialAnswers?: Record<string, unknown> | null;
  /** The tier the page opens at. Default: focus under the site look (the page is the full edit), quick otherwise. */
  tier?: "quick" | "focus";
}) {
  const schema = schemaOf(kind);
  const { boot, error } = useSiteFormBoot(kind, site, threadId, initialAnswers);
  const host = React.useMemo<FormHost>(() => makeFormHost(site), [site]);
  const go = () => window.location.assign(closeHref);

  if (!schema || error || !boot) {
    return (
      <p role={error ? "alert" : undefined} aria-busy={error ? undefined : true}>
        {error ? (
          <>
            {error} <a href={closeHref}>Back</a>
          </>
        ) : (
          "Opening…"
        )}
      </p>
    );
  }
  return (
    <SiteFormInner
      kind={kind}
      schema={schema}
      host={host}
      boot={boot}
      look={site.look}
      initialTier={tier ?? (site.look === "site" ? "focus" : "quick")}
      frame={(c, form) => (
        // Under the site look one panel wraps the title, the form and the foot (site-look.css, .frm-site-page).
        <div className="frm-site-page" data-look={site.look}>
          <h2
            className="frm-site-page-title"
            style={{
              margin: "0 0 12px",
              // The site look draws the title in the site's own title face (--sf-font-title); the default keeps Newsreader.
              fontFamily: site.look === "site" ? "var(--sf-font-title, inherit)" : "Newsreader, Georgia, serif",
              fontSize: "1.5rem",
              fontWeight: 500,
              lineHeight: 1.2,
            }}
          >{c.title}</h2>
          {form}
          <FormRoot theme={formThemeOf(site.look)} className="frm-site-page-foot" style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginTop: 16, background: "transparent" }}>
            {c.stage === "published" ? (
              <button type="button" className="frm-btn frm-btn--primary" onClick={go}>
                Done
              </button>
            ) : (
              <>
                <button type="button" className="frm-btn frm-btn--ghost" onClick={c.toggleTier}>
                  {c.tier === "quick" ? "Open full form" : "Fewer options"}
                </button>
                <button type="button" className="frm-btn frm-btn--ghost" onClick={go} disabled={c.busy}>
                  Cancel
                </button>
                {!c.published && c.canDraft && (
                  <button type="button" className="frm-btn frm-btn--secondary" onClick={c.saveDraft} disabled={c.busy}>
                    {c.pending === "draft" ? "Saving…" : "Save draft"}
                  </button>
                )}
                <button type="button" className="frm-btn frm-btn--primary" onClick={c.publish} disabled={c.busy}>
                  {c.pending === "publish" ? (c.published ? "Saving…" : "Publishing…") : c.published ? "Save changes" : c.canDraft ? "Publish" : "Create"}
                </button>
                {c.status && (
                  <span role="status" data-tone={c.statusTone} style={{ marginLeft: "auto" }}>
                    {c.status}
                  </span>
                )}
              </>
            )}
          </FormRoot>
        </div>
      )}
    />
  );
}

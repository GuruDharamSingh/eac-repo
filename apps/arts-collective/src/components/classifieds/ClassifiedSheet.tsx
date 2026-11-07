import "./classifieds.css";
import {
  declsToStyle,
  effective,
  planAd,
  plainCopy,
  sheetDecls,
  type Ad,
  type ClassifiedsDoc,
} from "@/lib/classifieds/catalog";
import { BlockKids } from "./BlockView";

export interface LinkedThread {
  id: string;
  slug: string | null;
  title: string;
}

/**
 * An org's classifieds sheet, as visitors see it. An ad with a link is one
 * whole clickable card: to one of the org's threads (by its path on the org's
 * own host), or out to any web address in a new tab. A link to a thread that
 * is no longer published (not in `threads`) is simply not drawn. Each ad draws
 * its node tree through the render plan (BlockView), the same plan the editor
 * draws.
 */
export function ClassifiedSheet({ doc, orgName, threads }: { doc: ClassifiedsDoc; orgName: string; threads: Map<string, LinkedThread> }) {
  return (
    <div className="cl-sheet" style={declsToStyle(sheetDecls(doc))}>
      <div className="cl-masthead">
        {doc.title || `${orgName} Classifieds`}
        <small>{orgName}</small>
      </div>
      {doc.ads.length === 0 ? <p className="cl-empty">No notices yet.</p> : doc.ads.map((ad) => <AdCard key={ad.id} doc={doc} ad={ad} threads={threads} />)}
    </div>
  );
}

function AdCard({ doc, ad, threads }: { doc: ClassifiedsDoc; ad: Ad; threads: Map<string, LinkedThread> }) {
  const plan = planAd(doc, ad);
  const style = declsToStyle(plan.decls);
  const e = effective(doc, ad);

  const link = ad.link;
  const thread = link?.kind === "thread" ? threads.get(link.threadId) : undefined;
  const wrapped = (link?.kind === "thread" && !!thread?.slug) || link?.kind === "url";
  const inner = <BlockKids plan={plan} links={!wrapped} />;
  const title = plainCopy(e.copy.title) || "Notice";

  if (link?.kind === "thread" && thread?.slug) {
    return (
      <a className={plan.cls} style={style} href={`/${thread.slug}`} aria-label={`${title}: open ${thread.title}`}>
        {inner}
        <span className="cl-linkmark" aria-hidden="true">read →</span>
      </a>
    );
  }
  if (link?.kind === "url") {
    let host = "";
    try { host = new URL(link.url).hostname.replace(/^www\./, ""); } catch { /* cleanDoc already checked */ }
    return (
      <a className={plan.cls} style={style} href={link.url} target="_blank" rel="noopener noreferrer nofollow" aria-label={`${title}: ${link.label || host} (opens in a new tab)`}>
        {inner}
        <span className="cl-linkmark" aria-hidden="true">{link.label || host} ↗</span>
      </a>
    );
  }
  return (
    <article className={plan.cls} style={style}>
      {inner}
    </article>
  );
}

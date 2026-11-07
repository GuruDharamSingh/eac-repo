import { createElement, type ReactNode } from "react";
import { parseRich, type RNode } from "@elkdonis/direct-edit/richtext";
import { declsToStyle, type PlanBlock, type PlanNode } from "@/lib/classifieds/catalog";

/**
 * A block's render plan (lib/classifieds/catalog.ts planAd) as React
 * elements: the public classifieds sheet and feed cards draw through this, the
 * editor draws the same plan as an HTML string, so both show the same thing.
 *
 * Words: the stored markup (b, i, u, a, ul/li, br; cleaned by cleanDoc, then
 * sanitised again by the plan) is parsed to a tree and every element is built
 * here from that tree. There is no dangerouslySetInnerHTML, so nothing the
 * server did not allow can reach the page. A link inside a block that is
 * itself a link is drawn as plain styled text (anchors cannot nest). Picture
 * sources passed safeSrc (http(s) or a same-site path).
 */
function Rich({ nodes, links }: { nodes: RNode[]; links: boolean }): ReactNode {
  return nodes.map((n, i) => {
    if (n.t === "text") return n.v;
    const kids = n.tag === "br" ? undefined : <Rich nodes={n.kids} links={links} />;
    if (n.tag === "br") return <br key={i} />;
    if (n.tag === "a") {
      return links ? (
        <a key={i} className="cl-rl" href={n.href} target="_blank" rel="noopener noreferrer nofollow">{kids}</a>
      ) : (
        <span key={i} className="cl-rl">{kids}</span>
      );
    }
    return createElement(n.tag === "ul" ? "ul" : n.tag, { key: i, className: n.tag === "ul" ? "cl-list" : undefined }, kids);
  });
}

function Node({ n, links }: { n: PlanNode; links: boolean }): ReactNode {
  const style = declsToStyle(n.decls);
  if (n.tag === "img") {
    // eslint-disable-next-line @next/next/no-img-element
    return <img className={n.cls} style={style} src={n.src} alt="" loading="lazy" />;
  }
  if (n.kids) {
    return <div className={n.cls} style={style}>{n.kids.map((k) => <Node key={k.id} n={k} links={links} />)}</div>;
  }
  if (n.kind === "rule") return <div className={n.cls} style={style} role="separator" />;
  const body = n.text === undefined ? null : n.rich ? <Rich nodes={parseRich(n.text, n.rich)} links={links} /> : n.text;
  return createElement(n.tag, { className: n.cls, style }, body);
}

/** The nodes of a block (its root element is the caller's: an article, or a link). */
export function BlockKids({ plan, links }: { plan: PlanBlock; links: boolean }): ReactNode {
  return plan.kids.map((k) => <Node key={k.id} n={k} links={links} />);
}

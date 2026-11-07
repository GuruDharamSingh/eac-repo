// The saved home page as a visitor's server would draw it: real config, real <Render>. Parts are the HTML they drew; the banner is an element, as on the site.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Render } from "@puckeditor/core/rsc";
import { landingPublishedConfig } from "/app/apps/sunjay/src/lib/puck/config.landing";
const fs = require("fs");
const doc = JSON.parse(fs.readFileSync("/w/h/home/saved.json", "utf8"));
const raw = JSON.parse(fs.readFileSync("/w/h/home/parts.json", "utf8"));
const src = /src="([^"]+)"/.exec(raw.banner)?.[1];
const parts = { ...raw, banner: createElement("img", { src, alt: "", fetchPriority: "high", style: { objectFit: "cover", objectPosition: "50% 50%" }, "data-landing-part": "banner" }) };
const metadata = { orgId: "sunjay", slug: "landing", parts };
const draw = (d: unknown) => renderToStaticMarkup(createElement(Render as never, { config: landingPublishedConfig, data: d, metadata } as never));
const strip = (l: any[]): any[] => l.map((n) => { const { morph: _m, ...props } = n.props; for (const [k, v] of Object.entries(props)) if (Array.isArray(v) && v.some((x: any) => x?.props)) (props as any)[k] = strip(v as any[]); return { ...n, props }; });
fs.writeFileSync("/w/h/home/tree-morph.html", draw(doc));
fs.writeFileSync("/w/h/home/tree-plain.html", draw({ ...doc, content: strip(doc.content) }));
console.log("drawn", fs.statSync("/w/h/home/tree-plain.html").size, fs.statSync("/w/h/home/tree-morph.html").size);

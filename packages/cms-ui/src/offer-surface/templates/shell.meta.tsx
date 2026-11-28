// The shell is not a template, so it has its own catalogue entry: the patterns
// every template draws inside (top bar, gateway face). Plain data, no JSX.
import type { PatternMeta } from "./meta";

export const shellMeta = {
  component: "TemplateShell",
  files: {
    tsx: "packages/cms-ui/src/offer-surface/templates/shell.tsx",
    css: "packages/cms-ui/src/offer-surface/templates/shell.css",
    route: "apps/development/src/app/offer-templates/t/probe",
  },
  packet: "3a / 2m / 4b",
  props: [
    { name: "data", type: "TemplateData", note: "the sample or live site data" },
    { name: "template", type: "TemplateId" },
    { name: "profileHref", type: "string", note: 'default "/profile"' },
    { name: "top", type: "ReactNode", note: "replaces the top bar (gazette masthead)" },
    { name: "gateway", type: "boolean", note: "default true; the profile turns it off" },
  ],
  reads: ["site.name", "owner.id", "owner.following", "featured.key", "offers[].kind, title, key", "look.icons"],
  actions: [
    { control: "+ Follow", opens: "follow (pf-owner once following)" },
    { control: "Profile", opens: "link to profileHref (the site profile page)" },
    { control: "Gateway face (any offer)", opens: "evt-offer / svc-offer / art-offer / ser-offer / wr-read, by kind" },
  ],
  patterns: [
    { id: "top-bar", name: "Top bar", use: "Site name in the heading font, PROFILE (active: bone border, bronze underline) and + FOLLOW (bronze outline, fills when following).", rootClass: "ost-top", packet: "3a / 2m", shared: true },
    { id: "gateway-face", name: "Gateway face", use: "Small door in the card language: bronze top border, kind box, mono kind, title, + circle, hover lift. One row on desktop, a sideways shelf on phone.", rootClass: "ost-gate-face", packet: "3a (cards)", shared: true },
  ] satisfies PatternMeta[],
  adapted: [
    "The gateway is the packet's Also offered card shrunk to one row; the packet has no such strip on offer pages.",
    "Profile stays in the top bar only; there is no owner face in the gateway.",
    "Page is min-height 100dvh and scrolls; the gateway sits after the content.",
  ],
};

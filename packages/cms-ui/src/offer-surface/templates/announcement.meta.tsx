import type { TemplateMeta } from "./meta";

export const meta: TemplateMeta = {
  id: "announcement",
  component: "AnnouncementTemplate",
  files: {
    tsx: "packages/cms-ui/src/offer-surface/templates/announcement.tsx",
    css: "packages/cms-ui/src/offer-surface/templates/announcement.css",
    route: "apps/development/src/app/offer-templates/t/announcement",
  },
  packet: "2j",
  reads: [
    { path: "featured.title", required: true, note: "the headline" },
    { path: "featured.takeUp", required: true },
    { path: "featured.standfirst", note: "the paragraph; description is used when absent (HTML allowed)" },
    { path: "featured.description" },
    { path: "featured.when.start", note: "facts row (when) and the calendar file" },
    { path: "featured.venue.name" },
    { path: "featured.venue.address" },
    { path: "featured.price" },
    { path: "extras.ribbon", note: "the ribbon; hidden when absent" },
    { path: "extras.facts[]", note: "three facts; derived from the offer when absent" },
    { path: "owner.name", note: "Posted by" },
  ],
  missing: [{ path: "extras.postedAt", why: "the packet shows “POSTED BY HOST NAME · 20 SEP”; no posted date exists in the contract, so only the name draws" }],
  actions: [
    { control: "Save a place", opens: "evt-offer" },
    { control: "Add to calendar", opens: "downloads an .ics file (no layer)" },
    { control: "Profile, + Follow (shell)", opens: "follow" },
  ],
  patterns: [
    { id: "ribbon", name: "News ribbon", use: "A full-width bronze bar that says what is new, with a pulsing dot.", rootClass: "ost-announcement-ribbon", packet: "2j" },
    { id: "fact-strip", name: "Fact strip", use: "Three label/value/note columns under a bronze rule.", rootClass: "ost-announcement-facts", packet: "2j", shared: true },
    { id: "centred-headline", name: "Centred headline block", use: "Kicker, balanced headline, short paragraph, actions.", rootClass: "ost-announcement-body", packet: "2j" },
  ],
  adapted: [
    "Page column is 560px (--ost-max), the packet frame width; the earlier desktop scale-up was removed.",
    "Add to calendar is a real download link rather than a drawn button.",
    "Posted-by line omits the date (no field).",
    "Phone: the three facts stack.",
  ],
  phoneHeight: undefined,
  status: "draft",
};

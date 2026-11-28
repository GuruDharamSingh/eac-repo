import type { TemplateMeta } from "./meta";

export const meta: TemplateMeta = {
  id: "note",
  component: "NoteTemplate",
  files: {
    tsx: "packages/cms-ui/src/offer-surface/templates/note.tsx",
    css: "packages/cms-ui/src/offer-surface/templates/note.css",
    route: "apps/development/src/app/offer-templates/t/note",
  },
  packet: "2i",
  reads: [
    { path: "pieces[0].title", required: true, note: "the current note; the other pieces form the timeline" },
    { path: "pieces[0].date", note: "the date line; the timeline is ordered by it, newest first" },
    { path: "pieces[0].bodyHtml", note: "falls back to standfirst" },
    { path: "pieces[0].standfirst" },
    { path: "pieces[0].picture" },
    { path: "pieces[0].caption" },
    { path: "pieces[0].tags[]" },
    { path: "pieces[0].replies[]", note: "name, ago, text" },
    { path: "pieces[].key" },
    { path: "pieces[].title" },
    { path: "pieces[].date" },
  ],
  missing: [{ path: "pieces[0].time", why: "the packet shows a time of day (07:40); pieces carry only a date and no time zone, so it is left out" }],
  actions: [
    { control: "Timeline entries other than the current one", opens: "wr-read" },
    { control: "Reply field and button", opens: "inert (posting replies is not built)" },
    { control: "Profile, + Follow (shell)", opens: "follow" },
  ],
  patterns: [
    { id: "timeline", name: "Timeline index", use: "A vertical rule with dated dots; the current entry is bronze and pulses slowly. A sideways strip on a phone.", rootClass: "ost-note-line", packet: "2i" },
    { id: "tag-chips", name: "Tag chips", use: "Mono hash-tags in thin boxes.", rootClass: "ost-note-tags", packet: "2i", shared: true },
    { id: "reply-thread", name: "Inline replies", use: "Avatar, name, age and text, then a reply field.", rootClass: "ost-note-replies", packet: "2i", shared: true },
  ],
  adapted: [
    "Page column is 560px (--ost-max) and the text column 380px, both as drawn in the packet.",
    "Reply is drawn but inert (posting is not built). Reply names are plain text: replies carry no profile id to open pf-owner with.",
    "Date line has no time of day.",
    "Sample content differs from the packet (long body, 1 reply, no time of day). Phone: the timeline becomes a sideways strip above the note.",
  ],
  phoneHeight: undefined,
  status: "draft",
};

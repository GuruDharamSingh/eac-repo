import Link from "next/link";
import type { ReactNode } from "react";
import { defineBlock, type PropsOf } from "@elkdonis/blocks";
import { GuestAnswer } from "@/components/landing/GuestAnswer";

// ============================================================================
// grand-forum (2026-11-21): "The Grand Forum" band of the landing page, as a block. It was the live part `forum`:
// a heading, a line about what the forum is, a button, then the forum itself opened on the work question's thread,
// and under it a box where a visitor without an account can still answer. All of its words are settings now, and
// the two live pieces can be switched off.
//
//   words        the small line, the heading, the paragraph, the button's words and where it goes
//   the forum    shown (as before) or not; it is read per request by the resolver (lib/landing-forum.ts) and is
//                the same render /forum/t/<id>/<slug> makes, so every link in it leads into the forum itself
//   the answer   the visitor's box under it, shown (as before) or not. It is never drawn for someone signed in.
//
// Colours and faces come from the landing page's own classes (.ig-forum-*, landing.css), which draw from the
// site's --ig-* variables, so Site style reaches this band. With no settings changed it draws what the part drew.
// The saved landing's `part` node is turned into this block at read time (lib/puck/landing-blocks.ts).
// ============================================================================

const LEDE = "The independent forum used across the arts collectives, shared by every group in the network rather than owned by any one of them.";

const props = [
  { name: "eyebrow", kind: "string", label: "Small line above the heading", default: "Across the arts collectives", inlineEditable: false },
  { name: "heading", kind: "string", label: "Heading", default: "The Grand Forum", inlineEditable: false },
  {
    name: "lede",
    kind: "text",
    label: "Paragraph",
    default: LEDE,
  },
  { name: "buttonLabel", kind: "string", label: "Button words", default: "Enter the forum", inlineEditable: false },
  { name: "buttonHref", kind: "url", label: "Button goes to", default: "/forum" },
  { name: "showForum", kind: "boolean", label: "Show the forum conversation", default: true },
  { name: "showAnswer", kind: "boolean", label: "Show the answer box to visitors who are not signed in", default: true },
] as const;

export type GrandForumProps = PropsOf<typeof props> & {
  /** What the resolver read: the forum's own render, the work question, whether the viewer is signed in. Never stored. */
  embed?: ReactNode;
  question?: { id: string; question: string } | null;
  signedIn?: boolean;
  /** Set by the editor's resolver, which cannot render the forum: the band draws with a note where the forum goes. */
  preview?: boolean;
};

const words = (v: unknown, fallback: string) => (typeof v === "string" ? v : fallback);

export function GrandForum(p: GrandForumProps) {
  const embed = p.showForum === false ? null : p.embed ?? null;
  const question = p.question ?? null;
  if (!embed && !question && !p.preview) return null;
  const showAnswer = p.showAnswer !== false && !p.signedIn && question;
  const eyebrow = words(p.eyebrow, "Across the arts collectives");
  const button = words(p.buttonLabel, "Enter the forum");
  return (
    <section id="grand-forum" className="ig-forum-section" aria-labelledby="ig-forum-heading">
      <div className="ig-forum-head">
        <div>
          {eyebrow && <p className="ig-forum-eyebrow">{eyebrow}</p>}
          <h2 id="ig-forum-heading" className="ig-forum-heading">{words(p.heading, "The Grand Forum")}</h2>
        </div>
        <p className="ig-forum-lede">{words(p.lede, LEDE)}</p>
        {button && (
          <Link href={words(p.buttonHref, "/forum") || "/forum"} className="ig-forum-btn ig-forum-btn--primary">{button}</Link>
        )}
      </div>

      {embed && <div className="gf-page ig-forum-embed">{embed}</div>}
      {!embed && p.preview && p.showForum !== false && (
        <div className="ig-forum-embed">
          <p className="ig-forum-lede">The forum conversation is drawn here on the live page.</p>
        </div>
      )}

      {showAnswer && question && (
        <div className="ig-forum-guest">
          <GuestAnswer questionId={question.id} question={question.question} />
        </div>
      )}
    </section>
  );
}

export const grandForum = defineBlock(
  {
    id: "grand-forum",
    category: "listings",
    label: "Grand forum",
    description:
      "The network's forum opened on the work question's thread, under a heading and a button into the forum, with an answer box for visitors who are not signed in.",
    memberSafe: false,
    dataDriven: true,
    styling: "tokens",
    props,
    reads: [
      { from: "site", what: "org" },
      { from: "viewer", what: "signed-in" },
      { from: "flow", what: "work-question" },
    ],
    parts: {
      root: { label: "Forum band", sel: "> .ig-forum-section" },
      eyebrow: { label: "Small line", sel: ".ig-forum-eyebrow", prop: "eyebrow" },
      heading: { label: "Heading", sel: ".ig-forum-heading", prop: "heading" },
      lede: { label: "Paragraph", sel: ".ig-forum-lede", prop: "lede" },
      button: { label: "Button", sel: ".ig-forum-btn", prop: "buttonLabel" },
      embed: { label: "Forum conversation", sel: ".ig-forum-embed", draws: { props: { showForum: true } } },
      guest: { label: "Answer box", sel: ".ig-forum-guest" },
    },
  },
  GrandForum,
  () => ({
    eyebrow: "Across the arts collectives",
    heading: "The Grand Forum",
    lede: LEDE,
    buttonLabel: "Enter the forum",
    buttonHref: "/forum",
    showForum: true,
    showAnswer: true,
    embed: null,
    question: { id: "sample", question: "What is the work you are here to do?" },
    signedIn: false,
    preview: true,
  })
);

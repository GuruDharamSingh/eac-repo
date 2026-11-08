import type { ReactNode } from "react";
import { defineBlock, RichText, type PropsOf } from "@elkdonis/blocks";
import { editingOf, type PuckEditing } from "@elkdonis/blocks/record";
import { PersonPage, PersonThreadList, type PersonListItem } from "@elkdonis/cms-ui/profile";
import { ContactForm } from "@/components/contact/contact-form";

// ============================================================================
// Round 3 (2026-11-07): blocks that frame records. The words are props (Ario
// edits them in the studio); the records come from data through resolvers
// (lib/puck/config.server.ts, and /api/blocks/* for the editor).
//
//   he-contact  Contact form, posting to /api/org/<org>/contact.
//   he-forum    The forum's newest topics and a way in (forumSnapshot).
//   he-person   A person from the site's profiles (portrait = the profile's
//               photo field), ifac's About card in this house's type. Round 6:
//               `layout: "page"` draws the whole person page (the `person`
//               template around every /about/<slug>; the route injects
//               `routeSlug`).
//
// Ids, prop and part names are stored: never rename.
// ============================================================================

const str = (v: unknown) => (typeof v === "string" ? v : "");

// ── he-contact ──────────────────────────────────────────────────────────────

const contactProps = [
  { name: "eyebrow", kind: "string", label: "Eyebrow", default: "Contact", inlineEditable: true },
  { name: "heading", kind: "string", label: "Heading", default: "Write to Ario", inlineEditable: true },
  { name: "intro", kind: "richtext", label: "Text", default: "" },
  { name: "nameLabel", kind: "string", label: "Name field", default: "Your name" },
  { name: "emailLabel", kind: "string", label: "Email field", default: "Email" },
  { name: "messageLabel", kind: "string", label: "Message field", default: "Message" },
  { name: "buttonLabel", kind: "string", label: "Button", default: "Send" },
  { name: "thanks", kind: "string", label: "After sending", default: "Thank you. Your message has been sent." },
] as const;

export function HeContact(p: PropsOf<typeof contactProps> & { puck?: PuckEditing }) {
  const { drawn } = editingOf(p.puck);
  const form = (
    <ContactForm
      nameLabel={str(p.nameLabel) || "Your name"}
      emailLabel={str(p.emailLabel) || "Email"}
      messageLabel={str(p.messageLabel) || "Message"}
      buttonLabel={str(p.buttonLabel) || "Send"}
      thanks={str(p.thanks) || "Thank you."}
    />
  );
  return (
    <section className="blk he-contact" id="contact">
      <header className="he-band-head">
        {p.eyebrow ? <p className="he-eyebrow">{p.eyebrow}</p> : null}
        {p.heading ? <h2 className="he-band-title">{p.heading}</h2> : null}
        {str(p.intro).trim() ? <RichText className="he-band-intro" body={p.intro} /> : null}
      </header>
      {drawn ? <div inert>{form}</div> : form}
    </section>
  );
}

export const heContact = defineBlock(
  {
    id: "he-contact",
    label: "Contact form",
    category: "actions",
    description: "Name, email and a message, sent to the site's owner (as the contact page always did).",
    memberSafe: true,
    styling: "tokens",
    props: contactProps,
    parts: {
      root: { label: "Contact", sel: "> .he-contact" },
      eyebrow: { label: "Eyebrow", sel: "> .he-contact .he-eyebrow", prop: "eyebrow" },
      heading: { label: "Heading", sel: "> .he-contact .he-band-title", prop: "heading" },
      form: { label: "Form", sel: "> .he-contact .he-contact-form" },
    },
    tokens: [{ name: "--he-aurum", label: "Accent (button)", type: "color" }],
  },
  HeContact,
);

// ── he-forum ────────────────────────────────────────────────────────────────

export interface ForumTopic {
  id: string;
  title: string;
  href: string;
  meta?: string | null;
}

const forumProps = [
  { name: "eyebrow", kind: "string", label: "Eyebrow", default: "Forum", inlineEditable: true },
  { name: "heading", kind: "string", label: "Heading", default: "From the forum", inlineEditable: true },
  { name: "intro", kind: "text", label: "Line under the heading", default: "" },
  { name: "limit", kind: "number", label: "Topics shown", default: 4, min: 0, max: 10, step: 1 },
  { name: "linkLabel", kind: "string", label: "Link", default: "Enter the forum" },
  { name: "linkHref", kind: "url", label: "Link goes to", default: "/forum" },
  { name: "emptyNote", kind: "string", label: "When there are no topics", default: "Questions, writing and the dictionary." },
] as const;

export function HeForum(p: PropsOf<typeof forumProps> & { topics?: ForumTopic[] }) {
  const topics = (Array.isArray(p.topics) ? p.topics : []).slice(0, Math.max(0, Number(p.limit) || 0));
  return (
    <section className="blk he-forum">
      <header className="he-band-head">
        {p.eyebrow ? <p className="he-eyebrow">{p.eyebrow}</p> : null}
        {p.heading ? <h2 className="he-band-title">{p.heading}</h2> : null}
        {p.intro ? <p className="he-band-intro">{p.intro}</p> : null}
      </header>
      {topics.length ? (
        <ul className="he-forum-list">
          {topics.map((t) => (
            <li key={t.id}>
              <a href={t.href}>
                <span className="he-forum-title">{t.title}</span>
                {t.meta ? <span className="he-forum-meta">{t.meta}</span> : null}
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p className="he-works-empty">{p.emptyNote}</p>
      )}
      {str(p.linkLabel).trim() && str(p.linkHref).trim() ? (
        <p className="he-band-more">
          <a href={p.linkHref as string}>{p.linkLabel} →</a>
        </p>
      ) : null}
    </section>
  );
}

export const heForum = defineBlock(
  {
    id: "he-forum",
    label: "Forum",
    category: "listings",
    description: "The forum's newest topics, read live, and a link in.",
    memberSafe: true,
    styling: "tokens",
    props: forumProps,
    parts: {
      root: { label: "Forum", sel: "> .he-forum" },
      heading: { label: "Heading", sel: "> .he-forum .he-band-title", prop: "heading" },
      list: { label: "Topics", sel: "> .he-forum .he-forum-list" },
    },
    tokens: [{ name: "--he-aurum", label: "Accent", type: "color" }],
  },
  HeForum,
);

// ── he-person ───────────────────────────────────────────────────────────────

export interface PersonView {
  name: string;
  role: string | null;
  city: string | null;
  bio: string | null;
  photoUrl: string | null;
  href: string;
  links: { label: string; url: string }[];
}

/**
 * Round 6: the whole person page (`layout: "page"`, the `person` template
 * around every `/about/<slug>`), from getPersonPage as the route always drew
 * it (lib/record-blocks.ts loadPersonPage): the profile, their posts and
 * events in the org's order, their portfolio.
 */
export interface PersonPageView {
  name: string;
  role: string | null;
  city: string | null;
  verified: boolean;
  /** Plain-text bio (paragraphs), when the bio is not HTML. */
  bio: string | null;
  /** Sanitised by the resolver. */
  bioHtml: string | null;
  avatarUrl: string | null;
  socialLinks: { label: string | null; url: string }[];
  portfolio: { url: string; title: string | null }[];
  /** Section keys in display order. */
  order: string[];
  /** Null when the section is switched off. */
  posts: PersonListItem[] | null;
  events: PersonListItem[] | null;
  /** The viewer is the person (or an admin): empty sections say so. */
  canEdit: boolean;
}

const personProps = [
  { name: "slug", kind: "string", label: "Person", description: "The profile's address (as in /about/aeon) or name (Ario). Empty = the first. On the person page: the person in the address.", default: "aeon" },
  {
    name: "layout",
    kind: "select",
    label: "Shape",
    default: "card",
    options: [
      { value: "card", label: "A card: portrait and statement" },
      { value: "page", label: "The whole person page: portrait, bio, posts, events" },
    ],
  },
  { name: "eyebrow", kind: "string", label: "Eyebrow", default: "", inlineEditable: true },
  { name: "heading", kind: "string", label: "Heading", description: "Empty = the person's name.", default: "", inlineEditable: true },
  { name: "statement", kind: "richtext", label: "Statement", description: "Shown in place of the profile's bio when filled.", default: "" },
  { name: "showBio", kind: "boolean", label: "Show the profile's bio when there is no statement", default: true },
  { name: "linkLabel", kind: "string", label: "Link", description: "Empty = none.", default: "" },
  { name: "linkHref", kind: "url", label: "Link goes to", description: "Empty = the person's profile page.", default: "" },
  // Round 6: the whole-page shape's words (card: unused).
  { name: "backLabel", kind: "string", label: "Page: back link", description: "Empty = none.", default: "" },
  { name: "backHref", kind: "url", label: "Page: back link goes to", default: "/about" },
  { name: "postsHeading", kind: "string", label: "Page: posts heading", default: "Posts" },
  { name: "eventsHeading", kind: "string", label: "Page: events heading", default: "Events" },
  { name: "emptyPosts", kind: "string", label: "Page: no posts (shown to the person only)", default: "Nothing posted here yet." },
  { name: "emptyEvents", kind: "string", label: "Page: no events (shown to the person only)", default: "No events yet." },
] as const;

type PersonProps = PropsOf<typeof personProps> & { person?: PersonView | null; page?: PersonPageView | null; puck?: PuckEditing };

/** The page shape: the route's PersonPage, its words from the props. */
function PersonWholePage(p: PersonProps) {
  const { drawn } = editingOf(p.puck);
  const page = p.page ?? null;
  if (!page) {
    return <section className="he-person-page font-sans">{drawn ? <p className="he-works-empty">No profile to show yet.</p> : null}</section>;
  }
  const statement = str(p.statement).trim();
  const showBio = !statement && p.showBio !== false;
  const list = (title: string, items: PersonListItem[] | null, empty: string) =>
    items ? <PersonThreadList title={title} items={items} empty={page.canEdit ? empty || null : null} /> : null;
  const slots: Record<string, ReactNode> = {
    posts: list(str(p.postsHeading) || "Posts", page.posts, str(p.emptyPosts)),
    events: list(str(p.eventsHeading) || "Events", page.events, str(p.emptyEvents)),
  };
  const backLabel = str(p.backLabel).trim();
  const body = (
    <PersonPage
      person={{
        displayName: str(p.heading) || page.name,
        role: page.role,
        bio: showBio ? page.bio : null,
        bioHtml: showBio ? page.bioHtml : null,
        avatarUrl: page.avatarUrl,
        city: page.city,
        verified: page.verified,
        socialLinks: page.socialLinks,
      }}
      back={backLabel ? { href: str(p.backHref).trim() || "/about", label: backLabel } : null}
      sidebarExtra={statement ? <RichText className="eac-person-bio" body={p.statement} /> : null}
      portfolio={page.portfolio}
      emptyFeatured={null}
      order={page.order}
      slots={slots}
    />
  );
  return <section className="he-person-page font-sans">{drawn ? <div inert>{body}</div> : body}</section>;
}

export function HePerson(p: PersonProps) {
  if (p.layout === "page") return <PersonWholePage {...p} />;
  const person = p.person ?? null;
  const name = person?.name ?? "";
  const statement = str(p.statement).trim();
  return (
    <section className="blk he-person">
      <div className="he-person-in">
        <figure className="he-person-portrait">
          {person?.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={person.photoUrl} alt={name} />
          ) : (
            <div className="he-orb" data-size="small" aria-hidden="true" />
          )}
        </figure>
        <div className="he-person-copy">
          {p.eyebrow ? <p className="he-eyebrow">{p.eyebrow}</p> : null}
          <h2 className="he-band-title">{str(p.heading) || name || "About"}</h2>
          {person?.role || person?.city ? (
            <p className="he-person-role">{[person.role, person.city].filter(Boolean).join(" · ")}</p>
          ) : null}
          {statement ? (
            <RichText className="he-person-bio" body={p.statement} />
          ) : p.showBio !== false && person?.bio ? (
            // The profile bio may be rich text (HTML) or plain paragraphs; RichText sanitises and draws both.
            <RichText className="he-person-bio" body={person.bio} />
          ) : null}
          {person?.links?.length ? (
            <p className="he-person-links">
              {person.links.map((l) => (
                <a key={l.url} href={l.url} rel="noopener">
                  {l.label}
                </a>
              ))}
            </p>
          ) : null}
          {str(p.linkLabel).trim() ? (
            <p className="he-band-more">
              <a href={str(p.linkHref).trim() || person?.href || "/about"}>{p.linkLabel} →</a>
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export const hePerson = defineBlock(
  {
    id: "he-person",
    label: "A person",
    category: "content",
    description: "A portrait (the profile's photo), name, role and a statement or the profile's bio; or the whole person page (the /about/<person> template).",
    memberSafe: true,
    styling: "tokens",
    props: personProps,
    parts: {
      root: { label: "Person", sel: "> .he-person" },
      portrait: { label: "Portrait", sel: "> .he-person .he-person-portrait" },
      heading: { label: "Name", sel: "> .he-person .he-band-title", prop: "heading" },
      bio: { label: "Statement", sel: "> .he-person .he-person-bio", prop: "statement" },
      // Round 6: the whole-page shape.
      page: { label: "Person page", sel: "> .he-person-page" },
      pageName: { label: "Page: name", sel: "> .he-person-page .eac-person-name", prop: "heading" },
      pagePortrait: { label: "Page: portrait", sel: "> .he-person-page .eac-person-portrait" },
    },
    tokens: [{ name: "--he-ink-dim", label: "Text ink", type: "color" }],
  },
  HePerson,
);

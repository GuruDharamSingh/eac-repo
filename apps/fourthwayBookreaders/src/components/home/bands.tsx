import Link from "next/link";
import {
  Archive,
  BookOpen,
  CalendarDays,
  FileDown,
  Lightbulb,
  LogIn,
  Mic,
  Users,
  Video,
} from "lucide-react";
import type { CurrentBook, MeetingStructure, SuggestedBook, Thread } from "@/lib/types";
import { ThreadCard } from "@/components/thread-card";
import { BookCoverFallback } from "./book-cover-fallback";

/* ── The two-column split ─────────────────────────────────────────────────── */

export function CurrentCircle({ thread, attending }: { thread: Thread | null; attending: number }) {
  return (
    <div>
      <div className="band__head">
        <h2 className="band__title">The current reading group</h2>
        <Link href="/groups" className="band__more">All groups →</Link>
      </div>
      {thread ? (
        <ThreadCard thread={thread} attending={attending} />
      ) : (
        <div className="empty">
          No reading group is sitting yet. When one is started from{" "}
          <Link href="/manage/groups/new">Manage</Link>, it appears here with its book, its time and a way to join.
        </div>
      )}
    </div>
  );
}

export function Invitation() {
  return (
    <div>
      <div className="band__head">
        <h2 className="band__title">Reading groups are spoken aloud</h2>
      </div>
      <p className="invitation__lead">
        We read the book to each other, a page at a time, and stop when there
        is something to say. Nobody has to have read ahead. The circle is open
        to —
      </p>
      <ul className="invitation__list">
        <li><strong>people learning English</strong> — a slow, patient reading with the text in front of you.</li>
        <li><strong>performing artists</strong> — a text that rewards being voiced, and a room that listens.</li>
        <li><strong>silent listeners</strong> — you are welcome to come and never say a word.</li>
        <li><strong>readers who have tried alone</strong> — and put the book down at chapter three.</li>
      </ul>
    </div>
  );
}

/* ── Suggested books + vertical banner ────────────────────────────────────── */

export function SuggestedBooks({ books }: { books: SuggestedBook[] }) {
  return (
    <div>
      <div className="band__head">
        <h2 className="band__title">Books ahead</h2>
        <Link href="/suggest" className="band__more">Suggest one →</Link>
      </div>
      {books.length === 0 ? (
        <div className="empty">
          No books are queued yet. <Link href="/suggest">Suggest the next one.</Link>
        </div>
      ) : (
        <ul className="booklist">
          {books.map((b) => (
            <li key={`${b.title}|${b.author ?? ""}`}>
              {b.href ? (
                <a href={b.href} target={/^https?:/.test(b.href) ? "_blank" : undefined} rel="noreferrer">
                  <span className="booklist__title">{b.title}</span>
                  {b.author && <span className="booklist__author">{b.author}</span>}
                  {b.note && <span className="booklist__note">{b.note}</span>}
                </a>
              ) : (
                <span className="booklist__dead">
                  <span className="booklist__title">{b.title}</span>
                  {b.author && <span className="booklist__author">{b.author}</span>}
                  {b.note && <span className="booklist__note">{b.note}</span>}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function VerticalBanner({
  imageUrl,
  href,
  book,
}: {
  imageUrl: string | null;
  href: string | null;
  book: CurrentBook | null;
}) {
  const inner = imageUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={imageUrl} alt="" />
  ) : (
    <BookCoverFallback title={book?.title ?? "Fourth Way Book Readers"} author={book?.author} spine />
  );
  return href ? (
    <a className="vbanner" href={href} aria-label="Featured">{inner}</a>
  ) : (
    <div className="vbanner" aria-hidden>{inner}</div>
  );
}

/* ── Feature tiles ────────────────────────────────────────────────────────── */

const TILES = [
  { href: "/books", label: "View Books", hint: "what we're reading", Icon: BookOpen },
  { href: "/groups", label: "View Groups", hint: "the circles and their times", Icon: Users },
  { href: "/archive", label: "View Archive", hint: "past sessions and notes", Icon: Archive },
  { href: "/calendar", label: "View Calendar", hint: "month by month", Icon: CalendarDays },
  { href: "/account", label: "View Account", hint: "your name and your RSVPs", Icon: LogIn },
  { href: "/suggest", label: "Suggest a Book", hint: "what should we read next", Icon: Lightbulb },
  { href: "/books#read", label: "Read Along", hint: "the page we're on", Icon: Mic },
  { href: "/archive#recordings", label: "Recordings", hint: "prior meetings on video", Icon: Video },
  { href: "/center", label: "Your Center", hint: "the network, from here", Icon: FileDown },
];

export function FeatureTiles() {
  return (
    <nav className="tiles" aria-label="Sections">
      {TILES.map(({ href, label, hint, Icon }) => (
        <Link key={href} href={href} className="tile">
          <span className="tile__icon"><Icon size={15} aria-hidden /></span>
          <span className="tile__text">
            <span className="tile__label">{label}</span>
            <span className="tile__hint">{hint}</span>
          </span>
        </Link>
      ))}
    </nav>
  );
}

/* ── Structure of a meeting ───────────────────────────────────────────────── */

export function MeetingStructureBand({
  structure,
  canEdit,
}: {
  structure: MeetingStructure | null;
  canEdit: boolean;
}) {
  return (
    <div>
      <div className="band__head">
        <h2 className="band__title">{structure?.title ?? "Structure of a Meeting"}</h2>
        {canEdit && <Link href="/manage/meeting-structure" className="band__more">Edit →</Link>}
      </div>
      {structure ? (
        <div className="structure" data-has-media={Boolean(structure.mediaUrl)}>
          <div>
            {/* The body is HTML from our own editor, sanitised on write in
                /api/manage/section — not arbitrary user input. */}
            <div className="prose" dangerouslySetInnerHTML={{ __html: structure.body }} />
            {structure.documentUrl && (
              <a className="structure__doc" href={structure.documentUrl} target="_blank" rel="noreferrer">
                <FileDown size={14} aria-hidden /> {structure.documentLabel}
              </a>
            )}
          </div>
          {structure.mediaUrl && (
            <div className="structure__media">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={structure.mediaUrl} alt="" />
            </div>
          )}
        </div>
      ) : (
        <div className="empty">
          How a session runs — the opening, the reading, the pauses, the close —
          hasn&rsquo;t been written up yet.
          {canEdit && <> <Link href="/manage/meeting-structure">Write it now.</Link></>}
        </div>
      )}
    </div>
  );
}

import Link from "next/link";
import type { Attendee } from "@/lib/types";

interface AttendeeListProps {
  attendees: Attendee[];
  total: number;
  /** Members only — see the note in the thread page about why. */
  visible: boolean;
}

/**
 * Who's coming. Showing up at 4am is easier when you can see that five other
 * people intend to, so this is social infrastructure rather than a metric.
 *
 * Signed-out visitors get the count but not the names.
 */
export function AttendeeList({ attendees, total, visible }: AttendeeListProps) {
  if (total === 0) return null;

  if (!visible) {
    return (
      <p className="mt-4 text-sm text-muted-foreground">
        <Link href="/login" className="underline underline-offset-2">
          Sign in
        </Link>{" "}
        to see who else is coming.
      </p>
    );
  }

  return (
    <section className="mt-6">
      <h2 className="font-serif text-lg">Who&rsquo;s coming</h2>
      <ul className="mt-3 flex flex-wrap gap-2">
        {attendees.map((a, i) => (
          <li
            key={`${a.name}-${i}`}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-sm"
          >
            {a.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={a.photoUrl} alt="" className="size-6 rounded-full object-cover" />
            ) : (
              <span
                aria-hidden
                className="flex size-6 items-center justify-center rounded-full bg-primary/20 text-xs font-medium"
              >
                {a.name.charAt(0).toUpperCase()}
              </span>
            )}
            {a.guideSlug ? (
              <Link href={`/about/${a.guideSlug}`} className="underline underline-offset-2">
                {a.name}
              </Link>
            ) : (
              a.name
            )}
          </li>
        ))}
      </ul>
      {total > attendees.length && (
        <p className="mt-2 text-sm text-muted-foreground">
          and {total - attendees.length} more
        </p>
      )}
    </section>
  );
}

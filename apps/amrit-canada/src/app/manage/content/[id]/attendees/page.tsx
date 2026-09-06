import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@elkdonis/db";
import { lastOccurrenceEnd } from "@elkdonis/utils";
import { Badge } from "@/components/ui/badge";
import { getThreadById } from "@/lib/data";
import { formatDateTime, formatShortDate } from "@/lib/format";

interface AttendeesPageProps {
  params: Promise<{ id: string }>;
}

interface Row {
  name: string | null;
  email: string | null;
  is_member: boolean;
  phone: string | null;
  wants_reminder: boolean;
  responded_at: Date;
}

/**
 * The full roster, for the person running the gathering.
 *
 * Unlike the public attendee list this shows emails and phone numbers — it's
 * the working list for actually contacting people, and it's behind the
 * /manage layout's owner/guide gate.
 */
export default async function AttendeesPage({ params }: AttendeesPageProps) {
  const { id } = await params;
  const thread = await getThreadById(id);
  if (!thread) notFound();

  const cutoff = thread.scheduledAt
    ? lastOccurrenceEnd(thread.scheduledAt, thread.recurrencePattern, thread.durationMinutes)
    : null;

  const rows = await db<Row[]>`
    SELECT u.display_name AS name, u.email, TRUE AS is_member,
           NULL::text AS phone, FALSE AS wants_reminder, r.updated_at AS responded_at
    FROM thread_rsvps r
    JOIN users u ON u.id = r.user_id
    WHERE r.thread_id = ${id} AND r.status = 'yes'
      ${cutoff ? db`AND r.updated_at > ${cutoff}` : db``}

    UNION ALL

    SELECT g.name, g.email, FALSE AS is_member,
           g.metadata->>'phone' AS phone,
           COALESCE((g.metadata->>'wants_reminder')::boolean, FALSE) AS wants_reminder,
           g.created_at AS responded_at
    FROM guest_submissions g
    WHERE g.thread_id = ${id} AND g.kind = 'rsvp'
      ${cutoff ? db`AND g.created_at > ${cutoff}` : db``}

    ORDER BY responded_at ASC
  `.catch(() => [] as Row[]);

  return (
    <>
      <Link href="/manage" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
        ← Content
      </Link>

      <h2 className="mt-4 font-serif text-2xl">Who&rsquo;s coming</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {thread.title}
        {thread.nextOccurrenceAt && ` · ${formatDateTime(thread.nextOccurrenceAt)}`}
      </p>

      {cutoff && (
        <p className="mt-2 text-sm text-muted-foreground">
          Showing this cycle only — RSVPs reset after each occurrence.
        </p>
      )}

      {rows.length === 0 ? (
        <p className="mt-8 rounded-lg border border-dashed border-border p-10 text-center text-muted-foreground">
          Nobody has RSVP&rsquo;d yet.
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[40rem] text-sm">
            <thead className="border-b border-border text-left text-muted-foreground">
              <tr>
                <th className="pb-2 font-medium">Name</th>
                <th className="pb-2 font-medium">Email</th>
                <th className="pb-2 font-medium">Phone</th>
                <th className="pb-2 font-medium">Said yes</th>
                <th className="pb-2 font-medium">Type</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row, i) => (
                <tr key={`${row.email ?? row.name}-${i}`}>
                  <td className="py-2.5 pr-4">{row.name ?? "—"}</td>
                  <td className="py-2.5 pr-4">
                    {row.email ? (
                      <a href={`mailto:${row.email}`} className="underline underline-offset-2">
                        {row.email}
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="py-2.5 pr-4 text-muted-foreground">{row.phone ?? "—"}</td>
                  <td className="py-2.5 pr-4 text-muted-foreground">
                    {formatShortDate(row.responded_at)}
                  </td>
                  <td className="py-2.5">
                    <Badge variant={row.is_member ? "secondary" : "outline"}>
                      {row.is_member ? "Member" : "Guest"}
                    </Badge>
                    {row.wants_reminder && (
                      <Badge variant="outline" className="ml-1">
                        Wants reminder
                      </Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-4 text-sm text-muted-foreground">
            {rows.length} {rows.length === 1 ? "person" : "people"} ·{" "}
            {rows.filter((r) => r.is_member).length} members,{" "}
            {rows.filter((r) => !r.is_member).length} guests
          </p>
        </div>
      )}
    </>
  );
}

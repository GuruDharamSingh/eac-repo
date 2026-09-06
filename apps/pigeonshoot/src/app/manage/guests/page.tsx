import type { Metadata } from "next";
import { GuestRow } from "@/components/manage/guest-row";
import { listGuests } from "@/lib/manage/data";

export const metadata: Metadata = { title: "Contributors" };

export default async function GuestsPage() {
  const guests = await listGuests();

  return (
    <div>
      <h1 className="font-display text-2xl font-bold">Contributors</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Anonymous contributors, one row per browser. Blocking stops new submissions from that
        browser; it doesn&apos;t touch cards they&apos;ve already posted.
      </p>

      {guests.length === 0 ? (
        <p className="mt-8 rounded-lg border border-dashed border-border p-12 text-center text-muted-foreground">
          Nobody yet.
        </p>
      ) : (
        <ul className="mt-6 divide-y divide-border rounded-lg border border-border bg-card">
          {guests.map((g) => (
            <GuestRow key={g.id} guest={g} />
          ))}
        </ul>
      )}
    </div>
  );
}

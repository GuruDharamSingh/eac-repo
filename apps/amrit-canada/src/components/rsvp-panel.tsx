"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

interface RsvpPanelProps {
  threadId: string;
  title: string;
  signedIn: boolean;
  alreadyAttending: boolean;
  attendanceCount: number;
  attendeeLimit: number | null;
  cancelled: boolean;
}

/**
 * Two RSVP paths, on purpose.
 *
 * Signed-in members go to `thread_rsvps` and get a durable record they can see
 * on /account. Guests go to `guest_submissions` + `contacts` with just a name
 * and email. Most people who show up at 4am will never make an account, and
 * requiring one would undercount the room and gatekeep a public practice.
 */
export function RsvpPanel({
  threadId,
  title,
  signedIn,
  alreadyAttending,
  attendanceCount,
  attendeeLimit,
  cancelled,
}: RsvpPanelProps) {
  const router = useRouter();
  const [attending, setAttending] = useState(alreadyAttending);
  const [busy, setBusy] = useState(false);
  const [guestDone, setGuestDone] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [wantsReminder, setWantsReminder] = useState(true);

  const full = attendeeLimit !== null && attendanceCount >= attendeeLimit && !attending;

  if (cancelled) {
    return (
      <div className="card-natural mt-8 border-destructive/50 p-6 text-sm">
        <p className="font-serif text-lg text-destructive">This gathering is cancelled.</p>
        <p className="mt-1 text-muted-foreground">
          RSVPs are closed for now. If it&rsquo;s a recurring gathering, the next one can still be
          confirmed — check back.
        </p>
      </div>
    );
  }

  async function toggleMemberRsvp() {
    setBusy(true);
    try {
      const res = await fetch(`/api/threads/${threadId}/rsvp`, {
        method: attending ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: attending ? undefined : JSON.stringify({ receiveEmailNotice: true }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        toast.error(data.error ?? "Could not update your RSVP.");
        return;
      }

      setAttending(!attending);
      toast.success(attending ? "You're no longer marked as coming." : "You're coming. See you there.");
      router.refresh();
    } catch {
      toast.error("Could not reach the server. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function submitGuestRsvp(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch("/api/rsvp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId, name, email, wantsReminder, meetingTitle: title }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        toast.error(data.error ?? "Could not record your RSVP.");
        return;
      }

      setGuestDone(true);
      toast.success("Thanks — you're on the list.");
      router.refresh();
    } catch {
      toast.error("Could not reach the server. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card-natural mt-8 p-6">
      <h2 className="font-serif text-xl">
        {attending || guestDone ? "You're coming" : "Are you coming?"}
      </h2>
      <div className="mt-4">
        {attendanceCount > 0 && (
          <p className="mb-4 text-sm text-muted-foreground">
            {attendanceCount} {attendanceCount === 1 ? "person has" : "people have"} said they&rsquo;re
            coming
            {attendeeLimit ? ` · ${attendeeLimit} spaces` : ""}.
          </p>
        )}

        {full ? (
          <p className="text-sm text-muted-foreground">
            This gathering is full. Get in touch if you&rsquo;d like to be added to the waitlist.
          </p>
        ) : signedIn ? (
          <Button onClick={toggleMemberRsvp} disabled={busy} variant={attending ? "outline" : "default"}>
            {busy ? "Saving…" : attending ? "I can't make it after all" : "Yes, I'm coming"}
          </Button>
        ) : guestDone ? (
          <p className="text-sm">
            You&rsquo;re on the list. We&rsquo;ve sent a confirmation to <strong>{email}</strong>.
          </p>
        ) : (
          <form onSubmit={submitGuestRsvp} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="rsvp-name">Your name</Label>
                <Input
                  id="rsvp-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  autoComplete="name"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rsvp-email">Email</Label>
                <Input
                  id="rsvp-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="rsvp-reminder"
                checked={wantsReminder}
                onCheckedChange={(v) => setWantsReminder(v === true)}
              />
              <Label htmlFor="rsvp-reminder" className="font-normal">
                Email me a reminder beforehand
              </Label>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={busy}>
                {busy ? "Sending…" : "Yes, I'm coming"}
              </Button>
              <span className="text-sm text-muted-foreground">
                or{" "}
                <a href="/login" className="underline underline-offset-2">
                  sign in
                </a>{" "}
                to keep track of your RSVPs
              </span>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}

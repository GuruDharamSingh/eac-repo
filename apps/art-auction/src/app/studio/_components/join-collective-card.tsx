"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { joinCollectiveAsArtistAction } from "../actions";

/**
 * The step before a store: join the collective as an artist. Shows the artist
 * agreement, an optional "already part of an organisation?" list, and one
 * button. Choosing an organisation records that the person follows it; the
 * organisation's owners confirm any role above that.
 */
export function JoinCollectiveCard({
  agreement,
  orgs,
  hubUrl,
}: {
  agreement: { id: string; title: string; bodyHtml: string } | null;
  orgs: Array<{ orgId: string; name: string }>;
  hubUrl: string;
}) {
  const router = useRouter();
  const [agreed, setAgreed] = React.useState(false);
  const [member, setMember] = React.useState(false);
  const [picked, setPicked] = React.useState<string[]>([]);
  const [pending, setPending] = React.useState(false);

  if (!agreement) {
    return (
      <section className="rounded-lg border border-dashed border-border p-5">
        <p className="font-medium">Joining as an artist is not open yet.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          The artist agreement has not been published. You can also join through an organisation in the network.
        </p>
        <Button asChild className="mt-4">
          <a href={hubUrl}>Go to the Arts Collective hub</a>
        </Button>
      </section>
    );
  }

  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  return (
    <section className="rounded-lg border border-border p-5">
      <h2 className="font-serif text-2xl">Join the collective as an artist</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        A store belongs to an artist of the collective. Read the agreement below, then join; you can claim your store straight after.
      </p>

      <div className="mt-4 rounded-md border border-border bg-muted/30 p-4">
        <p className="mb-2 text-sm font-medium">{agreement.title}</p>
        <div
          className="space-y-2 text-sm [&_li]:ml-5 [&_li]:list-disc"
          dangerouslySetInnerHTML={{ __html: agreement.bodyHtml }}
        />
      </div>

      {orgs.length > 0 && (
        <div className="mt-5">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" checked={member} onChange={(e) => setMember(e.target.checked)} />
            I am already part of an organisation in the network
          </label>
          {member && (
            <>
              <ul className="mt-2 grid gap-1 sm:grid-cols-2">
                {orgs.map((o) => (
                  <li key={o.orgId}>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={picked.includes(o.orgId)}
                        onChange={() => toggle(o.orgId)}
                      />
                      {o.name}
                    </label>
                  </li>
                ))}
              </ul>
              <p className="mt-1 text-xs text-muted-foreground">
                This links your account to the organisation. Its owners confirm your role.
              </p>
            </>
          )}
        </div>
      )}

      <label className="mt-5 flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
        />
        <span>I have read and accept this agreement.</span>
      </label>

      <Button
        className="mt-4"
        disabled={!agreed || pending}
        onClick={async () => {
          setPending(true);
          try {
            const res = await joinCollectiveAsArtistAction({
              agreementId: agreement.id,
              orgIds: member ? picked : [],
            });
            if (!res.ok) return toast.error(res.error ?? "Could not join.");
            toast.success("You have joined the collective.");
            router.refresh();
          } finally {
            setPending(false);
          }
        }}
      >
        {pending ? "Joining…" : "Join the collective as an artist"}
      </Button>
    </section>
  );
}

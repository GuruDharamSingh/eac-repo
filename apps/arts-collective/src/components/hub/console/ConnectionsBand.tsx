import { FilesCard } from "@elkdonis/cms-ui/files";
import type { ConsoleState } from "@/lib/org-console";

/**
 * What this org is plugged into, and its two file trees.
 *
 * A console is partly a status board for the services an org depends on, so
 * this reports honestly rather than aspirationally: with no STRIPE_SECRET_KEY
 * on the network, payments read "not connected" and say what that means, which
 * is more use than a card that implies a working integration.
 *
 * The Files card carries BOTH trees — the org's shared team folder and the
 * person's own EAC_Network/users/<slug>/ — as one switcher. Everyone has a
 * personal folder whether or not they have a Nextcloud login (most people
 * here do not), so for most members this is the only way to reach their files
 * at all.
 */

function Stat({
  label,
  value,
  note,
  tone = "normal",
}: {
  label: string;
  value: string;
  note: string;
  tone?: "normal" | "off";
}) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border bg-card p-4">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p
        className={
          tone === "off"
            ? "font-serif text-lg text-muted-foreground"
            : "font-serif text-lg text-foreground"
        }
      >
        {value}
      </p>
      <p className="text-xs leading-relaxed text-muted-foreground">{note}</p>
    </div>
  );
}

export function ConnectionsBand({
  state,
  orgId,
  orgSlug,
  paymentsReady,
}: {
  state: ConsoleState;
  /** The storage root is keyed on the org ID, not its slug — `amrit_canada`,
   *  not `amrit-canada`. Showing the slug here named a folder that does not
   *  exist, while the API route (which resolves the id properly) read the
   *  right one. */
  orgId: string;
  orgSlug: string;
  paymentsReady: boolean;
}) {
  const { all, total } = { all: state.people.all, total: state.people.total };
  const onNextcloud = all.filter((p) => p.hasNextcloud).length;
  const onStripe = all.filter((p) => p.stripeOnboarded).length;

  return (
    <section aria-label="Connections" className="mb-10">
      <h2 className="mb-3 text-xs uppercase tracking-[0.22em] text-muted-foreground">
        Connected services
      </h2>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat
          label="Payments"
          tone={paymentsReady ? "normal" : "off"}
          value={paymentsReady ? "Stripe connected" : "Not connected"}
          note={
            paymentsReady
              ? `${onStripe} of ${total} members can be paid out.`
              : "The network has no Stripe key set, so nothing can charge or pay out yet."
          }
        />
        <Stat
          label="Nextcloud"
          tone={onNextcloud > 0 ? "normal" : "off"}
          value={`${onNextcloud} with a login`}
          note="Everyone has storage regardless — a login only adds the Nextcloud apps themselves."
        />
        <Stat
          label="Team folder"
          value={`EAC_Network/${orgId}`}
          note="Shared with everyone in this org. Owners and guides can add to it."
        />
      </div>

      <div className="mt-4">
        <FilesCard
          title="Files"
          sources={[
            {
              id: "org",
              label: "Team folder",
              endpoint: `/api/org/${encodeURIComponent(orgSlug)}/files`,
              initialPath: "Media",
            },
            {
              id: "mine",
              label: "My files",
              endpoint: "/api/my-files",
              canUpload: true,
            },
          ]}
        />
      </div>
    </section>
  );
}

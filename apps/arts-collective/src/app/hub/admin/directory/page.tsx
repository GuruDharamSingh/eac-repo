import { notFound } from "next/navigation";
import { isAdmin } from "@elkdonis/auth-server";
import { requireUser } from "@/lib/session";
import { SiteShell } from "@/components/site-shell";
import { AssociatedOrgManager } from "@/components/hub/AssociatedOrgManager";
import { listAssociatedOrgs, listOrganizations } from "@/lib/associated-orgs";

/**
 * Associated organizations — external businesses (a gallery, a curator
 * collective, an auction house) the network has a relationship with,
 * represented as staff-edited profiles and listed on ArtDirect's directory
 * alongside people. Display/directory only, no access implied — see
 * associated-orgs.ts's header comment for the full model.
 *
 * Same gate as /hub/admin: network-wide, not org owner/guide, because this
 * spans every org via the org picker below rather than belonging to one.
 */
export const dynamic = "force-dynamic";

export default async function AssociatedOrgsPage() {
  const user = await requireUser();
  if (!(await isAdmin(user.id))) notFound();

  const [rows, orgs] = await Promise.all([listAssociatedOrgs(), listOrganizations()]);

  return (
    <SiteShell>
      <div className="mx-auto w-full max-w-6xl space-y-8 px-6 py-10">
        <header>
          <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
            Network operations
          </p>
          <h1 className="mt-2 font-serif text-3xl">Associated organizations</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Businesses the network has a relationship with — a gallery, a curator
            collective, an auction house — listed on ArtDirect like a Yellow Pages
            entry. This is a directory relationship, not an account: it grants no
            access to anything. <a className="underline" href="/hub/admin">← Back to admin</a>
          </p>
        </header>

        <AssociatedOrgManager initialRows={rows} orgs={orgs} />
      </div>
    </SiteShell>
  );
}

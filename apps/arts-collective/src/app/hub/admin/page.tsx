import { notFound } from "next/navigation";
import { isAdmin } from "@elkdonis/auth-server";
import { requireUser } from "@/lib/session";
import { networkHost } from "@/lib/domain";
import { SiteShell } from "@/components/site-shell";
import { ConfirmOrgButton } from "@/components/hub/ConfirmOrgButton";
import {
  getDomainRows,
  getHealthIssues,
  getNetworkTotals,
  getOrgRows,
  type DomainRow,
  type HealthIssue,
  type OrgRow,
} from "@/lib/network-admin";

/**
 * Network operations console.
 *
 * Deliberately outside hub/(tabs): the tab bar is the member-facing hub, and
 * this is not a member surface. Gated on users.is_admin — org owners see their
 * own org through the hub, not the whole network from here.
 */
export const dynamic = "force-dynamic";

export default async function NetworkAdminPage() {
  const user = await requireUser();
  if (!(await isAdmin(user.id))) notFound();

  const [totals, orgs, domains] = await Promise.all([
    getNetworkTotals(),
    getOrgRows(),
    getDomainRows(),
  ]);
  const issues = getHealthIssues(orgs, domains);

  return (
    <SiteShell>
      <div className="mx-auto w-full max-w-6xl space-y-10 px-6 py-10">
        <header>
          <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
            Network operations
          </p>
          <h1 className="mt-2 font-serif text-3xl">Collective admin</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Every organisation on the network, which domains serve them, and what
            is not yet wired up.
          </p>
          <p className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm">
            <a className="underline" href="/hub/admin/directory">
              Manage associated organizations →
            </a>
            <a className="underline" href="/hub/agreements">
              Agreements &amp; revenue shares →
            </a>
            <a className="underline" href="/hub/admin/ledger">
              Held funds →
            </a>
            <a className="underline" href="/hub/quotes">
              The line on every center →
            </a>
          </p>
        </header>

        <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <Stat label="Organisations" value={totals.orgs} />
          <Stat label="Users" value={totals.users} />
          <Stat label="Admins" value={totals.admins} />
          <Stat label="Live domains" value={totals.domains} />
          <Stat
            label="On subdomain only"
            value={Math.max(totals.orgs - totals.orgsWithDomain, 0)}
          />
        </section>

        <PendingPanel orgs={orgs.filter((o) => !o.subdomain_confirmed)} />
        <HealthPanel issues={issues} />
        <DomainsPanel domains={domains} />
        <OrgsPanel orgs={orgs} />
      </div>
    </SiteShell>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-border bg-card p-4">
      <p className="text-2xl font-semibold tabular-nums text-foreground">{value}</p>
      <p className="mt-1 text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
    </div>
  );
}

function Panel({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-serif text-2xl">{title}</h2>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {children}
    </section>
  );
}

function PendingPanel({ orgs }: { orgs: OrgRow[] }) {
  if (orgs.length === 0) return null;
  return (
    <Panel
      title="Awaiting intake interview"
      description="These sites show a pending notice to the public. Their owners can already see and build them."
    >
      <ul className="space-y-2">
        {orgs.map((o) => (
          <li
            key={o.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-card p-4"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">
                {o.name}{" "}
                <code className="ml-1 text-xs text-muted-foreground">
                  {o.slug}
                </code>
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {o.tier} tier · {o.owner_email ?? "no owner"} · created{" "}
                {new Date(o.created_at).toLocaleDateString()}
              </p>
            </div>
            <ConfirmOrgButton slug={o.slug} />
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function HealthPanel({ issues }: { issues: HealthIssue[] }) {
  return (
    <Panel
      title="Needs attention"
      description="Derived checks, not stored state. An empty list means nothing is half-wired."
    >
      {issues.length === 0 ? (
        <p className="rounded-md border border-dashed border-border bg-muted/30 p-5 text-sm text-muted-foreground">
          Everything checks out.
        </p>
      ) : (
        <ul className="space-y-3">
          {issues.map((issue) => (
            <li
              key={issue.key}
              className="rounded-md border border-border bg-card p-5"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground">
                  {issue.label}
                </h3>
                <span className="rounded-full border border-border px-2 py-0.5 text-xs tabular-nums text-muted-foreground">
                  {issue.items.length}
                </span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{issue.detail}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {issue.items.map((item) => (
                  <code
                    key={item}
                    className="rounded border border-border bg-muted/40 px-2 py-0.5 text-xs"
                  >
                    {item}
                  </code>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function DomainsPanel({ domains }: { domains: DomainRow[] }) {
  return (
    <Panel
      title="Domains"
      description="Host header → organisation. Adding a row here is all it takes to serve a business on its own domain."
    >
      {domains.length === 0 ? (
        <p className="rounded-md border border-dashed border-border bg-muted/30 p-5 text-sm text-muted-foreground">
          No full domains mapped yet — every site is served on its
          <code className="mx-1 rounded bg-muted px-1">
            slug.{networkHost()}
          </code>
          subdomain.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <Th>Domain</Th>
                <Th>Organisation</Th>
                <Th>Primary</Th>
                <Th>Verified</Th>
              </tr>
            </thead>
            <tbody>
              {domains.map((d) => (
                <tr key={d.domain} className="border-t border-border">
                  <Td>
                    <code className="text-xs">{d.domain}</code>
                  </Td>
                  <Td>{d.org_slug ?? <Missing>missing org</Missing>}</Td>
                  <Td>{d.is_primary ? "Yes" : "—"}</Td>
                  <Td>
                    {d.verified_at ? (
                      new Date(d.verified_at).toLocaleDateString()
                    ) : (
                      <span className="text-muted-foreground">Not recorded</span>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

function OrgsPanel({ orgs }: { orgs: OrgRow[] }) {
  return (
    <Panel
      title="Organisations"
      description="Every site on the network, with how it is served and how much is published."
    >
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <Th>Slug</Th>
              <Th>Name</Th>
              <Th>Tier</Th>
              <Th>Owner</Th>
              <Th>Members</Th>
              <Th>Published</Th>
              <Th>Layout</Th>
              <Th>Served on</Th>
            </tr>
          </thead>
          <tbody>
            {orgs.map((o) => (
              <tr key={o.id} className="border-t border-border align-top">
                <Td>
                  <code className="text-xs">{o.slug}</code>
                </Td>
                <Td>{o.name}</Td>
                <Td>
                  <span className="rounded-full border border-border px-2 py-0.5 text-xs">
                    {o.tier}
                  </span>
                </Td>
                <Td>
                  {o.owner_email ?? <Missing>none</Missing>}
                </Td>
                <Td className="tabular-nums">{o.member_count}</Td>
                <Td className="tabular-nums">
                  {o.published_count}
                  {o.draft_count > 0 && (
                    <span className="ml-1 text-xs text-muted-foreground">
                      +{o.draft_count} draft
                    </span>
                  )}
                </Td>
                <Td>
                  {o.layout_mode}
                  {o.layout_mode === "silex" && !o.silex_published && (
                    <Missing> unpublished</Missing>
                  )}
                </Td>
                <Td>
                  {o.domains.length > 0 ? (
                    <div className="flex flex-col gap-0.5">
                      {o.domains.map((d) => (
                        <code key={d} className="text-xs">
                          {d}
                        </code>
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      {o.slug}.{networkHost()}
                    </span>
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="whitespace-nowrap px-3 py-2 font-medium">{children}</th>;
}

function Td({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <td className={`px-3 py-2 ${className ?? ""}`}>{children}</td>;
}

function Missing({ children }: { children: React.ReactNode }) {
  return <span className="text-xs font-medium text-destructive">{children}</span>;
}

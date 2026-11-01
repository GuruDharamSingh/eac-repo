import type { Metadata } from "next";
import { HubCardGrid, HubLinkCard } from "@elkdonis/cms-ui/hubsite";
import { requireOrgMember } from "@/lib/auth";
import { HubPageShell } from "@/components/hub/HubPageShell";

export const metadata: Metadata = { title: "Group research · IFAC Hub" };
export const dynamic = "force-dynamic";

/**
 * Group research as a page (2026-10-10): where the Group research card goes,
 * on Cards 2 and, through `cardHref`, the card body on the classic hub (it
 * had no click target before). The same three doors as the card's tiles:
 * questionnaire and poll open their form on /hub/compose; "Arrange a time"
 * is declared, not built.
 */
export default async function HubResearchPage() {
  const viewer = await requireOrgMember("/hub/research");

  return (
    <HubPageShell
      userId={viewer.userId}
      crumbs={[{ label: "Hub", href: "/hub" }, { label: "Group research" }]}
      title="Group research"
      intro={<p>Put something to the membership, and read what comes back.</p>}
    >
      <HubCardGrid label="Ways to ask">
        <HubLinkCard
          href="/hub/compose?kind=questionnaire"
          glyph="▤"
          title="Questionnaire"
          blurb="A set of questions. Members answer on its own page."
        />
        <HubLinkCard
          href="/hub/compose?kind=poll"
          glyph="▥"
          title="Poll"
          blurb="One question, with a result bar."
        />
      </HubCardGrid>
      <section className="eac-hp-panel" aria-labelledby="research-time">
        <h2 id="research-time">Arrange a time</h2>
        <p>Finding when everyone is free is not built yet.</p>
      </section>
    </HubPageShell>
  );
}

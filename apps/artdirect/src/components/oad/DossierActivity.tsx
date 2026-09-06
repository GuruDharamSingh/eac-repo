import {
  getAuthoredThreads,
  getAuthoredMedia,
  listProfileOrgs,
  listOrgHomes,
} from "@elkdonis/services";

const NETWORK_URL = process.env.NEXT_PUBLIC_ARTS_COLLECTIVE_URL ?? "http://localhost:3007";

/**
 * What this person has actually done, across the whole network.
 *
 * The dossier above renders identity — name, bio, portrait, contacts. This is
 * the other half ArtDirect was missing: where they are published and what they
 * have filed. It is the only surface that asks those questions network-wide;
 * every other app asks "who are OUR people".
 *
 * Markup deliberately reuses the dossier template's own classes so it reads as
 * part of the same file rather than a React section bolted underneath.
 */
export async function DossierActivity({
  userId,
  viewerId,
}: {
  userId: string;
  viewerId?: string;
}) {
  const [orgs, threads, media, homes] = await Promise.all([
    listProfileOrgs(userId, { onlyPublic: true }),
    // viewerId is what unlocks drafts, and only when it equals userId.
    getAuthoredThreads(userId, { viewerId, limit: 50 }),
    getAuthoredMedia(userId, { limit: 12 }),
    listOrgHomes(),
  ]);

  if (orgs.length === 0 && threads.length === 0 && media.length === 0) return null;

  // Where each org lives: its verified custom domain, else its page on the
  // network. The tag on a dossier should take you there, not just name it.
  const homeByOrgId = new Map(
    homes.map((h) => [
      h.orgId,
      h.primaryDomain ? `https://${h.primaryDomain}` : `${NETWORK_URL}/sites/${h.orgSlug}`,
    ])
  );

  // Group filings under the org they were published on. An org the person is
  // published on but hasn't filed to still gets listed — absence is
  // information on a dossier.
  const byOrg = new Map<string, typeof threads>();
  for (const t of threads) {
    const list = byOrg.get(t.orgId) ?? [];
    list.push(t);
    byOrg.set(t.orgId, list);
  }

  const knownOrgIds = new Set(orgs.map((o) => o.orgId));
  const strayOrgIds = [...byOrg.keys()].filter((id) => !knownOrgIds.has(id));

  return (
    <div className="eac-dossier-network">
      <h2 className="eac-dos-section-title">FILED ACTIVITY</h2>

      {orgs.length > 0 && (
        <div className="eac-dos-network-block">
          <h3 className="eac-dos-network-sub">OPERATING UNDER:</h3>
          <div className="eac-dos-tags-container">
            {orgs.map((o) => (
              <a
                key={o.orgId}
                className="eac-dos-tag"
                href={homeByOrgId.get(o.orgId) ?? `${NETWORK_URL}/sites/${o.orgSlug}`}
                target="_blank"
                rel="noopener"
              >
                {o.orgName.toUpperCase()}
                {o.roleTitle ? ` — ${o.roleTitle.toUpperCase()}` : ""}
              </a>
            ))}
          </div>
        </div>
      )}

      {[...orgs.map((o) => o.orgId), ...strayOrgIds].map((orgId) => {
        const filings = byOrg.get(orgId);
        if (!filings?.length) return null;
        // Prefer the role-bearing profile name, else the org name the query
        // joined. An author can file to an org they hold no public profile on.
        const label =
          orgs.find((o) => o.orgId === orgId)?.orgName ?? filings[0].orgName;
        return (
          <div key={orgId} className="eac-dos-network-block">
            <h3 className="eac-dos-network-sub">{label.toUpperCase()}:</h3>
            <ul className="eac-dos-status-list">
              {filings.map((t) => (
                <li key={t.id}>
                  {t.title}
                  {t.status !== "published" ? " [UNFILED]" : ""}
                  {t.publishedAt
                    ? ` — ${new Date(t.publishedAt).toISOString().slice(0, 10)}`
                    : ""}
                </li>
              ))}
            </ul>
          </div>
        );
      })}

      {media.length > 0 && (
        <div className="eac-dos-network-block">
          <h3 className="eac-dos-network-sub">
            EVIDENCE ON FILE: {media.length}
          </h3>
        </div>
      )}
    </div>
  );
}

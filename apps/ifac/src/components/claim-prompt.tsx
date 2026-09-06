const ARTDIRECT_URL = process.env.NEXT_PUBLIC_ARTDIRECT_URL ?? "http://localhost:3013";

/**
 * "Is this you?" — the self-service half of the claim system (the other
 * half is the admin "Match to a member" control in directory-manager.tsx).
 * Claiming itself happens on ArtDirect, not here: that's the one place with
 * the claim/vouch/edit UI already built (packages/services/src/profiles.ts
 * — requestClaim/approveClaim), so this links out rather than duplicating
 * it. Signing in is handled by ArtDirect's own page — no login-gating
 * needed here.
 */
export function ClaimPrompt({ slug, claimStatus }: { slug: string; claimStatus?: "unclaimed" | "pending" | "claimed" }) {
  if (!claimStatus || claimStatus === "claimed") return null;

  return (
    <div className="claim-prompt">
      {claimStatus === "pending" ? (
        <p>A claim on this profile is awaiting review.</p>
      ) : (
        <p>
          Is this you?{" "}
          <a href={`${ARTDIRECT_URL}/${slug}`} target="_blank" rel="noreferrer">
            Claim this profile on ArtDirect ↗
          </a>
        </p>
      )}
    </div>
  );
}

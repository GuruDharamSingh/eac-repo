import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { renderDossier } from "@elkdonis/cms-bindings/dossier";
import {
  getDossierProfile,
  getDossierMeta,
  listDossierSlugs,
  hasVouched,
  isOadSteward,
} from "@/lib/oad";
import { getCurrentUser } from "@/lib/session";
import { DossierActions } from "@/components/oad/DossierActions";
import { DossierActivity } from "@/components/oad/DossierActivity";
import { StandardProfile } from "@/components/oad/StandardProfile";
import { ThemeStyle } from "@elkdonis/live-editor/theme";
import { getProfileBySlug } from "@elkdonis/services";
import { resolveLayout } from "@/lib/profile-layouts";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  const slugs = await listDossierSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const profile = await getDossierProfile(slug);
  if (!profile) return {};
  return {
    title: `${profile.name} — ArtDirect Dossier`,
    description: profile.bio ?? `Dossier on ${profile.name}.`,
  };
}

export default async function DossierPage({ params }: Props) {
  const { slug } = await params;
  const [profile, meta, user] = await Promise.all([
    getDossierProfile(slug),
    getDossierMeta(slug),
    getCurrentUser(),
  ]);
  if (!profile || !meta) notFound();

  const [steward, vouched] = await Promise.all([
    user ? isOadSteward(user.id) : Promise.resolve(false),
    user ? hasVouched(meta.id, user.id) : Promise.resolve(false),
  ]);

  // The person chooses how their own page is rendered — users.profile_layout.
  // resolveLayout falls back rather than throwing, so a value written before a
  // layout was retired still renders something.
  const identity = await getProfileBySlug(slug);
  const layout = resolveLayout(identity?.profileLayout);
  const useTemplate = layout !== "standard";

  const html = useTemplate ? renderDossier(profile, { archiveName: "ArtDirect" }) : null;

  return (
    <>
      {/* The dossier template carries its own fixed look, so a person's palette
          only reaches the standard page. Injected either way — harmless when
          the template ignores it, and it still themes DossierActivity below. */}
      <ThemeStyle userId={identity?.userId ?? null} precedence="user" />
      {useTemplate ? (
        <>
          {/* eslint-disable-next-line @next/next/no-head-element */}
          <link rel="stylesheet" href="/api/silex/templates/dossier.css" />
          <div dangerouslySetInnerHTML={{ __html: html! }} />
        </>
      ) : (
        identity && (
          <StandardProfile
            profile={identity}
            isSelf={Boolean(identity.userId && user?.id === identity.userId)}
          />
        )
      )}
      {/* Identity comes from the dossier template above; this is what they
          have actually published across the network. meta.id is the user id. */}
      <div style={{ paddingBottom: 64 }}>
        <DossierActivity userId={meta.id} viewerId={user?.id} />
      </div>
      <DossierActions
        slug={slug}
        signedIn={Boolean(user)}
        isSteward={steward}
        claimStatus={meta.claim_status}
        verified={meta.verified}
        vouchCount={meta.vouch_count}
        alreadyVouched={vouched}
        loginUrl={`/login?redirect=/${slug}`}
      />
    </>
  );
}

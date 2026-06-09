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

  const html = renderDossier(profile, { archiveName: "ArtDirect" });

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-head-element */}
      <link rel="stylesheet" href="/api/silex/templates/dossier.css" />
      <div style={{ paddingBottom: 64 }} dangerouslySetInnerHTML={{ __html: html }} />
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

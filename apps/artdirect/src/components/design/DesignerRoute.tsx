import { notFound } from "next/navigation";
import type { Data } from "@puckeditor/core";
import { PROFILE_TEMPLATE, SPOTLIGHT_TEMPLATE, templateDocument } from "@elkdonis/blocks";
import { loadUserPage } from "@elkdonis/page-builder/server";
import { canEditProfile, getProfileBySlug } from "@elkdonis/services";
import { ThemeStyle } from "@elkdonis/live-editor/theme";
import { getCurrentUser } from "@/lib/session";
import { resolveLayout } from "@/lib/profile-layouts";
import { PERSON_PAGE_ORG, draftKey, knownTypesFor, liveKey, loadPersonContext, type PersonPageKind } from "@/lib/person-pages";
import { PersonPageDesigner } from "./PersonPageDesigner";

/**
 * The server half of /<slug>/design and /<slug>/featured/design.
 *
 * Only the person themselves or a global admin (canEditProfile, with the
 * user from the session); anyone else, signed in or not, gets a 404, so the
 * route does not say whose pages have designs. Opens on the saved draft,
 * else the live page, else the template.
 */
export async function DesignerRoute({ slug, kind }: { slug: string; kind: PersonPageKind }) {
  const user = await getCurrentUser();
  if (!user) notFound();
  const identity = await getProfileBySlug(slug);
  if (!identity) notFound();
  if (!(await canEditProfile(user.id, identity.userId))) notFound();

  const known = knownTypesFor(kind);
  const [draft, live, context] = await Promise.all([
    loadUserPage(identity.userId, PERSON_PAGE_ORG, draftKey(kind), known),
    loadUserPage(identity.userId, PERSON_PAGE_ORG, liveKey(kind), known),
    loadPersonContext(slug, user.id),
  ]);
  if (!context) notFound();
  const published = live?.status === "published" ? live : null;

  const initial =
    (draft?.data as Data | undefined) ??
    (published?.data as Data | undefined) ??
    (templateDocument(kind === "profile" ? PROFILE_TEMPLATE : SPOTLIGHT_TEMPLATE) as unknown as Data);

  return (
    <>
      {/* The person's palette (frame colour and the like), so the canvas
          matches the published page. Puck copies it into the canvas iframe. */}
      <ThemeStyle userId={identity.userId} precedence="user" />
      <PersonPageDesigner
        kind={kind}
        slug={context.slug}
        displayName={identity.displayName}
        isSelf={user.id === identity.userId}
        initial={initial}
        context={context}
        state={published ? "published" : draft ? "draft" : "new"}
        dossierLayout={kind === "profile" && resolveLayout(identity.profileLayout) !== "standard"}
      />
    </>
  );
}

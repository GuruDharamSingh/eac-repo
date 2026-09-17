import { listWriting } from "@elkdonis/services";
import { blogOrgScopeFor } from "@/lib/cms/blog-actions";
import { WritingShelf, StartPiece } from "@elkdonis/cms-ui/writing";
import { siteConfig } from "@/config/site";
import { FRAME_THEME_VARS } from "@/lib/theme-tokens";
import { startPieceAction } from "@/lib/writing-actions";

/**
 * The writing section on a profile page — the first few pieces, and the way
 * in to the rest.
 *
 * Opt-in: the profile page only mounts this when the person has switched
 * "Writing" on in their hub (users.profile_sections.blog). Somebody who does
 * not write does not get an empty shelf on their page.
 *
 * The owner sees it even while it is empty, with the field to start a piece —
 * a section you turned on should show you what it is for.
 */
export async function WritingSection({
  profileUserId,
  profileSlug,
  kind,
  editable,
  limit = 4,
}: {
  profileUserId: string;
  profileSlug: string;
  kind: "artists" | "dealers";
  editable: boolean;
  limit?: number;
}) {
  const items = await listWriting(profileUserId, {
    // The page owner's scope — see blogOrgScopeFor.
    orgId: await blogOrgScopeFor(profileUserId),
    includeDrafts: editable,
    limit: limit + 1,
  });

  if (items.length === 0 && !editable) return null;

  const writingHref = `/${kind}/${profileSlug}/writing`;
  const shown = items.slice(0, limit);
  const more = items.length > limit;

  return (
    <section
      className="profile-writing"
      data-theme-vars={FRAME_THEME_VARS}
      data-theme-label="Writing"
    >
      <WritingShelf
        items={shown}
        basePath={writingHref}
        heading="Writing"
        showDrafts={editable}
        emptyNote={
          editable
            ? "Nothing here yet. Start a piece — it stays a draft until you publish it."
            : "Nothing published yet."
        }
      >
        {editable && (
          <StartPiece onCreate={startPieceAction.bind(null, profileUserId)} basePath={writingHref} />
        )}
        {more && (
          <p className="profile-writing-more">
            <a href={writingHref}>All writing →</a>
          </p>
        )}
      </WritingShelf>
    </section>
  );
}

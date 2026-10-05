import { listWriting, type WritingSummary } from "@elkdonis/services";
import { siteConfig } from "@/config/site";
import { WritingSection as SharedWritingSection, StartPiece } from "@elkdonis/cms-ui/writing";
import { FRAME_THEME_VARS } from "@/lib/theme-tokens";
import { startPieceAction } from "@/lib/writing-actions";

/**
 * The writing section on a profile page — IFAC's binding of the shared one.
 *
 * The section moved to @elkdonis/cms-ui/writing so every org gets the same
 * shelf, frame and owner affordances. What stays here is this app's: the read
 * and the server action behind "start a piece". The read is what IFAC shows:
 * pieces homed on IFAC or listed on it (thread_orgs), whatever the author's
 * old `blogScope` setting says. `.profile-writing` keeps IFAC's own framed black panel — the shared
 * default is a quiet token-driven one, and a host with a frame passes it in.
 */
export async function WritingSection({
  profileUserId,
  profileSlug,
  kind,
  editable,
  limit = 4,
  items: loaded,
}: {
  profileUserId: string;
  profileSlug: string;
  kind: "artists" | "dealers";
  editable: boolean;
  limit?: number;
  /** Already loaded (getPersonPage, `limit + 1` of them); read here when absent. */
  items?: WritingSummary[];
}) {
  const items =
    loaded ??
    (await listWriting(profileUserId, {
      orgId: siteConfig.orgId,
      includeDrafts: editable,
      limit: limit + 1,
    }));

  const writingHref = `/${kind}/${profileSlug}/writing`;

  return (
    <SharedWritingSection
      items={items}
      basePath={writingHref}
      editable={editable}
      limit={limit}
      className="profile-writing"
      themeVars={FRAME_THEME_VARS}
      themeLabel="Writing"
      startPiece={
        editable ? (
          <StartPiece
            onCreate={startPieceAction.bind(null, profileUserId)}
            basePath={writingHref}
          />
        ) : undefined
      }
    />
  );
}

import { renderForumRoute } from "@elkdonis/forum-ui";
import { getForumConnectors } from "@/lib/forum";

interface Props {
  params: Promise<{ segments?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * /forum — this org's slice of The Grand Forum, in this site's skin.
 *
 * No styling here: the board is plain CSS over custom properties, and
 * globals.css maps those onto InnerGathering's palette.
 */
export default async function ForumRoute({ params, searchParams }: Props) {
  const [{ segments = [] }, sp] = await Promise.all([params, searchParams]);
  return (
    <div className="gf-page">
      {await renderForumRoute({
        connectors: await getForumConnectors(),
        segments,
        searchParams: sp,
      })}
    </div>
  );
}

import { renderForumRoute } from "@elkdonis/forum-ui";
import { SiteNav } from "@/components/site-nav";
import { getForumConnectors } from "@/lib/forum";

interface Props {
  params: Promise<{ segments?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/** /forum — this org's slice of The Grand Forum, in this site's skin. */
export default async function ForumRoute({ params, searchParams }: Props) {
  const [{ segments = [] }, sp] = await Promise.all([params, searchParams]);
  return (
    <>
      <SiteNav />
      <div className="gf-page">
        {await renderForumRoute({ connectors: await getForumConnectors(), segments, searchParams: sp })}
      </div>
    </>
  );
}

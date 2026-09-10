import { renderForumRoute } from "@elkdonis/forum-ui";
import { getConnectors } from "@/lib/connectors";

/**
 * The whole forum is this one route. Every org, every feed, every thread —
 * the package decides what the segments mean; this file only says which
 * scope and where the links go (see lib/connectors.ts).
 */

interface Props {
  params: Promise<{ segments?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ForumRoute({ params, searchParams }: Props) {
  const [{ segments = [] }, sp] = await Promise.all([params, searchParams]);
  return renderForumRoute({ connectors: await getConnectors(), segments, searchParams: sp });
}

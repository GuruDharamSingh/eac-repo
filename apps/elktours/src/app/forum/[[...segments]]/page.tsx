import { renderForumRoute } from "@elkdonis/forum-ui";
import { getForumConnectors } from "@/lib/forum";
import { Split } from "@/components/mobile/split";
import { ForumHomePhone, ForumSectionPhone, ForumTopicPhone, isForumSection } from "@/components/mobile/forum-phone-server";
import "@/components/mobile/forum-m.css";

interface Props {
  params: Promise<{ segments?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * /forum: this org's slice of The Grand Forum.
 *
 * Phones (FORUM_SURFACE_PLAN.md): the cms-ui surface pattern. The home (/forum), a section (/forum/<section>) and a
 * topic page (/forum/t/<id>/<slug>) draw as the phone surfaces in components/mobile/forum-phone-server.tsx, beside the
 * unchanged forum-ui tree (`Split`: phone tree below md, forum-ui from md up). Every other forum-ui route (latest,
 * unread, topics, search, members, wiki, map) is the forum-ui page for everyone, restyled below md by forum-m.css
 * (scoped to `.gf-m`); the hidden `.elk-m` marker tells the shell this page has a phone layout.
 */
export default async function ForumRoute({ params, searchParams }: Props) {
  const [{ segments = [] }, sp] = await Promise.all([params, searchParams]);
  const connectors = await getForumConnectors();

  const phone =
    segments.length === 0 ? <ForumHomePhone />
    : segments.length === 1 && (await isForumSection(segments[0]!)) ? <ForumSectionPhone slug={segments[0]!} />
    : segments[0] === "t" && segments[1] ? <ForumTopicPhone id={segments[1]} />
    : null;

  const forumUi = await renderForumRoute({ connectors, segments, searchParams: sp });
  if (!phone) {
    return (
      <div className="gf-page gf-m">
        <span className="elk-m" hidden data-mobile-tree="" />
        {forumUi}
      </div>
    );
  }
  return <Split mobile={phone} desktop={<div className="gf-page">{forumUi}</div>} />;
}

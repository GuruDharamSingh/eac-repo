import Link from "next/link";
import type { Metadata } from "next";
import { Notice, PageHeader } from "@elkdonis/cms-ui/manage";
import { requireOrgEditor } from "@/lib/auth";
import { loadSiteStyle } from "@/lib/site-style";
import { courseUrl } from "@/config/site";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Site" };

/** The public site's look and its doors to the network (katie's Site tab, this site's rooms). */
export default async function ManageSite() {
  await requireOrgEditor("/manage/site");
  const style = await loadSiteStyle().catch(() => null);
  const styled = Boolean(style && (Object.keys(style.theme ?? {}).length || style.chrome));

  return (
    <>
      <PageHeader title="Site" description="How the public site looks, and where it connects to the network." />
      <div className="he-m-cols">
        <section className="he-m-card">
          <h2>Site style</h2>
          <p>
            Colours, the three centre hues of the figure, fonts and corners for the whole site: the header and footer,
            every block and the figure follow it. Press <b>Site style</b> at the bottom left of any public page (it shows
            for editors, not here), change a value, and see the page change before you save.
          </p>
          <Notice>{styled ? "A style is saved: the site differs from the house look." : "Nothing saved: the site wears the house look (Ario's ÆON draft)."}</Notice>
          <p className="he-m-actions">
            <Link className="he-btn he-primary" href="/">
              Open the site to style it
            </Link>
          </p>
        </section>
        <section className="he-m-card">
          <h2>A block&rsquo;s own look</h2>
          <p>
            In the page editor, click into a block and pick a part (a title, the wheel, the dossier) in the Look panel,
            or double-click the block to open it alone. A block&rsquo;s look wins over the site style for that block only.
          </p>
          <p className="he-m-actions">
            <Link className="he-btn" href="/studio">
              Page editor
            </Link>
          </p>
        </section>
        <section className="he-m-card">
          <h2>The network</h2>
          <ul className="he-m-plain">
            <li>
              <Link href="/hub">Hub</Link> <span className="he-m-fine">members&rsquo; room: chat, calendar, forum</span>
            </li>
            <li>
              <Link href="/center">Center</Link> <span className="he-m-fine">a follower&rsquo;s home for this site</span>
            </li>
            <li>
              <Link href="/channel">Channel</Link> <span className="he-m-fine">post to Facebook, Instagram and Threads, see where each went</span>
            </li>
            <li>
              <a href={courseUrl()}>Enneagram Foundations</a> <span className="he-m-fine">the course on Sophia (unlisted: reachable by link)</span>
            </li>
          </ul>
        </section>
      </div>
    </>
  );
}

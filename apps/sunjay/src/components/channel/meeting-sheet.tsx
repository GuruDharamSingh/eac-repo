import { listOrgFeeds } from "@elkdonis/services";
import { siteConfig } from "@/config/site";
import { MeetingSheetForm } from "./meeting-sheet-form";
import "./meeting-sheet.css";

/**
 * The meeting quick form for Channel's side sheet (`?sheet=edit&id=`), as ChannelSitePage's `editHere.render`
 * takes it: `{ id, closeHref, studioHref }`. A server component: it reads the org's feeds ("Goes on") the way
 * /manage/content/new does; the page has already checked that the viewer edits this site.
 */
export async function MeetingSheet({ id, closeHref, studioHref }: { id: string | null; closeHref: string; studioHref: string }) {
  const feeds = await listOrgFeeds(siteConfig.orgId, { includePrivate: true });
  if (feeds.length === 0) {
    return (
      <div className="sj-chform">
        <p className="sj-chform-eb">Edit here · meeting</p>
        <p>
          A meeting needs a page to go on. <a href="/manage/feeds">Add a page</a> first.
        </p>
      </div>
    );
  }
  return <MeetingSheetForm id={id} closeHref={closeHref} studioHref={studioHref} feeds={feeds.map((f) => ({ slug: f.slug, name: f.name }))} />;
}

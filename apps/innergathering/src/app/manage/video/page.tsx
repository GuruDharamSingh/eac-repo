import { listPipelineAssets, listVideoJobs, listVideoPipelines } from "@elkdonis/services";
import { VideoPipelinesView, type PipelineView } from "@/components/manage/video-pipelines";
import { siteConfig } from "@/config/site";

export const dynamic = "force-dynamic";

/**
 * Video pipelines: recordings dropped into a Nextcloud folder come back
 * edited (migration 147). The worker container does the work; this screen is
 * where a person checks the cut, fixes the title, trims by hand if the
 * automatic edit got it wrong, and approves it for publishing.
 */
export default async function ManageVideoPage() {
  const pipelines = await listVideoPipelines(siteConfig.orgId);
  const jobs = await listVideoJobs(siteConfig.orgId, { limit: 100 });
  const views: PipelineView[] = await Promise.all(
    pipelines.map(async (p) => ({
      pipeline: p,
      // A Nextcloud hiccup shouldn't take the page down; the assets list is a hint.
      assets: await listPipelineAssets(p).catch(() => []),
      jobs: jobs.filter((j) => j.pipelineId === p.id),
    }))
  );

  return (
    <>
      <h2 className="font-serif text-2xl">Video</h2>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
        Drop a meeting recording into a pipeline&apos;s folder in Nextcloud. Within a minute or two
        it is picked up, the silence at the start and end is cut, the volume is evened out and the
        intro and outro are joined on. The edited video lands in the folder&apos;s{" "}
        <em>3 Finished</em>, and shows up here to check. Publishing to YouTube isn&apos;t connected
        yet — approving a video marks it ready for when it is.
      </p>
      <VideoPipelinesView
        pipelines={views}
        nextcloudUrl={process.env.NEXT_PUBLIC_NEXTCLOUD_URL ?? null}
      />
    </>
  );
}

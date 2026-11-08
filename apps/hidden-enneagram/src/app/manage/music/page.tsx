import type { Metadata } from "next";
import { PageHeader } from "@elkdonis/cms-ui/manage";
import { db } from "@elkdonis/db";
import { requireOrgEditor } from "@/lib/auth";
import { siteConfig } from "@/config/site";
import { loadAudioConfig } from "@/lib/audio-config";
import { MusicSettings } from "@/components/manage/music-settings";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Music" };

/** Ario's background music (tracks, volume, pages) and the figure's sound defaults. */
export default async function ManageMusic() {
  await requireOrgEditor("/manage/music");
  const initial = await loadAudioConfig();
  const library = await db<{ id: string; url: string; filename: string }[]>`
    SELECT id, url, filename
    FROM media
    WHERE org_id = ${siteConfig.orgId} AND type = 'audio'
    ORDER BY created_at DESC
    LIMIT 100
  `.catch(() => []);

  return (
    <>
      <PageHeader
        title="Music"
        description="The background music visitors can choose to play, and how the figure on the page sounds."
      />
      <MusicSettings initial={initial} library={library.map((m) => ({ id: m.id, url: m.url, filename: m.filename }))} />
    </>
  );
}

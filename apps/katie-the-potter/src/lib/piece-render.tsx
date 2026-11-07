import { Render, resolveAllData } from "@puckeditor/core/rsc";
import type { Data } from "@puckeditor/core";
import { serverPuckConfig } from "@/lib/puck/config.server";
import { loadPage, PIECE_TEMPLATE } from "@/lib/puck/store";
import { DEFAULT_PIECE_DETAIL } from "@/lib/piece-template";
import { getViewer } from "@/lib/auth";
import { currentOrgId } from "@/lib/site-org";
import type { PieceDetail } from "@/lib/artworks";

const KNOWN_TYPES = new Set(Object.keys(serverPuckConfig.components));

/**
 * A piece's page, drawn from the piece-detail template: the published
 * document if there is one, else the code default. The route's piece and its
 * neighbours reach the blocks as `metadata.pieceDetail` (an unbound ktp-piece /
 * ktp-piece-details shows it; a "more" grid lists the neighbours), the same
 * channel the editor uses for `slug`.
 */
export async function renderPieceDetail(detail: PieceDetail, opts: { preview?: boolean; look?: string | null } = {}) {
  const stored = await loadPage(PIECE_TEMPLATE, KNOWN_TYPES).catch(() => null);
  const data = (stored?.data as Data | undefined) ?? (DEFAULT_PIECE_DETAIL as Data);
  const viewer = opts.preview ? null : await getViewer().catch(() => null);
  const resolved = await resolveAllData(data, serverPuckConfig, {
    orgId: currentOrgId(),
    slug: PIECE_TEMPLATE,
    pieceDetail: detail,
    hrefBase: opts.preview ? "/preview/pieces" : "/pieces",
    preview: Boolean(opts.preview),
    canEdit: Boolean(viewer?.canEdit),
  });
  return (
    <div className="ktp-content ktp-piece-page" data-site-look={opts.preview && opts.look ? opts.look : undefined}>
      <Render config={serverPuckConfig} data={resolved as Data} />
      {viewer?.canEdit ? (
        <a className="ktp-edit-page" href={`/studio/${PIECE_TEMPLATE}`}>
          Edit this template
        </a>
      ) : null}
    </div>
  );
}

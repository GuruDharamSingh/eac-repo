import { db } from "@elkdonis/db";
import { requireOrgEditor, getSiteOwnerUserId } from "@/lib/auth";
import { siteConfig } from "@/config/site";
import { updateArtwork } from "@/lib/artwork-actions";

// ============================================================================
// Her artworks, and how each is shown.
//
// The one place to answer "is this a piece for sale, or just a picture of my
// work?" — the question the Artworks, Plate and Image set blocks all read the
// answer to. Also where the working titles given to pieces during the move
// from her old site get confirmed or corrected: a title typed here is marked
// confirmed.
//
// Plain forms and a server action: works with no client script, and each row
// saves on its own.
// ============================================================================

export const dynamic = "force-dynamic";
export const metadata = { title: "Artworks" };

interface Row {
  id: string;
  title: string;
  year_created: number | null;
  status: string;
  site: string | null;
  title_confirmed: boolean | null;
  collections: string[] | null;
  image: string | null;
}

function modeOf(r: Row): "sale" | "portfolio" | "hidden" | "locked" {
  if (r.status === "sold" || r.status === "reserved") return "locked";
  if (r.status === "available") return "sale";
  return r.site === "portfolio" ? "portfolio" : "hidden";
}

export default async function ManageArtworksPage() {
  const viewer = await requireOrgEditor("/manage/artworks");
  const artistId = await getSiteOwnerUserId();
  const canChange = !!artistId && (viewer.userId === artistId || viewer.role === "owner");

  const rows = artistId
    ? await db<Row[]>`
        SELECT a.id, a.title, a.year_created, a.status,
               a.metadata->>'site' AS site,
               (a.metadata->>'title_confirmed')::boolean AS title_confirmed,
               ARRAY(SELECT jsonb_array_elements_text(COALESCE(a.metadata->'collections', '[]'::jsonb))) AS collections,
               COALESCE(pm.url, (SELECT url FROM artwork_media m WHERE m.artwork_id = a.id ORDER BY position LIMIT 1)) AS image
        FROM artwork a
        LEFT JOIN artwork_media pm ON pm.id = a.primary_image_id
        WHERE a.artist_user_id = ${artistId}
        ORDER BY COALESCE((a.metadata->>'position')::int, 1000), a.title
      `
    : [];

  const unconfirmed = rows.filter((r) => r.title_confirmed === false).length;
  const market = siteConfig.marketUrl.replace(/\/+$/, "");

  return (
    <article className="content-page dm-manage">
      <h1 className="page-title">Artworks</h1>
      <p>
        <strong>For sale</strong> — listed on the marketplace; the site shows the price and an
        enquire / buy link. <strong>Portfolio only</strong> — shown on the site as a picture of
        your work, not for sale, not on the marketplace. <strong>Hidden</strong> — nowhere.
      </p>
      <p>
        Sold and reserved pieces are changed in the{" "}
        <a href={`${market}/studio`} target="_blank" rel="noopener noreferrer">
          marketplace studio
        </a>
        , where their orders are.
        {unconfirmed ? (
          <>
            {" "}
            <strong>{unconfirmed}</strong> titles are working titles from the move — correct or
            re-save them to confirm.
          </>
        ) : null}
      </p>
      {!canChange ? <p><em>Only Dana or the site's owner can change these.</em></p> : null}

      <ul className="dm-manage-list">
        {rows.map((r) => {
          const mode = modeOf(r);
          return (
            <li key={r.id} className="dm-manage-row" data-mode={mode}>
              {r.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={r.image.startsWith("/api/media/") ? `${r.image}?w=256` : r.image}
                  alt=""
                  width={72}
                  height={72}
                  loading="lazy"
                />
              ) : (
                <span className="dm-manage-noimg" />
              )}
              <form action={updateArtwork} className="dm-manage-form">
                <input type="hidden" name="id" value={r.id} />
                <label className="dm-manage-title">
                  <span className="dm-sr">Title</span>
                  <input name="title" defaultValue={r.title} disabled={!canChange} />
                </label>
                <span className="dm-manage-meta">
                  {r.year_created ?? "—"}
                  {r.collections?.length ? ` · ${r.collections.join(", ")}` : ""}
                  {r.title_confirmed === false ? <em className="dm-manage-flag"> working title</em> : null}
                </span>
                {mode === "locked" ? (
                  <span className="dm-manage-locked">{r.status === "sold" ? "Sold" : "Reserved"}</span>
                ) : (
                  <label>
                    <span className="dm-sr">Shown as</span>
                    <select name="mode" defaultValue={mode} disabled={!canChange}>
                      <option value="sale">For sale</option>
                      <option value="portfolio">Portfolio only</option>
                      <option value="hidden">Hidden</option>
                    </select>
                  </label>
                )}
                {canChange ? <button type="submit">Save</button> : null}
              </form>
            </li>
          );
        })}
      </ul>
    </article>
  );
}

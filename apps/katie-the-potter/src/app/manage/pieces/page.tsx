import Link from "next/link";
import type { Metadata } from "next";
import { listStoreArtworks } from "@elkdonis/commerce/queries";
import { formatMoney } from "@elkdonis/commerce/money";
import { loadManageCtx } from "@/lib/manage";
import { sized } from "@/blocks/media";
import { RetireSamples, ShownAsControl } from "@/components/manage/piece-row-actions";
import type { ShownAs } from "@/lib/manage-actions";
import { EmptyState, Notice, PageHeader } from "@elkdonis/cms-ui/manage";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Pieces" };

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  available: "For sale",
  reserved: "Reserved",
  sold: "Sold",
  archived: "Archived",
};

/** Every piece in the store, in any status. */
export default async function ManagePieces() {
  const { store, canAct, isStoreOwner } = await loadManageCtx("/manage/pieces");
  if (!store) {
    return (
      <section className="ktp-m-card">
        <h2>No store yet</h2>
        <p>Pieces live in the store on Collect Art. Open it first (see Overview).</p>
      </section>
    );
  }

  const pieces = await listStoreArtworks(store.id);
  const samples = pieces.filter((p) => p.metadata?.sample === true || p.metadata?.sample === "true");
  const retirable = samples.filter((p) => p.status === "draft" || p.status === "available").length;

  return (
    <>
      <PageHeader
        title="Pieces"
        description={<>{pieces.length} piece{pieces.length === 1 ? "" : "s"} in the store. &ldquo;Shown as&rdquo; decides what the public site does with each one.</>}
        actions={
          canAct ? (
            <Link className="ktp-btn" href="/manage/pieces/new">
              Add a piece
            </Link>
          ) : null
        }
      />

      {!canAct ? <Notice>You can look, but only the store&rsquo;s owner or its team can change pieces.</Notice> : null}

      {isStoreOwner ? <RetireSamples count={retirable} /> : null}

      {pieces.length === 0 ? (
        <EmptyState
          title="No pieces yet"
          body="Add the first one: a title, a price and a picture is enough to put it on sale."
          action={
            canAct ? (
              <Link className="ktp-btn" href="/manage/pieces/new">
                Add a piece
              </Link>
            ) : null
          }
        />
      ) : (
        <ul className="ktp-m-list">
          {pieces.map((p) => {
            const v = p.variants?.[0];
            const portfolio = p.metadata?.site === "portfolio";
            const shownAs: ShownAs | null =
              p.status === "available" ? "sale" : p.status === "archived" || p.status === "draft" ? (portfolio ? "portfolio" : p.status === "archived" ? "hidden" : null) : null;
            const locked = p.status === "reserved" || p.status === "sold";
            const isSample = p.metadata?.sample === true || p.metadata?.sample === "true";
            const badge = p.status === "draft" && portfolio ? "Picture only" : (STATUS_LABEL[p.status] ?? p.status);
            return (
              <li key={p.id} className="ktp-m-row" data-status={p.status}>
                <Link className="ktp-m-thumb" href={`/manage/pieces/${p.id}`}>
                  {p.primaryImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={sized(p.primaryImageUrl, 256)} alt="" loading="lazy" />
                  ) : null}
                </Link>
                <div className="ktp-m-row-main">
                  <Link className="ktp-m-row-title" href={`/manage/pieces/${p.id}`}>
                    {p.title}
                  </Link>
                  <p className="ktp-m-row-meta">
                    <span className="ktp-m-badge" data-tone={p.status}>
                      {badge}
                    </span>
                    {isSample ? <span className="ktp-m-badge" data-tone="sample">Sample</span> : null}
                    <span className="ktp-m-price">{v && v.priceMinor > 0 ? formatMoney(v.priceMinor, v.currency) : "Price on request"}</span>
                    {p.yearCreated ? <span>{p.yearCreated}</span> : null}
                  </p>
                </div>
                <div className="ktp-m-row-side">
                  {canAct ? (
                    locked ? (
                      <p className="ktp-m-fine">Has an order behind it. See Orders.</p>
                    ) : (
                      <ShownAsControl id={p.id} current={shownAs} />
                    )
                  ) : null}
                  <p className="ktp-m-row-links">
                    <Link href={`/manage/pieces/${p.id}`}>{canAct && !locked ? "Edit" : "View"}</Link>
                    {p.status === "available" || p.status === "reserved" || p.status === "sold" ? <Link href={`/pieces/${p.slug}`}>On the site</Link> : null}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

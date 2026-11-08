import Link from "next/link";
import { getPayoutIdentity } from "@elkdonis/commerce/server";
import { isCardPaymentAvailable } from "@elkdonis/checkout/stripe";
import { loadManageCtx } from "@/lib/manage";
import { orderCounts, pieceCounts } from "@/lib/manage-data";
import { Notice, PageHeader } from "@elkdonis/cms-ui/manage";
import { SAMPLE_CARD_GUARD } from "@/lib/sample-guard";
import { PictureFolderNotice } from "@/components/picture-folder-notice";

export const dynamic = "force-dynamic";

/** Overview: where the shop stands and what needs doing. */
export default async function ManageOverview({ searchParams }: { searchParams: Promise<{ claimed?: string }> }) {
  const { claimed } = await searchParams;
  const { viewer, store, canAct, isStoreOwner } = await loadManageCtx("/manage");
  const welcome = claimed ? <Notice>Welcome. The shop is yours now. Start with Payouts, so sales can reach you.</Notice> : null;

  if (!store) {
    return (
      <>
      {welcome}
      <PageHeader title="Overview" />
      <section className="ktp-m-card">
        <h2>The shop has no store yet</h2>
        <p>
          Pieces are sold through a store on Collect Art, the collective&rsquo;s marketplace, and this site reads it. It is opened once, from the owner&rsquo;s
          account (apply for a store, then it is approved), and nothing is created for you automatically. Until then the public site shows its empty state.
        </p>
        <p className="ktp-m-fine">
          The one-time commands are in <code>apps/katie-the-potter/scripts/seed-katie.md</code>.
        </p>
        <p className="ktp-m-actions">
          <Link className="ktp-btn" href="/studio">
            Edit the site
          </Link>
          <Link className="ktp-btn ktp-btn--ghost" href="/">
            View site
          </Link>
        </p>
      </section>
      </>
    );
  }

  const [pieces, orders, identity] = await Promise.all([
    pieceCounts(store.id),
    orderCounts(store.id),
    store.ownerUserId ? getPayoutIdentity(store.ownerUserId).catch(() => null) : Promise.resolve(null),
  ]);
  const payout = identity?.stripeOnboardedAt
    ? { label: "Stripe connected", tone: "ok", note: "Card sales pay out automatically." }
    : identity?.stripeAccountId
      ? { label: "Stripe set up, not finished", tone: "warn", note: "Sales still go through; your share is held until Stripe is done." }
      : identity?.payoutMethod === "etransfer" && identity.payoutEmail
        ? { label: `eTransfer to ${identity.payoutEmail}`, tone: "ok", note: isCardPaymentAvailable() ? "Add Stripe to take card sales directly." : "" }
        : { label: "Not set up", tone: "warn", note: "Say where you are and how you want to be paid." };

  return (
    <>
      {welcome}
      {store.ownerUserId ? <PictureFolderNotice userId={store.ownerUserId} /> : null}
      <PageHeader
        title="Overview"
        description="Where the shop stands and what needs doing."
        actions={
          canAct ? (
            <Link className="ktp-btn" href="/manage/pieces/new">
              Add a piece
            </Link>
          ) : null
        }
      />
      {store.status !== "active" ? (
        <Notice>
          The store is <b>{store.status}</b>. Pieces and orders open once it is active.
        </Notice>
      ) : !canAct ? (
        <Notice>
          You can look around, but only the store&rsquo;s owner or its team can change pieces and orders.{isStoreOwner ? "" : " You are not on this store’s team."}
        </Notice>
      ) : null}

      <div className="ktp-m-tiles">
        <Link className="ktp-m-tile" href="/manage/pieces">
          <span className="ktp-m-tile-n">{pieces.forSale}</span>
          <span className="ktp-m-tile-l">for sale</span>
          <span className="ktp-m-tile-s">
            {pieces.drafts} draft{pieces.drafts === 1 ? "" : "s"} · {pieces.reserved} reserved
          </span>
        </Link>
        <Link className="ktp-m-tile" href="/manage/pieces">
          <span className="ktp-m-tile-n">{pieces.sold}</span>
          <span className="ktp-m-tile-l">sold</span>
          <span className="ktp-m-tile-s">{pieces.portfolio} shown as pictures only</span>
        </Link>
        <Link className="ktp-m-tile" href="/manage/orders?status=awaiting" data-hot={orders.awaitingEtransfer > 0 ? "true" : undefined}>
          <span className="ktp-m-tile-n">{orders.awaitingEtransfer}</span>
          <span className="ktp-m-tile-l">eTransfer{orders.awaitingEtransfer === 1 ? "" : "s"} to confirm</span>
          <span className="ktp-m-tile-s">orders waiting for payment to arrive</span>
        </Link>
        <Link className="ktp-m-tile" href="/manage/orders?status=paid" data-hot={orders.paidToShip > 0 ? "true" : undefined}>
          <span className="ktp-m-tile-n">{orders.paidToShip}</span>
          <span className="ktp-m-tile-l">paid, to ship</span>
          <span className="ktp-m-tile-s">mark each shipped once it goes</span>
        </Link>
      </div>

      {pieces.samples > 0 ? (
        <Notice>
          {pieces.samples} <b>sample</b> piece{pieces.samples === 1 ? " is" : "s are"} still on the site{SAMPLE_CARD_GUARD ? ". Card payment is refused for samples; retire them under" : " and can be bought, by card too. Retire them under"}{" "}
          <Link href="/manage/pieces">Pieces</Link> {SAMPLE_CARD_GUARD ? "when real work is listed." : "before real buyers arrive."}
        </Notice>
      ) : null}

      <div className="ktp-m-cols">
        <section className="ktp-m-card">
          <h2>Getting paid</h2>
          <p className="ktp-m-status" data-tone={payout.tone}>
            {payout.label}
          </p>
          {payout.note ? <p className="ktp-m-fine">{payout.note}</p> : null}
          <p className="ktp-m-actions">
            <Link className="ktp-btn ktp-btn--ghost" href="/manage/payouts">
              Payouts
            </Link>
          </p>
        </section>

        <section className="ktp-m-card">
          <h2>Sharing</h2>
          <p className="ktp-m-fine">
            Post your pieces to Instagram and Facebook from Channel, on arts-collective.com. Connect your accounts there once, then make your Page the shop's channel.
          </p>
          <p className="ktp-m-actions">
            <a className="ktp-btn" href="/channel?to=outlets">
              Connect Instagram and Facebook
            </a>
            <a className="ktp-btn ktp-btn--ghost" href="/channel">
              Open Channel
            </a>
          </p>
        </section>

        <section className="ktp-m-card">
          <h2>Shortcuts</h2>
          <p className="ktp-m-actions">
            <Link className="ktp-btn" href="/manage/pieces/new">
              Add a piece
            </Link>
            <Link className="ktp-btn ktp-btn--ghost" href="/studio">
              Edit the site
            </Link>
            <Link className="ktp-btn ktp-btn--ghost" href="/">
              View site
            </Link>
          </p>
          <p className="ktp-m-fine">Signed in as {viewer.email}.</p>
        </section>
      </div>
    </>
  );
}

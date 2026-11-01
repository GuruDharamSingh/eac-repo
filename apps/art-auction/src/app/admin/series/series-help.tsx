import type { AuctionSeries } from "@elkdonis/commerce/queries";
import type { IncrementStep } from "@elkdonis/commerce/server";

/**
 * The Help tab (ORG_STORE_BRIEF D10): what a series is, the parts of a lot,
 * who sets what, the money rules and the timeline, in plain words. Server
 * component; reads the live settings so the figures are the ones in force.
 */
export function SeriesHelp({
  series,
  commissionPercent,
  ladder,
}: {
  series: AuctionSeries;
  commissionPercent: number;
  ladder: IncrementStep[];
}) {
  const money = (minor: number) => `$${(minor / 100).toLocaleString("en-CA")}`;
  const fmt = (d: string | null) => (d ? new Date(d).toLocaleString("en-CA", { dateStyle: "long", timeStyle: "short" }) : "not set");
  return (
    <div className="prose prose-sm max-w-3xl dark:prose-invert">
      <h3>What a series is</h3>
      <p>
        A series is one seasonal auction. It has a landing page (card, description, the weeks and
        their focus), a desk team that runs it, and the lots in it. Its three dates set every lot&rsquo;s
        clock, so nobody sets times on individual lots.
      </p>

      <h3>The timeline</h3>
      <ol>
        <li><strong>Announce</strong> ({fmt(series.announceAt)}): the landing page is public. No lots are shown yet.</li>
        <li><strong>Bidding opens</strong> ({fmt(series.silentOpensAt)}): every lot in the series opens at once. This is the silent auction: bids are visible, there is no auctioneer, and anyone registered may bid until the close.</li>
        <li>
          <strong>Live close</strong> ({fmt(series.liveAt)}):{" "}
          {series.closeMode === "staggered"
            ? `lots close one after another, ${series.staggerSeconds} seconds apart in lot-number order, so one person can follow them on the presenter page.`
            : "every lot closes at the same moment."}{" "}
          A bid in the last {series.softCloseMinutes} minutes of a lot extends that lot by {series.softCloseMinutes} minutes.
        </li>
        <li><strong>After the close</strong>: each winner receives an order and has {series.paymentWindowHours} hours to pay by card or e-Transfer. If they do not, the lot passes and the piece goes back on sale.</li>
      </ol>

      <h3>The parts of a lot</h3>
      <ul>
        <li><strong>Starting bid</strong>: the first acceptable bid. Usually 30–50% of the estimate.</li>
        <li><strong>Reserve</strong> (optional): the lowest price the seller will accept. Hidden; the page says &ldquo;reserve met&rdquo; or &ldquo;reserve not met&rdquo;. If bidding ends below it, the lot passes.</li>
        <li><strong>Estimate</strong>: a low–high range shown on the lot. Set on the piece itself.</li>
        <li>
          <strong>Increment</strong>: how much each bid must rise. By default the ladder:{" "}
          {ladder.map((s, i) => (
            <span key={i}>
              {i > 0 ? " · " : ""}
              {s.upTo != null ? `up to ${money(s.upTo)} → ${money(s.step)}` : `above → ${money(s.step)}`}
            </span>
          ))}
          . A lot may use a flat amount instead.
        </li>
        <li><strong>Maximum (proxy) bid</strong>: a bidder may leave the most they are willing to pay. The system bids for them one increment above the next highest maximum, never past their own. Equal maximums go to the earlier one.</li>
        <li><strong>Buy-now</strong> (optional): a price at which a buyer can take the piece before anyone bids. It disappears with the first bid.</li>
        <li><strong>Soft close</strong>: a late bid extends the lot, so a last-second bid cannot win by timing alone.</li>
      </ul>

      <h3>Who sets what</h3>
      <table>
        <thead><tr><th>Setting</th><th>Set by</th></tr></thead>
        <tbody>
          <tr><td>Starting bid, reserve, buy-now, flat increment, estimate</td><td>The artist or the store listing the piece</td></tr>
          <tr><td>Which lots are in the series, and their order</td><td>The desk (this page, Lots tab)</td></tr>
          <tr><td>Dates, close mode, stagger, soft close, payment window</td><td>The desk (Details tab)</td></tr>
          <tr><td>The default ladder and commission</td><td>The marketplace admin (Admin → Money)</td></tr>
        </tbody>
      </table>

      <h3>Who may bid</h3>
      <p>
        A signed-in member who has registered: a phone number and a card on file. The card is not
        charged automatically; it is held against unpaid wins. Bidders appear on public pages as paddle
        numbers, never by name.
      </p>

      <h3>The money</h3>
      <ul>
        <li>The buyer pays the hammer price. The artist receives it less the collective&rsquo;s commission ({commissionPercent}%) and the card fee when paid by card.</li>
        <li>At checkout the buyer chooses where the commission goes: the marketplace, IFAC, Elkdonis Arts Collective, or a split.</li>
        <li>A piece listed for a charity sends all proceeds (less card fees) to that charity, or only the commission, as the listing says. The collective holds the money and pays it over; the buyer receives a statement of proceeds, not a tax receipt.</li>
        <li>Everything passes through the collective&rsquo;s one Stripe account; artists who have set up payouts are paid directly, the rest are paid out by hand from Admin → Money.</li>
      </ul>

      <h3>The desk</h3>
      <p>
        Editors change everything on this page. Contributors are listed for the desk and write
        articles and week content, but edit nothing here. Participants can see the series they are
        in, and attach or create publications for it, from My art.
      </p>
    </div>
  );
}

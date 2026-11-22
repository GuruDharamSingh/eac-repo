import "./he-mock.css";

const FACTS = [
  ["Kind", "One to one"],
  ["Length", "90 minutes"],
  ["Where", "Online"],
  ["Price", "CA$120 to CA$180"],
];

export default function Mock() {
  return (
    <article className="blk he-svc">
      <a href="#mock" className="he-svc-back">
        ← Readings
      </a>
      <header className="he-svc-head">
        <p className="he-eyebrow">A reading</p>
        <h1 className="he-svc-title">A Sample Reading</h1>
        <p className="he-svc-sub">A sitting with the figure, for one person</p>
      </header>
      <div className="he-orb" data-size="small" aria-hidden="true" />
      <dl className="he-svc-facts">
        {FACTS.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      <div className="he-svc-body">
        <p>A sample description of the service. It says what happens in the session, who it suits and what to bring, in the author&apos;s own words.</p>
        <p>A second paragraph carries on with how the time is spent and what follows after.</p>
      </div>
      <section className="he-svc-book" aria-label="Booking" id="book">
        <div className="he-svc-pay">
          <p className="he-svc-price">CA$120.00 – CA$180.00</p>
          <label className="he-svc-amount">
            <span>What you will pay (CAD)</span>
            <input type="number" className="he-input" defaultValue={180} readOnly />
            <span className="he-svc-note">A sliding scale: pay what fits inside it.</span>
          </label>
          <button type="button" className="he-btn he-primary he-svc-cta">
            Book and pay
          </button>
          <p className="he-svc-small">You pay on a secure card page, then suggest times that suit you.</p>
        </div>
      </section>
    </article>
  );
}

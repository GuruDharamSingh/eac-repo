import "./he-mock.css";

export default function Mock() {
  return (
    <section className="blk he-person">
      <div className="he-person-in">
        <figure className="he-person-portrait">
          <div className="he-orb" data-size="small" aria-hidden="true" />
        </figure>
        <div className="he-person-copy">
          <p className="he-eyebrow">About</p>
          <h2 className="he-band-title">A Sample Teacher</h2>
          <p className="he-person-role">Enneagram guide · A Sample City</p>
          <div className="he-person-bio">
            <p>A sample statement: a few sentences in the guide&apos;s own voice about how they came to the work and what a reading with them is like.</p>
          </div>
          <p className="he-person-links">
            <a href="#mock">Newsletter</a>
            <a href="#mock">Podcast</a>
          </p>
          <p className="he-band-more">
            <a href="#mock">Read more →</a>
          </p>
        </div>
      </div>
    </section>
  );
}

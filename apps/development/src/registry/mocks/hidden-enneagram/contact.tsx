import { BandHead } from "./parts";

export default function Mock() {
  return (
    <section className="blk he-contact" id="contact">
      <BandHead eyebrow="Contact" title="Write to the owner" />
      <form className="he-contact-form" onSubmit={(e) => e.preventDefault()}>
        <label>
          <span>Your name</span>
          <input name="name" className="he-input" readOnly />
        </label>
        <label>
          <span>Email</span>
          <input name="email" type="email" className="he-input" readOnly />
        </label>
        <label className="he-contact-wide">
          <span>Message</span>
          <textarea name="message" className="he-input" rows={5} readOnly />
        </label>
        <button type="button" className="he-btn he-primary">
          Send
        </button>
      </form>
    </section>
  );
}

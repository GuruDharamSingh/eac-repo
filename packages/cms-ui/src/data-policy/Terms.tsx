/**
 * The network's Terms and Acceptable Use (2026-11-01), the text behind the
 * `network-terms` agreement (migration 223). Written for members, in the
 * same register as the data policy. Hosts wrap it in their page frame and
 * import data-policy.css.
 */
export interface TermsProps {
  orgName: string;
  host: string;
  contactEmail: string;
  /** ISO date of this version. */
  updated: string;
  version: number;
  dataHref?: string;
}

export function Terms({ orgName, host, contactEmail, updated, version, dataHref = "/data" }: TermsProps) {
  return (
    <div className="eac-policy">
      <section>
        <h2>What these terms are</h2>
        <p>
          {orgName} runs {host} and a network of sites on one platform. These terms say what you may do on it,
          what we do for you, and who answers for what. By creating an account you accept them. They go with our{" "}
          <a href={dataHref}>data policy</a>, which says what we keep about you.
        </p>
      </section>

      <section>
        <h2>You are the publisher</h2>
        <ul>
          <li>What you publish on the network, under your own name, a pen name or an organisation you may speak for, is yours and is published by you. You must hold the rights to it.</li>
          <li>When you connect an outside account (a Facebook Page, an Instagram account, a Threads profile, a YouTube channel) and send something there from the Studio, you are the one publishing it there. We carry it for you.</li>
          <li>We act on your keys only when you ask: a post you send, item by item, or a schedule you set yourself. We never post on our own initiative, and every use is written to a log you can read under Connections.</li>
          <li>You can withdraw at any time: remove a connection, delete a post, or ask us to delete your account. Removing a connection deletes the stored token; for Facebook we also tell Meta to withdraw the app&rsquo;s access.</li>
        </ul>
      </section>

      <section>
        <h2>Acceptable use</h2>
        <p>Do not publish, here or through a connected account:</p>
        <ul>
          <li>anything unlawful, or that you have no right to publish;</li>
          <li>anything that targets a person: harassment, threats, private details, impersonation;</li>
          <li>spam, or content whose purpose is to mislead;</li>
          <li>anything that breaks the rules of the platform it is sent to.</li>
        </ul>
        <p>
          We may remove content that breaks these rules and, for repeated or serious breaches, close the account.
          Where we can, we tell you first.
        </p>
      </section>

      <section>
        <h2>Organisations</h2>
        <ul>
          <li>An organisation on the network is run by its owners and guides. They decide who may post under its name and which outside accounts are its channels.</li>
          <li>A post under an organisation&rsquo;s name goes out through the member&rsquo;s own connection, never through a shared key.</li>
          <li>An organisation may stop a member from posting under its name at any time. The member&rsquo;s own account and connections are unaffected.</li>
        </ul>
      </section>

      <section>
        <h2>What we are not</h2>
        <p>
          We are the host and the tool, not the publisher of your work and not a party to anything you agree with
          an outside platform. The platforms&rsquo; own terms apply to what you send them. We give no warranty that
          a platform will accept a post or keep it up.
        </p>
      </section>

      <section>
        <h2>Changes</h2>
        <p>
          This is version {version}, last changed on <time dateTime={updated}>{updated}</time>. When the terms change
          in a way that matters, signed-in members are asked to accept the new version. Questions go to{" "}
          <a href={`mailto:${contactEmail}`}>{contactEmail}</a>.
        </p>
      </section>
    </div>
  );
}

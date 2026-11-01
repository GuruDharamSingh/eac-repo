import type { ReactNode } from "react";

export interface DataPolicyProps {
  /** The organisation this site belongs to, as written on the site. */
  orgName: string;
  /** The public host, e.g. "elkdonis-arts.org". */
  host: string;
  /** Where a request for a copy, a correction or deletion goes. */
  contactEmail: string;
  /** The deletion page on this site; default "/data/delete". */
  deleteHref?: string;
  /** ISO date of the last change to the policy text. */
  updated: string;
  /** Rendered between the heading and the sections (a site's own opening). */
  intro?: ReactNode;
}

/**
 * The data policy shared by the network's sites (2026-10-29). Every
 * statement is a fact about the platform as deployed, or a commitment the
 * collective has made; the facts are cited in packages/cms-ui/src/data-policy/README.md.
 * Hosts wrap it in their own page frame and import data-policy.css.
 */
export function DataPolicy({ orgName, host, contactEmail, deleteHref = "/data/delete", updated, intro }: DataPolicyProps) {
  return (
    <div className="eac-policy">
      {intro}

      <section>
        <h2>Who we are</h2>
        <p>
          {orgName} is a not-for-profit based in Toronto, Canada. It runs {host} and a network of
          sites for arts groups, study groups and artists on one shared platform, with one sign-in and one
          file store. This page says what the platform keeps about you, why, and how to have it removed.
          Questions go to <a href={`mailto:${contactEmail}`}>{contactEmail}</a>.
        </p>
      </section>

      <section>
        <h2>What we hold</h2>
        <ul>
          <li>
            <strong>Your account.</strong> An email address and a password, or a Google account if you sign
            in with Google. Optionally a display name, pronouns, a city, a short bio, an avatar and links you
            add to your profile. Which groups on the network you belong to and in what role.
          </li>
          <li>
            <strong>What you publish.</strong> Posts, comments, writing, images and recordings you put on a
            site, with the time you posted them. Public posts are visible to anyone; members-only posts are
            visible to the group.
          </li>
          <li>
            <strong>Your files.</strong> Files you upload or share go to the collective&rsquo;s own Nextcloud
            server. Anything under a <em>Private</em> folder is visible only to people you share it with.
          </li>
          <li>
            <strong>Attendance and bookings.</strong> RSVPs, reading-circle and workshop sign-ups, and orders,
            so organisers know who is coming and what was paid.
          </li>
          <li>
            <strong>Payments.</strong> Card payments are taken by Stripe. Card numbers never reach our servers.
            We keep the order: what was bought, the amount, your name and email, and Stripe&rsquo;s reference.
          </li>
          <li>
            <strong>Messages and mail.</strong> Messages you send through a contact form, replies you send to
            our emails, and a record of which emails we sent you and whether they were delivered.
          </li>
        </ul>
      </section>

      <section>
        <h2>Cookies</h2>
        <p>
          A signed-in visit uses one session cookie, set by this host only. Moving between network sites sets a
          short-lived cookie that notes the sign-in was carried over; it expires within a day. There are no
          advertising or tracking cookies.
        </p>
      </section>

      <section>
        <h2>Counting visits</h2>
        <p>
          Page views are counted by our own collector, without cookies. Your IP address is turned into a
          one-day identifier and is not stored, so visits cannot be joined across days or sites. Browsers
          that send Do Not Track or Global Privacy Control are not counted at all. For private member
          content only the time, device type and country are kept, never the page.
        </p>
      </section>

      <section>
        <h2>Services we rely on</h2>
        <ul>
          <li><strong>Google</strong>, only if you choose to sign in with it. Google tells us your email and name.</li>
          <li><strong>Stripe</strong> for card payments and payouts to artists.</li>
          <li><strong>SendGrid</strong> (Twilio) to deliver our email. Every newsletter carries an unsubscribe link that works in one click.</li>
          <li><strong>Meta</strong>: see the next section.</li>
        </ul>
        <p>
          Nextcloud, the database and the sites themselves run on the collective&rsquo;s own server. We do not
          sell your data and we do not pass it to advertisers.
        </p>
      </section>

      <section>
        <h2>Facebook and Instagram</h2>
        <p>
          The collective runs Meta apps so that posts written here can be published to Facebook Pages, Instagram
          accounts and Threads profiles. Two things use them:
        </p>
        <ul>
          <li>
            <strong>The collective&rsquo;s own Page and account.</strong> When an organiser publishes a post from
            a site to them, the text and images of that post are sent to Meta.
          </li>
          <li>
            <strong>Your own Page or account.</strong> From the Studio on arts-collective.com you can connect a
            Facebook Page, Instagram professional account or Threads profile you manage and publish your own work to it. To do
            this Meta gives us your name, the id of your account, the Pages and accounts you chose, and an
            access token. We store these only to publish what you ask us to publish, and never post on our own
            initiative. Disconnecting in Studio deletes the token and ids. So does removing the app from your
            Facebook settings, which sends us a deletion request that we carry out on our{" "}
            <a href={deleteHref}>data deletion page</a>.
          </li>
        </ul>
        <p>We do not use Facebook, Instagram or Threads for sign-in, and we receive nothing about your friends, followers or activity there.</p>
      </section>

      <section>
        <h2>How long we keep it</h2>
        <p>
          Your account and what you have published stay until you ask us to remove them. Order records are
          kept for the period Canadian tax rules require. Nightly backups of the database are kept for two
          weeks, and one copy a month for a year; a deleted record disappears from them on that schedule.
        </p>
      </section>

      <section>
        <h2>Your choices</h2>
        <ul>
          <li>You can read and change your profile from your account page on any network site.</li>
          <li>You can ask for a copy of your files and everything you have published; we send it as files.</li>
          <li>You can ask for a correction of anything we hold.</li>
          <li>
            You can ask us to delete your account and data: see <a href={deleteHref}>deleting your data</a>.
          </li>
          <li>You can stop any newsletter with the link at the bottom of it.</li>
        </ul>
        <p>
          Write to <a href={`mailto:${contactEmail}`}>{contactEmail}</a> for any of these. We answer within
          thirty days.
        </p>
      </section>

      <section>
        <h2>Changes</h2>
        <p>
          This page was last changed on <time dateTime={updated}>{updated}</time>. When it changes in a way
          that matters, signed-in members are told on their next visit.
        </p>
      </section>
    </div>
  );
}

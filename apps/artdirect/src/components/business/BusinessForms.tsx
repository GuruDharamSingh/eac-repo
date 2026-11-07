"use client";

import { useActionState } from "react";
import { claimBusinessAction, requestBusinessRemovalAction, type BusinessActionState } from "@/lib/business-actions";
import styles from "./BusinessShellPage.module.css";

/** "Is this your business? Claim it" and "Ask us to remove it" for an unclaimed listing. */
export function BusinessForms({ businessUserId, businessName, stewardName, signedIn, slug }: { businessUserId: string; businessName: string; stewardName: string | null; signedIn: boolean; slug: string }) {
  const [claim, claimAction, claiming] = useActionState<BusinessActionState, FormData>(claimBusinessAction, null);
  const [removal, removalAction, removing] = useActionState<BusinessActionState, FormData>(requestBusinessRemovalAction, null);
  return (
    <section className={styles.section} id="claim">
      <h2>Is this your business?</h2>
      <details className={styles.details}>
        <summary>Claim it</summary>
        {signedIn ? (
          claim?.ok ? (
            <p className={styles.ok}>{claim.message}</p>
          ) : (
            <form action={claimAction} className={styles.form}>
              <input type="hidden" name="businessUserId" value={businessUserId} />
              <label>
                How can we check that {businessName} is yours?
                <select name="method" required defaultValue="">
                  <option value="" disabled>
                    Choose…
                  </option>
                  <option value="domain_email">An email from the business&rsquo;s own web address</option>
                  <option value="phone">Call me back on the business&rsquo;s public number</option>
                  <option value="document">I can send a document (Kbis, lease, invoice)</option>
                  <option value="in_person">{stewardName ? `${stewardName} knows me / met me in person` : "Someone from the steward met me in person"}</option>
                </select>
              </label>
              <label>
                Your role there
                <input name="role" maxLength={200} placeholder="Owner, manager…" />
              </label>
              <label>
                Business email or phone for the check
                <input name="contact" maxLength={300} />
              </label>
              <label>
                Anything else
                <textarea name="message" rows={3} maxLength={4000} />
              </label>
              {claim && !claim.ok ? <p className={styles.err}>{claim.message}</p> : null}
              <button type="submit" disabled={claiming}>
                {claiming ? "Sending…" : "Send the claim"}
              </button>
            </form>
          )
        ) : (
          <p>
            <a href={`/login?next=${encodeURIComponent(`/${slug}#claim`)}`}>Sign in</a> to claim this
            listing.
          </p>
        )}
      </details>
      <details className={styles.details}>
        <summary>Ask us to remove it</summary>
        {removal?.ok ? (
          <p className={styles.ok}>{removal.message}</p>
        ) : (
          <form action={removalAction} className={styles.form}>
            <input type="hidden" name="businessUserId" value={businessUserId} />
            <label>
              Why (optional)
              <textarea name="reason" rows={2} maxLength={1000} />
            </label>
            {!signedIn ? (
              <label>
                Your email or phone, so we can confirm
                <input name="contact" maxLength={300} required />
              </label>
            ) : null}
            {removal && !removal.ok ? <p className={styles.err}>{removal.message}</p> : null}
            <button type="submit" disabled={removing}>
              {removing ? "Sending…" : "Remove this listing"}
            </button>
          </form>
        )}
      </details>
    </section>
  );
}

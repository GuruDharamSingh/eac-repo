import {
  unsubscribeContact,
  verifyUnsubscribeToken,
} from "@elkdonis/newsletter/server";
import { siteConfig } from "@/config/site";

/**
 * One click, no sign-in, no form.
 *
 * Ported to this app because the unsubscribe link is built from the host the
 * send went out on. A newsletter sent from here with no /unsubscribe route is
 * a letter nobody can opt out of — which is why sendNewsletter refuses to run
 * without a signing secret, and why this page ships in the same change as the
 * editor rather than after it.
 *
 * The link in every newsletter carries the address and an HMAC of it, so the
 * page can act immediately — asking someone to log in or retype their address
 * to stop receiving email is the pattern the law exists to prevent.
 *
 * It says the same thing whether the row existed or not: confirming which
 * addresses are on an org's list to anyone holding a link is a leak, and
 * "you're unsubscribed" is true either way.
 */
export const dynamic = "force-dynamic";

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ e?: string; t?: string }>;
}) {
  const { e: email, t: token } = await searchParams;

  const valid =
    typeof email === "string" &&
    typeof token === "string" &&
    verifyUnsubscribeToken(siteConfig.orgId, email, token);

  if (valid) await unsubscribeContact(siteConfig.orgId, email as string);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-16 text-center">
      {valid ? (
        <>
          <h1 className="font-serif text-3xl">Unsubscribed</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            {email} will not receive any more letters from{" "}
            {siteConfig.orgName ?? siteConfig.orgId}. Nothing else changes — if
            you have an account, it still works.
          </p>
        </>
      ) : (
        <>
          <h1 className="font-serif text-3xl">This link didn&rsquo;t work</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            It may have been altered in transit. Reply to any letter and
            we&rsquo;ll take you off the list by hand.
          </p>
        </>
      )}
    </main>
  );
}

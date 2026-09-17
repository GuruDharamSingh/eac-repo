import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getOrgEmailIdentity,
  loadOrgTemplate,
  renderSample,
  templateMeta,
} from "@elkdonis/email";
import { requireOrgEditor } from "@/lib/auth";
import { siteConfig } from "@/config/site";
import { EmailTemplateForm } from "@/components/hub/EmailTemplateForm";

export const metadata: Metadata = { title: "Email template" };
export const dynamic = "force-dynamic";

/**
 * One letter: what it currently says, and a box to say something of your own.
 *
 * The preview re-renders with whatever is stored, so what you read here is
 * what will actually send — not a mock-up of the default.
 */
export default async function EmailTemplatePage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const { key } = await params;
  const meta = templateMeta(key);
  // Unknown keys 404 rather than rendering an empty form: the only way to
  // reach one is a hand-edited URL, and a form that saves into a template
  // nothing sends is worse than a missing page.
  if (!meta || !meta.editable) notFound();

  await requireOrgEditor(`/hub/email/${key}`);

  const [identity, stored] = await Promise.all([
    getOrgEmailIdentity(siteConfig.orgId),
    loadOrgTemplate(siteConfig.orgId, key),
  ]);

  const html = await renderSample(key, {
    orgName: identity.fromName,
    orgHeader: identity.fromIsOrgDomain,
    orgAccent: identity.accentColor,
    bodyText: stored?.bodyText,
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <Link href="/hub/email" className="text-sm text-muted-foreground underline underline-offset-4">
        ← All email
      </Link>

      <h1 className="mt-3 font-serif text-3xl">{meta.title}</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        {meta.trigger}. Goes to {meta.recipient.toLowerCase()}.
      </p>

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <div>
          <EmailTemplateForm
            templateKey={key}
            initialBodyText={stored?.bodyText ?? ""}
            hint={meta.editHint}
            hasOwnLayout={Boolean(stored?.html)}
            editHref={`/hub/email/${key}/edit`}
            saveEndpoint={`/api/hub/email/${key}`}
            testEndpoint={`/api/hub/email/${key}/test`}
          />
        </div>

        <div>
          <h2 className="text-xs uppercase tracking-[0.15em] text-muted-foreground">
            What sends today
          </h2>
          <iframe
            title="Preview"
            srcDoc={html}
            sandbox=""
            className="mt-3 block h-[36rem] w-full rounded border border-border bg-white"
          />
        </div>
      </div>
    </div>
  );
}

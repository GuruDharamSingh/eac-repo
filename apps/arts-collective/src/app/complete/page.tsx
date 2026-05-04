import Link from "next/link";
import { requireUser } from "@/lib/session";
import { getProfileForUser } from "@/lib/profile";
import { SiteShell } from "@/components/site-shell";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function CompletePage({
  searchParams,
}: {
  searchParams: Promise<{ slug?: string }>;
}) {
  const user = await requireUser();
  const profile = await getProfileForUser(user.id);
  const params = await searchParams;
  const slug = params.slug ?? profile?.org_id;

  return (
    <SiteShell>
      <div className="mx-auto max-w-xl py-16">
        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-3xl">
              You&apos;re in.
            </CardTitle>
            <CardDescription>
              Your corner of the collective is set up. Here&apos;s what happens
              next.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm leading-relaxed">
            <p>
              The team will review your onboarding and reach out within a few
              days with the first pass of your page. Nothing you wrote is
              locked — you&apos;ll be able to edit everything later.
            </p>
            {slug && (
              <p className="rounded-md border border-border bg-muted/40 p-3 text-muted-foreground">
                Your org slug:{" "}
                <code className="font-mono text-foreground">{slug}</code>
                <br />
                <span className="text-xs">
                  Your public page at <code>/{slug}</code> is not live yet.
                </span>
              </p>
            )}
            <div className="flex flex-col gap-3 pt-2 sm:flex-row">
              <Button asChild variant="outline">
                <Link href="/wizard/confirm">Review what I submitted</Link>
              </Button>
              <Button asChild>
                <Link href="/hub">Continue to your hub</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </SiteShell>
  );
}

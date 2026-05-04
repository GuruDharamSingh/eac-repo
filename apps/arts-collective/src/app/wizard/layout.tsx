import { requireUser } from "@/lib/session";
import { SiteShell } from "@/components/site-shell";

export default async function WizardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await requireUser();
  return <SiteShell>{children}</SiteShell>;
}

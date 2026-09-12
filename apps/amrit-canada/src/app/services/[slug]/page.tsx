import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArticleView } from "@elkdonis/cms-ui/article";
import { getThreadBySlug } from "@/lib/data";
import { getViewer } from "@/lib/auth";
import { toPlainText } from "@/lib/format";
import { InquiryForm } from "@/components/inquiry-form";
import { EditThreadButton } from "@/components/edit-thread-button";
import { ShareButton } from "@/components/share-button";

interface ServicePageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: ServicePageProps): Promise<Metadata> {
  const { slug } = await params;
  const thread = await getThreadBySlug("services", slug);
  if (!thread) return {};

  const description = thread.excerpt ?? toPlainText(thread.description, 160);
  return {
    title: thread.title,
    description,
    openGraph: {
      title: thread.title,
      description,
      type: "article",
      images: thread.coverImageUrl ? [thread.coverImageUrl] : undefined,
    },
  };
}

export const dynamic = "force-dynamic";

export default async function ServicePage({ params }: ServicePageProps) {
  const { slug } = await params;

  const [thread, viewer] = await Promise.all([
    getThreadBySlug("services", slug),
    getViewer().catch(() => null),
  ]);

  if (!thread) notFound();

  return (
    <div className="mx-auto max-w-3xl px-5 py-10">
      <Link
        href="/services"
        className="text-sm text-muted-foreground underline-offset-4 hover:underline"
      >
        ← Services
      </Link>

      <ArticleView
        title={thread.title}
        lede={thread.excerpt}
        bodyHtml={thread.description ?? ""}
        authorName={thread.authorName}
        publishedAt={thread.publishedAt}
        kindLabel="Service"
        org={{ name: "Services", href: "/services" }}
        coverImageUrl={thread.coverImageUrl}
      >
        {thread.location && (
          <p className="mt-4 text-sm text-muted-foreground">
            📍 {thread.location}
          </p>
        )}

        <div className="mt-8 flex flex-wrap items-center justify-end gap-3">
          {viewer?.canEdit && <EditThreadButton threadId={thread.id} kind={thread.kind} />}
          <ShareButton title={thread.title} />
        </div>
      </ArticleView>

      <div className="mt-10">
        <InquiryForm threadId={thread.id} serviceTitle={thread.title} />
      </div>
    </div>
  );
}

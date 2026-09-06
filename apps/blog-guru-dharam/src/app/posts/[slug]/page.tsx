import { BlogPostPage } from "@elkdonis/blog-client";
import { blogConfig } from "../../../config/blog";

export default async function PostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <BlogPostPage config={blogConfig} slug={slug} />;
}

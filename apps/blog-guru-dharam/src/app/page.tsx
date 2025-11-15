import { BlogPostList } from '@elkdonis/blog-client';
import { getPublishedPosts } from '@elkdonis/blog-server';
import { blogConfig } from '../config/blog';

export default async function HomePage() {
  const posts = await getPublishedPosts(blogConfig.orgId, 20).catch(() => []);

  return <BlogPostList posts={posts} />;
}

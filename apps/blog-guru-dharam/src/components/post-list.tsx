import Link from 'next/link';
import { format } from 'date-fns';
import type { Post } from '@elkdonis/types';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';

function truncate(text: string, length: number) {
  if (text.length <= length) return text;
  return `${text.slice(0, length).trim()}…`;
}

interface PostListProps {
  posts: Post[];
  basePath?: string;
  emptyStateMessage?: string;
}

export function PostList({
  posts,
  basePath = '/posts',
  emptyStateMessage = 'No published entries yet. Check back soon.',
}: PostListProps) {
  if (!posts.length) {
    return (
      <Card className="border-dashed bg-card/70">
        <CardHeader>
          <CardTitle className="text-lg font-medium text-muted-foreground">
            {emptyStateMessage}
          </CardTitle>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {posts.map((post) => {
        const publishedAt = post.publishedAt ?? post.createdAt;
        return (
          <Link key={post.id} href={`${basePath}/${post.slug}`} className="group">
            <article className="relative flex h-full flex-col rounded-3xl border border-border/70 bg-card/90 p-6 shadow-lg transition duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-2xl">
              <Badge variant="secondary" className="w-fit bg-primary/10 text-primary">
                {format(new Date(publishedAt), 'MMM d, yyyy')}
              </Badge>
              <h3 className="mt-4 text-2xl font-semibold tracking-tight text-foreground group-hover:text-primary">
                {post.title}
              </h3>
              {post.excerpt ? (
                <p className="mt-3 text-sm text-muted-foreground">{truncate(post.excerpt, 200)}</p>
              ) : null}

              <div className="mt-6 flex items-center gap-4 text-xs uppercase tracking-widest text-muted-foreground">
                {post.metadata?.tags && Array.isArray(post.metadata.tags) && post.metadata.tags.length
                  ? (post.metadata.tags as string[]).slice(0, 2).map((tag) => (
                      <span key={tag} className="rounded-full bg-muted px-3 py-1">
                        {tag}
                      </span>
                    ))
                  : null}
              </div>
            </article>
          </Link>
        );
      })}
    </div>
  );
}

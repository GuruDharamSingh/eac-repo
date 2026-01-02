import Link from 'next/link';
import { format } from 'date-fns';
import type { Post } from '@elkdonis/types';

interface AdminPostTableProps {
  posts: Post[];
}

export function AdminPostTable({ posts }: AdminPostTableProps) {
  if (!posts.length) {
    return (
      <p className="rounded-2xl border border-dashed border-border/70 bg-card/70 p-6 text-sm text-muted-foreground">
        No posts published yet.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-border/70">
      <table className="w-full border-collapse bg-card text-sm">
        <thead className="bg-muted/40 text-left uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-6 py-4 font-medium">Title</th>
            <th className="px-6 py-4 font-medium">Published</th>
            <th className="px-6 py-4 font-medium">Visibility</th>
          </tr>
        </thead>
        <tbody>
          {posts.map((post) => (
            <tr key={post.id} className="border-t border-border/60 text-foreground">
              <td className="px-6 py-4">
                <Link href={`/posts/${post.slug}`} className="font-semibold text-primary">
                  {post.title}
                </Link>
              </td>
              <td className="px-6 py-4 text-muted-foreground">
                {format(new Date(post.publishedAt ?? post.createdAt), 'PPP')}
              </td>
              <td className="px-6 py-4 uppercase tracking-wider text-muted-foreground">
                {post.visibility}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

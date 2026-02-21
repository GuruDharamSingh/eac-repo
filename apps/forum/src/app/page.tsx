import { Suspense } from 'react';
import { fetchForumFeed, type SortOption } from '@/lib/data';
import { ForumFeed } from '@/components/forum-feed';
import { Loader2 } from 'lucide-react';

interface PageProps {
  searchParams: Promise<{ sort?: string; page?: string }>;
}

async function ForumContent({ searchParams }: PageProps) {
  const params = await searchParams;
  const sort = (params.sort as SortOption) || 'active';
  const page = parseInt(params.page || '1', 10);

  const { threads, pagination } = await fetchForumFeed({
    sort,
    page,
    limit: 12,
  });

  return (
    <ForumFeed
      initialThreads={threads}
      pagination={pagination}
      currentSort={sort}
    />
  );
}

function LoadingFeed() {
  return (
    <div className="flex justify-center py-16">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );
}

export default async function ForumPage(props: PageProps) {
  return (
    <main className="w-full min-h-screen">
      <div className="container mx-auto max-w-6xl px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-2 text-foreground">
            Community Forum
          </h1>
          <p className="text-base md:text-lg text-muted-foreground">
            Discussions and gatherings across the Elkdonis network
          </p>
        </div>

        {/* Feed */}
        <Suspense fallback={<LoadingFeed />}>
          <ForumContent searchParams={props.searchParams} />
        </Suspense>
      </div>
    </main>
  );
}
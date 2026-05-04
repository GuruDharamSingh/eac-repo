'use client';

import { useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Flame, Clock, TrendingUp, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ThreadCard } from './thread-card';
import { DeleteConfirmationModal } from './delete-confirmation-modal';
import type { ForumThread, SortOption } from '@/lib/data';

interface ForumFeedProps {
  initialThreads: ForumThread[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  currentSort: SortOption;
}

const sortOptions: { value: SortOption; label: string; icon: React.ReactNode }[] = [
  { value: 'active', label: 'Active', icon: <Flame className="w-4 h-4" /> },
  { value: 'newest', label: 'New', icon: <Clock className="w-4 h-4" /> },
  { value: 'reactions', label: 'Top', icon: <TrendingUp className="w-4 h-4" /> },
];

export function ForumFeed({ initialThreads, pagination, currentSort }: ForumFeedProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [threads, setThreads] = useState(initialThreads);
  const [isDeleteModalOpened, setDeleteModalOpened] = useState(false);
  const [threadToDeleteId, setThreadToDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false); // New state for deletion loading

  const handleDelete = (threadId: string) => {
    setThreadToDeleteId(threadId);
    setDeleteModalOpened(true);
  };

  const confirmDelete = async () => {
    if (!threadToDeleteId) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/threads/${threadToDeleteId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete thread');
      }

      // Remove the deleted thread from the state
      setThreads((prevThreads) =>
        prevThreads.filter((thread) => thread.id !== threadToDeleteId)
      );

      // TODO: Replace with actual notification system (e.g., Mantine Notifications)
      alert('Thread deleted successfully!');
      router.refresh(); // To revalidate data if needed elsewhere
    } catch (error) {
      console.error('Error deleting thread:', error);
      // TODO: Replace with actual notification system
      alert('Failed to delete thread.');
    } finally {
      setIsDeleting(false);
      setDeleteModalOpened(false);
      setThreadToDeleteId(null);
    }
  };

  const handleSortChange = (sort: SortOption) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('sort', sort);
    params.delete('page'); // Reset to page 1
    startTransition(() => {
      router.push(`?${params.toString()}`);
    });
  };

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', newPage.toString());
    startTransition(() => {
      router.push(`?${params.toString()}`);
    });
  };

  return (
    <div className="space-y-6">
      {/* Sort tabs */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex gap-1 p-1 bg-secondary/50 rounded-lg">
          {sortOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => handleSortChange(option.value)}
              disabled={isPending}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all',
                currentSort === option.value
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
              )}
            >
              {option.icon}
              {option.label}
            </button>
          ))}
        </div>

        {/* Thread count */}
        <p className="text-sm text-muted-foreground">
          {pagination.total} {pagination.total === 1 ? 'thread' : 'threads'}
        </p>
      </div>

      {/* Loading overlay */}
      {isPending && (
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      )}

      {/* Thread grid */}
      {!isPending && threads.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {threads.map((thread) => (
            <ThreadCard
              key={`${thread.kind}-${thread.id}`}
              thread={thread}
              onDelete={handleDelete}
              canDelete={true} // For demonstration, later this will be based on user permissions
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isPending && threads.length === 0 && (
        <div className="text-center py-16 px-4">
          <div className="text-5xl mb-4">
            <Flame className="w-16 h-16 mx-auto text-muted-foreground/30" />
          </div>
          <h2 className="text-xl font-semibold mb-2 text-foreground">No discussions yet</h2>
          <p className="text-muted-foreground max-w-md mx-auto">
            Be the first to start a conversation. Share your thoughts, ask questions, or announce a gathering.
          </p>
        </div>
      )}

      {/* Pagination */}
      {!isPending && pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <button
            onClick={() => handlePageChange(pagination.page - 1)}
            disabled={pagination.page <= 1 || isPending}
            className={cn(
              'flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
              pagination.page <= 1
                ? 'text-muted-foreground/50 cursor-not-allowed'
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
            )}
          >
            <ChevronLeft className="w-4 h-4" />
            Previous
          </button>

          <div className="flex items-center gap-1">
            {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
              let pageNum: number;
              if (pagination.totalPages <= 5) {
                pageNum = i + 1;
              } else if (pagination.page <= 3) {
                pageNum = i + 1;
              } else if (pagination.page >= pagination.totalPages - 2) {
                pageNum = pagination.totalPages - 4 + i;
              } else {
                pageNum = pagination.page - 2 + i;
              }

              return (
                <button
                  key={pageNum}
                  onClick={() => handlePageChange(pageNum)}
                  disabled={isPending}
                  className={cn(
                    'w-9 h-9 rounded-lg text-sm font-medium transition-colors',
                    pagination.page === pageNum
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                  )}
                >
                  {pageNum}
                </button>
              );
            })}
          </div>

          <button
            onClick={() => handlePageChange(pagination.page + 1)}
            disabled={pagination.page >= pagination.totalPages || isPending}
            className={cn(
              'flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
              pagination.page >= pagination.totalPages
                ? 'text-muted-foreground/50 cursor-not-allowed'
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
            )}
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      <DeleteConfirmationModal
        opened={isDeleteModalOpened}
        onClose={() => setDeleteModalOpened(false)}
        onConfirm={confirmDelete}
        title="Confirm Deletion"
        description="Are you sure you want to delete this thread? This action cannot be undone."
        loading={isDeleting}
      />
    </div>
  );
}

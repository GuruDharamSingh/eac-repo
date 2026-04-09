import Link from 'next/link';
import { MessageCircle, Heart, Eye, Pin, Lock, Calendar, MapPin, Trash2 } from 'lucide-react';
import { cn, formatRelativeTime, truncateText } from '@/lib/utils';
import type { ForumThread } from '@/lib/data';

interface ThreadCardProps {
  thread: ForumThread;
  onDelete: (threadId: string) => void;
  canDelete: boolean;
}

export function ThreadCard({ thread, onDelete, canDelete }: ThreadCardProps) {
  const isMeeting = thread.type === 'meeting';

  return (
    <Link href={`/${thread.slug}`} className="block group">
      <article
        className={cn(
          'relative bg-card rounded-xl border border-border p-4 h-full',
          'transition-all duration-200 ease-out',
          'hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5',
          'hover:-translate-y-0.5'
        )}
      >
        {/* Pinned/Locked badges and Delete button */}
        <div className="absolute top-3 right-3 flex gap-1.5">
          {thread.isPinned && (
            <span className="p-1 rounded-full bg-amber-100 text-amber-600">
              <Pin className="w-3 h-3" />
            </span>
          )}
          {thread.isLocked && (
            <span className="p-1 rounded-full bg-gray-100 text-gray-500">
              <Lock className="w-3 h-3" />
            </span>
          )}
          {canDelete && (
            <button
              onClick={(e) => {
                e.preventDefault(); // Prevent navigating to thread detail page
                e.stopPropagation(); // Stop event propagation
                onDelete(thread.id);
              }}
              className="p-1 rounded-full bg-red-100 text-red-600 hover:bg-red-200"
              aria-label="Delete thread"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}

        {/* Type badge */}
        <div className="mb-3">
          <span
            className={cn(
              'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
              isMeeting
                ? 'bg-blue-100 text-blue-700'
                : 'bg-purple-100 text-purple-700'
            )}
          >
            {isMeeting ? (
              <>
                <Calendar className="w-3 h-3" />
                Meeting
              </>
            ) : (
              'Post'
            )}
          </span>
        </div>

        {/* Title */}
        <h3 className="text-base font-semibold text-foreground mb-2 line-clamp-2 group-hover:text-primary transition-colors">
          {thread.title}
        </h3>

        {/* Excerpt */}
        <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
          {truncateText(thread.excerpt || '', 120)}
        </p>

        {/* Meeting details */}
        {isMeeting && thread.scheduledAt && (
          <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              {new Date(thread.scheduledAt).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              })}
            </span>
            {thread.location && (
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" />
                {thread.isOnline ? 'Online' : truncateText(thread.location, 20)}
              </span>
            )}
          </div>
        )}

        {/* Topics/Tags */}
        {(thread.topicNames?.length ?? 0) > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {thread.topicNames!.slice(0, 3).map((topic, i) => (
              <span
                key={thread.topicIds?.[i] ?? i}
                className="px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground text-xs"
              >
                {topic}
              </span>
            ))}
            {(thread.topicNames?.length ?? 0) > 3 && (
              <span className="px-2 py-0.5 text-xs text-muted-foreground">
                +{thread.topicNames!.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Author and stats */}
        <div className="flex items-center justify-between pt-3 border-t border-border/50">
          <div className="flex items-center gap-2">
            {/* Avatar */}
            <div className="relative">
              {thread.authorAvatar ? (
                <img
                  src={thread.authorAvatar}
                  alt={thread.authorName}
                  className="w-7 h-7 rounded-full object-cover"
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary">
                  {thread.authorInitials}
                </div>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-foreground truncate">
                {thread.authorName}
              </p>
              <p className="text-xs text-muted-foreground">
                {thread.orgName} · {formatRelativeTime(thread.lastActivityAt)}
              </p>
            </div>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-3 text-muted-foreground">
            <span className="flex items-center gap-1 text-xs">
              <MessageCircle className="w-3.5 h-3.5" />
              {thread.replyCount}
            </span>
            <span className="flex items-center gap-1 text-xs">
              <Heart className="w-3.5 h-3.5" />
              {thread.reactionCount}
            </span>
            {thread.viewCount > 0 && (
              <span className="flex items-center gap-1 text-xs">
                <Eye className="w-3.5 h-3.5" />
                {thread.viewCount}
              </span>
            )}
          </div>
        </div>
      </article>
    </Link>
  );
}

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, Calendar, MapPin, Pin, Lock, Eye, Heart, MessageCircle } from 'lucide-react';
import { fetchThread, fetchReplies } from '@/lib/data';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ReplyList } from './components/reply-list';
import { ReplyComposer } from './components/reply-composer';
import { formatRelativeTime } from '@/lib/utils';
const KIND_CONFIG: Record<string, { label: string; badgeClass: string }> = {
  post:     { label: 'Discussion', badgeClass: 'bg-purple-100 text-purple-700 border-purple-200' },
  meeting:  { label: 'Gathering',  badgeClass: 'bg-blue-100 text-blue-700 border-blue-200' },
  workshop: { label: 'Workshop',   badgeClass: 'bg-amber-100 text-amber-700 border-amber-200' },
};

interface ThreadPageProps {
  params: Promise<{ slug: string }>;
}

export default async function ThreadPage({ params }: ThreadPageProps) {
  const { slug } = await params;
  const thread = await fetchThread(slug);

  if (!thread) notFound();

  const replies = await fetchReplies(thread.id, thread.kind as 'post' | 'meeting' | 'workshop');

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
      >
        <ChevronLeft className="w-4 h-4" />
        Back to Forum
      </Link>

      {/* Thread */}
      <article className="bg-card border border-border rounded-xl p-6 mb-8 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${(KIND_CONFIG[thread.kind] ?? KIND_CONFIG.post).badgeClass}`}>
            {(KIND_CONFIG[thread.kind] ?? KIND_CONFIG.post).label}
          </span>
          {thread.isPinned && (
            <Badge variant="outline" className="text-xs gap-1">
              <Pin className="w-3 h-3" /> Pinned
            </Badge>
          )}
          {thread.isLocked && (
            <Badge variant="outline" className="text-xs gap-1 text-muted-foreground">
              <Lock className="w-3 h-3" /> Locked
            </Badge>
          )}
        </div>

        <h1 className="text-2xl md:text-3xl font-serif font-semibold text-foreground leading-snug mb-4">
          {thread.title}
        </h1>

        {thread.kind === 'meeting' && thread.scheduledAt && (
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mb-5 p-3 bg-secondary/50 rounded-lg border border-border/50">
            <span className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-primary" />
              {new Date(thread.scheduledAt).toLocaleDateString('en-US', {
                weekday: 'long', month: 'long', day: 'numeric',
                hour: 'numeric', minute: '2-digit',
              })}
            </span>
            {thread.location && (
              <span className="flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-primary" />
                {thread.isOnline ? 'Online' : thread.location}
              </span>
            )}
          </div>
        )}

        {(thread.topicNames?.length ?? 0) > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-5">
            {thread.topicNames!.map((topic: string, i: number) => (
              <span
                key={thread.topicIds?.[i] ?? i}
                className="px-2.5 py-0.5 text-xs rounded-full bg-secondary text-secondary-foreground border border-border/50"
              >
                {topic}
              </span>
            ))}
          </div>
        )}

        <Separator className="mb-5" />

        {'content' in thread && thread.content ? (
          <div
            className="prose-forum min-h-[80px]"
            dangerouslySetInnerHTML={{ __html: thread.content as string }}
          />
        ) : thread.excerpt ? (
          <p className="text-foreground/90 leading-relaxed">{thread.excerpt}</p>
        ) : (
          <p className="text-muted-foreground italic">No content.</p>
        )}

        <Separator className="mt-5 mb-4" />

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="w-9 h-9">
              <AvatarImage src={thread.authorAvatar || ''} alt={thread.authorName} />
              <AvatarFallback className="text-sm bg-primary/10 text-primary font-medium">
                {thread.authorInitials}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-medium leading-none">{thread.authorName}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {thread.orgName} · {formatRelativeTime(thread.lastActivityAt)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-muted-foreground">
            <span className="flex items-center gap-1 text-xs"><Eye className="w-3.5 h-3.5" />{thread.viewCount}</span>
            <span className="flex items-center gap-1 text-xs"><Heart className="w-3.5 h-3.5" />{thread.reactionCount}</span>
            <span className="flex items-center gap-1 text-xs"><MessageCircle className="w-3.5 h-3.5" />{thread.replyCount}</span>
          </div>
        </div>
      </article>

      {/* Replies section */}
      <section>
        <h2 className="text-xl font-serif font-semibold text-foreground mb-5">
          {replies.length} {replies.length === 1 ? 'Reply' : 'Replies'}
        </h2>

        <ReplyList replies={replies} />

        {!thread.isLocked && (
          <div className="mt-6">
            <ReplyComposer threadId={thread.id} threadType={thread.kind as 'post' | 'meeting' | 'workshop'} />
          </div>
        )}

        {thread.isLocked && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground p-4 bg-secondary/30 rounded-lg border border-border/50 mt-4">
            <Lock className="w-4 h-4" />
            This thread is locked. No new replies can be added.
          </div>
        )}
      </section>
    </div>
  );
}

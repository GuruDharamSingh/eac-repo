import { Heart } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { formatRelativeTime } from '@/lib/utils';
import type { Reply } from '@/lib/data';

interface ReplyItemProps {
  reply: Reply;
}

export function ReplyItem({ reply }: ReplyItemProps) {
  return (
    <div className="flex gap-3 group">
      <Avatar className="w-8 h-8 shrink-0 mt-0.5">
        <AvatarImage src={reply.userAvatar || ''} alt={reply.userName} />
        <AvatarFallback className="text-xs bg-primary/10 text-primary font-medium">
          {reply.userInitials}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <div className="bg-card border border-border rounded-xl px-4 py-3 shadow-sm">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-sm font-medium text-foreground">{reply.userName}</span>
            <span className="text-xs text-muted-foreground shrink-0">{formatRelativeTime(reply.createdAt)}</span>
          </div>

          <div
            className="prose-forum text-sm"
            dangerouslySetInnerHTML={{ __html: reply.content }}
          />
        </div>

        <div className="flex items-center gap-3 mt-1.5 px-1">
          <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors">
            <Heart className="w-3.5 h-3.5" />
            {reply.reactionCount > 0 && <span>{reply.reactionCount}</span>}
          </button>
          <button className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            Reply
          </button>
        </div>

        {reply.children && reply.children.length > 0 && (
          <div className="mt-3 ml-4 space-y-3 border-l-2 border-border/50 pl-4">
            {reply.children.map((child) => (
              <ReplyItem key={child.id} reply={child} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

import { MessageCircle } from 'lucide-react';
import { ReplyItem } from './reply-item';
import type { Reply } from '@/lib/data';

interface ReplyListProps {
  replies: Reply[];
}

export function ReplyList({ replies }: ReplyListProps) {
  if (replies.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-10 text-center">
        <MessageCircle className="w-10 h-10 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">Be the first to reply.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {replies.map((reply) => (
        <ReplyItem key={reply.id} reply={reply} />
      ))}
    </div>
  );
}

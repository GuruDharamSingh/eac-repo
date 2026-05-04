'use client';

import { useState, useTransition } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Send } from 'lucide-react';

interface ReplyComposerProps {
  threadId: string;
  threadType: 'post' | 'meeting' | 'workshop';
}

export function ReplyComposer({ threadId, threadType }: ReplyComposerProps) {
  const [content, setContent] = useState('');
  const [isPending, startTransition] = useTransition();
  const maxLength = 2000;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    startTransition(async () => {
      try {
        const res = await fetch(`/api/threads/${threadId}/replies`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content, threadType }),
        });
        if (res.ok) {
          setContent('');
          window.location.reload();
        }
      } catch (err) {
        console.error(err);
      }
    });
  };

  return (
    <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-foreground mb-3 font-serif">Add a Reply</h3>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="relative">
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Share your thoughts..."
            maxLength={maxLength}
            rows={4}
            className="resize-none pr-2"
          />
          <p className="text-xs text-muted-foreground text-right mt-1">
            {content.length}/{maxLength}
          </p>
        </div>
        <div className="flex justify-end">
          <Button
            type="submit"
            size="sm"
            disabled={!content.trim() || isPending}
            className="gap-1.5"
          >
            <Send className="w-3.5 h-3.5" />
            {isPending ? 'Posting...' : 'Post Reply'}
          </Button>
        </div>
      </form>
    </div>
  );
}

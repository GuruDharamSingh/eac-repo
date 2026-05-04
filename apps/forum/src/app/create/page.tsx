'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, ScrollText, CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

type ThreadType = 'post' | 'meeting';

export default function CreateThreadPage() {
  const router = useRouter();
  const [type, setType] = useState<ThreadType>('post');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [location, setLocation] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [isOnline, setIsOnline] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    startTransition(async () => {
      try {
        const res = await fetch('/api/threads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type,
            title,
            content,
            ...(type === 'meeting' && { location, scheduledAt, isOnline }),
          }),
        });
        if (res.ok) {
          const data = await res.json();
          router.push('/' + (data.slug || ''));
        }
      } catch (err) {
        console.error(err);
      }
    });
  };

  return (
    <div className="container mx-auto max-w-2xl px-4 py-8">
      <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6">
        <ChevronLeft className="w-4 h-4" />
        Back to Forum
      </Link>

      <h1 className="text-2xl font-serif font-semibold text-foreground mb-1">Create a Post</h1>
      <p className="text-sm text-muted-foreground mb-6">Share a discussion or announce a gathering.</p>

      <div className="flex gap-3 mb-6">
        {([
          { value: 'post' as const, label: 'Discussion', icon: ScrollText, desc: 'Share ideas or start a conversation' },
          { value: 'meeting' as const, label: 'Gathering', icon: CalendarDays, desc: 'Announce an event or meeting' },
        ]).map(({ value, label, icon: Icon, desc }) => (
          <button
            key={value}
            type="button"
            onClick={() => setType(value)}
            className={cn(
              'flex-1 flex flex-col items-start gap-1 p-4 rounded-xl border-2 text-left transition-all',
              type === value ? 'border-primary bg-primary/5' : 'border-border bg-card hover:border-primary/30 hover:bg-secondary/30'
            )}
          >
            <div className="flex items-center gap-2">
              <Icon className={cn('w-4 h-4', type === value ? 'text-primary' : 'text-muted-foreground')} />
              <span className={cn('text-sm font-semibold', type === value ? 'text-primary' : 'text-foreground')}>{label}</span>
            </div>
            <p className="text-xs text-muted-foreground">{desc}</p>
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground" htmlFor="title">Title</label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={type === 'post' ? 'What would you like to discuss?' : 'Name your gathering'}
            maxLength={200}
            required
            className="font-serif text-base"
          />
          <p className="text-xs text-muted-foreground text-right">{title.length}/200</p>
        </div>

        {type === 'meeting' && (
          <div className="space-y-4 p-4 bg-secondary/30 rounded-xl border border-border/50">
            <h3 className="text-sm font-semibold text-foreground">Gathering Details</h3>
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="scheduledAt">Date & Time</label>
              <Input id="scheduledAt" type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} required={type === 'meeting'} />
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsOnline(!isOnline)}
                className={cn('w-9 h-5 rounded-full transition-colors relative', isOnline ? 'bg-primary' : 'bg-secondary border border-border')}
              >
                <span className={cn('absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform', isOnline ? 'translate-x-4' : 'translate-x-0')} />
              </button>
              <span className="text-sm cursor-pointer" onClick={() => setIsOnline(!isOnline)}>Online gathering</span>
            </div>
            {!isOnline && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium" htmlFor="location">Location</label>
                <Input id="location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Where is it taking place?" />
              </div>
            )}
          </div>
        )}

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground" htmlFor="content">
            {type === 'post' ? 'Content' : 'Description'}
          </label>
          <Textarea
            id="content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={type === 'post' ? 'Share your thoughts in detail...' : 'Describe the gathering or agenda...'}
            rows={8}
            maxLength={10000}
            required
            className="resize-none"
          />
          <p className="text-xs text-muted-foreground text-right">{content.length}/10,000</p>
        </div>

        <Separator />

        <div className="flex items-center justify-between">
          <Button type="button" variant="ghost" asChild>
            <Link href="/">Cancel</Link>
          </Button>
          <Button type="submit" disabled={!title.trim() || !content.trim() || isPending}>
            {isPending ? 'Publishing...' : type === 'post' ? 'Publish Discussion' : 'Announce Gathering'}
          </Button>
        </div>
      </form>
    </div>
  );
}

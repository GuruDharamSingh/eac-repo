/**
 * Polls List Page
 * Uses custom UI with Nextcloud Polls API backend (hybrid approach)
 */

import { PollsList } from '@/components/polls-list';
import { Calendar, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function PollsPage() {
  return (
    <div className="container mx-auto px-4 py-8 pb-32 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Calendar className="h-8 w-8" />
            Availability Polls
          </h1>
          <p className="text-muted-foreground mt-2">
            Find the best time for your next gathering
          </p>
        </div>
        <Link href="/polls/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Create Poll
          </Button>
        </Link>
      </div>

      {/* Polls List - Custom UI using Nextcloud API */}
      <PollsList />
    </div>
  );
}

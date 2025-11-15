/**
 * Create New Poll Page
 * Simple form to create availability polls in Nextcloud
 */

import { PollCreator } from '@/components/poll-creator';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function NewPollPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <Link href="/polls">
        <Button variant="ghost" size="sm" className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Polls
        </Button>
      </Link>
      <h1 className="text-3xl font-bold mb-2">Create Availability Poll</h1>
      <p className="text-muted-foreground mb-8">
        Find the best time for your gathering using Nextcloud Polls
      </p>
      <PollCreator />
    </div>
  );
}

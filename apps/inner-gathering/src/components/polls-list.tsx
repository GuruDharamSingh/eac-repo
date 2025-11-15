/**
 * Polls List Component
 * Client component that fetches and displays polls from Nextcloud
 */

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, Clock, Users, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';

interface Poll {
  id: number;
  type: 'datePoll' | 'textPoll';
  title: string;
  description?: string;
  created: number;
  expire: number;
  ownerDisplayName: string;
  access: string;
  allowMaybe: number;
}

export function PollsList() {
  const [polls, setPolls] = useState<Poll[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchPolls() {
      try {
        const response = await fetch('/api/polls');
        if (!response.ok) {
          throw new Error('Failed to fetch polls');
        }
        const data = await response.json();
        setPolls(data.polls || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load polls');
      } finally {
        setLoading(false);
      }
    }

    fetchPolls();
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="overflow-hidden">
            <CardContent className="py-8">
              <div className="animate-pulse space-y-4">
                <div className="h-5 bg-muted rounded w-3/4"></div>
                <div className="h-4 bg-muted rounded w-1/2"></div>
                <div className="h-4 bg-muted rounded w-2/3"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive/50">
        <CardContent className="py-12">
          <div className="text-center space-y-4">
            <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
              <Calendar className="h-6 w-6 text-destructive" />
            </div>
            <div>
              <h3 className="font-semibold mb-1">Failed to load polls</h3>
              <p className="text-sm text-muted-foreground mb-4">{error}</p>
            </div>
            <Button onClick={() => window.location.reload()} variant="outline" size="sm">
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (polls.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-12">
          <div className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Calendar className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-2">No polls yet</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Create your first availability poll to get started
              </p>
            </div>
            <Link href="/polls/new">
              <Button>
                <Calendar className="h-4 w-4 mr-2" />
                Create Poll
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4 pb-6">
      {polls.map((poll) => {
        const isExpired = poll.expire > 0 && poll.expire * 1000 < Date.now();
        const createdDate = new Date(poll.created * 1000);
        const expireDate = poll.expire > 0 ? new Date(poll.expire * 1000) : null;

        return (
          <Card
            key={poll.id}
            className={`hover:shadow-lg transition-all duration-200 ${
              isExpired ? 'opacity-75 border-muted' : 'border-border hover:border-primary/50'
            }`}
          >
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 space-y-2">
                  <div className="flex items-start gap-2 flex-wrap">
                    <CardTitle className="text-lg leading-tight">{poll.title}</CardTitle>
                    {poll.type === 'datePoll' && (
                      <Badge variant="secondary" className="bg-blue-100 text-blue-900 dark:bg-blue-900 dark:text-blue-100">
                        <Calendar className="h-3 w-3 mr-1" />
                        Time Poll
                      </Badge>
                    )}
                    {isExpired && (
                      <Badge variant="destructive" className="bg-red-100 text-red-900 dark:bg-red-900 dark:text-red-100">
                        Expired
                      </Badge>
                    )}
                  </div>
                  {poll.description && (
                    <CardDescription className="text-sm line-clamp-2">
                      {poll.description}
                    </CardDescription>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5" />
                  <span className="font-medium text-foreground">{poll.ownerDisplayName}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  <span>{format(createdDate, 'MMM d, yyyy')}</span>
                </div>
                {expireDate && (
                  <div className={`flex items-center gap-1.5 ${isExpired ? 'text-destructive' : 'text-orange-600 dark:text-orange-400'}`}>
                    <Calendar className="h-3.5 w-3.5" />
                    <span className="font-medium">
                      {isExpired ? 'Expired' : 'Due'} {format(expireDate, 'MMM d')}
                    </span>
                  </div>
                )}
              </div>

              {poll.allowMaybe === 1 && (
                <Badge variant="outline" className="text-xs">
                  <Clock className="h-3 w-3 mr-1" />
                  Maybe option enabled
                </Badge>
              )}

              <Link href={`/polls/${poll.id}`} className="block">
                <Button
                  className="w-full"
                  variant={isExpired ? 'outline' : 'default'}
                  size="lg"
                >
                  {isExpired ? (
                    <>
                      <Users className="h-4 w-4 mr-2" />
                      View Results
                    </>
                  ) : (
                    <>
                      Vote Now
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </>
                  )}
                </Button>
              </Link>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

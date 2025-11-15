/**
 * Poll Voting Component
 * Display poll options and allow voting with When2Meet-style interface
 */

'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, Users, CheckCircle2, XCircle, HelpCircle, ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface Poll {
  id: number;
  type: 'datePoll' | 'textPoll';
  title: string;
  description?: string;
  created: number;
  expire: number;
  ownerDisplayName: string;
  allowMaybe: number;
}

interface PollOption {
  id: number;
  pollId: number;
  pollOptionText: string;
  timestamp?: number;
  order: number;
  duration: number;
}

interface VoteResult {
  option: PollOption;
  yes: number;
  no: number;
  maybe: number;
  total: number;
  availabilityScore: number;
}

type VoteAnswer = 'yes' | 'no' | 'maybe';

export function PollVoting({ pollId }: { pollId: string }) {
  const [poll, setPoll] = useState<Poll | null>(null);
  const [options, setOptions] = useState<PollOption[]>([]);
  const [results, setResults] = useState<VoteResult[]>([]);
  const [votes, setVotes] = useState<Map<number, VoteAnswer>>(new Map());
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    async function fetchPollData() {
      try {
        const [pollResponse, resultsResponse] = await Promise.all([
          fetch(`/api/polls/${pollId}`),
          fetch(`/api/polls/${pollId}/vote`),
        ]);

        if (!pollResponse.ok || !resultsResponse.ok) {
          throw new Error('Failed to fetch poll data');
        }

        const pollData = await pollResponse.json();
        const resultsData = await resultsResponse.json();

        setPoll(pollData.poll);
        setOptions(pollData.options);
        setResults(resultsData.results);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load poll');
      } finally {
        setLoading(false);
      }
    }

    fetchPollData();
  }, [pollId]);

  const handleVote = (optionId: number, answer: VoteAnswer) => {
    setVotes((prev) => {
      const newVotes = new Map(prev);
      if (newVotes.get(optionId) === answer) {
        newVotes.delete(optionId); // Toggle off if clicking same answer
      } else {
        newVotes.set(optionId, answer);
      }
      return newVotes;
    });
  };

  const handleSubmit = async () => {
    if (votes.size === 0) {
      alert('Please select your availability for at least one time slot');
      return;
    }

    setSubmitting(true);
    try {
      const votesArray = Array.from(votes.entries()).map(([optionId, answer]) => ({
        optionId,
        answer,
      }));

      const response = await fetch(`/api/polls/${pollId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ votes: votesArray }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit votes');
      }

      // Refresh results
      const resultsResponse = await fetch(`/api/polls/${pollId}/vote`);
      const resultsData = await resultsResponse.json();
      setResults(resultsData.results);
      setShowResults(true);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to submit votes');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center text-muted-foreground">Loading poll...</div>
        </CardContent>
      </Card>
    );
  }

  if (error || !poll) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center">
            <p className="text-destructive mb-4">{error || 'Poll not found'}</p>
            <Link href="/polls">
              <Button variant="outline">Back to Polls</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  const isExpired = poll.expire > 0 && poll.expire * 1000 < Date.now();
  const sortedResults = [...results].sort((a, b) => b.availabilityScore - a.availabilityScore);
  const bestOption = sortedResults[0];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link href="/polls">
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Polls
          </Button>
        </Link>
        <h1 className="text-3xl font-bold mb-2">{poll.title}</h1>
        {poll.description && (
          <p className="text-muted-foreground">{poll.description}</p>
        )}
        <div className="flex flex-wrap gap-2 mt-4">
          <Badge variant="secondary">
            <Users className="h-3 w-3 mr-1" />
            By {poll.ownerDisplayName}
          </Badge>
          {poll.allowMaybe === 1 && (
            <Badge variant="outline">Maybe allowed</Badge>
          )}
          {isExpired && <Badge variant="destructive">Expired</Badge>}
        </div>
      </div>

      {/* Toggle View */}
      {!isExpired && (
        <div className="flex gap-2">
          <Button
            variant={!showResults ? 'default' : 'outline'}
            onClick={() => setShowResults(false)}
          >
            Vote
          </Button>
          <Button
            variant={showResults ? 'default' : 'outline'}
            onClick={() => setShowResults(true)}
          >
            View Results
          </Button>
        </div>
      )}

      {/* Voting Interface */}
      {!showResults && !isExpired && (
        <Card>
          <CardHeader>
            <CardTitle>Mark Your Availability</CardTitle>
            <CardDescription>
              Click on each time slot to indicate when you can attend
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {options.map((option) => {
              const userVote = votes.get(option.id);
              const optionDate = option.timestamp
                ? new Date(option.timestamp * 1000)
                : null;

              return (
                <div
                  key={option.id}
                  className="border rounded-lg p-4 space-y-3"
                >
                  <div className="font-medium">
                    {optionDate ? (
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        {format(optionDate, 'EEEE, MMMM d, yyyy')}
                        <span className="text-muted-foreground">•</span>
                        <Clock className="h-4 w-4" />
                        {format(optionDate, 'h:mm a')}
                        {option.duration > 0 && (
                          <span className="text-sm text-muted-foreground">
                            ({option.duration} min)
                          </span>
                        )}
                      </div>
                    ) : (
                      option.pollOptionText
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant={userVote === 'yes' ? 'default' : 'outline'}
                      onClick={() => handleVote(option.id, 'yes')}
                      className={cn(
                        userVote === 'yes' && 'bg-green-600 hover:bg-green-700'
                      )}
                    >
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Yes
                    </Button>
                    {poll.allowMaybe === 1 && (
                      <Button
                        size="sm"
                        variant={userVote === 'maybe' ? 'default' : 'outline'}
                        onClick={() => handleVote(option.id, 'maybe')}
                        className={cn(
                          userVote === 'maybe' && 'bg-yellow-600 hover:bg-yellow-700'
                        )}
                      >
                        <HelpCircle className="h-4 w-4 mr-2" />
                        Maybe
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant={userVote === 'no' ? 'default' : 'outline'}
                      onClick={() => handleVote(option.id, 'no')}
                      className={cn(
                        userVote === 'no' && 'bg-red-600 hover:bg-red-700'
                      )}
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      No
                    </Button>
                  </div>
                </div>
              );
            })}
          </CardContent>
          <CardContent className="pt-0 pb-6">
            <Button
              className="w-full"
              size="lg"
              onClick={handleSubmit}
              disabled={submitting || votes.size === 0}
            >
              {submitting ? 'Submitting...' : `Submit Votes (${votes.size} selected)`}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Results View */}
      {(showResults || isExpired) && (
        <Card>
          <CardHeader>
            <CardTitle>Results</CardTitle>
            <CardDescription>
              {results.length} time slots • {results[0]?.total || 0} responses
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {sortedResults.map((result, index) => {
              const optionDate = result.option.timestamp
                ? new Date(result.option.timestamp * 1000)
                : null;
              const isBest = result === bestOption && result.total > 0;

              return (
                <div
                  key={result.option.id}
                  className={cn(
                    'border rounded-lg p-4',
                    isBest && 'border-green-500 bg-green-50 dark:bg-green-950'
                  )}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="font-medium">
                      {optionDate ? (
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          {format(optionDate, 'EEE, MMM d')} •{' '}
                          {format(optionDate, 'h:mm a')}
                          {isBest && (
                            <Badge className="bg-green-600">Best Time</Badge>
                          )}
                        </div>
                      ) : (
                        result.option.pollOptionText
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold">
                        {result.availabilityScore}%
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {result.total} {result.total === 1 ? 'vote' : 'votes'}
                      </div>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <span className="font-medium">{result.yes}</span>
                      <span className="text-muted-foreground">Yes</span>
                    </div>
                    {poll.allowMaybe === 1 && (
                      <div className="flex items-center gap-2 text-sm">
                        <HelpCircle className="h-4 w-4 text-yellow-600" />
                        <span className="font-medium">{result.maybe}</span>
                        <span className="text-muted-foreground">Maybe</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-sm">
                      <XCircle className="h-4 w-4 text-red-600" />
                      <span className="font-medium">{result.no}</span>
                      <span className="text-muted-foreground">No</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

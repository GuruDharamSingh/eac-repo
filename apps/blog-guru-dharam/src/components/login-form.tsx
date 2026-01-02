'use client';

import { useState, useTransition, FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getClientAuth } from '@elkdonis/auth-client';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';

interface LoginFormProps {
  redirectPath?: string;
  title?: string;
  description?: string;
}

export function LoginForm({
  redirectPath = '/entry',
  title = 'Author sign in',
  description = 'Access the private workspace for publishing and editing entries.',
}: LoginFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = getClientAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const queryMessage = searchParams?.get('message');

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!email || !password) {
      setError('Email and password are required.');
      return;
    }

    startTransition(async () => {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError(signInError.message);
        return;
      }

      router.replace(redirectPath);
      router.refresh();
    });
  };

  return (
    <Card className="w-full max-w-lg border border-border/70 bg-card/80 shadow-2xl">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {queryMessage ? (
          <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-900">
            {queryMessage === 'unauthorized'
              ? 'You must be an authorized contributor to view that page.'
              : queryMessage}
          </div>
        ) : null}

        {error ? (
          <div className="mb-4 rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.currentTarget.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(event) => setPassword(event.currentTarget.value)}
            />
          </div>

          <Button type="submit" disabled={isPending} className="w-full">
            {isPending ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

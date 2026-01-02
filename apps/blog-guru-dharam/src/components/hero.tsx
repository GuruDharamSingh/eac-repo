import Link from 'next/link';
import type { BlogHeroConfig } from '@elkdonis/blog-client';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';

interface HeroProps {
  hero?: BlogHeroConfig;
  orgName: string;
}

const highlightCards = [
  {
    title: 'Daily Practice',
    description: 'Breath, mantra, and meditative prompts for the sangha.',
  },
  {
    title: 'Guided Journeys',
    description: 'Audio immersions to explore subtle energetics and healing work.',
  },
  {
    title: 'Field Notes',
    description: 'Reflections and transmissions from collective gatherings.',
  },
];

export function Hero({ hero, orgName }: HeroProps) {
  if (!hero) {
    return null;
  }

  return (
    <section className="space-y-10">
      <div className="grid gap-8 lg:grid-cols-[1.5fr_1fr]">
        <div className="relative overflow-hidden rounded-3xl border border-border/70 bg-gradient-to-br from-primary/10 via-background to-secondary/10 p-8 shadow-2xl">
          <Badge variant="secondary" className="w-fit bg-primary/10 text-primary">
            Featured transmissions
          </Badge>
          <h1 className="mt-6 text-4xl font-semibold leading-tight tracking-tight text-foreground md:text-5xl">
            {hero.title || orgName}
          </h1>
          {hero.description ? (
            <p className="mt-4 max-w-2xl text-lg text-muted-foreground">{hero.description}</p>
          ) : null}

          <div className="mt-8 flex flex-wrap gap-4">
            {hero.ctaHref && hero.ctaLabel ? (
              <Button size="lg" asChild>
                <Link href={hero.ctaHref}>{hero.ctaLabel}</Link>
              </Button>
            ) : null}
            <Button size="lg" variant="ghost" asChild>
              <Link href="/posts">Browse archive</Link>
            </Button>
          </div>

          <div className="mt-10 grid gap-4 text-sm text-muted-foreground sm:grid-cols-3">
            <div>
              <p className="text-3xl font-semibold text-foreground">18+</p>
              <p>Years of teaching</p>
            </div>
            <div>
              <p className="text-3xl font-semibold text-foreground">200+</p>
              <p>Writings and practices</p>
            </div>
            <div>
              <p className="text-3xl font-semibold text-foreground">Global</p>
              <p>Collective community</p>
            </div>
          </div>

          <div className="pointer-events-none absolute -right-24 top-12 h-48 w-48 rounded-full bg-primary/15 blur-[120px]" />
          <div className="pointer-events-none absolute -bottom-10 left-1/3 h-40 w-40 rounded-full bg-secondary/20 blur-[100px]" />
        </div>

        <div className="grid gap-4">
          {highlightCards.map((card) => (
            <Card key={card.title} className="bg-card/80">
              <CardHeader>
                <CardTitle className="text-lg">{card.title}</CardTitle>
                <CardDescription>{card.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  Updated weekly
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

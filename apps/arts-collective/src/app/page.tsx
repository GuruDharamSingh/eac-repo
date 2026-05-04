import Link from "next/link";
import { Button } from "@/components/ui/button";
import { DissolveReveal } from "@/components/dissolve-reveal";

export default function LandingPage() {
  return (
    <>
      <DissolveReveal />
      <main className="relative mx-auto flex min-h-screen max-w-2xl flex-col justify-start gap-16 px-6 py-24 md:py-32">
        <section className="space-y-5">
          <p className="text-sm uppercase tracking-[0.22em] text-muted-foreground">
            Welcome to the Collective
          </p>
          <h1 className="font-serif text-4xl leading-[1.1] text-foreground md:text-5xl">
            Arts Collective is the main free offering of Elkdonis Arts
            Collective.
          </h1>
          <p className="text-lg leading-relaxed text-muted-foreground">
            We separate <em>Arts Collective</em> as a network from the full
            name <em>Elkdonis Arts Collective</em> to allow users and artists
            to be put first — and to suggest the generality and diffused
            quality this work really has. By that we refer to the core
            Elkdonis principle of the group, and of group support in creating
            something for the benefit of all beings.
          </p>
        </section>

        <section className="space-y-4 border-l-2 border-accent/70 pl-5">
          <p className="text-base leading-relaxed text-foreground/90">
            This network aims to be as transparent as possible in providing
            the structured web portal that will aid in connecting people who
            are interested in artists to the artists — and artists to other
            artists, and to the people around them.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="font-serif text-2xl text-foreground">
            What you get by creating an account
          </h2>
          <p className="text-base leading-relaxed text-muted-foreground">
            A subdomain of your own. Access to the back end of our network —
            automated emails, ongoing engagement with the people who follow
            your work, checkout and store tools, cross-promotion with other
            artists in the collective.
          </p>
        </section>

        <section className="space-y-4">
          <p className="text-base leading-relaxed text-foreground/90">
            We are not looking to control or manage any of the offerings being
            presented through our network. We do ask that people are willing
            to participate in the aims of the network — openness, mutual aid,
            support.
          </p>
          <p className="text-base leading-relaxed text-muted-foreground">
            There are opportunities to go deeper into what our collective is,
            but that&apos;s not necessary — it&apos;s not even necessarily
            encouraged. If you show up as an active artist in the community
            and you&apos;re interested in what we&apos;re building, there is
            space and attention for you to become more integrated and to find
            out more about what Elkdonis is about. You might also use our site
            and never try to deepen your connection with the network as a
            place, and that&apos;s totally fine. You&apos;re doing enough by
            being present. Thank you.
          </p>
        </section>

        <section className="flex flex-col gap-3 pt-4 sm:flex-row">
          <Button asChild size="lg">
            <Link href="/login?mode=signup">Join the Collective</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/login">Sign in</Link>
          </Button>
        </section>
      </main>
    </>
  );
}

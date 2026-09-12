export function SiteFooter() {
  return (
    <footer className="border-t border-border/70">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-5 py-6 text-xs text-muted-foreground">
        <p>Positions calculated with the Swiss Ephemeris. Tropical zodiac.</p>
        <p>
          Part of the{" "}
          <a href="https://elkdonis-arts.org" className="underline underline-offset-4 hover:text-foreground">
            Elkdonis Arts Collective
          </a>
        </p>
      </div>
    </footer>
  );
}

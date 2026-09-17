import { useEffect, useState } from 'react';

/**
 * Inline styles cannot carry media queries, and the overlay has to lay itself
 * out differently on a phone — so the breakpoints are asked for directly.
 *
 * Starts false and corrects after mount rather than guessing during SSR, which
 * would otherwise render a desktop overlay into a phone's HTML and flash.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const list = window.matchMedia(query);
    setMatches(list.matches);

    const onChange = (event: MediaQueryListEvent) => setMatches(event.matches);
    list.addEventListener('change', onChange);
    return () => list.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

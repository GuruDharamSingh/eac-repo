/**
 * Local class-merging helper. Avoids forcing consumers to install clsx/tailwind-merge
 * in every package. Falls back to a tiny implementation since the components
 * mostly compose static class strings.
 */
export function cn(...inputs: Array<string | undefined | null | false>): string {
  return inputs.filter(Boolean).join(" ");
}

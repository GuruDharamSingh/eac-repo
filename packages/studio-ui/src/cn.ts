/**
 * Local class-merging helper. Mirrors @elkdonis/commerce's cn() so studio-ui
 * stays free of a hard clsx/tailwind-merge dependency — components compose
 * mostly static class strings.
 */
export function cn(
  ...inputs: Array<string | undefined | null | false>
): string {
  return inputs.filter(Boolean).join(" ");
}

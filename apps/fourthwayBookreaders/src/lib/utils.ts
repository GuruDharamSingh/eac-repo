import clsx, { type ClassValue } from "clsx";

/**
 * Class joiner. Deliberately clsx alone, not clsx + tailwind-merge: this app's
 * own surface is plain CSS with BEM-ish class names, so there are no
 * conflicting Tailwind utilities to dedupe and no reason to pull in the extra
 * dependency.
 */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}

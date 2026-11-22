import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { format } from "date-fns"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format a date to a readable string
 * @param date - Date to format
 * @param formatString - Format string (default: "MMM d, yyyy")
 */
export function formatDate(date: Date | string | null | undefined, formatString = "MMM d, yyyy"): string {
  if (!date) return "";
  const dateObj = typeof date === "string" ? new Date(date) : date;
  return format(dateObj, formatString);
}

/**
 * Format a time to a readable string
 * @param date - Date to format
 * @param formatString - Format string (default: "h:mm a")
 */
export function formatTime(date: Date | string | null | undefined, formatString = "h:mm a"): string {
  if (!date) return "";
  const dateObj = typeof date === "string" ? new Date(date) : date;
  return format(dateObj, formatString);
}

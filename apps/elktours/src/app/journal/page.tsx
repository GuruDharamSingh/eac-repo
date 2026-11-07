import { redirect } from "next/navigation";

/**
 * The Journal listing became the public catalogue of places (2026-11-02).
 * The journal feed held no posts then; should posts appear, each still opens
 * at /journal/<slug> (app/[feed]/[slug]), since only this listing moved.
 */
export default function JournalPage() {
  redirect("/places");
}

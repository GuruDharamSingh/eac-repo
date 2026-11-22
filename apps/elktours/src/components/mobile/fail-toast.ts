import { toast } from "sonner";

/** An error toast; a raw "available after migration / cutover" refusal becomes a plain sentence. */
export function failToast(message: string | undefined | null): void {
  const m = (message ?? "").trim();
  if (!m) return void toast.error("That did not work. Try again.");
  if (/available after|after the (booking )?cutover|after migration/i.test(m)) {
    return void toast.error("This isn\x27t switched on yet. The office has been told.");
  }
  toast.error(m);
}

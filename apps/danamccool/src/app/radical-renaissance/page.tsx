import { redirect } from "next/navigation";

// Radical Renaissance lives under Mixed Media, as on her old site; this is
// the short address for sharing the brand on its own.
export default function RadicalRenaissanceRedirect() {
  redirect("/mixed-media/radical-renaissance");
}

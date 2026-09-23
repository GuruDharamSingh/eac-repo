import { redirect } from "next/navigation";

// The page is "Manifestos" in her nav; the singular is what people type.
export default function ManifestoRedirect() {
  redirect("/manifestos");
}

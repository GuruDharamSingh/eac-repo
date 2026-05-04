import { redirect } from "next/navigation";
import { getServerSession } from "@elkdonis/auth-server";

export default async function RootPage() {
  const session = await getServerSession();
  redirect(session?.user ? "/feed" : "/login");
}

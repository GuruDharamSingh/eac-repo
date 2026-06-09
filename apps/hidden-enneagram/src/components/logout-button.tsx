"use client";

import { useRouter } from "next/navigation";
import { signOut } from "@elkdonis/auth-client";

export function LogoutButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={async () => {
        await signOut();
        router.push("/");
        router.refresh();
      }}
      style={{
        padding: "10px 24px",
        border: "1px solid rgba(236,231,221,0.18)",
        borderRadius: 999,
        background: "transparent",
        color: "#ece7dd",
        fontFamily: "var(--font-eb-garamond), Georgia, serif",
        fontSize: 12,
        letterSpacing: "0.2em",
        textTransform: "uppercase",
        cursor: "pointer",
      }}
    >
      Sign out
    </button>
  );
}

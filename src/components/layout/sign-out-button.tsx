"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function signOut() {
    if (pending) return;
    setPending(true);
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
      router.replace("/login");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
      type="button"
      onClick={signOut}
      disabled={pending}
    >
      {pending ? "Signing out…" : "Sign out"}
    </button>
  );
}

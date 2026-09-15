"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Stage 2: Account replaces Profile; keep redirect for Stage 1 bookmarks. */
export default function ProfileRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/account");
  }, [router]);
  return <div className="auth-page panel muted">Redirecting to Account…</div>;
}

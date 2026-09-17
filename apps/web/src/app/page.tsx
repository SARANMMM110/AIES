"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { ToolLoadingPulse } from "@/components/ToolLoadingPulse";

/** Public entry: sales for guests (instant); dashboard only when a token exists. */
export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    const token =
      typeof window !== "undefined" ? localStorage.getItem("aes_token") : null;
    // Most visitors are guests — skip waiting on /api/auth/me
    if (!token) {
      router.replace("/sales");
      return;
    }
    if (loading) return;
    router.replace(user ? "/dashboard" : "/sales");
  }, [user, loading, router]);

  return <ToolLoadingPulse label="Loading AI Enterprise Studio" />;
}

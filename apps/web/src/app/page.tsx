"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { ToolLoadingPulse } from "@/components/ToolLoadingPulse";

/** Public entry: sales catalog for guests; dashboard for signed-in users. */
export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    router.replace(user ? "/dashboard" : "/sales");
  }, [user, loading, router]);

  return <ToolLoadingPulse label="Loading AI Enterprise Studio" />;
}

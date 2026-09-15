"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";

/** Go to the previous history entry; only use `fallbackHref` when there is nowhere to go back. */
export function useNavigateBack(fallbackHref: string) {
  const router = useRouter();

  return useCallback(() => {
    if (typeof window !== "undefined") {
      const idx = (window.history.state as { idx?: number } | null)?.idx;
      if (typeof idx === "number" ? idx > 0 : window.history.length > 1) {
        router.back();
        return;
      }
    }
    router.push(fallbackHref);
  }, [router, fallbackHref]);
}

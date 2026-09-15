"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { ToolLoadingPulse } from "@/components/ToolLoadingPulse";

export function Protected({
  children,
  adminOnly = false,
}: {
  children: React.ReactNode;
  adminOnly?: boolean;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      if (adminOnly) {
        const next = pathname && pathname.startsWith("/admin") ? pathname : "/admin";
        router.replace(`/admin/login?next=${encodeURIComponent(next)}`);
      } else {
        router.replace(`/login?next=${encodeURIComponent(pathname || "/dashboard")}`);
      }
      return;
    }
    if (adminOnly && user.role !== "ADMIN") {
      router.replace("/admin/login");
    }
  }, [user, loading, adminOnly, router, pathname]);

  if (loading) {
    return <ToolLoadingPulse label="Opening session" />;
  }

  if (!user) return null;
  if (adminOnly && user.role !== "ADMIN") return null;

  return <>{children}</>;
}

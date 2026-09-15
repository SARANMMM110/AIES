"use client";

import { useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

function RedirectInner() {
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const qs = search.toString();
    router.replace(`/admin/users/${params.id}${qs ? `?${qs}` : ""}`);
  }, [params.id, router, search]);

  return <p className="muted">Redirecting…</p>;
}

/** Legacy path — access management now lives under /admin/users/[id]. */
export default function LegacyAdminUserAccessRedirect() {
  return (
    <Suspense fallback={<p className="muted">Redirecting…</p>}>
      <RedirectInner />
    </Suspense>
  );
}

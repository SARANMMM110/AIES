"use client";

import { AdminShell } from "@/components/AdminShell";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";

export function AdminPlaceholder({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <AdminShell>
      <PageHeader title={title} subtitle={description} />
      <div className="panel">
        <EmptyState
          title={`${title} management comes in a later stage`}
          description="Navigation and permissions are ready. Full CRUD for this section will be added without changing the core architecture."
        />
      </div>
    </AdminShell>
  );
}

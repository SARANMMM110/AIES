"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { Protected } from "@/components/Protected";
import { TablePagination } from "@/components/TablePagination";
import { ToolLoadingPulse } from "@/components/ToolLoadingPulse";
import { apiFetch } from "@/lib/api";
import { useClientPagination } from "@/hooks/useClientPagination";

type CustomerRow = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  createdAt: string;
  agencies: string[];
  grantedAt: string;
};

export default function AdminUsersPage() {
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pager = useClientPagination(customers);

  useEffect(() => {
    void apiFetch<{ customers: CustomerRow[] }>("/api/users/customers")
      .then((data) => setCustomers(data.customers || []))
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <Protected adminOnly>
      <AdminShell>
        <PageHeader
          title="Users"
          subtitle="Customers with agency access — name, email, unlocked products, and when access was granted."
          actions={
            <Link className="btn lime" href="/admin/users/provision">
              Create account
            </Link>
          }
        />
        {error ? <p className="error">{error}</p> : null}

        <div className="panel">
          {loading ? (
            <ToolLoadingPulse label="Loading users" fullPage={false} />
          ) : customers.length === 0 ? (
            <EmptyState
              title="No customers yet"
              description="Create an account from an inquiry, or grant agency access, to see customers here."
            />
          ) : (
            <>
              <table className="table">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Email</th>
                    <th>Agencies</th>
                    <th>Access granted</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {pager.pageItems.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <strong>
                          {row.firstName} {row.lastName}
                        </strong>
                      </td>
                      <td>{row.email}</td>
                      <td>{row.agencies.join(", ") || "—"}</td>
                      <td>{new Date(row.grantedAt).toLocaleString()}</td>
                      <td>
                        <Link className="btn btn-sm" href={`/admin/users/${row.id}`}>
                          Manage access
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <TablePagination
                page={pager.page}
                totalPages={pager.totalPages}
                total={pager.total}
                pageSize={pager.pageSize}
                show={pager.showPagination}
                onPageChange={pager.setPage}
              />
            </>
          )}
        </div>
      </AdminShell>
    </Protected>
  );
}

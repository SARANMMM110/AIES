"use client";

import { AdminShell } from "@/components/AdminShell";
import { ChangePasswordForm } from "@/components/ChangePasswordForm";
import { PageHeader } from "@/components/PageHeader";
import { Protected } from "@/components/Protected";
import { useAuth } from "@/contexts/AuthContext";

export default function AdminSettingsPage() {
  const { user } = useAuth();

  return (
    <Protected adminOnly>
      <AdminShell>
        <PageHeader title="Settings" subtitle="Your admin profile and password." />

        <div className="stack">
          <section className="panel" style={{ maxWidth: 480 }}>
            <div className="section-heading">
              <h2>Admin profile</h2>
            </div>
            <p className="muted" style={{ marginTop: 0 }}>
              Signed in as <strong>{user?.email}</strong>
              {user ? ` · ${user.firstName} ${user.lastName}` : ""}.
            </p>
          </section>
          <section className="panel" style={{ maxWidth: 480 }}>
            <div className="section-heading">
              <h2>Change password</h2>
            </div>
            <p className="muted" style={{ marginTop: 0 }}>
              Update your admin sign-in password. Other active sessions will be signed out.
            </p>
            <ChangePasswordForm compact />
          </section>
        </div>
      </AdminShell>
    </Protected>
  );
}

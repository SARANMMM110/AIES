"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiClientError, apiFetch, getToken, setToken } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

type NotificationRow = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  href: string | null;
  readAt: string | null;
  createdAt: string;
};

type Props = {
  /** Visual tone for admin vs user shell */
  tone?: "admin" | "user";
};

export function NotificationBell({ tone = "user" }: Props) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [authOk, setAuthOk] = useState(true);
  const rootRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (!user || !authOk || !getToken()) return;
    try {
      const data = await apiFetch<{ notifications: NotificationRow[]; unreadCount: number }>(
        "/api/notifications"
      );
      setItems(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch (err) {
      if (err instanceof ApiClientError && (err.status === 401 || err.status === 403)) {
        setAuthOk(false);
        setToken(null);
      }
    }
  }, [user, authOk]);

  useEffect(() => {
    if (!user || !authOk) return;
    void load();
    const timer = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void load();
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [load, user, authOk]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  async function markRead(id: string) {
    try {
      await apiFetch(`/api/notifications/${id}/read`, { method: "POST" });
      setItems((prev) => prev.map((row) => (row.id === id ? { ...row, readAt: new Date().toISOString() } : row)));
      setUnreadCount((n) => Math.max(0, n - 1));
    } catch {
      // ignore
    }
  }

  async function markAllRead() {
    try {
      await apiFetch("/api/notifications/read-all", { method: "POST" });
      setItems((prev) => prev.map((row) => ({ ...row, readAt: row.readAt || new Date().toISOString() })));
      setUnreadCount(0);
    } catch {
      // ignore
    }
  }

  return (
    <div className={`notify-bell notify-bell--${tone}`} ref={rootRef}>
      <button
        type="button"
        className="notify-bell-btn"
        aria-label={unreadCount ? `${unreadCount} unread notifications` : "Notifications"}
        aria-expanded={open}
        onClick={() => {
          setOpen((v) => !v);
          if (!open) void load();
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
          <path d="M6 9a6 6 0 1 1 12 0c0 7 3 7 3 7H3s3 0 3-7" />
          <path d="M10 19a2 2 0 0 0 4 0" />
        </svg>
        {unreadCount > 0 ? <span className="notify-bell-badge">{unreadCount > 9 ? "9+" : unreadCount}</span> : null}
      </button>

      {open ? (
        <div className="notify-panel" role="dialog" aria-label="Notifications">
          <div className="notify-panel-head">
            <strong>Notifications</strong>
            {unreadCount > 0 ? (
              <button type="button" className="notify-link-btn" onClick={() => void markAllRead()}>
                Mark all read
              </button>
            ) : null}
          </div>
          <ul className="notify-list">
            {items.length === 0 ? <li className="notify-empty">No notifications yet.</li> : null}
            {items.map((item) => (
              <li key={item.id} className={item.readAt ? undefined : "unread"}>
                {item.href ? (
                  <Link
                    href={item.href}
                    onClick={() => {
                      if (!item.readAt) void markRead(item.id);
                      setOpen(false);
                    }}
                  >
                    <strong>{item.title}</strong>
                    {item.body ? <span>{item.body}</span> : null}
                    <em>{new Date(item.createdAt).toLocaleString()}</em>
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      if (!item.readAt) void markRead(item.id);
                    }}
                  >
                    <strong>{item.title}</strong>
                    {item.body ? <span>{item.body}</span> : null}
                    <em>{new Date(item.createdAt).toLocaleString()}</em>
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

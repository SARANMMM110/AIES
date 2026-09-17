/**
 * Normalize DATABASE_URL for a long-lived PM2 API process on Supabase session pooler.
 * connection_limit=1 (common for serverless/transaction pooler) starves concurrent
 * requests and causes "Timed out fetching a new connection" / 500s.
 */
export function normalizeDatabaseUrl(raw: string): string {
  if (!raw) return raw;

  const qIndex = raw.indexOf("?");
  const base = qIndex >= 0 ? raw.slice(0, qIndex) : raw;
  const params = new URLSearchParams(qIndex >= 0 ? raw.slice(qIndex + 1) : "");

  const existingLimit = Number(params.get("connection_limit") || "0");
  // One API process serving parallel page loads — keep headroom.
  const limit = Number.isFinite(existingLimit) && existingLimit >= 10 ? existingLimit : 15;
  params.set("connection_limit", String(limit));

  const existingTimeout = Number(params.get("pool_timeout") || "0");
  const timeout =
    Number.isFinite(existingTimeout) && existingTimeout >= 30 ? existingTimeout : 60;
  params.set("pool_timeout", String(timeout));

  if (!params.has("sslmode") && /supabase\.com|pooler/i.test(raw)) {
    params.set("sslmode", "require");
  }

  return `${base}?${params.toString()}`;
}

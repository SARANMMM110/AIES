type LogFields = Record<string, unknown>;

function scrub(fields?: LogFields): LogFields | undefined {
  if (!fields) return undefined;
  const out: LogFields = {};
  for (const [k, v] of Object.entries(fields)) {
    const key = k.toLowerCase();
    if (
      key.includes("password") ||
      key.includes("secret") ||
      key.includes("apikey") ||
      key.includes("api_key") ||
      key.includes("authorization") ||
      key.includes("token") ||
      key.includes("card") ||
      key.includes("cvv")
    ) {
      out[k] = "[redacted]";
    } else {
      out[k] = v;
    }
  }
  return out;
}

export function logInfo(message: string, fields?: LogFields) {
  console.log(JSON.stringify({ level: "info", message, ...scrub(fields), ts: new Date().toISOString() }));
}

export function logWarn(message: string, fields?: LogFields) {
  console.warn(JSON.stringify({ level: "warn", message, ...scrub(fields), ts: new Date().toISOString() }));
}

export function logError(message: string, fields?: LogFields) {
  console.error(JSON.stringify({ level: "error", message, ...scrub(fields), ts: new Date().toISOString() }));
}

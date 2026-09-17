export function getClientApiBase(): string {
  const pub = process.env.NEXT_PUBLIC_API_URL;
  // Same-origin when unset or accidentally set to localhost (common bad prod build).
  if (!pub || pub.includes("localhost") || pub.includes("127.0.0.1")) {
    return "";
  }
  return pub;
}

export type ApiResult<T> =
  | { success: true; data: T }
  | { success: false; error: { message: string; code?: string; details?: unknown } };

export class ApiClientError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
    public details?: unknown
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("aes_token");
}

export { getToken };

export function setToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) localStorage.setItem("aes_token", token);
  else localStorage.removeItem("aes_token");
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = new Headers(options.headers);
  if (!headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json");
  }
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(`${getClientApiBase()}${path}`, {
    ...options,
    headers,
  });

  const json = (await res.json()) as ApiResult<T>;
  if (!res.ok || !json.success) {
    const err = !json.success ? json.error : { message: "Request failed" };
    const detailReason =
      err.details &&
      typeof err.details === "object" &&
      err.details !== null &&
      "reason" in err.details
        ? String((err.details as { reason?: unknown }).reason ?? "")
        : "";
    const message =
      detailReason && err.message === "Internal server error"
        ? detailReason
        : err.message;
    throw new ApiClientError(message, res.status, err.code, err.details);
  }
  return json.data;
}

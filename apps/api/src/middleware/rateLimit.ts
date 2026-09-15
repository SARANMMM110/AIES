import type { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/errors";

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/**
 * Simple in-memory rate limiter (per-process). Suitable for single-instance API.
 * Keyed by IP + route group.
 */
export function rateLimit(opts: {
  windowMs: number;
  max: number;
  key?: (req: Request) => string;
  name?: string;
}) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const id = opts.key?.(req) ?? `${req.ip || "unknown"}:${opts.name || req.path}`;
    const now = Date.now();
    let bucket = buckets.get(id);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + opts.windowMs };
      buckets.set(id, bucket);
    }
    bucket.count += 1;
    if (bucket.count > opts.max) {
      return next(
        new AppError(429, "Too many requests. Please try again shortly.", "RATE_LIMITED")
      );
    }
    next();
  };
}

/** Periodic cleanup to avoid unbounded map growth */
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of buckets) {
    if (v.resetAt <= now) buckets.delete(k);
  }
}, 60_000).unref?.();

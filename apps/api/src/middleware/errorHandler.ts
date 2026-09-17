import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { AppError } from "../utils/errors";
import { env } from "../config/env";

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({
    success: false,
    error: { message: "Route not found", code: "ROUTE_NOT_FOUND" },
  });
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      error: {
        message: err.message,
        code: err.code,
        details: err.details,
      },
    });
  }

  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      error: {
        message: "Validation failed",
        code: "VALIDATION_ERROR",
        details: err.flatten(),
      },
    });
  }

  console.error("[api:error]", err);
  const isProd = env.NODE_ENV === "production";
  const message =
    err instanceof Error ? err.message : "Internal server error";
  return res.status(500).json({
    success: false,
    error: {
      message: isProd ? "Internal server error" : message,
      code: "INTERNAL_ERROR",
      // Safe diagnostic for ops (no stack). Helps VPS debugging without NODE_ENV=development.
      details: isProd ? { reason: message } : undefined,
    },
  });
}

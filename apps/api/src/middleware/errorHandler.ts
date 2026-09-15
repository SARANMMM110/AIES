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
  return res.status(500).json({
    success: false,
    error: {
      message:
        env.NODE_ENV === "production"
          ? "Internal server error"
          : err instanceof Error
            ? err.message
            : "Internal server error",
      code: "INTERNAL_ERROR",
    },
  });
}

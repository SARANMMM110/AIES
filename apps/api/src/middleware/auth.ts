import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { createHash } from "crypto";
import { prisma, UserRole } from "@aes/database";
import { env } from "../config/env";
import { AppError } from "../utils/errors";

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  firstName: string;
  lastName: string;
  isActive: boolean;
  createdAt: Date;
}

export interface AuthRequest extends Request {
  user?: AuthUser;
  token?: string;
}

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  sid?: string;
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function signAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"],
  });
}

export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, env.JWT_SECRET) as JwtPayload;
}

function extractBearer(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice(7).trim() || null;
}

export async function authenticate(
  req: AuthRequest,
  _res: Response,
  next: NextFunction
) {
  try {
    const token = extractBearer(req);
    if (!token) {
      throw new AppError(401, "Authentication required", "UNAUTHORIZED");
    }

    let payload: JwtPayload;
    try {
      payload = verifyAccessToken(token);
    } catch {
      throw new AppError(401, "Invalid or expired token", "INVALID_TOKEN");
    }

    let user: AuthUser | undefined;

    if (payload.sid) {
      // One round-trip: session + user (Supabase latency dominates when split).
      const session = await prisma.session.findUnique({
        where: { id: payload.sid },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              role: true,
              firstName: true,
              lastName: true,
              isActive: true,
              createdAt: true,
            },
          },
        },
      });
      if (
        !session ||
        session.revokedAt ||
        session.expiresAt < new Date() ||
        session.tokenHash !== hashToken(token)
      ) {
        throw new AppError(401, "Session expired or revoked", "SESSION_INVALID");
      }
      if (!session.user.isActive) {
        throw new AppError(401, "User not found or inactive", "USER_INACTIVE");
      }
      user = session.user;
    } else {
      const row = await prisma.user.findUnique({
        where: { id: payload.sub },
        select: {
          id: true,
          email: true,
          role: true,
          firstName: true,
          lastName: true,
          isActive: true,
          createdAt: true,
        },
      });
      if (!row || !row.isActive) {
        throw new AppError(401, "User not found or inactive", "USER_INACTIVE");
      }
      user = row;
    }

    req.token = token;
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

/** Attach user when Bearer token is present; otherwise continue as guest. */
export async function optionalAuthenticate(
  req: AuthRequest,
  _res: Response,
  next: NextFunction
) {
  try {
    const token = extractBearer(req);
    if (!token) {
      next();
      return;
    }

    let payload: JwtPayload;
    try {
      payload = verifyAccessToken(token);
    } catch {
      next();
      return;
    }

    if (payload.sid) {
      const session = await prisma.session.findUnique({
        where: { id: payload.sid },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              role: true,
              firstName: true,
              lastName: true,
              isActive: true,
              createdAt: true,
            },
          },
        },
      });
      if (
        !session ||
        session.revokedAt ||
        session.expiresAt < new Date() ||
        session.tokenHash !== hashToken(token) ||
        !session.user.isActive
      ) {
        next();
        return;
      }
      req.token = token;
      req.user = session.user;
      next();
      return;
    }

    const row = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        role: true,
        firstName: true,
        lastName: true,
        isActive: true,
        createdAt: true,
      },
    });
    if (!row || !row.isActive) {
      next();
      return;
    }

    req.token = token;
    req.user = row;
    next();
  } catch (err) {
    next(err);
  }
}

export function requireRole(...roles: UserRole[]) {
  return (req: AuthRequest, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError(401, "Authentication required", "UNAUTHORIZED"));
    }
    if (!roles.includes(req.user.role)) {
      return next(new AppError(403, "Insufficient permissions", "FORBIDDEN"));
    }
    next();
  };
}

export const requireAdmin = requireRole(UserRole.ADMIN);

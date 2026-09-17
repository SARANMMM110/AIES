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

/** Short-lived memo so rapid UI clicks don't each pay a Supabase round-trip. */
const authMemo = new Map<string, { at: number; user: AuthUser }>();
const AUTH_MEMO_MS = 25_000;

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function clearAuthMemo(token?: string | null) {
  if (!token) {
    authMemo.clear();
    return;
  }
  authMemo.delete(hashToken(token));
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

const userSelect = {
  id: true,
  email: true,
  role: true,
  firstName: true,
  lastName: true,
  isActive: true,
  createdAt: true,
} as const;

async function resolveUser(token: string, payload: JwtPayload): Promise<AuthUser> {
  if (payload.sid) {
    const session = await prisma.session.findUnique({
      where: { id: payload.sid },
      include: { user: { select: userSelect } },
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
    return session.user;
  }

  const row = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: userSelect,
  });
  if (!row || !row.isActive) {
    throw new AppError(401, "User not found or inactive", "USER_INACTIVE");
  }
  return row;
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

    const memoKey = hashToken(token);
    const hit = authMemo.get(memoKey);
    if (hit && Date.now() - hit.at < AUTH_MEMO_MS) {
      req.token = token;
      req.user = hit.user;
      next();
      return;
    }

    const user = await resolveUser(token, payload);
    authMemo.set(memoKey, { at: Date.now(), user });
    // Bound memo size (admin UIs click rapidly; avoid unbounded growth).
    if (authMemo.size > 500) {
      const oldest = authMemo.keys().next().value;
      if (oldest) authMemo.delete(oldest);
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

    const memoKey = hashToken(token);
    const hit = authMemo.get(memoKey);
    if (hit && Date.now() - hit.at < AUTH_MEMO_MS) {
      req.token = token;
      req.user = hit.user;
      next();
      return;
    }

    try {
      const user = await resolveUser(token, payload);
      authMemo.set(memoKey, { at: Date.now(), user });
      req.token = token;
      req.user = user;
    } catch {
      // guest
    }
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

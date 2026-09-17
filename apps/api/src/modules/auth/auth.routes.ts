import bcrypt from "bcryptjs";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "@aes/database";
import { env } from "../../config/env";
import { AppError } from "../../utils/errors";
import { ok, toPublicUser } from "../../utils/response";
import { validate } from "../../middleware/validate";
import {
  authenticate,
  hashToken,
  signAccessToken,
  type AuthRequest,
} from "../../middleware/auth";
import { createUserWithSession } from "./create-user-session";

const registerSchema = z.object({
  email: z.string().email().max(255).transform((v) => v.toLowerCase().trim()),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128)
    .regex(/[A-Za-z]/, "Password must include a letter")
    .regex(/[0-9]/, "Password must include a number"),
  firstName: z.string().min(1).max(100).trim(),
  lastName: z.string().min(1).max(100).trim(),
});

const loginSchema = z.object({
  email: z.string().email().transform((v) => v.toLowerCase().trim()),
  password: z.string().min(1),
});

function parseExpiryToDate(expiresIn: string): Date {
  const match = /^(\d+)([smhd])$/.exec(expiresIn);
  const now = Date.now();
  if (!match) return new Date(now + 7 * 24 * 60 * 60 * 1000);
  const amount = Number(match[1]);
  const unit = match[2];
  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };
  return new Date(now + amount * (multipliers[unit] ?? multipliers.d));
}

export const authRouter = Router();

authRouter.post("/register", validate(registerSchema), async (req, res, next) => {
  try {
    const body = req.body as z.infer<typeof registerSchema>;
    const created = await createUserWithSession(body);
    res.status(201).json(ok({ user: created.user, tokens: created.tokens }));
  } catch (err) {
    next(err);
  }
});

authRouter.post("/login", validate(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body as z.infer<typeof loginSchema>;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new AppError(401, "Invalid email or password", "INVALID_CREDENTIALS");
    }
    if (!user.isActive) {
      throw new AppError(403, "Account is inactive", "USER_INACTIVE");
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      throw new AppError(401, "Invalid email or password", "INVALID_CREDENTIALS");
    }

    const expiresAt = parseExpiryToDate(env.JWT_EXPIRES_IN);
    const session = await prisma.session.create({
      data: {
        userId: user.id,
        tokenHash: "pending",
        expiresAt,
      },
    });

    const accessToken = signAccessToken({
      sub: user.id,
      email: user.email,
      role: user.role,
      sid: session.id,
    });

    await prisma.session.update({
      where: { id: session.id },
      data: { tokenHash: hashToken(accessToken) },
    });

    res.json(
      ok({
        user: toPublicUser(user),
        tokens: { accessToken, expiresIn: env.JWT_EXPIRES_IN },
      })
    );
  } catch (err) {
    next(err);
  }
});

authRouter.post("/logout", authenticate, async (req: AuthRequest, res, next) => {
  try {
    if (req.token) {
      await prisma.session.updateMany({
        where: { tokenHash: hashToken(req.token), revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    res.json(ok({ message: "Logged out" }));
  } catch (err) {
    next(err);
  }
});

authRouter.get("/me", authenticate, async (req: AuthRequest, res, next) => {
  try {
    // authenticate already resolved the active user — avoid a second DB round-trip.
    res.json(ok({ user: toPublicUser(req.user!) }));
  } catch (err) {
    next(err);
  }
});

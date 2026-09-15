import bcrypt from "bcryptjs";
import { prisma } from "@aes/database";
import { env } from "../../config/env";
import { AppError } from "../../utils/errors";
import { toPublicUser } from "../../utils/response";
import { hashToken, signAccessToken } from "../../middleware/auth";

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

export type AccountInput = {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
};

export async function createUserWithSession(input: AccountInput) {
  const email = input.email.toLowerCase().trim();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new AppError(
      409,
      "Email already registered. Sign in to complete your purchase.",
      "EMAIL_TAKEN"
    );
  }

  const passwordHash = await bcrypt.hash(input.password, env.BCRYPT_SALT_ROUNDS);
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      role: "USER",
    },
  });

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

  return {
    user: toPublicUser(user),
    tokens: { accessToken, expiresIn: env.JWT_EXPIRES_IN },
    userId: user.id,
  };
}

import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma, UserRole } from "@aes/database";
import { env } from "../../config/env";
import { authenticate, hashToken, requireAdmin, type AuthRequest } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { AppError } from "../../utils/errors";
import { ok, toPublicUser } from "../../utils/response";
import { provisionCustomer, provisionCustomerSchema } from "./provision";

export const usersRouter = Router();

usersRouter.use(authenticate);

usersRouter.get("/me/profile", async (req: AuthRequest, res, next) => {
  try {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: req.user!.id },
    });
    res.json(ok({ user: toPublicUser(user) }));
  } catch (err) {
    next(err);
  }
});

const updateProfileSchema = z.object({
  firstName: z.string().min(1).max(100).trim().optional(),
  lastName: z.string().min(1).max(100).trim().optional(),
});

usersRouter.patch(
  "/me/profile",
  validate(updateProfileSchema),
  async (req: AuthRequest, res, next) => {
    try {
      const user = await prisma.user.update({
        where: { id: req.user!.id },
        data: req.body,
      });
      res.json(ok({ user: toPublicUser(user) }));
    } catch (err) {
      next(err);
    }
  }
);

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128)
    .regex(/[A-Za-z]/, "Password must include a letter")
    .regex(/[0-9]/, "Password must include a number"),
});

usersRouter.patch(
  "/me/password",
  validate(changePasswordSchema),
  async (req: AuthRequest, res, next) => {
    try {
      const { currentPassword, newPassword } = req.body as z.infer<typeof changePasswordSchema>;
      const user = await prisma.user.findUniqueOrThrow({
        where: { id: req.user!.id },
      });

      const valid = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!valid) {
        throw new AppError(400, "Current password is incorrect", "INVALID_PASSWORD");
      }
      if (currentPassword === newPassword) {
        throw new AppError(400, "New password must be different from the current password", "SAME_PASSWORD");
      }

      const passwordHash = await bcrypt.hash(newPassword, env.BCRYPT_SALT_ROUNDS);
      await prisma.user.update({
        where: { id: user.id },
        data: { passwordHash },
      });

      // Keep the current session; revoke every other active session for this user.
      if (req.token) {
        await prisma.session.updateMany({
          where: {
            userId: user.id,
            revokedAt: null,
            NOT: { tokenHash: hashToken(req.token) },
          },
          data: { revokedAt: new Date() },
        });
      }

      res.json(ok({ message: "Password updated" }));
    } catch (err) {
      next(err);
    }
  }
);

// --- Admin user management foundation ---
usersRouter.post(
  "/provision",
  requireAdmin,
  validate(provisionCustomerSchema),
  async (req: AuthRequest, res, next) => {
    try {
      const body = req.body as z.infer<typeof provisionCustomerSchema>;
      const result = await provisionCustomer(body, {
        id: req.user?.id,
        email: req.user?.email,
      });
      res.status(201).json(ok(result));
    } catch (err) {
      next(err);
    }
  }
);

/** Customers with active agency access (for Admin → Users). */
usersRouter.get("/customers", requireAdmin, async (_req, res, next) => {
  try {
    const access = await prisma.productAccess.findMany({
      where: {
        status: "ACTIVE",
        OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }],
        user: {
          role: "USER",
          NOT: {
            OR: [
              { email: { endsWith: "@test.local" } },
              { email: { contains: "sales-test-" } },
              { email: { endsWith: "@example.com" } },
              { email: "user@aies.local" },
            ],
          },
        },
      },
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true, createdAt: true } },
        product: { select: { id: true, name: true, slug: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 500,
    });

    const byUser = new Map<
      string,
      {
        id: string;
        email: string;
        firstName: string;
        lastName: string;
        createdAt: Date;
        agencies: string[];
        grantedAt: Date;
      }
    >();

    for (const row of access) {
      const current = byUser.get(row.userId);
      if (!current) {
        byUser.set(row.userId, {
          id: row.user.id,
          email: row.user.email,
          firstName: row.user.firstName,
          lastName: row.user.lastName,
          createdAt: row.user.createdAt,
          agencies: [row.product.name],
          grantedAt: row.createdAt,
        });
      } else {
        if (!current.agencies.includes(row.product.name)) current.agencies.push(row.product.name);
        if (row.createdAt > current.grantedAt) current.grantedAt = row.createdAt;
      }
    }

    const customers = [...byUser.values()].sort(
      (a, b) => b.grantedAt.getTime() - a.grantedAt.getTime()
    );
    res.json(ok({ customers }));
  } catch (err) {
    next(err);
  }
});

usersRouter.get("/", requireAdmin, async (_req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    res.json(ok({ users }));
  } catch (err) {
    next(err);
  }
});

usersRouter.get("/:id", requireAdmin, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) throw new AppError(404, "User not found", "NOT_FOUND");
    res.json(ok({ user: toPublicUser(user) }));
  } catch (err) {
    next(err);
  }
});

const adminUpdateSchema = z.object({
  role: z.nativeEnum(UserRole).optional(),
  isActive: z.boolean().optional(),
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
});

usersRouter.patch(
  "/:id",
  requireAdmin,
  validate(adminUpdateSchema),
  async (req: AuthRequest, res, next) => {
    try {
      if (req.params.id === req.user!.id && req.body.role && req.body.role !== "ADMIN") {
        throw new AppError(400, "Cannot demote your own admin role", "INVALID_OPERATION");
      }
      const user = await prisma.user.update({
        where: { id: req.params.id },
        data: req.body,
      });
      res.json(ok({ user: toPublicUser(user) }));
    } catch (err) {
      next(err);
    }
  }
);

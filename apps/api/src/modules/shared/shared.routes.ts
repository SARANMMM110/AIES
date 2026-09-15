import { Router } from "express";
import { prisma } from "@aes/database";
import { authenticate, type AuthRequest } from "../../middleware/auth";
import { AppError, assertFound } from "../../utils/errors";
import { ok } from "../../utils/response";

/**
 * Shared platform resources (Agency Wiki, etc.) — not duplicated per product.
 * Readable by any authenticated user with at least one product access (or admin).
 */
export const sharedRouter = Router();

sharedRouter.use(authenticate);

async function userMayReadShared(userId: string, role: string): Promise<boolean> {
  if (role === "ADMIN") return true;
  const access = await prisma.productAccess.findFirst({
    where: {
      userId,
      status: "ACTIVE",
      OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }],
      product: { status: "PUBLISHED" },
    },
  });
  return Boolean(access);
}

sharedRouter.get("/", async (req: AuthRequest, res, next) => {
  try {
    const allowed = await userMayReadShared(req.user!.id, req.user!.role);
    if (!allowed) {
      throw new AppError(
        403,
        "Shared resources require access to at least one product",
        "FORBIDDEN"
      );
    }
    const resources = await prisma.sharedResource.findMany({
      where: { isPublished: true },
      orderBy: { title: "asc" },
      select: {
        id: true,
        key: true,
        title: true,
        description: true,
        updatedAt: true,
      },
    });
    res.json(ok({ resources }));
  } catch (err) {
    next(err);
  }
});

sharedRouter.get("/:key", async (req: AuthRequest, res, next) => {
  try {
    const allowed = await userMayReadShared(req.user!.id, req.user!.role);
    if (!allowed) {
      throw new AppError(
        403,
        "Shared resources require access to at least one product",
        "FORBIDDEN"
      );
    }
    const resource = await prisma.sharedResource.findFirst({
      where: {
        OR: [{ key: req.params.key }, { id: req.params.key }],
        isPublished: true,
      },
    });
    assertFound(resource, "Shared resource not found");
    res.json(ok({ resource }));
  } catch (err) {
    next(err);
  }
});

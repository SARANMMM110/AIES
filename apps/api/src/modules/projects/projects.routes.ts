import { Router } from "express";
import { z } from "zod";
import { prisma, ProjectStatus } from "@aes/database";
import { authenticate, type AuthRequest } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { AppError, assertFound } from "../../utils/errors";
import { ok } from "../../utils/response";
import { userHasProductAccess } from "../access/access.routes";

export const projectsRouter = Router();

projectsRouter.use(authenticate);

const projectSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(5000).optional().nullable(),
  clientId: z.string().min(1),
  productId: z.string().min(1).optional().nullable(),
  status: z.nativeEnum(ProjectStatus).optional(),
  metadata: z.record(z.unknown()).optional(),
});

projectsRouter.get("/", async (req: AuthRequest, res, next) => {
  try {
    const isAdmin = req.user!.role === "ADMIN";
    const projects = await prisma.project.findMany({
      where: isAdmin ? undefined : { ownerId: req.user!.id },
      include: {
        client: true,
        product: { select: { id: true, name: true, slug: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(ok({ projects }));
  } catch (err) {
    next(err);
  }
});

projectsRouter.post("/", validate(projectSchema), async (req: AuthRequest, res, next) => {
  try {
    const body = req.body as z.infer<typeof projectSchema>;
    const client = await prisma.client.findUnique({ where: { id: body.clientId } });
    assertFound(client, "Client not found");
    if (req.user!.role !== "ADMIN" && client.ownerId !== req.user!.id) {
      throw new AppError(403, "Client does not belong to you", "FORBIDDEN");
    }

    if (body.productId) {
      const allowed = await userHasProductAccess(
        req.user!.id,
        body.productId,
        req.user!.role
      );
      if (!allowed) {
        throw new AppError(403, "No access to this product", "PRODUCT_ACCESS_DENIED");
      }
    }

    const project = await prisma.project.create({
      data: {
        ownerId: req.user!.id,
        clientId: body.clientId,
        productId: body.productId ?? null,
        name: body.name,
        description: body.description ?? null,
        status: body.status ?? "ACTIVE",
        metadata: body.metadata as object | undefined,
      },
    });
    res.status(201).json(ok({ project }));
  } catch (err) {
    next(err);
  }
});

projectsRouter.get("/:id", async (req: AuthRequest, res, next) => {
  try {
    const project = await prisma.project.findUnique({
      where: { id: req.params.id },
      include: {
        client: true,
        product: true,
        workflowProgress: true,
        workflowResults: { take: 20, orderBy: { createdAt: "desc" } },
      },
    });
    assertFound(project, "Project not found");
    if (req.user!.role !== "ADMIN" && project.ownerId !== req.user!.id) {
      throw new AppError(403, "Forbidden", "FORBIDDEN");
    }
    res.json(ok({ project }));
  } catch (err) {
    next(err);
  }
});

projectsRouter.patch(
  "/:id",
  validate(projectSchema.partial()),
  async (req: AuthRequest, res, next) => {
    try {
      const existing = await prisma.project.findUnique({ where: { id: req.params.id } });
      assertFound(existing, "Project not found");
      if (req.user!.role !== "ADMIN" && existing.ownerId !== req.user!.id) {
        throw new AppError(403, "Forbidden", "FORBIDDEN");
      }
      const project = await prisma.project.update({
        where: { id: req.params.id },
        data: req.body,
      });
      res.json(ok({ project }));
    } catch (err) {
      next(err);
    }
  }
);

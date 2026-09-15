import { Router } from "express";
import { z } from "zod";
import { prisma, WorkflowProgressStatus } from "@aes/database";
import { authenticate, type AuthRequest } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { AppError, assertFound } from "../../utils/errors";
import { ok } from "../../utils/response";

export const workflowsRouter = Router();

workflowsRouter.use(authenticate);

workflowsRouter.get("/definitions/:id", async (req: AuthRequest, res, next) => {
  try {
    const workflow = await prisma.workflowDefinition.findUnique({
      where: { id: req.params.id },
      include: {
        product: { select: { id: true, name: true, slug: true, status: true } },
        serviceResource: { select: { id: true, title: true, slug: true } },
      },
    });
    assertFound(workflow, "Workflow not found");
    if (req.user!.role !== "ADMIN") {
      if (workflow.product.status !== "PUBLISHED") {
        throw new AppError(404, "Workflow not found", "NOT_FOUND");
      }
      const access = await prisma.productAccess.findFirst({
        where: {
          userId: req.user!.id,
          productId: workflow.productId,
          status: "ACTIVE",
          OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }],
        },
      });
      if (!access) {
        throw new AppError(403, "No access to this product", "PRODUCT_ACCESS_DENIED");
      }
    }
    res.json(ok({ workflow }));
  } catch (err) {
    next(err);
  }
});

const progressSchema = z.object({
  projectId: z.string().min(1),
  workflowKey: z.string().min(1).max(100),
  workflowId: z.string().optional(),
  status: z.nativeEnum(WorkflowProgressStatus).optional(),
  currentStep: z.number().int().min(0).optional(),
  progressPercent: z.number().int().min(0).max(100).optional(),
  state: z.unknown().optional(),
});

const resultSchema = z.object({
  projectId: z.string().min(1),
  workflowKey: z.string().min(1).max(100),
  title: z.string().max(300).optional(),
  content: z.unknown(),
  metadata: z.record(z.unknown()).optional(),
});

async function assertProjectOwner(projectId: string, userId: string, role: string) {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  assertFound(project, "Project not found");
  if (role !== "ADMIN" && project.ownerId !== userId) {
    throw new AppError(403, "Forbidden", "FORBIDDEN");
  }
  return project;
}

workflowsRouter.get("/progress", async (req: AuthRequest, res, next) => {
  try {
    const projectId = req.query.projectId as string | undefined;
    if (!projectId) throw new AppError(400, "projectId query required", "VALIDATION_ERROR");
    await assertProjectOwner(projectId, req.user!.id, req.user!.role);
    const progress = await prisma.workflowProgress.findMany({
      where: { projectId },
      orderBy: { updatedAt: "desc" },
    });
    res.json(ok({ progress }));
  } catch (err) {
    next(err);
  }
});

workflowsRouter.post(
  "/progress",
  validate(progressSchema),
  async (req: AuthRequest, res, next) => {
    try {
      const body = req.body as z.infer<typeof progressSchema>;
      await assertProjectOwner(body.projectId, req.user!.id, req.user!.role);

      const progress = await prisma.workflowProgress.create({
        data: {
          projectId: body.projectId,
          workflowKey: body.workflowKey,
          workflowId: body.workflowId,
          status: body.status ?? "IN_PROGRESS",
          currentStep: body.currentStep ?? 0,
          progressPercent: body.progressPercent ?? 0,
          state: body.state as object | undefined,
          startedAt: new Date(),
        },
      });
      res.status(201).json(ok({ progress }));
    } catch (err) {
      next(err);
    }
  }
);

workflowsRouter.patch(
  "/progress/:id",
  validate(
    z.object({
      status: z.nativeEnum(WorkflowProgressStatus).optional(),
      currentStep: z.number().int().min(0).optional(),
      progressPercent: z.number().int().min(0).max(100).optional(),
      state: z.unknown().optional(),
    })
  ),
  async (req: AuthRequest, res, next) => {
    try {
      const existing = await prisma.workflowProgress.findUnique({
        where: { id: req.params.id },
        include: { project: true },
      });
      assertFound(existing, "Progress not found");
      if (req.user!.role !== "ADMIN" && existing.project.ownerId !== req.user!.id) {
        throw new AppError(403, "Forbidden", "FORBIDDEN");
      }

      const data = { ...req.body } as Record<string, unknown>;
      if (req.body.status === "COMPLETED") {
        data.completedAt = new Date();
        data.progressPercent = 100;
      }

      const progress = await prisma.workflowProgress.update({
        where: { id: req.params.id },
        data,
      });
      res.json(ok({ progress }));
    } catch (err) {
      next(err);
    }
  }
);

workflowsRouter.get("/results", async (req: AuthRequest, res, next) => {
  try {
    const projectId = req.query.projectId as string | undefined;
    const where =
      req.user!.role === "ADMIN"
        ? projectId
          ? { projectId }
          : {}
        : projectId
          ? { projectId, ownerId: req.user!.id }
          : { ownerId: req.user!.id };

    if (projectId) {
      await assertProjectOwner(projectId, req.user!.id, req.user!.role);
    }

    const results = await prisma.workflowResult.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    res.json(ok({ results }));
  } catch (err) {
    next(err);
  }
});

workflowsRouter.post("/results", validate(resultSchema), async (req: AuthRequest, res, next) => {
  try {
    const body = req.body as z.infer<typeof resultSchema>;
    await assertProjectOwner(body.projectId, req.user!.id, req.user!.role);

    const result = await prisma.workflowResult.create({
      data: {
        projectId: body.projectId,
        ownerId: req.user!.id,
        workflowKey: body.workflowKey,
        title: body.title,
        content: body.content as object,
        metadata: body.metadata as object | undefined,
      },
    });
    res.status(201).json(ok({ result }));
  } catch (err) {
    next(err);
  }
});

import { Router } from "express";
import { z } from "zod";
import { prisma } from "@aes/database";
import { authenticate, requireAdmin, type AuthRequest } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { AppError, assertFound } from "../../utils/errors";
import { ok } from "../../utils/response";

export const clientsRouter = Router();

clientsRouter.use(authenticate);

const clientSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email().optional().nullable(),
  company: z.string().max(200).optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
  businessType: z.string().max(200).optional().nullable(),
  industry: z.string().max(200).optional().nullable(),
  location: z.string().max(200).optional().nullable(),
  serviceArea: z.string().max(300).optional().nullable(),
  website: z.string().max(500).optional().nullable(),
  contactPhone: z.string().max(50).optional().nullable(),
  targetCustomers: z.string().max(2000).optional().nullable(),
  currentProcess: z.string().max(5000).optional().nullable(),
  existingTools: z.string().max(2000).optional().nullable(),
  marketingChannels: z.string().max(2000).optional().nullable(),
  mainProblems: z.string().max(5000).optional().nullable(),
  goals: z.string().max(5000).optional().nullable(),
  metadata: z.record(z.unknown()).optional(),
});

clientsRouter.get("/", async (req: AuthRequest, res, next) => {
  try {
    const isAdmin = req.user!.role === "ADMIN";
    const clients = await prisma.client.findMany({
      where: isAdmin ? undefined : { ownerId: req.user!.id },
      orderBy: { createdAt: "desc" },
    });
    res.json(ok({ clients }));
  } catch (err) {
    next(err);
  }
});

/** Admin overview — must be registered before /:id */
clientsRouter.get("/admin/all", requireAdmin, async (_req, res, next) => {
  try {
    const clients = await prisma.client.findMany({
      include: { owner: { select: { id: true, email: true } } },
      orderBy: { createdAt: "desc" },
    });
    res.json(ok({ clients }));
  } catch (err) {
    next(err);
  }
});

clientsRouter.post("/", validate(clientSchema), async (req: AuthRequest, res, next) => {
  try {
    const body = req.body as z.infer<typeof clientSchema>;
    const client = await prisma.client.create({
      data: {
        ownerId: req.user!.id,
        name: body.name,
        email: body.email ?? null,
        company: body.company ?? null,
        notes: body.notes ?? null,
        businessType: body.businessType ?? null,
        industry: body.industry ?? null,
        location: body.location ?? null,
        serviceArea: body.serviceArea ?? null,
        website: body.website ?? null,
        contactPhone: body.contactPhone ?? null,
        targetCustomers: body.targetCustomers ?? null,
        currentProcess: body.currentProcess ?? null,
        existingTools: body.existingTools ?? null,
        marketingChannels: body.marketingChannels ?? null,
        mainProblems: body.mainProblems ?? null,
        goals: body.goals ?? null,
        metadata: body.metadata as object | undefined,
      },
    });
    res.status(201).json(ok({ client }));
  } catch (err) {
    next(err);
  }
});

clientsRouter.get("/:id", async (req: AuthRequest, res, next) => {
  try {
    const client = await prisma.client.findUnique({ where: { id: req.params.id } });
    assertFound(client, "Client not found");
    if (req.user!.role !== "ADMIN" && client.ownerId !== req.user!.id) {
      throw new AppError(403, "Forbidden", "FORBIDDEN");
    }
    res.json(ok({ client }));
  } catch (err) {
    next(err);
  }
});

clientsRouter.patch(
  "/:id",
  validate(clientSchema.partial()),
  async (req: AuthRequest, res, next) => {
    try {
      const existing = await prisma.client.findUnique({ where: { id: req.params.id } });
      assertFound(existing, "Client not found");
      if (req.user!.role !== "ADMIN" && existing.ownerId !== req.user!.id) {
        throw new AppError(403, "Forbidden", "FORBIDDEN");
      }
      const client = await prisma.client.update({
        where: { id: req.params.id },
        data: req.body,
      });
      res.json(ok({ client }));
    } catch (err) {
      next(err);
    }
  }
);

clientsRouter.delete("/:id", async (req: AuthRequest, res, next) => {
  try {
    const existing = await prisma.client.findUnique({ where: { id: req.params.id } });
    assertFound(existing, "Client not found");
    if (req.user!.role !== "ADMIN" && existing.ownerId !== req.user!.id) {
      throw new AppError(403, "Forbidden", "FORBIDDEN");
    }
    await prisma.client.delete({ where: { id: req.params.id } });
    res.json(ok({ message: "Client deleted" }));
  } catch (err) {
    next(err);
  }
});

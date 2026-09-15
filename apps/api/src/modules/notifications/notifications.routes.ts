import { Router } from "express";
import { prisma } from "@aes/database";
import { authenticate, type AuthRequest } from "../../middleware/auth";
import { AppError } from "../../utils/errors";
import { ok } from "../../utils/response";

export const notificationsRouter = Router();

notificationsRouter.use(authenticate);

notificationsRouter.get("/", async (req: AuthRequest, res, next) => {
  try {
    const unreadOnly = String(req.query.unread || "") === "1";
    const rows = await prisma.notification.findMany({
      where: {
        userId: req.user!.id,
        ...(unreadOnly ? { readAt: null } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 40,
      select: {
        id: true,
        type: true,
        title: true,
        body: true,
        href: true,
        entityType: true,
        entityId: true,
        readAt: true,
        createdAt: true,
      },
    });
    const unreadCount = await prisma.notification.count({
      where: { userId: req.user!.id, readAt: null },
    });
    res.json(ok({ notifications: rows, unreadCount }));
  } catch (err) {
    next(err);
  }
});

notificationsRouter.post("/read-all", async (req: AuthRequest, res, next) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.user!.id, readAt: null },
      data: { readAt: new Date() },
    });
    res.json(ok({ read: true }));
  } catch (err) {
    next(err);
  }
});

notificationsRouter.post("/:id/read", async (req: AuthRequest, res, next) => {
  try {
    const row = await prisma.notification.findFirst({
      where: { id: req.params.id, userId: req.user!.id },
    });
    if (!row) throw new AppError(404, "Notification not found", "NOT_FOUND");
    const updated = await prisma.notification.update({
      where: { id: row.id },
      data: { readAt: new Date() },
    });
    res.json(ok({ notification: updated }));
  } catch (err) {
    next(err);
  }
});

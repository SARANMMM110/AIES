import { Router } from "express";
import { prisma } from "@aes/database";
import { authenticate, type AuthRequest } from "../../middleware/auth";
import { AppError } from "../../utils/errors";
import { ok } from "../../utils/response";

export const notificationsRouter = Router();

notificationsRouter.use(authenticate);

function isMissingNotificationsTable(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const code = "code" in err ? String((err as { code?: string }).code ?? "") : "";
  const message = "message" in err ? String((err as { message?: string }).message ?? "") : "";
  return (
    code === "P2021" ||
    code === "P2010" ||
    (/notifications/i.test(message) && /does not exist|relation/i.test(message))
  );
}

notificationsRouter.get("/", async (req: AuthRequest, res, next) => {
  try {
    const unreadOnly = String(req.query.unread || "") === "1";
    const where = {
      userId: req.user!.id,
      ...(unreadOnly ? { readAt: null } : {}),
    };
    const [rows, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
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
      }),
      prisma.notification.count({
        where: { userId: req.user!.id, readAt: null },
      }),
    ]);
    res.json(ok({ notifications: rows, unreadCount }));
  } catch (err) {
    if (isMissingNotificationsTable(err)) {
      console.error("[notifications] table missing — run pnpm db:migrate or repair-schema-drift.sql");
      res.json(ok({ notifications: [], unreadCount: 0 }));
      return;
    }
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
    if (isMissingNotificationsTable(err)) {
      res.json(ok({ read: true }));
      return;
    }
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
    if (isMissingNotificationsTable(err)) {
      throw new AppError(404, "Notification not found", "NOT_FOUND");
    }
    next(err);
  }
});

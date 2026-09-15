import { prisma } from "@aes/database";

export type CreateNotificationInput = {
  userId: string;
  type: string;
  title: string;
  body?: string | null;
  href?: string | null;
  entityType?: string | null;
  entityId?: string | null;
};

/** Persist an in-app notification. Never throws to callers. */
export async function createAppNotification(input: CreateNotificationInput): Promise<void> {
  try {
    await prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body ?? null,
        href: input.href ?? null,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
      },
    });
  } catch {
    // Never fail the primary request because of notifications
  }
}

export async function notifyAdmins(input: Omit<CreateNotificationInput, "userId">): Promise<void> {
  try {
    const admins = await prisma.user.findMany({
      where: { role: "ADMIN", isActive: true },
      select: { id: true },
      take: 50,
    });
    if (!admins.length) return;
    await prisma.notification.createMany({
      data: admins.map((admin) => ({
        userId: admin.id,
        type: input.type,
        title: input.title,
        body: input.body ?? null,
        href: input.href ?? null,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
      })),
    });
  } catch {
    // Never fail the primary request because of notifications
  }
}

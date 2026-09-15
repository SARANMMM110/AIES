import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const demoUserWhere = {
  OR: [
    { email: { endsWith: "@test.local" } },
    { email: { contains: "@test." } },
    { email: "user@aies.local" },
    { AND: [{ firstName: "Phase" }, { lastName: "Six" }] },
    { AND: [{ firstName: "Demo" }, { lastName: "User" }] },
  ],
} as const;

async function main() {
  const testUsers = await prisma.user.findMany({
    where: demoUserWhere,
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      _count: { select: { purchases: true } },
    },
  });
  console.log(`Found ${testUsers.length} demo users`);

  const userIds = testUsers.map((u) => u.id);

  // Delete dependent records that may block user delete, then users (cascade purchases).
  if (userIds.length) {
    const purchaseIds = (
      await prisma.purchase.findMany({
        where: { userId: { in: userIds } },
        select: { id: true },
      })
    ).map((p) => p.id);

    if (purchaseIds.length) {
      await prisma.paymentEvent.deleteMany({ where: { purchaseId: { in: purchaseIds } } });
      await prisma.resellerEntitlement.deleteMany({ where: { purchaseId: { in: purchaseIds } } });
      await prisma.purchaseItem.deleteMany({ where: { purchaseId: { in: purchaseIds } } });
      await prisma.purchase.deleteMany({ where: { id: { in: purchaseIds } } });
      console.log(`Deleted ${purchaseIds.length} demo purchases`);
    }

    await prisma.productAccess.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.bundleAccess.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.session.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    console.log(`Deleted ${userIds.length} demo users`);
  }

  // Also drop any leftover purchases still tied to @test.local emails (safety).
  const leftover = await prisma.purchase.deleteMany({
    where: {
      OR: [
        { user: { email: { endsWith: "@test.local" } } },
        { user: { AND: [{ firstName: "Phase" }, { lastName: "Six" }] } },
      ],
    },
  });
  if (leftover.count) console.log(`Deleted ${leftover.count} leftover purchases`);

  // Remove smoke purchases on the seeded admin account (keep the admin user).
  const adminSmoke = await prisma.purchase.findMany({
    where: { user: { email: "admin@aies.local" } },
    select: { id: true },
  });
  if (adminSmoke.length) {
    const ids = adminSmoke.map((p) => p.id);
    await prisma.paymentEvent.deleteMany({ where: { purchaseId: { in: ids } } });
    await prisma.resellerEntitlement.deleteMany({ where: { purchaseId: { in: ids } } });
    await prisma.purchaseItem.deleteMany({ where: { purchaseId: { in: ids } } });
    await prisma.purchase.deleteMany({ where: { id: { in: ids } } });
    console.log(`Deleted ${ids.length} admin smoke purchases`);
  }

  const remaining = await prisma.purchase.count({
    where: { status: "COMPLETED" },
  });
  console.log(`Remaining completed purchases: ${remaining}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

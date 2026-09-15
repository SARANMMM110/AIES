import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(__dirname, "../.env") });
import { prisma } from "@aes/database";

async function main() {
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { email: { startsWith: "browser.reseller." } },
        { email: "browser.buyer.r41@test.local" },
        { lastName: "R41" },
      ],
    },
    select: { id: true, email: true },
  });
  const ids = users.map((user) => user.id);
  if (!ids.length) {
    console.log("nothing to clean");
    await prisma.$disconnect();
    return;
  }
  await prisma.resellerCustomerAccess.deleteMany({ where: { userId: { in: ids } } });
  await prisma.productAccess.deleteMany({ where: { userId: { in: ids } } });
  await prisma.client.deleteMany({ where: { ownerId: { in: ids } } });
  await prisma.paymentEvent.deleteMany({ where: { OR: [{ resellerSale: { resellerUserId: { in: ids } } }, { resellerSale: { customer: { userId: { in: ids } } } }] } });
  await prisma.resellerSale.deleteMany({ where: { OR: [{ resellerUserId: { in: ids } }, { customer: { userId: { in: ids } } }] } });
  await prisma.resellerOffer.deleteMany({ where: { resellerUserId: { in: ids } } });
  await prisma.resellerCustomer.deleteMany({ where: { OR: [{ resellerUserId: { in: ids } }, { userId: { in: ids } }] } });
  await prisma.resellerEntitlement.deleteMany({ where: { userId: { in: ids } } });
  await prisma.purchase.deleteMany({ where: { userId: { in: ids } } });
  await prisma.session.deleteMany({ where: { userId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  console.log(`cleaned ${users.map((user) => user.email).join(", ")}`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

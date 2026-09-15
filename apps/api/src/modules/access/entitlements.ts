import { prisma } from "@aes/database";
import { APPROVED_PRODUCT_SLUGS } from "../../constants/product-scope";

/**
 * Products the user is entitled to use in the app (purchase / grant / bundle).
 * Never returns the full catalog — only ACTIVE ProductAccess rows.
 */
export async function loadEntitledProductAccess(userId: string) {
  const rows = await prisma.productAccess.findMany({
    where: {
      userId,
      status: "ACTIVE",
      OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }],
      product: {
        status: "PUBLISHED",
        slug: { in: [...APPROVED_PRODUCT_SLUGS] },
      },
    },
    include: {
      product: {
        include: {
          _count: { select: { resources: true, workflows: true } },
        },
      },
      bundle: { select: { id: true, slug: true, name: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  // One row per product (prefer DIRECT / ADMIN_GRANT over BUNDLE if both exist)
  const byProduct = new Map<string, (typeof rows)[number]>();
  for (const row of rows) {
    const existing = byProduct.get(row.productId);
    if (
      !existing ||
      row.source === "DIRECT" ||
      row.source === "ADMIN_GRANT"
    ) {
      byProduct.set(row.productId, row);
    }
  }
  return [...byProduct.values()];
}

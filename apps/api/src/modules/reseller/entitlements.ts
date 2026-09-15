import {
  prisma,
  type Prisma,
  type ResellerScope,
} from "@aes/database";
import { APPROVED_PRODUCT_SLUGS } from "../../constants/product-scope";
import { AppError } from "../../utils/errors";
import { COMPLETE_SUITE_SLUG } from "./constants";

type Db = Prisma.TransactionClient | typeof prisma;

export type PolicySnapshot = {
  policyId: string;
  scope: ResellerScope;
  allowBranding: boolean;
  minPriceCents: number | null;
};

function asIdList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.length > 0);
}

export function readCoveredProductIds(value: unknown): string[] {
  return asIdList(value);
}

export function readPolicySnapshot(value: unknown): PolicySnapshot | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (typeof row.policyId !== "string") return null;
  const scope = row.scope;
  if (scope !== "PRODUCT" && scope !== "BUNDLE" && scope !== "COMPLETE_SUITE") return null;
  return {
    policyId: row.policyId,
    scope,
    allowBranding: row.allowBranding !== false,
    minPriceCents: typeof row.minPriceCents === "number" ? row.minPriceCents : null,
  };
}

function entitlementKey(userId: string, scope: ResellerScope, targetId: string | null) {
  if (scope === "COMPLETE_SUITE") return `${userId}:COMPLETE_SUITE`;
  return `${userId}:${scope}:${targetId}`;
}

function purchaseGrantsRights(purchase: {
  status: string;
  paymentStatus: string;
  refundedAt: Date | null;
}) {
  if (purchase.status === "REFUNDED" || purchase.status === "CANCELLED" || purchase.refundedAt) {
    return false;
  }
  return (
    purchase.paymentStatus === "PAID" ||
    purchase.paymentStatus === "SIMULATED" ||
    purchase.status === "COMPLETED"
  );
}

async function approvedProductIds(db: Db, ids: string[]) {
  if (!ids.length) return [];
  const rows = await db.product.findMany({
    where: {
      id: { in: ids },
      status: "PUBLISHED",
      slug: { in: [...APPROVED_PRODUCT_SLUGS] },
    },
    select: { id: true },
  });
  const allowed = new Set(rows.map((row) => row.id));
  return ids.filter((id) => allowed.has(id));
}

async function suiteProductIds(db: Db, bundleId: string | null) {
  if (bundleId) {
    const items = await db.bundleItem.findMany({
      where: { bundleId },
      select: { productId: true },
      orderBy: { sortOrder: "asc" },
    });
    const fromBundle = await approvedProductIds(
      db,
      items.map((item) => item.productId)
    );
    if (fromBundle.length) return fromBundle;
  }
  const products = await db.product.findMany({
    where: { status: "PUBLISHED", slug: { in: [...APPROVED_PRODUCT_SLUGS] } },
    select: { id: true },
  });
  return products.map((product) => product.id);
}

/**
 * Resolve reseller rights from a verified purchase + admin commercial rules.
 * Never reads a client-supplied resell flag. Does not grant ProductAccess.
 */
export async function grantResellerEntitlementsForPurchase(
  db: Db,
  purchaseId: string
) {
  const purchase = await db.purchase.findUnique({
    where: { id: purchaseId },
    include: {
      items: true,
    },
  });
  if (!purchase || !purchaseGrantsRights(purchase)) return [];

  const policies = await db.resellerPolicy.findMany({ where: { enabled: true } });
  const productPolicies = new Map(
    policies.filter((policy) => policy.scope === "PRODUCT" && policy.productId).map((policy) => [policy.productId as string, policy])
  );
  const bundlePolicies = new Map(
    policies.filter((policy) => policy.scope === "BUNDLE" && policy.bundleId).map((policy) => [policy.bundleId as string, policy])
  );
  const suitePolicy = policies.find((policy) => policy.scope === "COMPLETE_SUITE") ?? null;

  const grants: Array<{
    key: string;
    scope: ResellerScope;
    productId: string | null;
    bundleId: string | null;
    coveredProductIds: string[];
    snapshot: PolicySnapshot;
  }> = [];

  for (const item of purchase.items) {
    if (item.itemType === "PRODUCT" && item.productId) {
      const policy = productPolicies.get(item.productId);
      if (!policy) continue;
      const covered = await approvedProductIds(db, [item.productId]);
      if (!covered.length) continue;
      grants.push({
        key: entitlementKey(purchase.userId, "PRODUCT", item.productId),
        scope: "PRODUCT",
        productId: item.productId,
        bundleId: null,
        coveredProductIds: covered,
        snapshot: {
          policyId: policy.id,
          scope: "PRODUCT",
          allowBranding: policy.allowBranding,
          minPriceCents: policy.minPriceCents,
        },
      });
      continue;
    }

    if (item.itemType !== "BUNDLE" || !item.bundleId) continue;
    const bundle = await db.bundle.findUnique({
      where: { id: item.bundleId },
      select: { id: true, slug: true },
    });
    if (!bundle) continue;

    if (bundle.slug === COMPLETE_SUITE_SLUG && suitePolicy) {
      grants.push({
        key: entitlementKey(purchase.userId, "COMPLETE_SUITE", null),
        scope: "COMPLETE_SUITE",
        productId: null,
        bundleId: bundle.id,
        coveredProductIds: await suiteProductIds(db, bundle.id),
        snapshot: {
          policyId: suitePolicy.id,
          scope: "COMPLETE_SUITE",
          allowBranding: suitePolicy.allowBranding,
          minPriceCents: suitePolicy.minPriceCents,
        },
      });
      continue;
    }

    const policy = bundlePolicies.get(bundle.id);
    if (!policy) continue;
    const items = await db.bundleItem.findMany({
      where: { bundleId: bundle.id },
      select: { productId: true },
    });
    const covered = await approvedProductIds(
      db,
      items.map((row) => row.productId)
    );
    if (!covered.length) continue;
    grants.push({
      key: entitlementKey(purchase.userId, "BUNDLE", bundle.id),
      scope: "BUNDLE",
      productId: null,
      bundleId: bundle.id,
      coveredProductIds: covered,
      snapshot: {
        policyId: policy.id,
        scope: "BUNDLE",
        allowBranding: policy.allowBranding,
        minPriceCents: policy.minPriceCents,
      },
    });
  }

  const saved = [];
  for (const grant of grants) {
    const existing = await db.resellerEntitlement.findUnique({
      where: { entitlementKey: grant.key },
    });

    if (!existing) {
      saved.push(
        await db.resellerEntitlement.create({
          data: {
            entitlementKey: grant.key,
            userId: purchase.userId,
            scope: grant.scope,
            status: "ACTIVE",
            productId: grant.productId,
            bundleId: grant.bundleId,
            purchaseId: purchase.id,
            coveredProductIds: grant.coveredProductIds,
            policySnapshot: grant.snapshot,
          },
        })
      );
      continue;
    }

    // Do not undo an admin revoke of this same purchase.
    if (existing.status === "REVOKED" && existing.purchaseId === purchase.id) {
      saved.push(existing);
      continue;
    }

    saved.push(
      await db.resellerEntitlement.update({
        where: { id: existing.id },
        data: {
          status: "ACTIVE",
          revokedAt: null,
          productId: grant.productId,
          bundleId: grant.bundleId,
          purchaseId: existing.purchaseId ?? purchase.id,
          coveredProductIds: grant.coveredProductIds,
          policySnapshot: grant.snapshot,
          grantedAt: existing.status === "ACTIVE" ? existing.grantedAt : new Date(),
        },
      })
    );
  }

  return saved;
}

export async function syncResellerEntitlementsFromPaidPurchases() {
  const purchases = await prisma.purchase.findMany({
    where: {
      OR: [
        { paymentStatus: { in: ["PAID", "SIMULATED"] } },
        { status: "COMPLETED" },
      ],
      status: { notIn: ["REFUNDED", "CANCELLED"] },
      refundedAt: null,
    },
    select: { id: true },
  });

  let granted = 0;
  for (const purchase of purchases) {
    const rows = await grantResellerEntitlementsForPurchase(prisma, purchase.id);
    granted += rows.filter((row) => row.status === "ACTIVE").length;
  }
  return { purchases: purchases.length, entitlementsTouched: granted };
}

export async function listAccountResale(userId: string) {
  const [purchases, accessRows, entitlements] = await Promise.all([
    prisma.purchase.findMany({
      where: {
        userId,
        refundedAt: null,
        status: { notIn: ["REFUNDED", "CANCELLED"] },
        OR: [{ paymentStatus: { in: ["PAID", "SIMULATED"] } }, { status: "COMPLETED" }],
      },
      include: {
        items: {
          include: {
            product: { select: { id: true, name: true, slug: true, status: true } },
            bundle: { select: { id: true, name: true, slug: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.productAccess.findMany({
      where: {
        userId,
        status: "ACTIVE",
        source: { in: ["DIRECT", "ADMIN_GRANT", "BUNDLE"] },
        OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }],
        product: {
          status: "PUBLISHED",
          slug: { in: [...APPROVED_PRODUCT_SLUGS] },
        },
      },
      include: {
        product: { select: { id: true, name: true, slug: true, status: true } },
      },
    }),
    prisma.resellerEntitlement.findMany({ where: { userId } }),
  ]);
  const byKey = new Map(entitlements.map((row) => [row.entitlementKey, row]));
  const rows: Array<{
    key: string;
    scope: ResellerScope;
    productId: string | null;
    bundleId: string | null;
    name: string;
    resell: boolean;
    whiteLabel: boolean;
  }> = [];
  const seen = new Set<string>();

  function pushProduct(product: { id: string; name: string; slug: string; status: string }) {
    if (product.status !== "PUBLISHED") return;
    if (!(APPROVED_PRODUCT_SLUGS as readonly string[]).includes(product.slug)) return;
    const key = entitlementKey(userId, "PRODUCT", product.id);
    if (seen.has(key)) return;
    seen.add(key);
    const existing = byKey.get(key);
    rows.push({
      key,
      scope: "PRODUCT",
      productId: product.id,
      bundleId: null,
      name: product.name,
      resell: existing?.status === "ACTIVE",
      whiteLabel: readPolicySnapshot(existing?.policySnapshot)?.allowBranding === true,
    });
  }

  for (const purchase of purchases) {
    for (const item of purchase.items) {
      if (item.itemType === "PRODUCT" && item.product) {
        pushProduct(item.product);
      }
      if (item.itemType === "BUNDLE" && item.bundle) {
        const scope: ResellerScope = item.bundle.slug === COMPLETE_SUITE_SLUG ? "COMPLETE_SUITE" : "BUNDLE";
        const key = entitlementKey(userId, scope, scope === "COMPLETE_SUITE" ? null : item.bundle.id);
        if (seen.has(key)) continue;
        seen.add(key);
        const existing = byKey.get(key);
        rows.push({
          key,
          scope,
          productId: null,
          bundleId: item.bundle.id,
          name: item.bundle.name,
          resell: existing?.status === "ACTIVE",
          whiteLabel: readPolicySnapshot(existing?.policySnapshot)?.allowBranding === true,
        });
      }
    }
  }

  for (const access of accessRows) {
    pushProduct(access.product);
  }

  return rows;
}

export async function setAccountResale(
  userId: string,
  input: { key: string; resell: boolean; whiteLabel: boolean }
) {
  const owned = await listAccountResale(userId);
  const target = owned.find((row) => row.key === input.key);
  if (!target) {
    throw new AppError(403, "You can only resell agencies you own", "RESELLER_SCOPE");
  }
  const covered =
    target.scope === "PRODUCT" && target.productId
      ? await approvedProductIds(prisma, [target.productId])
      : await suiteProductIds(prisma, target.bundleId);
  if (!covered.length) {
    throw new AppError(400, "This catalog item cannot be resold", "INVALID_PRODUCT");
  }
  const snapshot: PolicySnapshot = {
    policyId: "account",
    scope: target.scope,
    allowBranding: input.resell && input.whiteLabel,
    minPriceCents: null,
  };
  if (!input.resell) {
    const existing = await prisma.resellerEntitlement.findUnique({ where: { entitlementKey: target.key } });
    if (!existing) return { ...target, resell: false, whiteLabel: false };
    await prisma.resellerEntitlement.update({
      where: { id: existing.id },
      data: { status: "REVOKED", revokedAt: new Date(), policySnapshot: { ...snapshot, allowBranding: false } },
    });
    await prisma.resellerOffer.updateMany({
      where: { entitlementId: existing.id, status: { in: ["ACTIVE", "PUBLISHED"] } },
      data: { status: "UNPUBLISHED" },
    });
    return { ...target, resell: false, whiteLabel: false };
  }
  await prisma.resellerEntitlement.upsert({
    where: { entitlementKey: target.key },
    create: {
      entitlementKey: target.key,
      userId,
      scope: target.scope,
      status: "ACTIVE",
      productId: target.productId,
      bundleId: target.scope === "BUNDLE" ? target.bundleId : target.scope === "COMPLETE_SUITE" ? target.bundleId : null,
      coveredProductIds: covered,
      policySnapshot: snapshot,
    },
    update: {
      status: "ACTIVE",
      revokedAt: null,
      coveredProductIds: covered,
      policySnapshot: snapshot,
    },
  });
  return { ...target, resell: true, whiteLabel: snapshot.allowBranding };
}

export async function loadResellerRights(userId: string) {
  const rows = await prisma.resellerEntitlement.findMany({
    where: { userId, status: "ACTIVE" },
    include: {
      product: { select: { id: true, name: true, slug: true } },
      bundle: { select: { id: true, name: true, slug: true } },
    },
    orderBy: { grantedAt: "desc" },
  });

  const productIds = [...new Set(rows.flatMap((row) => readCoveredProductIds(row.coveredProductIds)))];
  const products = productIds.length
    ? await prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, name: true, slug: true },
      })
    : [];
  const byId = new Map(products.map((product) => [product.id, product]));

  return rows.map((row) => ({
    id: row.id,
    scope: row.scope,
    status: row.status,
    product: row.product,
    bundle: row.bundle,
    purchaseId: row.purchaseId,
    grantedAt: row.grantedAt,
    policy: readPolicySnapshot(row.policySnapshot),
    products: readCoveredProductIds(row.coveredProductIds)
      .map((id) => byId.get(id))
      .filter((product): product is NonNullable<typeof product> => Boolean(product)),
  }));
}

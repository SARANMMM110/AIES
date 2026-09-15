import type { AccessSource, Prisma, PrismaClient } from "@aes/database";

type Db = PrismaClient | Prisma.TransactionClient;

export type GrantEndsAt = Date | null | undefined;

/**
 * Grant or reactivate direct (non-bundle) product access.
 * Idempotent: never creates a second row for the same user+product when a
 * direct (bundleId null) row already exists.
 */
export async function grantDirectProductAccess(
  db: Db,
  opts: {
    userId: string;
    productId: string;
    source?: AccessSource;
    endsAt?: GrantEndsAt;
  }
) {
  const source = opts.source ?? "DIRECT";
  const endsAt = opts.endsAt === undefined ? undefined : opts.endsAt;

  const existing = await db.productAccess.findFirst({
    where: { userId: opts.userId, productId: opts.productId, bundleId: null },
  });

  if (existing) {
    return {
      access: await db.productAccess.update({
        where: { id: existing.id },
        data: {
          status: "ACTIVE",
          source,
          ...(endsAt !== undefined ? { endsAt } : {}),
        },
      }),
      created: false,
      alreadyActive: existing.status === "ACTIVE",
    };
  }

  // Prefer not duplicating if any ACTIVE entitlement already exists (e.g. via bundle)
  const anyActive = await db.productAccess.findFirst({
    where: {
      userId: opts.userId,
      productId: opts.productId,
      status: "ACTIVE",
      OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }],
    },
  });
  if (anyActive) {
    return { access: anyActive, created: false, alreadyActive: true };
  }

  return {
    access: await db.productAccess.create({
      data: {
        userId: opts.userId,
        productId: opts.productId,
        source,
        status: "ACTIVE",
        endsAt: endsAt ?? null,
      },
    }),
    created: true,
    alreadyActive: false,
  };
}

/**
 * Grant bundle access and materialize product access for each bundle item.
 * Idempotent: skips creating ProductAccess when the user already has ACTIVE access.
 */
export async function grantBundleAccess(
  db: Db,
  opts: {
    userId: string;
    bundleId: string;
    source?: AccessSource;
    endsAt?: GrantEndsAt;
  }
) {
  const source = opts.source ?? "DIRECT";
  const endsAt = opts.endsAt === undefined ? null : opts.endsAt;

  const bundle = await db.bundle.findUnique({
    where: { id: opts.bundleId },
    include: { items: true },
  });
  if (!bundle) {
    throw new Error("Bundle not found");
  }

  const bundleAccess = await db.bundleAccess.upsert({
    where: {
      userId_bundleId: { userId: opts.userId, bundleId: opts.bundleId },
    },
    update: {
      status: "ACTIVE",
      source,
      endsAt,
    },
    create: {
      userId: opts.userId,
      bundleId: opts.bundleId,
      source,
      status: "ACTIVE",
      endsAt,
    },
  });

  const productAccess = [];
  for (const item of bundle.items) {
    const byBundle = await db.productAccess.findFirst({
      where: {
        userId: opts.userId,
        productId: item.productId,
        bundleId: opts.bundleId,
      },
    });
    if (byBundle) {
      productAccess.push(
        await db.productAccess.update({
          where: { id: byBundle.id },
          data: { status: "ACTIVE", source: "BUNDLE", endsAt },
        })
      );
      continue;
    }

    const anyActive = await db.productAccess.findFirst({
      where: {
        userId: opts.userId,
        productId: item.productId,
        status: "ACTIVE",
        OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }],
      },
    });
    if (anyActive) {
      // Keep existing entitlement (DIRECT / ADMIN_GRANT / other bundle) — no duplicate
      productAccess.push(anyActive);
      continue;
    }

    const inactiveDirect = await db.productAccess.findFirst({
      where: { userId: opts.userId, productId: item.productId, bundleId: null },
    });
    if (inactiveDirect) {
      productAccess.push(
        await db.productAccess.update({
          where: { id: inactiveDirect.id },
          data: {
            status: "ACTIVE",
            source: "BUNDLE",
            bundleId: opts.bundleId,
            endsAt,
          },
        })
      );
    } else {
      productAccess.push(
        await db.productAccess.create({
          data: {
            userId: opts.userId,
            productId: item.productId,
            bundleId: opts.bundleId,
            source: "BUNDLE",
            status: "ACTIVE",
            endsAt,
          },
        })
      );
    }
  }

  return { bundleAccess, productAccess };
}

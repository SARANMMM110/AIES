import { PrismaClient, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import { config } from "dotenv";
import { resolve } from "path";
import {
  AGENCY_CATALOG,
  APPROVED_PRODUCT_SLUGS,
  catalogStats,
  emptyAgencyBuilderConfig,
  isApprovedProductSlug,
  serviceDescription,
  slugifyService,
} from "./content/agency-catalog";
import {
  buildBusinessStrategy,
  buildOperatorGuide,
  buildPositioning,
  buildSalesCopy,
  buildSalesPage,
} from "./content/resource-content";
import { buildWorkflowsForAgency } from "./content/workflow-catalog";
import { seedAgencyWiki } from "./seed-wiki";

config({ path: resolve(__dirname, "../../../.env") });

const prisma = new PrismaClient();

const DEMO_USER_PRODUCT_SLUGS = [
  "booking-flow-agency",
  "ai-advantage-agency",
  "trust-builder-agency",
];

function productConfiguration(entry: (typeof AGENCY_CATALOG)[number], definedCount: number) {
  return {
    templateVersion: "4",
    category: entry.category,
    sortOrder: entry.sortOrder,
    serviceCount: entry.services.length,
    accent: entry.accent,
    workflowCatalog: {
      targetCount: entry.workflowTargetCount,
      definedCount,
      status: "READY",
      note: "Original AI Enterprise Studio guided workflows (Stage 3B).",
    },
    agencyBuilder: emptyAgencyBuilderConfig(),
    agencyBuilderFields: [
      "aiPlatform",
      "agencyName",
      "country",
      "targetNiche",
      "geographicServiceArea",
      "experienceLevel",
      "preferredDeliveryModel",
      "weeklyTimeAvailability",
      "monthlyIncomeOrClientTarget",
      "selectedServiceIds",
    ],
  };
}

async function upsertAgencyProduct(entry: (typeof AGENCY_CATALOG)[number]) {
  const workflowSpecs = buildWorkflowsForAgency(entry);
  if (workflowSpecs.length !== entry.workflowTargetCount) {
    throw new Error(
      `${entry.slug}: expected ${entry.workflowTargetCount} workflows, got ${workflowSpecs.length}`
    );
  }

  const product = await prisma.product.upsert({
    where: { slug: entry.slug },
    update: {
      name: entry.name,
      tagline: entry.tagline,
      shortDescription: entry.shortDescription,
      description: entry.description,
      icon: entry.icon,
      status: "PUBLISHED",
      priceCents: 29900,
      currency: "USD",
      configuration: productConfiguration(entry, workflowSpecs.length),
      metadata: {
        stage: "3B",
        category: entry.category,
        sortOrder: entry.sortOrder,
        workflowTargetCount: entry.workflowTargetCount,
        idealClient: entry.idealClient,
      },
    },
    create: {
      name: entry.name,
      slug: entry.slug,
      tagline: entry.tagline,
      shortDescription: entry.shortDescription,
      description: entry.description,
      icon: entry.icon,
      status: "PUBLISHED",
      priceCents: 29900,
      currency: "USD",
      configuration: productConfiguration(entry, workflowSpecs.length),
      metadata: {
        stage: "3B",
        category: entry.category,
        sortOrder: entry.sortOrder,
        workflowTargetCount: entry.workflowTargetCount,
        idealClient: entry.idealClient,
      },
    },
  });

  await prisma.workflowDefinition.deleteMany({ where: { productId: product.id } });
  await prisma.productResource.deleteMany({ where: { productId: product.id } });

  const serviceIdByName = new Map<string, string>();

  for (let i = 0; i < entry.services.length; i++) {
    const serviceName = entry.services[i];
    const service = await prisma.productResource.create({
      data: {
        productId: product.id,
        type: "SERVICE",
        title: serviceName,
        slug: slugifyService(serviceName),
        description: serviceDescription(entry.name, serviceName),
        content: {
          status: "READY",
          stage: "3B",
          category: entry.category,
          sortOrder: i,
          agencySlug: entry.slug,
          configuration: {
            selectable: true,
            requiresClientPermission: true,
            autonomousActionsAllowed: false,
          },
        },
        sortOrder: i,
        isPublished: true,
      },
    });
    serviceIdByName.set(serviceName, service.id);
  }

  for (const spec of workflowSpecs) {
    const serviceResourceId = serviceIdByName.get(spec.serviceName);
    if (!serviceResourceId) {
      throw new Error(`${entry.slug}: service not found for workflow ${spec.key}`);
    }
    await prisma.workflowDefinition.create({
      data: {
        productId: product.id,
        serviceResourceId,
        key: spec.key,
        name: spec.name,
        description: spec.description,
        purpose: spec.purpose,
        displayOrder: spec.displayOrder,
        inputs: spec.inputs,
        aiInstructionTemplate: spec.aiInstructionTemplate,
        outputDefinition: spec.outputDefinition,
        reviewRequirements: spec.reviewRequirements,
        nextAction: spec.nextAction,
        steps: spec.steps,
        isActive: true,
        contentPending: false,
      },
    });
  }

  const resources = [
    {
      type: "OPERATOR_GUIDE" as const,
      title: `${entry.name} — Operator Guide`,
      slug: "operator-guide",
      description: `How to operate ${entry.name} inside AI Enterprise Studio.`,
      content: buildOperatorGuide(entry),
      sortOrder: 100,
    },
    {
      type: "SALES_PAGE" as const,
      title: `${entry.name} — Client Sales Page`,
      slug: "sales-page",
      description: `Editable client-facing sales page for ${entry.name}.`,
      content: buildSalesPage(entry),
      sortOrder: 101,
    },
    {
      type: "SALES_COPY" as const,
      title: `${entry.name} — Sales Copy`,
      slug: "sales-copy",
      description: `Sales copy and objection handlers for ${entry.name}.`,
      content: buildSalesCopy(entry),
      sortOrder: 102,
    },
    {
      type: "POSITIONING" as const,
      title: `${entry.name} — Positioning`,
      slug: "positioning",
      description: `Positioning brief for ${entry.name}.`,
      content: buildPositioning(entry),
      sortOrder: 103,
    },
    {
      type: "BUSINESS_STRATEGY" as const,
      title: `${entry.name} — Agency Business Strategy`,
      slug: "agency-business-strategy",
      description: `Business strategy for ${entry.name}.`,
      content: buildBusinessStrategy(entry),
      sortOrder: 104,
    },
  ];

  for (const def of resources) {
    await prisma.productResource.create({
      data: {
        productId: product.id,
        type: def.type,
        title: def.title,
        slug: def.slug,
        description: def.description,
        content: def.content,
        sortOrder: def.sortOrder,
        isPublished: true,
      },
    });
  }

  // Keep configuration.definedCount accurate after insert
  await prisma.product.update({
    where: { id: product.id },
    data: { configuration: productConfiguration(entry, workflowSpecs.length) },
  });

  return { product, workflowCount: workflowSpecs.length };
}

async function main() {
  const saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS ?? 12);
  const adminEmail =
    process.env.SEED_ADMIN_EMAIL?.trim() || "admin@aies.local";
  const adminPassword =
    process.env.SEED_ADMIN_PASSWORD?.trim() || "Admin123!ChangeMe";
  const userEmail = process.env.SEED_USER_EMAIL?.trim() || "user@aies.local";
  const userPassword =
    process.env.SEED_USER_PASSWORD?.trim() || "User123!ChangeMe";

  const adminHash = await bcrypt.hash(adminPassword, saltRounds);
  const userHash = await bcrypt.hash(userPassword, saltRounds);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: { passwordHash: adminHash, role: UserRole.ADMIN, isActive: true },
    create: {
      email: adminEmail,
      passwordHash: adminHash,
      firstName: "Platform",
      lastName: "Admin",
      role: UserRole.ADMIN,
    },
  });

  const user = await prisma.user.upsert({
    where: { email: userEmail },
    update: { passwordHash: userHash, role: UserRole.USER, isActive: true },
    create: {
      email: userEmail,
      passwordHash: userHash,
      firstName: "Demo",
      lastName: "User",
      role: UserRole.USER,
    },
  });

  const stats = catalogStats();
  console.log(
    `Stage 3B seed: ${stats.agencies} agencies / ${stats.services} services / workflow targets ${stats.workflowTargetTotal}`
  );
  if (stats.agencies !== 10) throw new Error(`Expected 10 agencies`);
  if (stats.services !== 99) throw new Error(`Expected 99 services`);

  const products = [];
  let workflowTotal = 0;
  for (const entry of AGENCY_CATALOG) {
    const { product, workflowCount } = await upsertAgencyProduct(entry);
    products.push(product);
    workflowTotal += workflowCount;
    console.log(`  ✓ ${product.slug} — ${entry.services.length} services, ${workflowCount} workflows`);
  }
  console.log(`  Total workflows seeded: ${workflowTotal}`);

  // Archive ANY product outside the fixed 10-tool catalog (preserve rows for FK integrity).
  console.log("  Catalog cleanup…");
  const archivedExtras = await prisma.product.updateMany({
    where: {
      slug: { notIn: [...APPROVED_PRODUCT_SLUGS] },
      status: { not: "ARCHIVED" },
    },
    data: { status: "ARCHIVED" },
  });
  if (archivedExtras.count > 0) {
    console.log(`  Archived ${archivedExtras.count} non-catalog product(s)`);
  }

  // Ensure approved products stay published (seed upsert already does this).
  const publishedCount = await prisma.product.count({
    where: { slug: { in: [...APPROVED_PRODUCT_SLUGS] }, status: "PUBLISHED" },
  });
  if (publishedCount !== 10) {
    throw new Error(`Expected 10 published catalog products, got ${publishedCount}`);
  }
  if (!APPROVED_PRODUCT_SLUGS.every(isApprovedProductSlug)) {
    throw new Error("APPROVED_PRODUCT_SLUGS integrity check failed");
  }

  // Do not recreate the pre-R4 sample workflow. It is not in the canonical 306.
  const sampleLeftover = await prisma.workflowDefinition.findFirst({
    where: { key: "sample-onboarding", product: { slug: "sample-agency-module" } },
    select: { id: true },
  });
  if (sampleLeftover) {
    const [progressCount, wikiLinkCount] = await Promise.all([
      prisma.workflowProgress.count({ where: { workflowId: sampleLeftover.id } }),
      prisma.wikiArticleWorkflow.count({ where: { workflowId: sampleLeftover.id } }),
    ]);
    if (progressCount || wikiLinkCount) {
      throw new Error("sample-onboarding has foreign keys; seed will not recreate or delete it");
    }
    await prisma.workflowDefinition.delete({ where: { id: sampleLeftover.id } });
    console.log("  Removed non-canonical sample-onboarding workflow");
  }
  const workflowRows = await prisma.workflowDefinition.count();
  if (workflowRows !== 306) {
    throw new Error(`Expected 306 workflow definitions after seed, got ${workflowRows}`);
  }
  console.log("  Workflow count OK (306)");

  // Sales packs first (fast) so /sales works even if wiki seed is interrupted.
  console.log("  Seeding sales bundles…");
  const suite = await prisma.bundle.upsert({
    where: { slug: "ai-enterprise-studio-complete-suite" },
    update: {
      name: "AI Enterprise Studio Complete Suite",
      description:
        "All 10 approved AI Enterprise Studio agencies in one package — 99 services and 306 guided workflows.",
      status: "ACTIVE",
      priceCents: 199900,
      currency: "USD",
      shortDescription: "All 10 agencies — 99 services and 306 guided workflows.",
      icon: "▣",
      displayOrder: 0,
      metadata: {
        kind: "COMPLETE_SUITE",
        agencyCount: 10,
        paymentGateway: "PENDING",
      },
    },
    create: {
      name: "AI Enterprise Studio Complete Suite",
      slug: "ai-enterprise-studio-complete-suite",
      description:
        "All 10 approved AI Enterprise Studio agencies in one package — 99 services and 306 guided workflows.",
      status: "ACTIVE",
      priceCents: 199900,
      currency: "USD",
      shortDescription: "All 10 agencies — 99 services and 306 guided workflows.",
      icon: "▣",
      displayOrder: 0,
      metadata: {
        kind: "COMPLETE_SUITE",
        agencyCount: 10,
        paymentGateway: "PENDING",
      },
    },
  });

  for (let i = 0; i < products.length; i++) {
    const product = products[i];
    await prisma.bundleItem.upsert({
      where: {
        bundleId_productId: { bundleId: suite.id, productId: product.id },
      },
      update: { sortOrder: i },
      create: {
        bundleId: suite.id,
        productId: product.id,
        sortOrder: i,
      },
    });
  }
  console.log(`  Suite bundle: ${suite.slug} (${products.length} products)`);

  const bySlug = new Map(products.map((p) => [p.slug, p]));

  async function upsertPack(input: {
    name: string;
    slug: string;
    description: string;
    shortDescription: string;
    priceCents: number;
    displayOrder: number;
    productSlugs: string[];
    icon: string;
  }) {
    const pack = await prisma.bundle.upsert({
      where: { slug: input.slug },
      update: {
        name: input.name,
        description: input.description,
        shortDescription: input.shortDescription,
        status: "ACTIVE",
        priceCents: input.priceCents,
        currency: "USD",
        icon: input.icon,
        displayOrder: input.displayOrder,
        metadata: { kind: "CUSTOM_PACK" },
      },
      create: {
        name: input.name,
        slug: input.slug,
        description: input.description,
        shortDescription: input.shortDescription,
        status: "ACTIVE",
        priceCents: input.priceCents,
        currency: "USD",
        icon: input.icon,
        displayOrder: input.displayOrder,
        metadata: { kind: "CUSTOM_PACK" },
      },
    });

    await prisma.bundleItem.deleteMany({ where: { bundleId: pack.id } });
    for (let i = 0; i < input.productSlugs.length; i++) {
      const product = bySlug.get(input.productSlugs[i]);
      if (!product) throw new Error(`Missing product for pack ${input.slug}: ${input.productSlugs[i]}`);
      await prisma.bundleItem.create({
        data: { bundleId: pack.id, productId: product.id, sortOrder: i },
      });
    }
    console.log(`  Pack: ${pack.slug} (${input.productSlugs.length} products, $${input.priceCents / 100})`);
  }

  await upsertPack({
    name: "Local Growth Pack",
    slug: "local-growth-pack",
    shortDescription: "Local visibility, partnerships, referrals, and trust — together.",
    description:
      "Four agencies for operators focused on local discovery, alliances, referral systems, and reputation.",
    priceCents: 79900,
    displayOrder: 1,
    icon: "📍",
    productSlugs: [
      "local-presence-agency",
      "local-alliance-agency",
      "referral-loop-agency",
      "trust-builder-agency",
    ],
  });

  await upsertPack({
    name: "Revenue Growth Pack",
    slug: "revenue-growth-pack",
    shortDescription: "Bookings, demand, retention, and revival in one pack.",
    description:
      "Four agencies for operators focused on enquiry flow, demand creation, repeat revenue, and win-back.",
    priceCents: 99900,
    displayOrder: 2,
    icon: "📈",
    productSlugs: [
      "booking-flow-agency",
      "demand-builder-agency",
      "repeat-revenue-agency",
      "revenue-revival-agency",
    ],
  });

  console.log("  Seeding Agency Wiki (172 articles — can take several minutes)…");
  await prisma.sharedResource.upsert({
    where: { key: "agency-wiki" },
    update: {
      title: "AI Enterprise Studio — Agency Wiki",
      description:
        "Shared agency operating knowledge for all 10 agency products. Full articles live in the Agency Wiki module.",
      isPublished: true,
      content: {
        status: "READY",
        version: 3,
        scope: "shared",
        module: "/wiki",
        note: "Structured Wiki articles are seeded into wiki_categories / wiki_articles. This SharedResource remains as the platform index pointer.",
        sections: [
          {
            id: "index",
            title: "Open the Agency Wiki",
            items: [
              "Use /wiki for searchable categories, articles, bookmarks, and progress.",
              "Wiki is shared across agencies — not a purchasable product.",
              "Operator Guides remain inside each agency product.",
            ],
          },
        ],
      },
    },
    create: {
      key: "agency-wiki",
      title: "AI Enterprise Studio — Agency Wiki",
      description:
        "Shared agency operating knowledge for all 10 agency products. Full articles live in the Agency Wiki module.",
      isPublished: true,
      content: {
        status: "READY",
        version: 3,
        scope: "shared",
        module: "/wiki",
      },
    },
  });

  const wikiSeed = await seedAgencyWiki(prisma);
  console.log(`Agency Wiki seeded: ${wikiSeed.categories} categories, ${wikiSeed.articles} articles`);

  console.log("  Demo user access + sample project…");
  for (const slug of DEMO_USER_PRODUCT_SLUGS) {
    const product = products.find((p) => p.slug === slug);
    if (!product) continue;
    const existing = await prisma.productAccess.findFirst({
      where: { userId: user.id, productId: product.id, bundleId: null },
    });
    if (existing) {
      await prisma.productAccess.update({
        where: { id: existing.id },
        data: { status: "ACTIVE", source: "ADMIN_GRANT" },
      });
    } else {
      await prisma.productAccess.create({
        data: {
          userId: user.id,
          productId: product.id,
          source: "ADMIN_GRANT",
          status: "ACTIVE",
        },
      });
    }
  }

  const keepIds = products
    .filter((p) => DEMO_USER_PRODUCT_SLUGS.includes(p.slug))
    .map((p) => p.id);
  await prisma.productAccess.updateMany({
    where: { userId: user.id, productId: { notIn: keepIds }, status: "ACTIVE" },
    data: { status: "REVOKED" },
  });

  const booking = products.find((p) => p.slug === "booking-flow-agency")!;
  let client = await prisma.client.findFirst({
    where: { ownerId: user.id, name: "Demo Dental Clinic" },
  });
  if (!client) {
    client = await prisma.client.create({
      data: {
        ownerId: user.id,
        name: "Demo Dental Clinic",
        email: "frontdesk@demodental.test",
        company: "Demo Dental",
        businessType: "Dental clinic",
        industry: "Healthcare services",
        location: "Austin, TX",
        serviceArea: "Greater Austin",
        targetCustomers: "Local families needing dental care",
        mainProblems: "Missed calls and slow enquiry follow-up",
        goals: "Increase booked appointments from web enquiries",
      },
    });
  }

  let project = await prisma.project.findFirst({
    where: { ownerId: user.id, name: "Enquiry Recovery Pilot" },
  });
  if (!project) {
    await prisma.project.create({
      data: {
        ownerId: user.id,
        clientId: client.id,
        productId: booking.id,
        name: "Enquiry Recovery Pilot",
        description: "Sample project linked to Booking Flow Agency",
        status: "ACTIVE",
      },
    });
  } else {
    await prisma.project.update({
      where: { id: project.id },
      data: { productId: booking.id, clientId: client.id },
    });
  }

  console.log("Seed complete (Stage 3B):");
  console.log(`  Admin: ${admin.email}`);
  console.log(`  User:  ${user.email}`);
  console.log(`  Products: ${products.length}`);
  console.log(`  Workflows: ${workflowTotal}`);
  console.log(`  Demo access: ${DEMO_USER_PRODUCT_SLUGS.join(", ")}`);

  const bundleCount = await prisma.bundle.count({ where: { status: "ACTIVE" } });
  const wikiCount = await prisma.wikiArticle.count();
  console.log(`Seed complete: ${bundleCount} ACTIVE bundles, ${wikiCount} wiki articles`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

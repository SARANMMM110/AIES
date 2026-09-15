/**
 * Stage 3B + product-scope catalog quality checks against DB + content sources.
 * Run: pnpm db:validate
 *
 * Fails if:
 * - product count != 10
 * - service count != 99
 * - workflow count != 306
 * - any product/service/workflow uses forbidden scope terms (e.g. "Agency Building")
 * - any workflow lacks a valid Product → Service mapping
 */
import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";
import { resolve } from "path";
import {
  AGENCY_CATALOG,
  APPROVED_PRODUCT_NAMES,
  APPROVED_PRODUCT_SLUGS,
  catalogStats,
  containsForbiddenScopeTerm,
  isApprovedProductSlug,
  slugifyService,
} from "./content/agency-catalog";
import { buildWorkflowsForAgency } from "./content/workflow-catalog";

config({ path: resolve(__dirname, "../../../.env") });

const prisma = new PrismaClient();

const REQUIRED_RESOURCE_TYPES = [
  "OPERATOR_GUIDE",
  "SALES_PAGE",
  "SALES_COPY",
  "POSITIONING",
  "BUSINESS_STRATEGY",
] as const;

function assert(cond: unknown, message: string) {
  if (!cond) throw new Error(`VALIDATION FAIL: ${message}`);
}

function assertNoForbidden(label: string, value: string) {
  const hit = containsForbiddenScopeTerm(value);
  assert(!hit, `${label} contains forbidden scope term "${hit}": ${value}`);
}

function contentNonEmpty(content: unknown): boolean {
  if (content == null) return false;
  if (typeof content === "string") return content.trim().length > 20;
  if (typeof content !== "object") return false;
  const obj = content as Record<string, unknown>;
  if (obj.status === "STRUCTURE_READY" || obj.status === "SOURCE_CONTENT_UNAVAILABLE") {
    return false;
  }
  const raw = JSON.stringify(content);
  return raw.length > 80;
}

async function main() {
  assert(APPROVED_PRODUCT_SLUGS.length === 10, "APPROVED_PRODUCT_SLUGS length");
  assert(APPROVED_PRODUCT_NAMES.length === 10, "APPROVED_PRODUCT_NAMES length");
  assert(AGENCY_CATALOG.length === 10, `AGENCY_CATALOG length=${AGENCY_CATALOG.length}`);

  for (const entry of AGENCY_CATALOG) {
    assert(isApprovedProductSlug(entry.slug), `catalog slug not approved: ${entry.slug}`);
    assert(
      (APPROVED_PRODUCT_NAMES as readonly string[]).includes(entry.name),
      `catalog name not approved: ${entry.name}`
    );
    assertNoForbidden(`catalog product ${entry.slug}`, entry.name);
    assertNoForbidden(`catalog category ${entry.slug}`, entry.category);
    for (const svc of entry.services) {
      assertNoForbidden(`service ${entry.slug}/${svc}`, svc);
    }
  }

  const stats = catalogStats();
  assert(stats.agencies === 10, `catalog agencies=${stats.agencies}`);
  assert(stats.services === 99, `catalog services=${stats.services}`);
  assert(stats.workflowTargetTotal === 306, `workflow targets=${stats.workflowTargetTotal}`);

  let generatedTotal = 0;
  const generatedKeys = new Set<string>();
  for (const entry of AGENCY_CATALOG) {
    const workflows = buildWorkflowsForAgency(entry);
    assert(
      workflows.length === entry.workflowTargetCount,
      `${entry.slug} generated ${workflows.length} != target ${entry.workflowTargetCount}`
    );
    generatedTotal += workflows.length;
    for (const wf of workflows) {
      const key = `${entry.slug}:${wf.key}`;
      assert(!generatedKeys.has(key), `duplicate generated workflow key ${key}`);
      generatedKeys.add(key);
      assert(wf.name.trim().length > 3, `${key} empty name`);
      assertNoForbidden(`generated workflow name ${key}`, wf.name);
      if (wf.serviceName) assertNoForbidden(`generated workflow service ${key}`, wf.serviceName);
      assert(wf.purpose.trim().length > 10, `${key} empty purpose`);
      assert(wf.aiInstructionTemplate.trim().length > 40, `${key} empty instruction`);
      assert(Array.isArray(wf.inputs) && wf.inputs.length > 0, `${key} missing inputs`);
      assert(wf.outputDefinition?.sections?.length, `${key} missing output sections`);
      assert(
        wf.reviewRequirements?.autonomousActionsForbidden === true,
        `${key} missing review gate`
      );
    }
  }
  assert(generatedTotal === 306, `generated workflows total=${generatedTotal}`);

  const published = await prisma.product.findMany({
    where: { status: "PUBLISHED" },
    include: { resources: true, workflows: true },
  });
  assert(published.length === 10, `published products in DB=${published.length} (must be exactly 10)`);

  for (const p of published) {
    assert(isApprovedProductSlug(p.slug), `published non-catalog product: ${p.slug}`);
    assertNoForbidden(`published product ${p.slug}`, p.name);
  }

  const extrasLive = await prisma.product.findMany({
    where: {
      slug: { notIn: [...APPROVED_PRODUCT_SLUGS] },
      status: { not: "ARCHIVED" },
    },
  });
  assert(
    extrasLive.length === 0,
    `non-catalog products still active: ${extrasLive.map((p) => p.slug).join(", ")}`
  );

  const products = published.filter((p) =>
    (APPROVED_PRODUCT_SLUGS as readonly string[]).includes(p.slug)
  );
  assert(products.length === 10, `approved published products=${products.length}`);

  let dbWorkflowTotal = 0;
  let dbServiceTotal = 0;

  for (const entry of AGENCY_CATALOG) {
    const product = products.find((p) => p.slug === entry.slug);
    assert(product, `missing product ${entry.slug}`);
    assert(product!.name === entry.name, `name mismatch ${entry.slug}`);

    const services = product!.resources.filter((r) => r.type === "SERVICE");
    dbServiceTotal += services.length;
    assert(
      services.length === entry.services.length,
      `${entry.slug} services ${services.length} != ${entry.services.length}`
    );

    const titles = new Set(services.map((s) => s.title));
    assert(titles.size === services.length, `${entry.slug} duplicate service titles`);

    for (const name of entry.services) {
      assert(titles.has(name), `${entry.slug} missing service "${name}"`);
      assertNoForbidden(`${entry.slug} service`, name);
      const slug = slugifyService(name);
      assert(
        services.some((s) => s.slug === slug),
        `${entry.slug} missing service slug ${slug}`
      );
    }

    for (const type of REQUIRED_RESOURCE_TYPES) {
      const matches = product!.resources.filter((r) => r.type === type);
      assert(matches.length === 1, `${entry.slug} expected 1 ${type}, got ${matches.length}`);
      assert(contentNonEmpty(matches[0].content), `${entry.slug} ${type} content empty`);
      assert(matches[0].isPublished, `${entry.slug} ${type} not published`);
    }

    const cfg = product!.configuration as {
      workflowCatalog?: { targetCount?: number; definedCount?: number; status?: string };
      agencyBuilder?: Record<string, unknown>;
      category?: string;
    } | null;
    assert(
      cfg?.workflowCatalog?.targetCount === entry.workflowTargetCount,
      `${entry.slug} workflow target ${cfg?.workflowCatalog?.targetCount} != ${entry.workflowTargetCount}`
    );
    assert(cfg?.agencyBuilder, `${entry.slug} missing agencyBuilder config`);
    if (cfg?.category) assertNoForbidden(`${entry.slug} category`, cfg.category);

    const workflows = product!.workflows.filter((w) => w.isActive);
    assert(
      workflows.length === entry.workflowTargetCount,
      `${entry.slug} DB workflows ${workflows.length} != ${entry.workflowTargetCount}`
    );
    dbWorkflowTotal += workflows.length;

    const keys = new Set(workflows.map((w) => w.key));
    assert(keys.size === workflows.length, `${entry.slug} duplicate workflow keys`);

    for (const wf of workflows) {
      assert(wf.productId === product!.id, `${entry.slug} workflow product link invalid`);
      assert(wf.id, `${entry.slug}/${wf.key} missing workflow id`);
      assert(wf.serviceResourceId, `${entry.slug}/${wf.key} missing service link — do not fallback to Agency Building`);
      assert(
        services.some((s) => s.id === wf.serviceResourceId),
        `${entry.slug}/${wf.key} service mapping invalid`
      );
      const svcTitle = services.find((s) => s.id === wf.serviceResourceId)?.title || "";
      assertNoForbidden(`${entry.slug}/${wf.key} service title`, svcTitle);
      assertNoForbidden(`${entry.slug}/${wf.key} workflow name`, wf.name);
      assert(!wf.contentPending, `${entry.slug}/${wf.key} still contentPending`);
      assert((wf.purpose || "").trim().length > 10, `${entry.slug}/${wf.key} empty purpose`);
      assert(
        (wf.aiInstructionTemplate || "").trim().length > 40,
        `${entry.slug}/${wf.key} empty instruction`
      );
      assert(Array.isArray(wf.inputs) && (wf.inputs as unknown[]).length > 0, `${wf.key} inputs`);
    }
  }

  assert(dbServiceTotal === 99, `DB service total=${dbServiceTotal}`);
  assert(dbWorkflowTotal === 306, `DB workflow total=${dbWorkflowTotal}`);

  const wiki = await prisma.sharedResource.findUnique({ where: { key: "agency-wiki" } });
  assert(wiki, "shared agency-wiki missing");
  assert(contentNonEmpty(wiki!.content), "agency-wiki content empty");
  const wikiDup = await prisma.sharedResource.count({
    where: { key: { startsWith: "agency-wiki" } },
  });
  assert(wikiDup === 1, `agency-wiki duplicates=${wikiDup}`);

  const wikiCategories = await prisma.wikiCategory.count({ where: { status: "PUBLISHED" } });
  const wikiArticles = await prisma.wikiArticle.count({ where: { status: "PUBLISHED" } });
  assert(wikiCategories === 7, `wiki categories=${wikiCategories}, expected 7`);
  assert(wikiArticles === 172, `wiki articles=${wikiArticles}, expected 172`);

  console.log("Product-scope catalog validation passed:");
  console.log(`  ${stats.agencies} approved products (exact)`);
  console.log(`  ${dbServiceTotal} services (exact)`);
  console.log(`  ${dbWorkflowTotal} workflows (exact)`);
  console.log(`  Agency Wiki: ${wikiCategories} categories, ${wikiArticles} published articles`);
  console.log("  no forbidden scope terms (Agency Building, etc.)");
  console.log("  every workflow has Product → Service mapping");
  console.log("  non-catalog products archived / not published");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

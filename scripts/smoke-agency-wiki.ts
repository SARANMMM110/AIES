/**
 * Smoke tests for Agency Wiki — does not modify catalog counts.
 *
 * Requires API on :4000 and seeded DB.
 */
const API = process.env.API_URL || "http://localhost:4000";
const ADMIN_EMAIL = process.env.SMOKE_EMAIL || "admin@aies.local";
const ADMIN_PASSWORD = process.env.SMOKE_PASSWORD || "Admin123!ChangeMe";
const USER_EMAIL = process.env.SMOKE_USER_EMAIL || "user@aies.local";
const USER_PASSWORD = process.env.SMOKE_USER_PASSWORD || "User123!ChangeMe";

async function login(email: string, password: string) {
  const r = await fetch(`${API}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const json = await r.json();
  if (!r.ok || !json.success) throw new Error(`Login failed for ${email}: ${JSON.stringify(json)}`);
  return json.data.tokens.accessToken as string;
}

async function api(token: string, path: string, init?: RequestInit) {
  const r = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  const json = await r.json().catch(() => ({}));
  return { status: r.status, json };
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function main() {
  console.log("Agency Wiki smoke…");
  const admin = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
  const user = await login(USER_EMAIL, USER_PASSWORD);

  // TEST 1 — categories
  const cats = await api(user, "/api/wiki/categories");
  assert(cats.status === 200, `categories status ${cats.status}`);
  assert(cats.json.data.categories.length === 7, "expected 7 categories");

  // TEST 2 — search pricing
  const search = await api(user, "/api/wiki/search?q=pricing");
  assert(search.status === 200, `search status ${search.status}`);
  assert(search.json.data.results.length > 0, "pricing search empty");
  console.log(`  search pricing → ${search.json.data.results.length} hits`);

  // TEST 3 — open article
  const articles = await api(user, "/api/wiki/articles?category=position-and-package&pageSize=5");
  assert(articles.status === 200, "articles list failed");
  const first = articles.json.data.articles[0];
  assert(first, "no articles in position-and-package");
  const article = await api(
    user,
    `/api/wiki/articles/${first.category.slug}/${first.slug}`
  );
  assert(article.status === 200, `article load ${article.status}`);
  assert(article.json.data.article.title, "article missing title");

  // TEST 4 — bookmark
  const articleId = article.json.data.article.id as string;
  const bm = await api(user, `/api/wiki/articles/${articleId}/bookmark`, {
    method: "POST",
    body: JSON.stringify({ on: true }),
  });
  assert(bm.status === 200 && bm.json.data.flags.bookmarked, "bookmark failed");
  const marks = await api(user, "/api/wiki/bookmarks");
  assert(marks.json.data.bookmarks.some((b: { article: { id: string } }) => b.article.id === articleId), "bookmark not listed");

  // TEST 5 — complete / progress
  const done = await api(user, `/api/wiki/articles/${articleId}/complete`, {
    method: "POST",
    body: JSON.stringify({ completed: true }),
  });
  assert(done.status === 200 && done.json.data.flags.completed, "complete failed");
  assert(done.json.data.progress.overall.completed >= 1, "progress not updated");

  // TEST 6/7 — related links shape (may be empty depending on seed matches)
  assert(Array.isArray(article.json.data.article.relatedWorkflows), "relatedWorkflows missing");
  assert(Array.isArray(article.json.data.article.relatedAgencies), "relatedAgencies missing");

  // TEST 8 — admin create draft
  const catId = cats.json.data.categories[0].id as string;
  let draftId = "";
  try {
  const created = await api(admin, "/api/wiki/admin/articles", {
    method: "POST",
    body: JSON.stringify({
      categoryId: catId,
      title: `Smoke Wiki Article ${Date.now()}`,
      summary: "Temporary smoke-test article for Agency Wiki admin CRUD.",
      content: {
        whatThisMeans: "Smoke test meaning.",
        whyItMatters: "Smoke test matters.",
        whenToUse: "Only during automated tests.",
        steps: ["Create", "Publish", "Unpublish"],
        example: "Example smoke content.",
        commonMistakes: ["Leaving smoke drafts published"],
        checklist: ["Unpublish after test"],
        aiAssistance: "AI not used in smoke.",
        humanReview: "Human must unpublish smoke drafts.",
        nextAction: "Archive or unpublish.",
      },
      keywords: ["smoke", "wiki"],
      tags: ["smoke"],
      status: "DRAFT",
    }),
  });
  assert(created.status === 201, `create status ${created.status}`);
  draftId = created.json.data.article.id as string;

  // TEST 9 — publish
  const pub = await api(admin, `/api/wiki/admin/articles/${draftId}/publish`, { method: "POST" });
  assert(pub.status === 200 && pub.json.data.article.status === "PUBLISHED", "publish failed");

  // user can read published
  const slug = created.json.data.article.slug as string;
  const catSlug = cats.json.data.categories[0].slug as string;
  const userRead = await api(user, `/api/wiki/articles/${catSlug}/${slug}`);
  assert(userRead.status === 200, "user cannot read published smoke article");

  // TEST 10 — unpublish
  const unpub = await api(admin, `/api/wiki/admin/articles/${draftId}/unpublish`, {
    method: "POST",
  });
  assert(unpub.status === 200 && unpub.json.data.article.status === "DRAFT", "unpublish failed");
  const userBlocked = await api(user, `/api/wiki/articles/${catSlug}/${slug}`);
  assert(userBlocked.status === 404, `expected 404 after unpublish, got ${userBlocked.status}`);

  // TEST 11 — normal user admin API 403
  const forbidden = await api(user, "/api/wiki/admin/articles");
  assert(forbidden.status === 403, `expected 403, got ${forbidden.status}`);

  // TEST 12 — search does not modify (already searched)
  const search2 = await api(user, "/api/wiki/search?q=pricing");
  assert(search2.status === 200, "second search failed");

  // Ask wiki retrieval mode
  const ask = await api(user, "/api/wiki/ask", {
    method: "POST",
    body: JSON.stringify({ question: "What should I prepare before discovery call?" }),
  });
  assert(ask.status === 200 && ask.json.data.mode === "search-retrieval", "ask wiki failed");

  console.log("Agency Wiki smoke PASSED");
  } finally {
    if (draftId) {
      await api(admin, `/api/wiki/admin/articles/${draftId}/archive`, { method: "POST" });
    }
  }
}

main()
  .catch(async (e) => {
    console.error(e);
    process.exitCode = 1;
  });

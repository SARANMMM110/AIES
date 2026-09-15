const API = process.env.API_URL || "http://localhost:4000";

async function login(email: string, password: string) {
  const r = await fetch(`${API}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const j = await r.json();
  if (!j.success) throw new Error(`login failed ${email}: ${JSON.stringify(j)}`);
  const token = j.data.tokens?.accessToken || j.data.token || j.data.accessToken;
  if (!token) throw new Error(`no token in ${JSON.stringify(j)}`);
  return token as string;
}

function headers(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

async function main() {
  const health = await fetch(`${API}/api/health`);
  if (!health.ok) throw new Error("API health failed");

  const adminTok = await login("admin@aies.local", "Admin123!ChangeMe");
  const userTok = await login("user@aies.local", "User123!ChangeMe");

  const adminCatalog = await (
    await fetch(`${API}/api/products`, { headers: headers(adminTok) })
  ).json();
  const adminAvailable = await (
    await fetch(`${API}/api/products/available`, { headers: headers(adminTok) })
  ).json();
  const userProducts = await (
    await fetch(`${API}/api/products/available`, { headers: headers(userTok) })
  ).json();

  const adminList = adminCatalog.data?.products ?? [];
  const adminEntitled = adminAvailable.data?.products ?? [];
  const userList = userProducts.data?.products ?? [];
  console.log(
    "admin catalog",
    adminList.length,
    "admin entitled",
    adminEntitled.length,
    "user products",
    userList.length
  );
  if (adminList.length < 10) throw new Error("admin catalog should list all 10");
  if (userList.length !== 3) throw new Error(`user should see 3, got ${userList.length}`);

  const denied = await fetch(`${API}/api/products/video-authority-agency`, {
    headers: headers(userTok),
  });
  const deniedJson = await denied.json();
  console.log("ungranted status", denied.status, "hasAccess", deniedJson.data?.hasAccess);
  if (denied.status !== 200 || deniedJson.data?.hasAccess !== false) {
    throw new Error("expected preview payload with hasAccess=false for ungranted product");
  }

  const setupGet = await (
    await fetch(`${API}/api/products/booking-flow-agency/setup`, {
      headers: headers(userTok),
    })
  ).json();
  const serviceIds = setupGet.data.services.slice(0, 3).map((s: { id: string }) => s.id);
  const setupPut = await (
    await fetch(`${API}/api/products/booking-flow-agency/setup`, {
      method: "PUT",
      headers: headers(userTok),
      body: JSON.stringify({
        aiPlatform: "Claude",
        agencyName: "Demo Booking Co",
        selectedServiceIds: serviceIds,
      }),
    })
  ).json();
  console.log(
    "setup saved",
    setupPut.success,
    setupPut.data.config.agencyName,
    setupPut.data.config.selectedServiceIds.length
  );

  const product = await (
    await fetch(`${API}/api/products/booking-flow-agency`, { headers: headers(userTok) })
  ).json();
  const svc = product.data.product.services[0];
  const wfs = await (
    await fetch(
      `${API}/api/products/booking-flow-agency/services/${svc.id}/workflows`,
      { headers: headers(userTok) }
    )
  ).json();
  console.log(
    "workflows for first service",
    wfs.data.workflows.length,
    wfs.data.workflows[0]?.name
  );

  const wf = wfs.data.workflows[0];
  const clients = await (
    await fetch(`${API}/api/clients`, { headers: headers(userTok) })
  ).json();
  const clientId = clients.data.clients[0]?.id;
  if (!clientId) throw new Error("no demo client");

  const projects = await (
    await fetch(`${API}/api/projects`, { headers: headers(userTok) })
  ).json();
  let projectId = projects.data.projects.find(
    (p: { product?: { slug?: string }; productId?: string }) =>
      p.product?.slug === "booking-flow-agency" || p.productId === product.data.product.id
  )?.id;
  if (!projectId) {
    const created = await (
      await fetch(`${API}/api/projects`, {
        method: "POST",
        headers: headers(userTok),
        body: JSON.stringify({
          name: "Smoke Project",
          clientId,
          productId: product.data.product.id,
        }),
      })
    ).json();
    projectId = created.data.project.id;
  }

  const prep = await (
    await fetch(`${API}/api/workflows/engine/prepare`, {
      method: "POST",
      headers: headers(userTok),
      body: JSON.stringify({
        workflowId: wf.id,
        projectId,
        inputs: { goals: "Improve booking conversion", constraints: "No cold outreach" },
      }),
    })
  ).json();
  console.log(
    "prepare",
    prep.success,
    "ready",
    prep.data.ready,
    "instruction len",
    prep.data.instruction?.length
  );

  const save = await (
    await fetch(`${API}/api/workflows/engine/save-result`, {
      method: "POST",
      headers: headers(userTok),
      body: JSON.stringify({
        workflowId: wf.id,
        projectId,
        instruction: prep.data.instruction,
        output: "# Deliverable\nSmoke test output",
        reviewStatus: "APPROVED",
      }),
    })
  ).json();
  console.log("save", save.success, save.data.result?.id);

  const slugs = [
    "ai-advantage-agency",
    "booking-flow-agency",
    "demand-builder-agency",
    "local-alliance-agency",
    "local-presence-agency",
    "referral-loop-agency",
    "repeat-revenue-agency",
    "revenue-revival-agency",
    "trust-builder-agency",
    "video-authority-agency",
  ];
  for (const slug of slugs) {
    const p = await (
      await fetch(`${API}/api/products/${slug}`, { headers: headers(adminTok) })
    ).json();
    const ok =
      p.success &&
      p.data.product.workflowCount > 0 &&
      p.data.product.resourceLibrary.length >= 5;
    if (!ok) throw new Error(`agency fail ${slug} ${JSON.stringify(p).slice(0, 300)}`);
    console.log(
      slug,
      "OK",
      "wf",
      p.data.product.workflowCount,
      "svc",
      p.data.product.serviceCount
    );
  }

  console.log("SMOKE PASS");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

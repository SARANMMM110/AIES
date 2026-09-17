"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { EmptyState } from "@/components/EmptyState";
import { Protected } from "@/components/Protected";
import { ToolLoadingPulse } from "@/components/ToolLoadingPulse";
import { AgencyOneLayout } from "@/components/product/AgencyOneLayout";
import { ProductShell } from "@/components/product/ProductShell";
import {
  productAccent,
  productCategory,
  type ClientRow,
  type ProductWorkspace,
  type SetupConfig,
} from "@/components/product/types";
import { apiFetch, ApiClientError } from "@/lib/api";

/**
 * Full-page admin agency preview at /admin/products/[slug].
 * No AdminShell / iframe — avoids dashboard flash while loading.
 */
export default function AdminProductViewPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;

  const [product, setProduct] = useState<ProductWorkspace | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [setup, setSetup] = useState<SetupConfig | null>(null);
  const [aiPlatforms, setAiPlatforms] = useState<string[]>([]);
  const [clients, setClients] = useState<ClientRow[]>([]);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await apiFetch<{ product: ProductWorkspace; hasAccess: boolean }>(
          `/api/products/${encodeURIComponent(slug)}`
        );
        if (cancelled) return;
        setProduct(data.product);
      } catch (err) {
        if (cancelled) return;
        setProduct(null);
        setError(err instanceof ApiClientError ? err.message : "Failed to load product");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    if (!slug || !product) return;
    let cancelled = false;
    void (async () => {
      try {
        const data = await apiFetch<{ config: SetupConfig; aiPlatforms: string[] }>(
          `/api/products/${encodeURIComponent(slug)}/setup`
        );
        if (cancelled) return;
        setSetup({
          ...data.config,
          selectedServiceIds: data.config.selectedServiceIds || [],
          aiPlatform: data.config.aiPlatform || "ChatGPT",
          experienceLevel: data.config.experienceLevel || "Beginner building a first agency",
          preferredDeliveryModel:
            data.config.preferredDeliveryModel || "Audit plus implementation",
          weeklyTimeAvailability: data.config.weeklyTimeAvailability || "5 hours or less",
        });
        setAiPlatforms(data.aiPlatforms || []);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof ApiClientError ? err.message : "Failed to load workspace");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug, product]);

  useEffect(() => {
    if (!product) return;
    let cancelled = false;
    void (async () => {
      try {
        const data = await apiFetch<{ clients: ClientRow[] }>("/api/clients");
        if (!cancelled) setClients(data.clients);
      } catch {
        /* optional for preview */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [product]);

  if (loading) {
    return (
      <Protected adminOnly>
        <ToolLoadingPulse label="Loading agency" fullPage />
      </Protected>
    );
  }

  if (error || !product) {
    return (
      <Protected adminOnly>
        <div style={{ padding: "2rem", maxWidth: 480, margin: "4rem auto" }}>
          <EmptyState
            title="Unable to open this product"
            description={error || "Not found"}
            action={
              <Link className="btn lime" href="/admin/products">
                Back to products
              </Link>
            }
          />
        </div>
      </Protected>
    );
  }

  if (!setup) {
    return (
      <Protected adminOnly>
        <ToolLoadingPulse
          label="Loading workspace"
          icon={product.icon}
          fullPage
        />
      </Protected>
    );
  }

  const accent = productAccent(product.configuration);
  const category = productCategory(product.configuration, product.tagline);

  return (
    <Protected adminOnly>
      <ProductShell
        mode="admin"
        slug={slug}
        productName={product.name}
        category={category}
        accent={accent}
      >
        <AgencyOneLayout
          slug={slug}
          product={product}
          setup={setup}
          aiPlatforms={aiPlatforms}
          onSetupChange={setSetup}
          clients={clients}
          onClientsChange={setClients}
        />
      </ProductShell>
    </Protected>
  );
}

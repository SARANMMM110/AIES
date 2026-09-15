"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { Protected } from "@/components/Protected";
import { ToolLoadingPulse } from "@/components/ToolLoadingPulse";
import { AgencyOneLayout } from "@/components/product/AgencyOneLayout";
import { LockedAgencyPreview } from "@/components/product/LockedAgencyPreview";
import { ProductShell } from "@/components/product/ProductShell";
import {
  productAccent,
  productCategory,
  type ClientRow,
  type ProductWorkspace,
  type SetupConfig,
} from "@/components/product/types";
import { apiFetch, ApiClientError } from "@/lib/api";

export default function ProductWorkspacePage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;

  const [product, setProduct] = useState<ProductWorkspace | null>(null);
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [setup, setSetup] = useState<SetupConfig | null>(null);
  const [aiPlatforms, setAiPlatforms] = useState<string[]>([]);
  const [clients, setClients] = useState<ClientRow[]>([]);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await apiFetch<{ product: ProductWorkspace; hasAccess: boolean }>(
          `/api/products/${slug}`
        );
        setProduct(data.product);
        setHasAccess(data.hasAccess);
      } catch (err) {
        setError(err instanceof ApiClientError ? err.message : "Failed to load product");
        setHasAccess(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [slug]);

  useEffect(() => {
    if (!slug || !hasAccess) return;
    void (async () => {
      try {
        const data = await apiFetch<{ config: SetupConfig; aiPlatforms: string[] }>(
          `/api/products/${slug}/setup`
        );
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
      } catch {
        /* ignore until access confirmed */
      }
    })();
  }, [slug, hasAccess]);

  useEffect(() => {
    if (!hasAccess) return;
    void (async () => {
      try {
        const data = await apiFetch<{ clients: ClientRow[] }>("/api/clients");
        setClients(data.clients);
      } catch {
        /* ignore */
      }
    })();
  }, [hasAccess]);

  if (loading) {
    return (
      <Protected>
        <AppShell>
          <ToolLoadingPulse label="Loading agency" fullPage={false} />
        </AppShell>
      </Protected>
    );
  }

  if (error || !product || hasAccess === null) {
    return (
      <Protected>
        <AppShell>
          <EmptyState
            title="Unable to open this product"
            description={error || "Not found"}
            action={
              <Link className="btn primary" href="/products">
                Back to Products
              </Link>
            }
          />
        </AppShell>
      </Protected>
    );
  }

  if (!hasAccess) {
    return (
      <Protected>
        <LockedAgencyPreview product={product} />
      </Protected>
    );
  }

  if (!setup) {
    return (
      <Protected>
        <AppShell>
          <ToolLoadingPulse
            label="Loading workspace"
            icon={product.icon}
            fullPage={false}
          />
        </AppShell>
      </Protected>
    );
  }

  const accent = productAccent(product.configuration);
  const category = productCategory(product.configuration, product.tagline);

  return (
    <Protected>
      <ProductShell slug={slug} productName={product.name} category={category} accent={accent}>
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

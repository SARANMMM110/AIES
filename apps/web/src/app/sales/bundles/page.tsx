import type { CSSProperties } from "react";
import Link from "next/link";
import { SalesFooter, SalesHeader } from "@/components/sales/SalesChrome";
import { fetchSalesCatalog } from "@/lib/sales/catalog";
import { formatMoney } from "@/lib/purchase";
import "@/components/sales/purchase-flow.css";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Bundles — AI Enterprise Studio",
  description: "Published agency bundles and packs.",
};

export default async function BundlesIndexPage() {
  const catalog = await fetchSalesCatalog();
  return (
    <div className="sales-root" style={{ ["--sales-accent"]: "#caff45" } as CSSProperties}>
      <SalesHeader />
      <main>
        <section className="section">
          <div className="container">
            <div className="head">
              <div>
                <div className="tag">Bundles</div>
                <h2>Published packs</h2>
              </div>
              <Link className="btn outline" href="/sales">
                Full catalog
              </Link>
            </div>
            <div className="service-grid" style={{ gridTemplateColumns: "repeat(2, 1fr)" }}>
              {catalog.bundles.map((bundle) => (
                <div key={bundle.slug} className="service">
                  <b>{bundle.name}</b>
                  <p className="service-desc">
                    {bundle.agencyCount} agencies · {formatMoney(bundle.priceCents, bundle.currency)}
                  </p>
                  <p className="service-desc">{bundle.shortDescription || bundle.tagline}</p>
                  <Link className="btn lime" href={`/sales/bundles/${bundle.slug}`} style={{ marginTop: 10 }}>
                    View Bundle →
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
      <SalesFooter />
    </div>
  );
}

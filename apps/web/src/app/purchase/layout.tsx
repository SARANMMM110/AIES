import type { Metadata } from "next";
import "../sales/sales-layout.css";

export const metadata: Metadata = {
  title: "Inquiry | AI Enterprise Studio",
  description:
    "Send your details to AI Enterprise Studio. There is no payment gateway — our team follows up by email.",
};

export default function PurchaseLayout({ children }: { children: React.ReactNode }) {
  return children;
}

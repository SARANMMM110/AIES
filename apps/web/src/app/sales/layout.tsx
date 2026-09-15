import type { Metadata } from "next";
import "./sales-layout.css";

export const metadata: Metadata = {
  title: {
    default: "Sales | AI Enterprise Studio",
    template: "%s | AI Enterprise Studio",
  },
  description:
    "Request access to individual AI agencies or the complete 10-agency suite from AI Enterprise Studio. No payment gateway — we follow up by email.",
};

export default function SalesLayout({ children }: { children: React.ReactNode }) {
  return children;
}

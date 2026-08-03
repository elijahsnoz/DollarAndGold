import type { Metadata } from "next";

import { PageHeader } from "@/components/common/page-header";
import { ComparisonWorkspace } from "@/components/compare/comparison-workspace";

export const metadata: Metadata = {
  title: "Compare Markets",
  description:
    "Compare trend, confidence, volatility, key levels and correlation across multiple markets side by side.",
};

export default function ComparePage() {
  return (
    <div className="container py-12 sm:py-16">
      <PageHeader
        eyebrow="Market Intelligence"
        title="Compare markets side by side"
        lede="Pick two to six markets to see trend, confidence, volatility, key levels, and how closely they actually move together."
      />

      <div className="mt-10">
        <ComparisonWorkspace />
      </div>
    </div>
  );
}

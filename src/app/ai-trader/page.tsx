import type { Metadata } from "next";

import { AiAnalysisPanel } from "@/components/ai-trader/ai-analysis-panel";
import { AiTraderHero } from "@/components/ai-trader/hero";
import { ConnectBybitCard } from "@/components/ai-trader/connect-bybit-card";
import { MarketDashboard } from "@/components/ai-trader/market-dashboard";
import { StatusCard } from "@/components/ai-trader/status-card";
import { loadMarketCards } from "@/lib/ai-trader/agents/market";
import type { ExchangeConnectionStatus } from "@/lib/ai-trader/types";
import { getCurrentUser, getSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Dashboard" };

async function loadConnectionStatus(): Promise<ExchangeConnectionStatus> {
  const empty: ExchangeConnectionStatus = { connected: false, exchange: "bybit", environment: null };

  const supabase = await getSupabaseServerClient();
  const user = await getCurrentUser();
  if (!supabase || !user) return empty;

  const { data } = await supabase
    .from("exchange_credentials")
    .select("environment")
    .eq("user_id", user.id)
    .eq("exchange", "bybit")
    .maybeSingle();

  return data
    ? { connected: true, exchange: "bybit", environment: data.environment }
    : empty;
}

export default async function AiTraderPage() {
  const [cards, connection] = await Promise.all([
    loadMarketCards(),
    loadConnectionStatus(),
  ]);

  return (
    <div className="space-y-12">
      <AiTraderHero />
      <StatusCard connection={connection} />
      <ConnectBybitCard initial={connection} />
      <MarketDashboard cards={cards} />
      <AiAnalysisPanel connection={connection} />
    </div>
  );
}

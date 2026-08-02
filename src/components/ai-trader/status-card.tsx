import { Card } from "@/components/ui/card";
import type { ExchangeConnectionStatus } from "@/lib/ai-trader/types";
import { cn } from "@/lib/utils";

/**
 * The top status strip. Portfolio metrics are honestly blank until paper
 * trading exists — this app doesn't fabricate a P/L number to fill a tile.
 */
export function StatusCard({ connection }: { connection: ExchangeConnectionStatus }) {
  const tiles: { label: string; value: string; tone?: "bull" | "gold"; note?: string }[] = [
    { label: "AI Status", value: "Online", tone: "bull" },
    {
      label: "Exchange",
      value: connection.connected
        ? `Bybit · ${connection.environment}`
        : "Not connected",
      tone: connection.connected ? "gold" : undefined,
    },
    { label: "Portfolio Value", value: "—", note: "Paper trading not active yet" },
    { label: "Today's P/L", value: "—", note: "Paper trading not active yet" },
    { label: "Open Positions", value: "—", note: "Paper trading not active yet" },
    { label: "Win Rate", value: "—", note: "Paper trading not active yet" },
  ];

  return (
    <Card className="p-6">
      <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-6">
        {tiles.map((tile) => (
          <div key={tile.label}>
            <p className="text-xs text-muted-foreground">{tile.label}</p>
            <p
              className={cn(
                "tabular mt-1.5 truncate text-lg font-semibold tracking-tight",
                tile.tone === "bull" && "text-bull",
                tile.tone === "gold" && "text-gold",
              )}
            >
              {tile.value}
            </p>
            {tile.note && (
              <p className="mt-1 text-[10px] leading-tight text-muted-foreground">
                {tile.note}
              </p>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}

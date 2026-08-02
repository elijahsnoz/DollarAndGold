import crypto from "node:crypto";

/**
 * Bybit V5 REST client.
 *
 * `getWalletBalance` (read-only) and `placeOrder` (market order, entry only —
 * cancel and stop-loss/take-profit modification are separate, later methods
 * on this same class, see the BYBIT INTEGRATION section of the /ai-trader
 * spec). Not stubbed here ahead of time, because a method with no real
 * implementation is worse than no method at all.
 *
 * Signing follows Bybit's V5 scheme exactly: HMAC-SHA256 over
 * `timestamp + apiKey + recvWindow + payload`, where `payload` is the query
 * string for GET and the raw JSON body for POST — sent as the `X-BAPI-SIGN`
 * header alongside the raw key, timestamp and recv-window.
 */

const BASE_URLS = {
  testnet: "https://api-testnet.bybit.com",
  live: "https://api.bybit.com",
} as const;

/** Bybit's tolerance window for how stale a request's timestamp may be, in ms. */
const RECV_WINDOW = "5000";

export type BybitEnvironment = "testnet" | "live";

export interface BybitCredentials {
  apiKey: string;
  apiSecret: string;
  environment: BybitEnvironment;
}

export interface BybitCoinBalance {
  coin: string;
  walletBalance: number;
  usdValue: number;
}

export interface BybitWalletBalance {
  accountType: string;
  totalEquity: number;
  totalAvailableBalance: number;
  totalWalletBalance: number;
  coins: BybitCoinBalance[];
}

export interface PlaceOrderParams {
  /** Bybit symbol, e.g. "BTCUSDT" — see `bybit-symbol-map.ts`. */
  symbol: string;
  side: "Buy" | "Sell";
  qty: string;
  stopLoss?: string;
  takeProfit?: string;
  /** USDT perpetuals by default — spot has no leverage or stop/take-profit on the order itself. */
  category?: "linear" | "spot";
}

export interface PlaceOrderResult {
  orderId: string;
  orderLinkId: string;
}

interface BybitApiResponse<T> {
  retCode: number;
  retMsg: string;
  result: T;
}

export class BybitClient {
  private readonly baseUrl: string;

  constructor(private readonly credentials: BybitCredentials) {
    this.baseUrl = BASE_URLS[credentials.environment];
  }

  private sign(payload: string): string {
    return crypto.createHmac("sha256", this.credentials.apiSecret).update(payload).digest("hex");
  }

  private async signedRequest<T>(
    method: "GET" | "POST",
    path: string,
    params: Record<string, string> = {},
  ): Promise<T> {
    const timestamp = Date.now().toString();
    const headers: Record<string, string> = {
      "X-BAPI-API-KEY": this.credentials.apiKey,
      "X-BAPI-TIMESTAMP": timestamp,
      "X-BAPI-RECV-WINDOW": RECV_WINDOW,
    };

    let url = `${this.baseUrl}${path}`;
    let body: string | undefined;

    if (method === "GET") {
      const queryString = new URLSearchParams(params).toString();
      if (queryString) url += `?${queryString}`;
      headers["X-BAPI-SIGN"] = this.sign(
        `${timestamp}${this.credentials.apiKey}${RECV_WINDOW}${queryString}`,
      );
    } else {
      body = JSON.stringify(params);
      headers["Content-Type"] = "application/json";
      headers["X-BAPI-SIGN"] = this.sign(
        `${timestamp}${this.credentials.apiKey}${RECV_WINDOW}${body}`,
      );
    }

    const response = await fetch(url, {
      method,
      headers,
      body,
      signal: AbortSignal.timeout(10_000),
    });

    const data = (await response.json()) as BybitApiResponse<T>;
    if (data.retCode !== 0) {
      // Bybit's own message ("api_key invalid", "timestamp expired",
      // "insufficient balance", account type mismatch, etc.) is far more
      // useful here than a generic failure.
      throw new Error(data.retMsg || "Bybit request failed.");
    }

    return data.result;
  }

  /** Unified Trading Account wallet balance — the modern default account type on Bybit. */
  async getWalletBalance(accountType: "UNIFIED" | "CONTRACT" = "UNIFIED"): Promise<BybitWalletBalance> {
    const result = await this.signedRequest<{
      list: {
        accountType: string;
        totalEquity: string;
        totalAvailableBalance: string;
        totalWalletBalance: string;
        coin: { coin: string; walletBalance: string; usdValue: string }[];
      }[];
    }>("GET", "/v5/account/wallet-balance", { accountType });

    const account = result.list[0];
    if (!account) {
      throw new Error(
        "Bybit returned no account data for this key — it may not be a Unified Trading Account.",
      );
    }

    return {
      accountType: account.accountType,
      totalEquity: Number(account.totalEquity) || 0,
      totalAvailableBalance: Number(account.totalAvailableBalance) || 0,
      totalWalletBalance: Number(account.totalWalletBalance) || 0,
      coins: account.coin.map((c) => ({
        coin: c.coin,
        walletBalance: Number(c.walletBalance) || 0,
        usdValue: Number(c.usdValue) || 0,
      })),
    };
  }

  /**
   * Places a market order, optionally with stop-loss/take-profit attached.
   * Uses whatever leverage is already configured for this symbol on your
   * Bybit account — this method does not set leverage.
   */
  async placeOrder({
    symbol,
    side,
    qty,
    stopLoss,
    takeProfit,
    category = "linear",
  }: PlaceOrderParams): Promise<PlaceOrderResult> {
    const body: Record<string, string> = {
      category,
      symbol,
      side,
      orderType: "Market",
      qty,
    };
    if (stopLoss) body.stopLoss = stopLoss;
    if (takeProfit) body.takeProfit = takeProfit;

    return this.signedRequest<PlaceOrderResult>("POST", "/v5/order/create", body);
  }
}

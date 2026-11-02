import { createHash } from "crypto";
import { base58Encode } from "./crypto";
import { getRoute, simulatedAmountInCents } from "./quotes";

const API = "https://1click.chaindefuser.com/v0";

export interface QuoteResult {
  mode: "SIMULATED" | "ONECLICK";
  amountInCents: number;
  depositAddress: string;
  depositMemo?: string;
  expiresAt: string;
}

function pseudoAddress(routeId: string, seed: string): string {
  const digest = createHash("sha256").update(`${routeId}:${seed}`).digest();
  if (routeId === "solana") return base58Encode(digest);
  if (routeId === "ton") return `EQ${digest.toString("base64url").slice(0, 44)}`;
  return `0x${digest.toString("hex").slice(0, 40)}`;
}

interface TokenInfo { assetId: string; blockchain: string; symbol: string; decimals: number }
function findToken(tokens: TokenInfo[], aliases: string[], symbol: string): TokenInfo | undefined {
  const wanted = aliases.map((a) => a.toLowerCase());
  return tokens.find((t) => t.symbol.toUpperCase() === symbol.toUpperCase() && wanted.some((a) => t.blockchain.toLowerCase().includes(a)));
}
function toSmallest(amountCents: number, decimals: number): string {
  if (decimals < 2) throw new Error("Unsupported token decimals");
  return (BigInt(amountCents) * 10n ** BigInt(decimals - 2)).toString();
}
function toCentsFromSmallest(value: string, decimals: number): number {
  const v = BigInt(value);
  if (decimals <= 2) return Number(v * 10n ** BigInt(2 - decimals));
  const divisor = 10n ** BigInt(decimals - 2);
  return Number((v + divisor - 1n) / divisor);
}

export async function createCrosschainQuote(input: {
  routeId: string;
  sourceToken: string;
  amountCents: number;
  recipientAccountId: string;
  refundTo?: string;
  quoteSeed: string;
}): Promise<QuoteResult> {
  const route = getRoute(input.routeId);
  const expiresAt = new Date(Date.now() + 10 * 60_000).toISOString();
  const simulated: QuoteResult = {
    mode: "SIMULATED",
    amountInCents: simulatedAmountInCents(input.amountCents, route.feeBps),
    depositAddress: pseudoAddress(route.id, input.quoteSeed),
    expiresAt,
  };
  if (process.env.ONE_CLICK_ENABLED !== "true" || !input.refundTo) return simulated;
  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (process.env.ONE_CLICK_API_KEY) headers["X-API-Key"] = process.env.ONE_CLICK_API_KEY;
    const tokensRes = await fetch(`${API}/tokens`, { headers, cache: "no-store" });
    if (!tokensRes.ok) throw new Error("Token list unavailable");
    const tokens = (await tokensRes.json()) as TokenInfo[];
    const origin = findToken(tokens, route.aliases, input.sourceToken);
    const destination = findToken(tokens, ["near"], "USDC");
    if (!origin || !destination) throw new Error("Route not currently available");
    const body = {
      dry: false,
      swapType: "EXACT_OUTPUT",
      slippageTolerance: 100,
      originAsset: origin.assetId,
      depositType: "ORIGIN_CHAIN",
      destinationAsset: destination.assetId,
      amount: toSmallest(input.amountCents, destination.decimals),
      recipient: input.recipientAccountId,
      recipientType: "DESTINATION_CHAIN",
      refundTo: input.refundTo,
      refundType: "ORIGIN_CHAIN",
      deadline: expiresAt,
    };
    const res = await fetch(`${API}/quote`, { method: "POST", headers, body: JSON.stringify(body), cache: "no-store" });
    const json: any = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.message ?? "Quote unavailable");
    const q = json.quote ?? json;
    const depositAddress: string | undefined = q.depositAddress ?? q.deposit_address;
    if (!depositAddress) throw new Error("Quote did not include a deposit address");
    let amountInCents = simulated.amountInCents;
    if (typeof q.amountInFormatted === "string") amountInCents = Math.ceil(Number(q.amountInFormatted) * 100);
    else if (typeof q.amountIn === "string") amountInCents = toCentsFromSmallest(q.amountIn, origin.decimals);
    return {
      mode: "ONECLICK",
      amountInCents,
      depositAddress,
      depositMemo: q.depositMemo ?? q.deposit_memo,
      expiresAt: q.deadline ?? expiresAt,
    };
  } catch {
    if (process.env.ONE_CLICK_FALLBACK === "false") throw new Error("Live cross-chain quote unavailable for this route.");
    return simulated;
  }
}

export async function fetchOneClickStatus(depositAddress: string): Promise<string> {
  const headers: Record<string, string> = {};
  if (process.env.ONE_CLICK_API_KEY) headers["X-API-Key"] = process.env.ONE_CLICK_API_KEY;
  const res = await fetch(`${API}/status?depositAddress=${encodeURIComponent(depositAddress)}`, { headers, cache: "no-store" });
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.message ?? "Status unavailable");
  return String(json.status ?? json.state ?? "PROCESSING").toUpperCase();
}

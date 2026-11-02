import { createHash } from "crypto";
import { base58Encode } from "./crypto";
import { getRoute, simulatedAmountInCents } from "./quotes";

const API = process.env.ONE_CLICK_API_URL ?? "https://1click.chaindefuser.com/v0";

type FetchImpl = typeof fetch;

export interface QuoteResult {
  mode: "SIMULATED" | "ONECLICK";
  amountInCents: number;
  depositAddress: string;
  depositMemo?: string;
  expiresAt: string;
}

export interface OneClickToken {
  assetId: string;
  blockchain: string;
  symbol: string;
  decimals: number;
  contractAddress?: string | null;
  price?: number;
}

export interface OneClickQuoteRequestBody {
  dry: boolean;
  swapType: "EXACT_OUTPUT";
  slippageTolerance: number;
  originAsset: string;
  depositType: "ORIGIN_CHAIN";
  destinationAsset: string;
  amount: string;
  recipient: string;
  recipientType: "DESTINATION_CHAIN";
  refundTo: string;
  refundType: "ORIGIN_CHAIN";
  deadline: string;
}

export interface OneClickQuoteRaw {
  depositAddress?: string;
  deposit_address?: string;
  depositMemo?: string;
  deposit_memo?: string;
  amountIn?: string;
  amountInFormatted?: string;
  amountOut?: string;
  amountOutFormatted?: string;
  deadline?: string;
  [key: string]: unknown;
}

export interface DryQuoteVerification {
  ok: boolean;
  stage: "TOKEN" | "DRY_QUOTE";
  routeId: string;
  origin?: OneClickToken;
  destination?: OneClickToken;
  amountOutCents: number;
  amountInCents?: number;
  expiresAt?: string;
  error?: string;
  raw?: OneClickQuoteRaw;
}

function pseudoAddress(routeId: string, seed: string): string {
  const digest = createHash("sha256").update(`${routeId}:${seed}`).digest();
  if (routeId === "solana") return base58Encode(digest);
  if (routeId === "ton") return `EQ${digest.toString("base64url").slice(0, 44)}`;
  return `0x${digest.toString("hex").slice(0, 40)}`;
}

function oneClickHeaders(includeJson = false): Record<string, string> {
  const headers: Record<string, string> = {};
  if (includeJson) headers["Content-Type"] = "application/json";
  // 1Click supports a Partner API key (X-API-Key, recommended) and legacy JWT Bearer auth.
  if (process.env.ONE_CLICK_API_KEY) headers["X-API-Key"] = process.env.ONE_CLICK_API_KEY;
  else if (process.env.ONE_CLICK_JWT) headers.Authorization = `Bearer ${process.env.ONE_CLICK_JWT}`;
  return headers;
}

export async function fetchOneClickTokens(fetchImpl: FetchImpl = fetch): Promise<OneClickToken[]> {
  const res = await fetchImpl(`${API}/tokens`, { headers: oneClickHeaders(), cache: "no-store" });
  if (!res.ok) throw new Error(`1Click token list unavailable (${res.status})`);
  return (await res.json()) as OneClickToken[];
}

export function findOneClickToken(tokens: OneClickToken[], aliases: string[], symbol: string): OneClickToken | undefined {
  const wanted = aliases.map((a) => a.toLowerCase());
  const bySymbol = tokens.filter((t) => t.symbol.toUpperCase() === symbol.toUpperCase());
  return (
    bySymbol.find((t) => wanted.includes(t.blockchain.toLowerCase())) ??
    bySymbol.find((t) => {
      const chain = t.blockchain.toLowerCase();
      return wanted.some((alias) => chain.includes(alias) || alias.includes(chain));
    })
  );
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
function parseAmountInCents(quote: OneClickQuoteRaw, origin: OneClickToken): number | undefined {
  if (typeof quote.amountInFormatted === "string" && Number.isFinite(Number(quote.amountInFormatted))) {
    return Math.ceil(Number(quote.amountInFormatted) * 100);
  }
  if (typeof quote.amountIn === "string") return toCentsFromSmallest(quote.amountIn, origin.decimals);
  return undefined;
}

export function buildExactOutputQuoteRequest(input: {
  dry: boolean;
  origin: OneClickToken;
  destination: OneClickToken;
  amountCents: number;
  recipient: string;
  refundTo: string;
  deadline: string;
  slippageTolerance?: number;
}): OneClickQuoteRequestBody {
  return {
    dry: input.dry,
    swapType: "EXACT_OUTPUT",
    slippageTolerance: input.slippageTolerance ?? 100,
    originAsset: input.origin.assetId,
    depositType: "ORIGIN_CHAIN",
    destinationAsset: input.destination.assetId,
    amount: toSmallest(input.amountCents, input.destination.decimals),
    recipient: input.recipient,
    recipientType: "DESTINATION_CHAIN",
    refundTo: input.refundTo,
    refundType: "ORIGIN_CHAIN",
    deadline: input.deadline,
  };
}

export async function requestOneClickQuoteRaw(
  body: OneClickQuoteRequestBody,
  fetchImpl: FetchImpl = fetch,
): Promise<OneClickQuoteRaw> {
  const res = await fetchImpl(`${API}/quote`, {
    method: "POST",
    headers: oneClickHeaders(true),
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.message ?? json?.error ?? `1Click quote unavailable (${res.status})`);
  return (json.quote ?? json) as OneClickQuoteRaw;
}

/**
 * Verifies a route with a dry exact-output quote. This function never requests
 * a live deposit: `dry` is hard-coded to true at the request-builder call.
 */
export async function requestDryExactOutputQuote(input: {
  routeId: string;
  sourceToken: string;
  amountCents: number;
  recipient: string;
  refundTo: string;
  fetchImpl?: FetchImpl;
}): Promise<DryQuoteVerification> {
  const route = getRoute(input.routeId);
  const fetchImpl = input.fetchImpl ?? fetch;
  const tokens = await fetchOneClickTokens(fetchImpl);
  const origin = findOneClickToken(tokens, route.aliases, input.sourceToken);
  const destination = findOneClickToken(tokens, ["near"], "USDC");
  if (!origin || !destination) {
    return {
      ok: false,
      stage: "TOKEN",
      routeId: route.id,
      origin,
      destination,
      amountOutCents: input.amountCents,
      error: !origin ? `Origin asset not found for ${route.chain} ${input.sourceToken}` : "NEAR USDC destination asset not found",
    };
  }
  const deadline = new Date(Date.now() + 10 * 60_000).toISOString();
  try {
    const raw = await requestOneClickQuoteRaw(
      buildExactOutputQuoteRequest({ dry: true, origin, destination, amountCents: input.amountCents, recipient: input.recipient, refundTo: input.refundTo, deadline }),
      fetchImpl,
    );
    return {
      ok: true,
      stage: "DRY_QUOTE",
      routeId: route.id,
      origin,
      destination,
      amountOutCents: input.amountCents,
      amountInCents: parseAmountInCents(raw, origin),
      expiresAt: raw.deadline ?? deadline,
      raw,
    };
  } catch (error) {
    return {
      ok: false,
      stage: "DRY_QUOTE",
      routeId: route.id,
      origin,
      destination,
      amountOutCents: input.amountCents,
      error: error instanceof Error ? error.message : "Dry quote failed",
    };
  }
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
    const tokens = await fetchOneClickTokens();
    const origin = findOneClickToken(tokens, route.aliases, input.sourceToken);
    const destination = findOneClickToken(tokens, ["near"], "USDC");
    if (!origin || !destination) throw new Error("Route not currently available");
    const q = await requestOneClickQuoteRaw(
      buildExactOutputQuoteRequest({
        dry: false,
        origin,
        destination,
        amountCents: input.amountCents,
        recipient: input.recipientAccountId,
        refundTo: input.refundTo,
        deadline: expiresAt,
      }),
    );
    const depositAddress = q.depositAddress ?? q.deposit_address;
    if (!depositAddress) throw new Error("Quote did not include a deposit address");
    return {
      mode: "ONECLICK",
      amountInCents: parseAmountInCents(q, origin) ?? simulated.amountInCents,
      depositAddress,
      depositMemo: q.depositMemo ?? q.deposit_memo,
      expiresAt: q.deadline ?? expiresAt,
    };
  } catch {
    if (process.env.ONE_CLICK_FALLBACK === "false") throw new Error("Live cross-chain quote unavailable for this route.");
    return simulated;
  }
}

export async function fetchOneClickStatus(depositAddress: string, depositMemo?: string): Promise<string> {
  const params = new URLSearchParams({ depositAddress });
  if (depositMemo) params.set("depositMemo", depositMemo);
  const res = await fetch(`${API}/status?${params.toString()}`, { headers: oneClickHeaders(), cache: "no-store" });
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.message ?? json?.error ?? "Status unavailable");
  return String(json.status ?? json.state ?? "PROCESSING").toUpperCase();
}

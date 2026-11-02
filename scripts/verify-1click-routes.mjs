#!/usr/bin/env node
import { writeFile } from "node:fs/promises";

/**
 * Dry-only 1Click route verification for NEST.
 *
 * This script hard-codes `dry: true`. It cannot create a live quote or spend.
 * It verifies, route by route:
 *   1. the exact origin asset exists in the live 1Click token list;
 *   2. a dry EXACT_OUTPUT quote to NEAR USDC succeeds.
 *
 * Required for dry quotes:
 *   --recipient=<public NEAR account id>
 *   --refund-evm=<public EVM refund address>
 * Optional by family: --refund-solana=..., --refund-ton=...
 * Optional secrets are read only from env: ONE_CLICK_API_KEY or ONE_CLICK_JWT.
 */

const ROUTES = [
  { id: "base", chain: "Base", token: "USDC", aliases: ["base"], refundKind: "evm" },
  { id: "solana", chain: "Solana", token: "USDC", aliases: ["sol", "solana"], refundKind: "solana" },
  { id: "arbitrum", chain: "Arbitrum", token: "USDC", aliases: ["arb", "arbitrum"], refundKind: "evm" },
  { id: "ethereum", chain: "Ethereum", token: "USDC", aliases: ["eth", "ethereum"], refundKind: "evm" },
  { id: "bsc", chain: "BSC", token: "USDC", aliases: ["bsc", "bnb"], refundKind: "evm" },
  { id: "optimism", chain: "Optimism", token: "USDC", aliases: ["op", "optimism"], refundKind: "evm" },
  { id: "polygon", chain: "Polygon", token: "USDC", aliases: ["pol", "polygon", "matic"], refundKind: "evm" },
  { id: "avalanche", chain: "Avalanche", token: "USDC", aliases: ["avax", "avalanche"], refundKind: "evm" },
  { id: "celo", chain: "Celo", token: "USDC", aliases: ["celo"], refundKind: "evm" },
  { id: "ton", chain: "TON", token: "GRAM", aliases: ["ton"], refundKind: "ton" },
  { id: "robinhood", chain: "Robinhood", token: "USDG", aliases: ["hood", "robinhood"], refundKind: "evm" },
  { id: "plasma", chain: "Plasma", token: "USDT0", aliases: ["plasma"], refundKind: "evm" },
  { id: "xlayer", chain: "X Layer", token: "USDC", aliases: ["xlayer", "x-layer", "xl"], refundKind: "evm" },
];

const args = new Map();
for (const arg of process.argv.slice(2)) {
  const match = arg.match(/^--([^=]+)=(.*)$/);
  if (match) args.set(match[1], match[2]);
  else if (arg === "--help" || arg === "-h") args.set("help", "true");
}

if (args.has("help")) {
  console.log(`Usage:
  npm run routes:verify -- --recipient=<near-account> --refund-evm=<0x...> --route=base --amount-cents=100

Environment alternatives:
  NEST_VERIFY_RECIPIENT_NEAR, NEST_VERIFY_REFUND_EVM,
  NEST_VERIFY_REFUND_SOLANA, NEST_VERIFY_REFUND_TON,
  NEST_VERIFY_REFUND_<ROUTE_ID>, ONE_CLICK_API_KEY, ONE_CLICK_JWT

Safety: every quote in this script is dry:true. No deposit is created for spending.`);
  process.exit(0);
}

const apiBase = process.env.ONE_CLICK_API_URL || "https://1click.chaindefuser.com/v0";
const recipient = args.get("recipient") || process.env.NEST_VERIFY_RECIPIENT_NEAR || "";
const amountCents = Number(args.get("amount-cents") || process.env.NEST_VERIFY_AMOUNT_CENTS || "100");
const onlyRoute = args.get("route") || "";
const outFile = args.get("out") || "";

if (!Number.isSafeInteger(amountCents) || amountCents <= 0 || amountCents > 100_000_000) {
  throw new Error("--amount-cents must be a positive safe integer no greater than 100000000");
}

function headers(includeJson = false) {
  const result = {};
  if (includeJson) result["content-type"] = "application/json";
  if (process.env.ONE_CLICK_API_KEY) result["X-API-Key"] = process.env.ONE_CLICK_API_KEY;
  else if (process.env.ONE_CLICK_JWT) result.Authorization = `Bearer ${process.env.ONE_CLICK_JWT}`;
  return result;
}

function findToken(tokens, aliases, symbol) {
  const wanted = aliases.map((value) => value.toLowerCase());
  const bySymbol = tokens.filter((token) => String(token.symbol).toUpperCase() === symbol.toUpperCase());
  return bySymbol.find((token) => wanted.includes(String(token.blockchain).toLowerCase())) ??
    bySymbol.find((token) => {
      const chain = String(token.blockchain).toLowerCase();
      return wanted.some((alias) => chain.includes(alias) || alias.includes(chain));
    });
}

function refundFor(route) {
  const specific = process.env[`NEST_VERIFY_REFUND_${route.id.toUpperCase()}`];
  if (specific) return specific;
  if (route.refundKind === "solana") return args.get("refund-solana") || process.env.NEST_VERIFY_REFUND_SOLANA || "";
  if (route.refundKind === "ton") return args.get("refund-ton") || process.env.NEST_VERIFY_REFUND_TON || "";
  return args.get("refund-evm") || process.env.NEST_VERIFY_REFUND_EVM || "";
}

function toSmallest(cents, decimals) {
  if (decimals < 2) throw new Error(`Unsupported destination decimals: ${decimals}`);
  return (BigInt(cents) * 10n ** BigInt(decimals - 2)).toString();
}

async function fetchTokens() {
  const response = await fetch(`${apiBase}/tokens`, { headers: headers() });
  if (!response.ok) throw new Error(`Token list failed: HTTP ${response.status}`);
  return response.json();
}

async function dryQuote(route, origin, destination, refundTo) {
  const deadline = new Date(Date.now() + 10 * 60_000).toISOString();
  const body = {
    dry: true,
    swapType: "EXACT_OUTPUT",
    slippageTolerance: 100,
    originAsset: origin.assetId,
    depositType: "ORIGIN_CHAIN",
    destinationAsset: destination.assetId,
    amount: toSmallest(amountCents, destination.decimals),
    recipient,
    recipientType: "DESTINATION_CHAIN",
    refundTo,
    refundType: "ORIGIN_CHAIN",
    deadline,
  };
  const response = await fetch(`${apiBase}/quote`, {
    method: "POST",
    headers: headers(true),
    body: JSON.stringify(body),
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(json.message || json.error || `HTTP ${response.status}`);
  const quote = json.quote ?? json;
  return {
    status: "DRY_QUOTE_OK",
    amountIn: quote.amountIn ?? null,
    amountInFormatted: quote.amountInFormatted ?? null,
    amountOut: quote.amountOut ?? body.amount,
    amountOutFormatted: quote.amountOutFormatted ?? null,
    deadline: quote.deadline ?? deadline,
    depositMemoRequired: Boolean(quote.depositMemo || quote.deposit_memo),
  };
}

const tokens = await fetchTokens();
const destination = findToken(tokens, ["near"], "USDC");
if (!destination) throw new Error("NEAR USDC destination asset was not found in the live token list");

const selectedRoutes = onlyRoute ? ROUTES.filter((route) => route.id === onlyRoute) : ROUTES;
if (onlyRoute && selectedRoutes.length === 0) throw new Error(`Unknown route: ${onlyRoute}`);

const results = [];
for (const route of selectedRoutes) {
  const origin = findToken(tokens, route.aliases, route.token);
  const base = {
    route: route.id,
    chain: route.chain,
    token: route.token,
    originAssetId: origin?.assetId ?? null,
    originBlockchain: origin?.blockchain ?? null,
    originDecimals: origin?.decimals ?? null,
    destinationAssetId: destination.assetId,
    amountOutCents: amountCents,
  };
  if (!origin) {
    results.push({ ...base, status: "TOKEN_MISSING" });
    continue;
  }
  const refundTo = refundFor(route);
  if (!recipient || !refundTo) {
    results.push({
      ...base,
      status: "TOKEN_FOUND_QUOTE_INPUT_MISSING",
      missing: [!recipient && "recipient", !refundTo && `refund:${route.refundKind}`].filter(Boolean),
    });
    continue;
  }
  try {
    results.push({ ...base, ...(await dryQuote(route, origin, destination, refundTo)) });
  } catch (error) {
    results.push({ ...base, status: "DRY_QUOTE_FAILED", error: error.message });
  }
}

const report = {
  generatedAt: new Date().toISOString(),
  dryOnly: true,
  amountOutCents: amountCents,
  destination,
  results,
};
const text = JSON.stringify(report, null, 2);
if (outFile) await writeFile(outFile, `${text}\n`, "utf8");
console.log(text);

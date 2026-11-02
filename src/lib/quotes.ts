export interface SourceRoute {
  id: string;
  chain: string;
  token: string;
  feeBps: number;
  aliases: string[];
}

/** Target source routes. Runtime availability is verified against the live 1Click token list. */
export const SOURCE_ROUTES: SourceRoute[] = [
  { id: "base", chain: "Base", token: "USDC", feeBps: 80, aliases: ["base"] },
  { id: "solana", chain: "Solana", token: "USDC", feeBps: 90, aliases: ["sol", "solana"] },
  { id: "arbitrum", chain: "Arbitrum", token: "USDC", feeBps: 80, aliases: ["arb", "arbitrum"] },
  { id: "ethereum", chain: "Ethereum", token: "USDC", feeBps: 120, aliases: ["eth", "ethereum"] },
  { id: "bsc", chain: "BSC", token: "USDC", feeBps: 90, aliases: ["bsc", "bnb"] },
  { id: "optimism", chain: "Optimism", token: "USDC", feeBps: 80, aliases: ["op", "optimism"] },
  { id: "polygon", chain: "Polygon", token: "USDC", feeBps: 80, aliases: ["pol", "polygon", "matic"] },
  { id: "avalanche", chain: "Avalanche", token: "USDC", feeBps: 90, aliases: ["avax", "avalanche"] },
  { id: "celo", chain: "Celo", token: "USDC", feeBps: 100, aliases: ["celo"] },
  { id: "ton", chain: "TON", token: "GRAM", feeBps: 110, aliases: ["ton"] },
  { id: "robinhood", chain: "Robinhood", token: "USDG", feeBps: 100, aliases: ["hood", "robinhood"] },
  { id: "plasma", chain: "Plasma", token: "USDT0", feeBps: 100, aliases: ["plasma"] },
  { id: "xlayer", chain: "X Layer", token: "USDC", feeBps: 100, aliases: ["xlayer", "x-layer"] },
];

export function getRoute(id: string): SourceRoute {
  return SOURCE_ROUTES.find((r) => r.id === id) ?? SOURCE_ROUTES[0];
}

/** Exact-output estimate: recipient amount stays whole; sender pays routing on top. */
export function simulatedAmountInCents(amountCents: number, feeBps: number): number {
  if (amountCents <= 0) throw new Error("Amount must be positive");
  return Math.ceil((amountCents * (10_000 + feeBps)) / 10_000) + 1;
}

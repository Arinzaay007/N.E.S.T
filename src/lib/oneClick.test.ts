import { describe, expect, test } from "vitest";
import { buildExactOutputQuoteRequest, findOneClickToken, requestDryExactOutputQuote, type OneClickToken } from "./oneClick";

const tokens: OneClickToken[] = [
  { assetId: "nep141:base-usdc", blockchain: "base", symbol: "USDC", decimals: 6 },
  { assetId: "nep141:near-usdc", blockchain: "near", symbol: "USDC", decimals: 6 },
  { assetId: "nep141:eth-usdc", blockchain: "eth", symbol: "USDC", decimals: 6 },
];

describe("1Click verification helpers", () => {
  test("prefers exact blockchain matches when resolving assets", () => {
    expect(findOneClickToken(tokens, ["base"], "USDC")?.assetId).toBe("nep141:base-usdc");
    expect(findOneClickToken(tokens, ["near"], "USDC")?.assetId).toBe("nep141:near-usdc");
  });

  test("builds an exact-output request in destination smallest units", () => {
    const body = buildExactOutputQuoteRequest({
      dry: true,
      origin: tokens[0],
      destination: tokens[1],
      amountCents: 100,
      recipient: "merchant.near",
      refundTo: "0x0000000000000000000000000000000000000001",
      deadline: "2026-11-02T00:10:00.000Z",
    });
    expect(body.swapType).toBe("EXACT_OUTPUT");
    expect(body.amount).toBe("1000000");
    expect(body.dry).toBe(true);
  });

  test("dry verification fetches tokens then sends only a dry quote", async () => {
    const calls: Array<{ url: string; body?: any }> = [];
    const fetchImpl = async (url: string | URL | Request, init?: RequestInit) => {
      const href = String(url);
      calls.push({ url: href, body: init?.body ? JSON.parse(String(init.body)) : undefined });
      if (href.endsWith("/tokens")) {
        return new Response(JSON.stringify(tokens), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({ quote: { amountIn: "1010000", deadline: "2026-11-02T00:10:00.000Z" } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };
    const result = await requestDryExactOutputQuote({
      routeId: "base",
      sourceToken: "USDC",
      amountCents: 100,
      recipient: "merchant.near",
      refundTo: "0x0000000000000000000000000000000000000001",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(result.ok).toBe(true);
    expect(result.amountInCents).toBe(101);
    expect(calls[1].body.dry).toBe(true);
    expect(calls[1].body.swapType).toBe("EXACT_OUTPUT");
  });
});

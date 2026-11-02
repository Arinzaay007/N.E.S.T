import { describe, expect, test } from "vitest";
import {
  buildViewFunctionParams,
  decodeViewResult,
  encodeCallArgs,
  getNearConfig,
  getNearReadiness,
  isValidNearAccountId,
  NEAR_MAINNET_USDC_CONTRACT_ID,
  viewFunction,
} from "./near";

describe("NEAR read-only integration", () => {
  test("defaults to testnet and leaves contract ids explicit", () => {
    const config = getNearConfig({});
    expect(config.networkId).toBe("testnet");
    expect(config.rpcUrl).toBe("https://rpc.testnet.near.org");
    expect(config.registryConfigured).toBe(false);
    expect(config.usdcConfigured).toBe(false);
  });

  test("uses the known mainnet USDC contract only on mainnet", () => {
    const config = getNearConfig({ NEAR_NETWORK_ID: "mainnet" });
    expect(config.usdcContractId).toBe(NEAR_MAINNET_USDC_CONTRACT_ID);
  });

  test("validates named and implicit NEAR account ids", () => {
    expect(isValidNearAccountId("alice.near")).toBe(true);
    expect(isValidNearAccountId("a".repeat(64))).toBe(true);
    expect(isValidNearAccountId("Alice.near")).toBe(false);
    expect(isValidNearAccountId("bad..near")).toBe(false);
  });

  test("encodes and decodes NEAR view-call arguments/results", () => {
    const args = { handle: "mystore" };
    const params = buildViewFunctionParams("registry.testnet", "resolve_handle", args);
    expect(params.args_base64).toBe(encodeCallArgs(args));
    expect(decodeViewResult<{ ok: boolean }>([...Buffer.from("{\"ok\":true}")])).toEqual({ ok: true });
  });

  test("viewFunction posts a JSON-RPC query and parses byte results", async () => {
    const fetchImpl = async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      expect(body.method).toBe("query");
      expect(body.params.method_name).toBe("config");
      return new Response(JSON.stringify({ jsonrpc: "2.0", id: "nest", result: { result: [...Buffer.from("{\"handles\":3}")] } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };
    const result = await viewFunction<{ handles: number }>(
      "registry.testnet",
      "config",
      {},
      getNearConfig({ NEAR_REGISTRY_CONTRACT_ID: "registry.testnet" }),
      fetchImpl as unknown as typeof fetch,
    );
    expect(result.handles).toBe(3);
  });

  test("unconfigured readiness stays explicitly local-prototype", async () => {
    const readiness = await getNearReadiness({ config: getNearConfig({}) });
    expect(readiness.mode).toBe("LOCAL_PROTOTYPE");
    expect(readiness.registry).toBeUndefined();
    expect(readiness.usdc).toBeUndefined();
  });
});

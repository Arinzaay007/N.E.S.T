#!/usr/bin/env node
/**
 * Read-only NEAR preflight for NEST.
 *
 * Examples:
 *   NEAR_NETWORK_ID=testnet NEAR_REGISTRY_CONTRACT_ID=... NEAR_USDC_CONTRACT_ID=... \
 *     npm run near:preflight -- --account alice.testnet --handle alice
 *
 * This script only calls public JSON-RPC view methods. It never signs,
 * never pays storage, and never transfers value.
 */

const args = new Map();
for (const arg of process.argv.slice(2)) {
  const match = arg.match(/^--([^=]+)=(.*)$/);
  if (match) args.set(match[1], match[2]);
  else if (arg === "--help" || arg === "-h") args.set("help", "true");
}

if (args.has("help")) {
  console.log(`Usage:
  npm run near:preflight -- --network=testnet --account=<near-account> --handle=<handle>

Environment:
  NEAR_NETWORK_ID=testnet|mainnet
  NEAR_RPC_URL=https://rpc.testnet.near.org
  NEAR_REGISTRY_CONTRACT_ID=<deployed registry contract>
  NEAR_USDC_CONTRACT_ID=<NEP-141 USDC contract>

No keys are required or accepted.`);
  process.exit(0);
}

const networkId = args.get("network") || process.env.NEAR_NETWORK_ID || "testnet";
if (!["mainnet", "testnet"].includes(networkId)) throw new Error("--network must be mainnet or testnet");
const rpcUrl = args.get("rpc") || process.env.NEAR_RPC_URL || `https://rpc.${networkId}.near.org`;
const registryId = args.get("registry") || process.env.NEAR_REGISTRY_CONTRACT_ID || "";
const usdcId = args.get("usdc") || process.env.NEAR_USDC_CONTRACT_ID || (networkId === "mainnet" ? "17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1" : "");
const accountId = args.get("account") || process.env.NEST_PREFLIGHT_ACCOUNT_ID || "";
const handle = (args.get("handle") || "").replace(/^@/, "").toLowerCase();

async function rpc(method, params) {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: "nest-preflight", method, params }),
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok || json.error) throw new Error(JSON.stringify(json.error ?? `HTTP ${response.status}`));
  return json.result;
}

async function view(contractId, methodName, callArgs) {
  const result = await rpc("query", {
    request_type: "call_function",
    finality: "final",
    account_id: contractId,
    method_name: methodName,
    args_base64: Buffer.from(JSON.stringify(callArgs)).toString("base64"),
  });
  return JSON.parse(Buffer.from(result.result).toString("utf8"));
}

const report = {
  networkId,
  rpcUrl,
  registryContractId: registryId || null,
  usdcContractId: usdcId || null,
  account: null,
  registry: null,
  usdc: null,
};

if (accountId) {
  try {
    const viewResult = await rpc("query", { request_type: "view_account", finality: "final", account_id: accountId });
    report.account = { accountId, exists: true, amount: viewResult.amount, locked: viewResult.locked, storageUsage: viewResult.storage_usage, codeHash: viewResult.code_hash };
  } catch (error) {
    report.account = { accountId, exists: false, error: error.message };
  }
}

if (registryId) {
  report.registry = { contractId: registryId };
  try {
    report.registry.config = await view(registryId, "config", {});
    if (handle) report.registry.handle = await view(registryId, "resolve_handle", { handle });
    if (accountId) report.registry.handleOfAccount = await view(registryId, "handle_of", { account_id: accountId });
  } catch (error) {
    report.registry.error = error.message;
  }
}

if (usdcId && accountId) {
  report.usdc = { contractId: usdcId, accountId };
  try {
    report.usdc.balance = await view(usdcId, "ft_balance_of", { account_id: accountId });
    report.usdc.storageBalance = await view(usdcId, "storage_balance_of", { account_id: accountId });
  } catch (error) {
    report.usdc.error = error.message;
  }
}

console.log(JSON.stringify(report, null, 2));

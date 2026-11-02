type FetchImpl = typeof fetch;
type EnvLike = Record<string, string | undefined>;

export type NearNetworkId = "mainnet" | "testnet";

export interface NearConfig {
  networkId: NearNetworkId;
  rpcUrl: string;
  registryContractId?: string;
  usdcContractId?: string;
  registryConfigured: boolean;
  usdcConfigured: boolean;
}

export interface OnchainHandleView {
  handle: string;
  account_id: string;
  display_name: string;
  created_at_ns: number;
}

export interface OnchainRegistryConfig {
  owner_id: string;
  sponsor_id: string;
  usdc_id: string;
  network_fee: string;
  handles: number;
  payments: number;
}

export interface NearAccountView {
  amount: string;
  code_hash: string;
  locked: string;
  storage_paid_at?: number;
  storage_usage: number;
  block_height?: number;
  block_hash?: string;
}

export interface NearReadiness {
  mode: "ONCHAIN_READ_CONFIGURED" | "LOCAL_PROTOTYPE";
  config: Omit<NearConfig, "registryConfigured" | "usdcConfigured"> & {
    registryConfigured: boolean;
    usdcConfigured: boolean;
  };
  account?: { accountId: string; exists: boolean; view?: NearAccountView; error?: string };
  registry?: {
    contractId: string;
    config?: OnchainRegistryConfig;
    handle?: OnchainHandleView | null;
    error?: string;
  };
  usdc?: {
    contractId: string;
    accountId: string;
    balance?: string;
    storageBalance?: { total: string; available: string } | null;
    error?: string;
  };
}

/** Circle-issued USDC contract account on NEAR mainnet. Testnet must be configured explicitly. */
export const NEAR_MAINNET_USDC_CONTRACT_ID = "17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1";

function emptyToUndefined(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function getNearConfig(env: EnvLike = process.env): NearConfig {
  const networkId: NearNetworkId = env.NEAR_NETWORK_ID === "mainnet" ? "mainnet" : "testnet";
  const registryContractId = emptyToUndefined(env.NEAR_REGISTRY_CONTRACT_ID);
  const usdcContractId = emptyToUndefined(env.NEAR_USDC_CONTRACT_ID) ?? (networkId === "mainnet" ? NEAR_MAINNET_USDC_CONTRACT_ID : undefined);
  return {
    networkId,
    rpcUrl: emptyToUndefined(env.NEAR_RPC_URL) ?? `https://rpc.${networkId}.near.org`,
    registryContractId,
    usdcContractId,
    registryConfigured: Boolean(registryContractId),
    usdcConfigured: Boolean(usdcContractId),
  };
}

export function isValidNearAccountId(accountId: string): boolean {
  if (/^[0-9a-f]{64}$/.test(accountId)) return true;
  return /^(?=.{2,64}$)(?!.*\.\.)[a-z0-9]+(?:[-_][a-z0-9]+)*(?:\.[a-z0-9]+(?:[-_][a-z0-9]+)*)*$/.test(accountId);
}

export function encodeCallArgs(args: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(args), "utf8").toString("base64");
}

export function buildViewFunctionParams(accountId: string, methodName: string, args: Record<string, unknown>) {
  return {
    request_type: "call_function",
    finality: "final",
    account_id: accountId,
    method_name: methodName,
    args_base64: encodeCallArgs(args),
  };
}

export function decodeViewResult<T>(result: number[]): T {
  return JSON.parse(Buffer.from(result).toString("utf8")) as T;
}

function rpcErrorMessage(error: unknown): string {
  try {
    return JSON.stringify(error);
  } catch {
    return error instanceof Error ? error.message : "NEAR RPC error";
  }
}

export async function nearRpc<T>(
  method: string,
  params: unknown,
  config: NearConfig = getNearConfig(),
  fetchImpl: FetchImpl = fetch,
): Promise<T> {
  const res = await fetchImpl(config.rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: "nest", method, params }),
    cache: "no-store",
  });
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok || json.error) throw new Error(rpcErrorMessage(json.error ?? `NEAR RPC HTTP ${res.status}`));
  return json.result as T;
}

export async function viewFunction<T>(
  contractId: string,
  methodName: string,
  args: Record<string, unknown>,
  config: NearConfig = getNearConfig(),
  fetchImpl: FetchImpl = fetch,
): Promise<T> {
  const result = await nearRpc<{ result: number[] }>("query", buildViewFunctionParams(contractId, methodName, args), config, fetchImpl);
  return decodeViewResult<T>(result.result);
}

export async function viewAccount(
  accountId: string,
  config: NearConfig = getNearConfig(),
  fetchImpl: FetchImpl = fetch,
): Promise<NearAccountView | null> {
  try {
    return await nearRpc<NearAccountView>(
      "query",
      { request_type: "view_account", finality: "final", account_id: accountId },
      config,
      fetchImpl,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/UNKNOWN_ACCOUNT|DOES_NOT_EXIST|does not exist/i.test(message)) return null;
    throw error;
  }
}

export async function resolveHandleOnNear(handle: string, config: NearConfig = getNearConfig(), fetchImpl: FetchImpl = fetch) {
  if (!config.registryContractId) return null;
  return viewFunction<OnchainHandleView | null>(config.registryContractId, "resolve_handle", { handle }, config, fetchImpl);
}

export async function getHandleOfOnNear(accountId: string, config: NearConfig = getNearConfig(), fetchImpl: FetchImpl = fetch) {
  if (!config.registryContractId) return null;
  return viewFunction<string | null>(config.registryContractId, "handle_of", { account_id: accountId }, config, fetchImpl);
}

export async function getRegistryConfigOnNear(config: NearConfig = getNearConfig(), fetchImpl: FetchImpl = fetch) {
  if (!config.registryContractId) return null;
  return viewFunction<OnchainRegistryConfig>(config.registryContractId, "config", {}, config, fetchImpl);
}

export async function getFtBalanceOnNear(accountId: string, config: NearConfig = getNearConfig(), fetchImpl: FetchImpl = fetch) {
  if (!config.usdcContractId) return null;
  return viewFunction<string>(config.usdcContractId, "ft_balance_of", { account_id: accountId }, config, fetchImpl);
}

export async function getStorageBalanceOnNear(accountId: string, config: NearConfig = getNearConfig(), fetchImpl: FetchImpl = fetch) {
  if (!config.usdcContractId) return null;
  return viewFunction<{ total: string; available: string } | null>(
    config.usdcContractId,
    "storage_balance_of",
    { account_id: accountId },
    config,
    fetchImpl,
  );
}

/**
 * Read-only readiness check. It performs no signing, no storage deposits and
 * no transfers; it only asks public NEAR RPC view endpoints what already exists.
 */
export async function getNearReadiness(input: {
  accountId?: string;
  handle?: string;
  config?: NearConfig;
  fetchImpl?: FetchImpl;
}): Promise<NearReadiness> {
  const config = input.config ?? getNearConfig();
  const fetchImpl = input.fetchImpl ?? fetch;
  const readiness: NearReadiness = {
    mode: config.registryConfigured || config.usdcConfigured ? "ONCHAIN_READ_CONFIGURED" : "LOCAL_PROTOTYPE",
    config: {
      networkId: config.networkId,
      rpcUrl: config.rpcUrl,
      registryContractId: config.registryContractId,
      usdcContractId: config.usdcContractId,
      registryConfigured: config.registryConfigured,
      usdcConfigured: config.usdcConfigured,
    },
  };

  if (input.accountId) {
    try {
      const view = await viewAccount(input.accountId, config, fetchImpl);
      readiness.account = { accountId: input.accountId, exists: Boolean(view), view: view ?? undefined };
    } catch (error) {
      readiness.account = { accountId: input.accountId, exists: false, error: error instanceof Error ? error.message : "Account query failed" };
    }
  }

  if (config.registryContractId) {
    readiness.registry = { contractId: config.registryContractId };
    try {
      readiness.registry.config = await getRegistryConfigOnNear(config, fetchImpl) ?? undefined;
      if (input.handle) readiness.registry.handle = await resolveHandleOnNear(input.handle, config, fetchImpl);
    } catch (error) {
      readiness.registry.error = error instanceof Error ? error.message : "Registry query failed";
    }
  }

  if (config.usdcContractId && input.accountId) {
    readiness.usdc = { contractId: config.usdcContractId, accountId: input.accountId };
    try {
      readiness.usdc.balance = await getFtBalanceOnNear(input.accountId, config, fetchImpl) ?? undefined;
      readiness.usdc.storageBalance = await getStorageBalanceOnNear(input.accountId, config, fetchImpl);
    } catch (error) {
      readiness.usdc.error = error instanceof Error ? error.message : "USDC query failed";
    }
  }

  return readiness;
}

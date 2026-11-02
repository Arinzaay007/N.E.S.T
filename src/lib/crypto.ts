import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  generateKeyPairSync,
  randomBytes,
  timingSafeEqual,
} from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";

const cache = new Map<string, Buffer>();

function devSecret(filename: string, envValue?: string): Buffer {
  const cacheKey = `${filename}:${envValue ? "env" : "file"}`;
  const hit = cache.get(cacheKey);
  if (hit) return hit;
  let key: Buffer;
  if (envValue) {
    key = createHash("sha256").update(envValue).digest();
  } else {
    const dir = process.env.NEST_DATA_DIR ?? (process.env.VERCEL ? path.join("/tmp", "nest-data") : path.join(process.cwd(), ".data"));
    const file = path.join(dir, filename);
    try {
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      if (!existsSync(file)) writeFileSync(file, randomBytes(32).toString("hex"), "utf8");
      key = createHash("sha256").update(readFileSync(file, "utf8").trim()).digest();
    } catch {
      key = createHash("sha256").update(`${filename}:${process.pid}`).digest();
    }
  }
  cache.set(cacheKey, key);
  return key;
}

const encryptionKey = () => devSecret("encryption-key", process.env.NEST_ENCRYPTION_KEY);
const sessionKey = () => devSecret("session-key", process.env.NEST_SESSION_SECRET);

/** AES-256-GCM: iv.tag.ciphertext. The service can decrypt email-wallet keys — see /security. */
export function encryptText(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((b) => b.toString("base64url")).join(".");
}

export function decryptText(payload: string): string {
  const [iv, tag, data] = payload.split(".").map((p) => Buffer.from(p, "base64url"));
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

export function signToken(payload: Record<string, unknown>): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", sessionKey()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyToken<T extends Record<string, unknown>>(
  token: string | undefined,
  purpose: string,
): (T & { purpose: string; exp: number }) | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", sessionKey()).update(body).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (parsed.purpose !== purpose || typeof parsed.exp !== "number" || parsed.exp < Date.now()) return null;
    return parsed as T & { purpose: string; exp: number };
  } catch {
    return null;
  }
}

export function hashOtp(email: string, code: string): string {
  return createHmac("sha256", sessionKey()).update(`${email}:${code}`).digest("base64url");
}

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
export function base58Encode(bytes: Buffer): string {
  let zeros = 0;
  while (zeros < bytes.length && bytes[zeros] === 0) zeros++;
  let value = 0n;
  for (const byte of bytes) value = (value << 8n) + BigInt(byte);
  let out = "";
  while (value > 0n) {
    out = B58[Number(value % 58n)] + out;
    value /= 58n;
  }
  return "1".repeat(zeros) + out;
}

export interface NearKeyPair {
  accountId: string;
  publicKey: string;
  privateKey: string;
}

/** Real ed25519 keypair + its NEAR implicit account id. */
export function createNearKeyPair(): NearKeyPair {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const pubDer = publicKey.export({ type: "spki", format: "der" }) as Buffer;
  const privDer = privateKey.export({ type: "pkcs8", format: "der" }) as Buffer;
  const pubRaw = Buffer.from(pubDer.subarray(pubDer.length - 32));
  const seed = Buffer.from(privDer.subarray(privDer.length - 32));
  return {
    accountId: pubRaw.toString("hex"),
    publicKey: `ed25519:${base58Encode(pubRaw)}`,
    privateKey: `ed25519:${base58Encode(Buffer.concat([seed, pubRaw]))}`,
  };
}

export function randomId(prefix: string): string {
  return `${prefix}_${randomBytes(9).toString("base64url").replace(/[-_]/g, "x")}`;
}

export function receiptId(): string {
  return base58Encode(randomBytes(32));
}

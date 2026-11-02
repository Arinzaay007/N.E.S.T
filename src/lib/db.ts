import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import { createNearKeyPair, encryptText, hashOtp, randomId, receiptId } from "./crypto";
import { AppError } from "./errors";
import { normalizeEmail, normalizeHandle } from "./handle";
import { NETWORK_FEE_CENTS } from "./money";
import type { CrosschainQuote, Db, PaymentLink, PublicUser, Transfer, User } from "./types";

/**
 * Prototype data store.
 * Local/demo persistence lives in .data/ (gitignored) so judges can run the app
 * with zero infrastructure. The production target swaps this module for Postgres
 * plus an on-chain indexer; the API surface in this file is the seam.
 */
const DATA_DIR = process.env.NEST_DATA_DIR ?? (process.env.VERCEL ? path.join("/tmp", "nest-data") : path.join(process.cwd(), ".data"));
const DB_PATH = path.join(DATA_DIR, "nest-db.json");
const AVATAR_COLORS = ["#073B2C", "#8A5A00", "#0E5E46", "#7A3B12", "#14532d", "#6B4E00"];

function colorFor(handle: string): string {
  let n = 0;
  for (const ch of handle) n = (n * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[n % AVATAR_COLORS.length];
}

function makeUser(id: string, email: string, handle: string, displayName: string): User {
  const keys = createNearKeyPair();
  return {
    id,
    email,
    handle,
    displayName,
    accountId: keys.accountId,
    publicKey: keys.publicKey,
    encryptedPrivateKey: encryptText(keys.privateKey),
    balanceCents: 0,
    avatarColor: colorFor(handle),
    createdAt: new Date().toISOString(),
  };
}

function xfer(input: Omit<Transfer, "id" | "receiptId" | "createdAt" | "status"> & { at?: string }): Transfer {
  const { at, ...rest } = input;
  return { id: randomId("tx"), receiptId: receiptId(), createdAt: at ?? new Date().toISOString(), status: "SETTLED", ...rest };
}

function seedDb(): Db {
  const users: User[] = [
    makeUser("user_mystore", "store@demo.nest", "mystore", "My Store"),
    makeUser("user_alice", "alice@demo.nest", "alice", "Alice Bello"),
    makeUser("user_sulaimon", "sulaimon@demo.nest", "sulaimon", "Sulaimon"),
    makeUser("user_arinzaay", "arinzaay@demo.nest", "arinzaay", "Arinzaay"),
    makeUser("user_chidi", "chidi@demo.nest", "chidi", "Chidi"),
  ];
  const byHandle = new Map(users.map((u) => [u.handle, u]));
  const transfers: Transfer[] = [];
  const fund = (handle: string, cents: number) => {
    const u = byHandle.get(handle)!;
    u.balanceCents += cents;
    transfers.push(xfer({ kind: "FAUCET", toUserId: u.id, toHandle: u.handle, amountCents: cents, networkFeeCents: 0, memo: "Demo funds" }));
  };
  fund("mystore", 25000); fund("alice", 15000); fund("sulaimon", 4000); fund("arinzaay", 20000); fund("chidi", 3000);
  const pay = (from: string, to: string, cents: number, memo: string, batchId?: string) => {
    const f = byHandle.get(from)!; const t = byHandle.get(to)!;
    f.balanceCents -= cents; t.balanceCents += cents;
    transfers.push(xfer({ kind: "NEST_PAYMENT", fromUserId: f.id, fromHandle: f.handle, toUserId: t.id, toHandle: t.handle, amountCents: cents, networkFeeCents: batchId ? 0 : NETWORK_FEE_CENTS, memo, batchId }));
  };
  pay("alice", "mystore", 1200, "Order #1042");
  const batchId = randomId("batch");
  pay("arinzaay", "sulaimon", 5000, "Design", batchId);
  pay("arinzaay", "chidi", 8000, "QA testing", batchId);
  byHandle.get("arinzaay")!.balanceCents -= NETWORK_FEE_CENTS;
  const mystore = byHandle.get("mystore")!;
  mystore.balanceCents += 1800;
  transfers.push(xfer({ kind: "CROSS_CHAIN_IN", toUserId: mystore.id, toHandle: mystore.handle, amountCents: 1800, networkFeeCents: 0, memo: "Customer payment", sourceChain: "Base" }));
  return {
    users,
    paymentLinks: [{
      id: "link_seed_invoice",
      ownerId: mystore.id,
      title: "Website design deposit",
      amountCents: 2500,
      reference: "INV-1024",
      status: "UNPAID",
      createdAt: new Date().toISOString(),
    }],
    transfers,
    quotes: [],
    otps: [],
    sponsor: { collectedCents: 2, claimsSponsored: users.length },
  };
}

export function readDb(): Db {
  try {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
    if (!existsSync(DB_PATH)) {
      const seeded = seedDb();
      writeFileSync(DB_PATH, JSON.stringify(seeded, null, 2), "utf8");
      return seeded;
    }
    return JSON.parse(readFileSync(DB_PATH, "utf8")) as Db;
  } catch {
    return seedDb();
  }
}

export function writeDb(db: Db): void {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(DB_PATH, JSON.stringify(db, null, 2), "utf8");
}

export function publicUser(u: User): PublicUser {
  return { id: u.id, handle: u.handle, displayName: u.displayName, accountId: u.accountId, avatarColor: u.avatarColor, createdAt: u.createdAt };
}

export function getUserById(id: string): User | null {
  return readDb().users.find((u) => u.id === id) ?? null;
}
export function getUserByEmail(email: string): User | null {
  const e = normalizeEmail(email);
  return readDb().users.find((u) => u.email === e) ?? null;
}
export function getUserByHandle(handle: string): User | null {
  const h = normalizeHandle(handle);
  return readDb().users.find((u) => u.handle === h) ?? null;
}

export function saveOtp(email: string, code: string): void {
  const db = readDb();
  const e = normalizeEmail(email);
  db.otps = db.otps.filter((o) => o.email !== e && o.expiresAt > Date.now());
  db.otps.push({ email: e, codeHash: hashOtp(e, code), expiresAt: Date.now() + 10 * 60_000, attempts: 0 });
  writeDb(db);
}

export function consumeOtp(email: string, code: string): boolean {
  const db = readDb();
  const e = normalizeEmail(email);
  const rec = db.otps.find((o) => o.email === e);
  if (!rec) return false;
  if (rec.expiresAt < Date.now() || rec.attempts >= 5) {
    db.otps = db.otps.filter((o) => o.email !== e);
    writeDb(db);
    return false;
  }
  if (rec.codeHash !== hashOtp(e, code.trim())) {
    rec.attempts += 1;
    writeDb(db);
    return false;
  }
  db.otps = db.otps.filter((o) => o.email !== e);
  writeDb(db);
  return true;
}

export function createUser(email: string, handle: string, displayName: string): User {
  const db = readDb();
  const e = normalizeEmail(email);
  const h = normalizeHandle(handle);
  if (db.users.some((u) => u.email === e)) throw new AppError("This email already has a NEST wallet.", 409);
  if (db.users.some((u) => u.handle === h)) throw new AppError("That handle is already taken.", 409);
  const user = makeUser(randomId("user"), e, h, displayName.trim().slice(0, 60) || h);
  db.users.push(user);
  db.sponsor.claimsSponsored += 1;
  writeDb(db);
  return user;
}

export interface PaymentItemInput { handle: string; amountCents: number; memo?: string }

export function createPayments(
  senderId: string,
  items: PaymentItemInput[],
  opts?: { paymentLinkId?: string; forceBatch?: boolean },
): Transfer[] {
  if (!items.length || items.length > 50) throw new AppError("Add between 1 and 50 payments.");
  const db = readDb();
  const sender = db.users.find((u) => u.id === senderId);
  if (!sender) throw new AppError("Session expired. Please sign in again.", 401);
  let link: PaymentLink | undefined;
  if (opts?.paymentLinkId) {
    link = db.paymentLinks.find((l) => l.id === opts.paymentLinkId);
    if (!link) throw new AppError("Payment link not found.", 404);
    if (link.status === "PAID") throw new AppError("This invoice has already been paid.", 409);
    if (items.length !== 1) throw new AppError("An invoice payment must have one recipient.");
  }
  const resolved = items.map((item) => {
    const h = normalizeHandle(item.handle);
    const recipient = db.users.find((u) => u.handle === h);
    if (!recipient) throw new AppError(`User not found: @${h}`);
    if (recipient.id === sender.id) throw new AppError("You cannot pay yourself.");
    if (!Number.isSafeInteger(item.amountCents) || item.amountCents <= 0 || item.amountCents > 100_000_000) {
      throw new AppError(`Invalid amount for @${h}.`);
    }
    return { recipient, amountCents: item.amountCents, memo: item.memo?.trim().slice(0, 140) || undefined };
  });
  if (link) {
    const only = resolved[0];
    if (only.recipient.id !== link.ownerId) throw new AppError("This invoice belongs to a different recipient.");
    if (only.amountCents !== link.amountCents) throw new AppError("Invoice amount must be paid in full.");
  }
  const total = resolved.reduce((s, r) => s + r.amountCents, 0);
  const fee = NETWORK_FEE_CENTS;
  if (sender.balanceCents < total + fee) throw new AppError("Insufficient USDC balance for this payment plus the network amount.");
  const batchId = resolved.length > 1 || opts?.forceBatch ? randomId("batch") : undefined;
  sender.balanceCents -= total + fee;
  db.sponsor.collectedCents += fee;
  const created = resolved.map((r, idx) => {
    r.recipient.balanceCents += r.amountCents;
    const t = xfer({
      kind: "NEST_PAYMENT",
      fromUserId: sender.id,
      fromHandle: sender.handle,
      toUserId: r.recipient.id,
      toHandle: r.recipient.handle,
      amountCents: r.amountCents,
      networkFeeCents: idx === 0 ? fee : 0,
      memo: r.memo ?? (link ? `${link.title} · ${link.reference}` : undefined),
      batchId,
      paymentLinkId: link?.id,
    });
    db.transfers.push(t);
    return t;
  });
  if (link) { link.status = "PAID"; link.paidAt = new Date().toISOString(); }
  writeDb(db);
  return created;
}

export function createPaymentLink(ownerId: string, title: string, amountCents: number, reference?: string): PaymentLink {
  const db = readDb();
  const owner = db.users.find((u) => u.id === ownerId);
  if (!owner) throw new AppError("Session expired. Please sign in again.", 401);
  const link: PaymentLink = {
    id: randomId("link"),
    ownerId,
    title: title.trim().slice(0, 80) || "Payment request",
    amountCents,
    reference: (reference?.trim() || `INV-${1000 + Math.floor(Math.random() * 9000)}`).slice(0, 40),
    status: "UNPAID",
    createdAt: new Date().toISOString(),
  };
  db.paymentLinks.push(link);
  writeDb(db);
  return link;
}

export function getPaymentLink(id: string): { link: PaymentLink; owner: User } | null {
  const db = readDb();
  const link = db.paymentLinks.find((l) => l.id === id);
  if (!link) return null;
  const owner = db.users.find((u) => u.id === link.ownerId);
  return owner ? { link, owner } : null;
}

export function addDemoFunds(userId: string): Transfer {
  const db = readDb();
  const user = db.users.find((u) => u.id === userId);
  if (!user) throw new AppError("Session expired. Please sign in again.", 401);
  user.balanceCents += 10_000;
  const t = xfer({ kind: "FAUCET", toUserId: user.id, toHandle: user.handle, amountCents: 10_000, networkFeeCents: 0, memo: "Demo funds" });
  db.transfers.push(t);
  writeDb(db);
  return t;
}

export function saveQuote(quote: CrosschainQuote): void {
  const db = readDb();
  db.quotes.push(quote);
  writeDb(db);
}
export function getQuote(id: string): CrosschainQuote | null {
  return readDb().quotes.find((q) => q.id === id) ?? null;
}

export function settleQuote(quoteId: string): Transfer {
  const db = readDb();
  const quote = db.quotes.find((q) => q.id === quoteId);
  if (!quote) throw new AppError("Quote not found.", 404);
  if (quote.status === "SUCCESS" && quote.transferId) {
    const existing = db.transfers.find((t) => t.id === quote.transferId);
    if (existing) return existing;
  }
  const recipient = db.users.find((u) => u.id === quote.toUserId);
  if (!recipient) throw new AppError("Recipient not found.", 404);
  recipient.balanceCents += quote.amountCents;
  const t = xfer({
    kind: "CROSS_CHAIN_IN",
    toUserId: recipient.id,
    toHandle: recipient.handle,
    amountCents: quote.amountCents,
    networkFeeCents: 0,
    memo: quote.memo,
    paymentLinkId: quote.paymentLinkId,
    sourceChain: quote.sourceChain,
  });
  db.transfers.push(t);
  quote.status = "SUCCESS";
  quote.transferId = t.id;
  if (quote.paymentLinkId) {
    const link = db.paymentLinks.find((l) => l.id === quote.paymentLinkId);
    if (link) { link.status = "PAID"; link.paidAt = new Date().toISOString(); }
  }
  writeDb(db);
  return t;
}

export function getDashboard(userId: string) {
  const db = readDb();
  const user = db.users.find((u) => u.id === userId);
  if (!user) return null;
  const transfers = db.transfers
    .filter((t) => t.fromUserId === userId || t.toUserId === userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 100);
  const links = db.paymentLinks.filter((l) => l.ownerId === userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return { user: { ...publicUser(user), email: user.email, balanceCents: user.balanceCents, publicKey: user.publicKey }, transfers, links, sponsor: db.sponsor };
}

export function getStats() {
  const db = readDb();
  const payments = db.transfers.filter((t) => t.kind !== "FAUCET");
  return {
    handles: db.users.length,
    payments: payments.length,
    volumeCents: payments.reduce((s, t) => s + t.amountCents, 0),
    sponsorCollectedCents: db.sponsor.collectedCents,
    claimsSponsored: db.sponsor.claimsSponsored,
    recent: [...payments].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 12),
  };
}

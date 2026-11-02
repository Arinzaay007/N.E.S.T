export interface User {
  id: string;
  email: string;
  handle: string;
  displayName: string;
  accountId: string;
  publicKey: string;
  encryptedPrivateKey: string;
  balanceCents: number;
  avatarColor: string;
  createdAt: string;
}

export interface PublicUser {
  id: string;
  handle: string;
  displayName: string;
  accountId: string;
  avatarColor: string;
  createdAt: string;
}

export interface PaymentLink {
  id: string;
  ownerId: string;
  title: string;
  amountCents: number;
  reference: string;
  status: "UNPAID" | "PAID";
  createdAt: string;
  paidAt?: string;
}

export interface Transfer {
  id: string;
  kind: "NEST_PAYMENT" | "CROSS_CHAIN_IN" | "FAUCET";
  fromUserId?: string;
  fromHandle?: string;
  toUserId: string;
  toHandle: string;
  amountCents: number;
  networkFeeCents: number;
  memo?: string;
  batchId?: string;
  paymentLinkId?: string;
  sourceChain?: string;
  status: "SETTLED" | "PROCESSING";
  receiptId: string;
  createdAt: string;
}

export interface CrosschainQuote {
  id: string;
  mode: "SIMULATED" | "ONECLICK";
  toUserId: string;
  toHandle: string;
  paymentLinkId?: string;
  memo?: string;
  amountCents: number;
  amountInCents: number;
  sourceChain: string;
  sourceToken: string;
  depositAddress: string;
  depositMemo?: string;
  refundTo?: string;
  expiresAt: string;
  status: "PENDING_DEPOSIT" | "PROCESSING" | "SUCCESS" | "EXPIRED";
  transferId?: string;
  createdAt: string;
}

export interface OtpRecord {
  email: string;
  codeHash: string;
  expiresAt: number;
  attempts: number;
}

export interface Db {
  users: User[];
  paymentLinks: PaymentLink[];
  transfers: Transfer[];
  quotes: CrosschainQuote[];
  otps: OtpRecord[];
  sponsor: { collectedCents: number; claimsSponsored: number };
}

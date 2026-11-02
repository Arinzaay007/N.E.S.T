const RESERVED = new Set([
  "admin", "api", "claim", "docs", "help", "login", "nest", "near", "official",
  "pay", "security", "send", "sponsor", "stats", "support", "wallet",
]);

export function normalizeHandle(raw: string): string {
  return raw.trim().toLowerCase().replace(/^@+/, "");
}

export function validateHandle(raw: string): { handle?: string; error?: string } {
  const handle = normalizeHandle(raw);
  if (handle.length < 3 || handle.length > 20) return { error: "Handles are 3–20 characters." };
  if (!/^[a-z0-9_]+$/.test(handle)) return { error: "Use only lowercase letters, numbers and underscores." };
  if (/^[0-9_]|_$/.test(handle)) return { error: "Handle must start with a letter and not end with an underscore." };
  if (RESERVED.has(handle)) return { error: "That handle is reserved." };
  return { handle };
}

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isEmail(raw: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normalizeEmail(raw));
}

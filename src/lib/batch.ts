import { parseAmountToCents } from "./money";
import { validateHandle } from "./handle";

export interface BatchItem {
  handle: string;
  amountCents: number;
  memo?: string;
  line: number;
  raw: string;
}

export interface ParsedBatch {
  items: BatchItem[];
  errors: { line: number; raw: string; error: string }[];
  totalCents: number;
}

/** Parses lines like: `@sulaimon 50 Design` / `alice $12.50 Lunch`. */
export function parseBatchText(text: string): ParsedBatch {
  const items: BatchItem[] = [];
  const errors: ParsedBatch["errors"] = [];
  const lines = text.split(/\r?\n/);
  lines.forEach((rawLine, index) => {
    const raw = rawLine.trim();
    if (!raw || raw.startsWith("#")) return;
    const match = raw.match(/^@?([A-Za-z0-9_]+)\s+\$?([0-9][0-9,]*(?:\.[0-9]{1,2})?)\s*(.*)$/);
    if (!match) {
      errors.push({ line: index + 1, raw, error: "Use: @handle amount memo" });
      return;
    }
    const valid = validateHandle(match[1]);
    if (!valid.handle) {
      errors.push({ line: index + 1, raw, error: valid.error ?? "Invalid handle" });
      return;
    }
    const amountCents = parseAmountToCents(match[2]);
    if (!amountCents) {
      errors.push({ line: index + 1, raw, error: "Invalid amount" });
      return;
    }
    items.push({
      handle: valid.handle,
      amountCents,
      memo: match[3]?.trim() ? match[3].trim().slice(0, 140) : undefined,
      line: index + 1,
      raw,
    });
  });
  return { items, errors, totalCents: items.reduce((sum, i) => sum + i.amountCents, 0) };
}

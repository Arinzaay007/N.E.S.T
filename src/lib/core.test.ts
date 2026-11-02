import { describe, expect, test } from "vitest";
import { parseBatchText } from "./batch";
import { normalizeHandle, validateHandle } from "./handle";
import { formatUSD, parseAmountToCents } from "./money";
import { simulatedAmountInCents } from "./quotes";

describe("money", () => {
  test("formats USD cents", () => {
    expect(formatUSD(1205)).toBe("$12.05");
    expect(formatUSD(0)).toBe("$0.00");
  });
  test("parses safe dollar amounts", () => {
    expect(parseAmountToCents("$12.5")).toBe(1250);
    expect(parseAmountToCents("1,000")).toBe(100000);
    expect(parseAmountToCents("-5")).toBeNull();
    expect(parseAmountToCents("1.234")).toBeNull();
  });
});

describe("handles", () => {
  test("normalizes and validates", () => {
    expect(normalizeHandle(" @Alice_1 ")).toBe("alice_1");
    expect(validateHandle("@alice_1").handle).toBe("alice_1");
    expect(validateHandle("ab").error).toBeTruthy();
    expect(validateHandle("bad-name").error).toBeTruthy();
    expect(validateHandle("wallet").error).toBeTruthy();
  });
});

describe("batch payroll parser", () => {
  test("parses @handle amount memo rows", () => {
    const result = parseBatchText("@sulaimon 50 Design\nalice $12.50 Lunch\n# comment");
    expect(result.errors).toEqual([]);
    expect(result.items).toHaveLength(2);
    expect(result.totalCents).toBe(6250);
    expect(result.items[0].memo).toBe("Design");
  });
  test("reports malformed rows without dropping good rows", () => {
    const result = parseBatchText("bad row\n@chidi 25 QA");
    expect(result.items).toHaveLength(1);
    expect(result.errors).toHaveLength(1);
  });
});

describe("cross-chain quote simulation", () => {
  test("exact-output input is always above recipient amount", () => {
    expect(simulatedAmountInCents(1000, 80)).toBeGreaterThan(1000);
  });
});

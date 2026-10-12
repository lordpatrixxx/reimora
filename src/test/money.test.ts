import { describe, expect, it } from "vitest";
import { netSettlement, outstanding, parseRupeesToPaise, formatINR } from "@/lib/money";

describe("settlement", () => {
  it("approved ₹2,650 with ₹2,000 advance → ₹650 payable to the student", () => {
    expect(netSettlement(265000, 200000)).toEqual({ kind: "payable", amount: 65000 });
  });
  it("approved ₹1,700 with ₹2,000 advance → ₹300 returnable by the student", () => {
    expect(netSettlement(170000, 200000)).toEqual({ kind: "returnable", amount: 30000 });
  });
  it("partial payment leaves the remainder outstanding", () => {
    expect(outstanding(265000, 200000, 40000, 0).remaining).toBe(25000);
  });
  it("partial advance return leaves the remainder outstanding", () => {
    expect(outstanding(170000, 200000, 0, 10000).remaining).toBe(20000);
  });
});

describe("money parsing", () => {
  it("parses rupees into integer paise without float error", () => {
    expect(parseRupeesToPaise("1,234.5")).toBe(123450);
    expect(parseRupeesToPaise("0.1")).toBe(10);
    expect(parseRupeesToPaise("abc")).toBeNull();
  });
  it("formats Indian grouping", () => {
    expect(formatINR(12345600)).toBe("₹1,23,456");
  });
});

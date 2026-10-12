/** All money is stored as integer paise. */
export function formatINR(paise: number | null | undefined): string {
  const p = paise ?? 0;
  const neg = p < 0;
  const abs = Math.abs(p);
  const rupees = Math.floor(abs / 100);
  const ps = abs % 100;
  const r = rupees.toLocaleString("en-IN");
  return `${neg ? "−" : ""}₹${r}${ps ? "." + String(ps).padStart(2, "0") : ""}`;
}

/** Parse a rupee string like "1,234.50" into integer paise. Returns null when invalid. */
export function parseRupeesToPaise(input: string): number | null {
  const s = input.replace(/[₹,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const [r, d = ""] = s.split(".");
  return Number(r) * 100 + Number(d.padEnd(2, "0"));
}

export function paiseToInput(paise: number | null | undefined): string {
  if (paise == null) return "";
  return (paise / 100).toFixed(2).replace(/\.00$/, "");
}

export type SettlementOutcome =
  | { kind: "payable"; amount: number }
  | { kind: "returnable"; amount: number }
  | { kind: "even"; amount: 0 };

/** Approved expenses − advance applied = net settlement. */
export function netSettlement(approvedPaise: number, advancePaise: number): SettlementOutcome {
  const net = approvedPaise - advancePaise;
  if (net > 0) return { kind: "payable", amount: net };
  if (net < 0) return { kind: "returnable", amount: -net };
  return { kind: "even", amount: 0 };
}

/** Remaining after partial payments for a settlement outcome. */
export function outstanding(approvedPaise: number, advancePaise: number, paidToStudent: number, paidByStudent: number) {
  const o = netSettlement(approvedPaise, advancePaise);
  if (o.kind === "payable") return { ...o, remaining: Math.max(0, o.amount - paidToStudent) };
  if (o.kind === "returnable") return { ...o, remaining: Math.max(0, o.amount - paidByStudent) };
  return { ...o, remaining: 0 };
}

export function maskAccount(last4: string | null | undefined) {
  return `•••• •••• ${last4 ?? "----"}`;
}

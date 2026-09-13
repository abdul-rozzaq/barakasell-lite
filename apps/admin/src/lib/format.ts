// "128 000 so'm" — thousands grouped with a space, no decimals. See design
// handoff README "Currency formatting".
export function formatSom(value: number | string): string {
  const n = typeof value === "string" ? Number(value) : value;
  const rounded = Math.round(n);
  const grouped = Math.abs(rounded)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${rounded < 0 ? "-" : ""}${grouped} so'm`;
}

export function formatQty(value: number | string): string {
  const n = typeof value === "string" ? Number(value) : value;
  return n.toLocaleString("uz-UZ", { maximumFractionDigits: 3 });
}

export function formatMoneyInput(value: string | number): string {
  if (value === "" || value === null || value === undefined) return "";
  let str = String(value).trim();
  if (str.includes(".") && !str.includes(" ")) {
    const num = Number(str);
    if (!isNaN(num)) {
      str = String(Math.round(num));
    }
  }
  const digits = str.replace(/\D/g, "");
  if (!digits) return "";
  const cleanDigits = digits.replace(/^0+(?=\d)/, "");
  return cleanDigits.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

export function parseMoney(value: string | number): number {
  if (typeof value === "number") return value;
  if (!value) return 0;
  const cleaned = String(value).replace(/\s/g, "");
  return Number(cleaned) || 0;
}


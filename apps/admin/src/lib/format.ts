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

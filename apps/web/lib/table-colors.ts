export const TABLE_COLOR_NAMES = [
  "violet",
  "blue",
  "emerald",
  "amber",
  "rose",
  "slate"
] as const;

export type TableColorName = (typeof TABLE_COLOR_NAMES)[number];

const KNOWN: Record<string, TableColorName> = {
  customers: "amber",
  products: "emerald",
  orders: "violet",
  order_items: "blue",
  payments: "rose"
};

export function tableColorForName(
  name: string,
  fallbackIndex: number
): TableColorName {
  const cycled =
    TABLE_COLOR_NAMES[
      ((fallbackIndex % TABLE_COLOR_NAMES.length) + TABLE_COLOR_NAMES.length) %
        TABLE_COLOR_NAMES.length
    ] ?? "slate";
  return KNOWN[name] ?? cycled;
}

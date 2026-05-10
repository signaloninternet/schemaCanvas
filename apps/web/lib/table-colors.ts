export const TABLE_COLOR_NAMES = [
  "green",
  "blue",
  "yellow"
] as const;

export type TableColorName = (typeof TABLE_COLOR_NAMES)[number];

const KNOWN: Record<string, TableColorName> = {
  customers: "yellow",
  products: "green",
  orders: "blue",
  order_items: "blue",
  payments: "green"
};

export function tableColorForName(
  name: string,
  fallbackIndex: number
): TableColorName {
  const cycled =
    TABLE_COLOR_NAMES[
      ((fallbackIndex % TABLE_COLOR_NAMES.length) + TABLE_COLOR_NAMES.length) %
        TABLE_COLOR_NAMES.length
    ] ?? "green";
  return KNOWN[name] ?? cycled;
}

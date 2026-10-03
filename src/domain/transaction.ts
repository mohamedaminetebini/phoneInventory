import type { Currency, Transaction } from "./transactions";
import { IPHONE_CATALOG } from "../../lib/catalog/iphones";

export type MoneyByCurrency = Record<Currency, number>;

export type TransactionSummary = {
  transactions: number;
  buys: number;
  sells: number;
  unitsInStock: number;
  purchases: MoneyByCurrency;
  sales: MoneyByCurrency;
};

const currencies: Currency[] = ["TND", "EUR", "USD"];

function zeroTotals(): MoneyByCurrency {
  return { TND: 0, EUR: 0, USD: 0 };
}

/**
 * Returns purchased devices that have not been sold. Legacy sales created before
 * purchase links existed are matched by IMEI/serial where possible, then reduced
 * oldest-first so the available-device count includes historical sales.
 */
export function getAvailablePhones(records: readonly Transaction[]): Transaction[] {
  const modelByName = new Map(IPHONE_CATALOG.map((item) => [item.name, item]));
  const catalogRecords = records.filter((record) =>
    modelByName.get(record.phoneModel)?.colors.some((color) => color.name === record.phoneColor),
  );
  const purchases = catalogRecords.filter((record) => record.direction === "buy");
  const soldPurchaseIds = new Set(
    catalogRecords
      .filter((record) => record.direction === "sell" && record.soldFromTransactionId)
      .map((record) => record.soldFromTransactionId as string),
  );
  const byModelAndColor = new Map<string, Transaction[]>();

  for (const purchase of purchases) {
    if (soldPurchaseIds.has(purchase.id)) continue;
    const key = `${purchase.phoneModel}\u0000${purchase.phoneColor}`;
    const group = byModelAndColor.get(key) ?? [];
    group.push(purchase);
    byModelAndColor.set(key, group);
  }

  const oldestFirst = (a: Transaction, b: Transaction) => a.date.localeCompare(b.date)
    || a.createdAt.localeCompare(b.createdAt)
    || a.id.localeCompare(b.id);
  for (const group of byModelAndColor.values()) group.sort(oldestFirst);

  const legacySales = catalogRecords
    .filter((record) => record.direction === "sell" && !record.soldFromTransactionId)
    .sort(oldestFirst);

  for (const sale of legacySales) {
    const group = byModelAndColor.get(`${sale.phoneModel}\u0000${sale.phoneColor}`);
    if (!group?.length) continue;

    const matchingIndex = group.findIndex((purchase) =>
      (sale.imei && purchase.imei === sale.imei)
      || (sale.serialNumber && purchase.serialNumber === sale.serialNumber));
    group.splice(matchingIndex >= 0 ? matchingIndex : 0, 1);
  }

  return [...byModelAndColor.values()]
    .flat()
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
}

export function summarizeTransactions(records: readonly Transaction[]): TransactionSummary {
  const purchases = zeroTotals();
  const sales = zeroTotals();
  let buys = 0;
  let sells = 0;

  for (const record of records) {
    if (record.direction === "buy") {
      buys += 1;
      purchases[record.currency] += record.amount;
    } else {
      sells += 1;
      sales[record.currency] += record.amount;
    }
  }

  const unitsInStock = getAvailablePhones(records).length;
  return {
    transactions: records.length,
    buys,
    sells,
    unitsInStock,
    purchases: Object.fromEntries(currencies.map((currency) => [currency, purchases[currency]])) as MoneyByCurrency,
    sales: Object.fromEntries(currencies.map((currency) => [currency, sales[currency]])) as MoneyByCurrency,
  };
}

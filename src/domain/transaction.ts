import type { Currency, Transaction } from "./transactions";
import { IPHONE_CATALOG } from "../../lib/catalog/iphones";

export type MoneyByCurrency = Record<Currency, number>;

export type InventoryRow = {
  modelId: string;
  phoneModel: string;
  phoneColor: string;
  hex: string;
  units: number;
  purchases: MoneyByCurrency;
  sales: MoneyByCurrency;
  latestDate: string;
};

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

export function getInventory(records: readonly Transaction[]): InventoryRow[] {
  const rows = new Map<string, InventoryRow>();
  const modelByName = new Map(IPHONE_CATALOG.map((item) => [item.name, item]));

  for (const record of records) {
    const model = modelByName.get(record.phoneModel);
    const color = model?.colors.find((item) => item.name === record.phoneColor);
    if (!model || !color) continue;

    const key = `${model.id}\u0000${record.phoneColor}`;
    const row = rows.get(key) ?? {
      modelId: model.id,
      phoneModel: model.name,
      phoneColor: record.phoneColor,
      hex: color.hex ?? "#777777",
      units: 0,
      purchases: zeroTotals(),
      sales: zeroTotals(),
      latestDate: record.date,
    };

    if (record.direction === "buy") {
      row.units += 1;
      row.purchases[record.currency] += record.amount;
    } else {
      row.units -= 1;
      row.sales[record.currency] += record.amount;
    }
    if (record.date > row.latestDate) row.latestDate = record.date;
    rows.set(key, row);
  }

  return [...rows.values()]
    .filter((row) => row.units !== 0)
    .sort((a, b) => {
      const orderA = modelByName.get(a.phoneModel)?.order ?? 0;
      const orderB = modelByName.get(b.phoneModel)?.order ?? 0;
      return orderB - orderA || a.phoneColor.localeCompare(b.phoneColor);
    });
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

  const unitsInStock = getInventory(records).reduce((total, row) => total + row.units, 0);
  return {
    transactions: records.length,
    buys,
    sells,
    unitsInStock,
    purchases: Object.fromEntries(currencies.map((currency) => [currency, purchases[currency]])) as MoneyByCurrency,
    sales: Object.fromEntries(currencies.map((currency) => [currency, sales[currency]])) as MoneyByCurrency,
  };
}

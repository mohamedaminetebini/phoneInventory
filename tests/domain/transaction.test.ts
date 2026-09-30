import { describe, expect, it } from "vitest";
import { getInventory, summarizeTransactions } from "../../src/domain/transaction";
import type { Transaction } from "../../src/domain/transactions";

function transaction(
  id: string,
  direction: Transaction["direction"],
  phoneModel: string,
  phoneColor: string,
  amount: number,
  currency: Transaction["currency"],
): Transaction {
  const front = { name: "front.png", mimeType: "image/png" as const, url: "/api/files/front.png", path: "front.png" };
  const back = { name: "back.png", mimeType: "image/png" as const, url: "/api/files/back.png", path: "back.png" };
  return {
    id,
    direction,
    phoneModel,
    phoneColor,
    imei: null,
    serialNumber: null,
    amount,
    currency,
    date: "2026-09-20",
    phonePhotos: [],
    idFront: front,
    idBack: back,
    notes: "",
    createdAt: "2026-09-20T12:00:00.000Z",
  };
}

describe("transaction summaries", () => {
  const records = [
    transaction("buy-pro", "buy", "iPhone 15 Pro Max", "Natural Titanium", 5200, "TND"),
    transaction("sell-pro", "sell", "iPhone 15 Pro Max", "Natural Titanium", 5900, "TND"),
    transaction("buy-12", "buy", "iPhone 12", "Blue", 400, "EUR"),
  ];

  it("counts one phone per buy or sell and groups stock by its catalog color", () => {
    expect(getInventory(records)).toEqual([
      {
        modelId: "iphone-12",
        phoneModel: "iPhone 12",
        phoneColor: "Blue",
        hex: "#4B79C6",
        units: 1,
        purchases: { TND: 0, EUR: 400, USD: 0 },
        sales: { TND: 0, EUR: 0, USD: 0 },
        latestDate: "2026-09-20",
      },
    ]);

    expect(summarizeTransactions(records)).toEqual({
      transactions: 3,
      buys: 2,
      sells: 1,
      unitsInStock: 1,
      purchases: { TND: 5200, EUR: 400, USD: 0 },
      sales: { TND: 5900, EUR: 0, USD: 0 },
    });
  });

  it("recalculates inventory and totals when a transaction is removed", () => {
    const remaining = records.filter((record) => record.id !== "buy-12");
    expect(getInventory(remaining)).toEqual([]);
    expect(summarizeTransactions(remaining)).toEqual({
      transactions: 2,
      buys: 1,
      sells: 1,
      unitsInStock: 0,
      purchases: { TND: 5200, EUR: 0, USD: 0 },
      sales: { TND: 5900, EUR: 0, USD: 0 },
    });
  });
});

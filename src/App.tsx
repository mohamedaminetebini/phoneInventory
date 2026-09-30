"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronRight,
  CircleAlert,
  FileImage,
  LogOut,
  Plus,
  Smartphone,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { IPHONE_CATALOG } from "../lib/catalog/iphones";
import type { Transaction } from "./domain/transactions";
import { createSupabaseBrowserClient } from "./lib/supabase/client";
import { ApiError, createTransaction, fetchTransactions, removeTransaction } from "./api";
import { TransactionForm } from "./components/TransactionForm";
import { Drawer, DrawerContent, DrawerTitle } from "./components/ui/drawer";
import { getInventory, summarizeTransactions } from "./domain/transaction";

type Page = "overview" | "stock" | "transactions";
type DirectionFilter = "all" | "buy" | "sell";

const pageTitles: Record<Page, string> = {
  overview: "Overview",
  stock: "Stock",
  transactions: "Transactions",
};

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("fr-TN", {
      style: "currency",
      currency,
      maximumFractionDigits: currency === "TND" ? 3 : 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

function formatDate(value: string): string {
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(date);
}

function catalogEntry(name: string) {
  return IPHONE_CATALOG.find((item) => item.name === name);
}

function ProductMark({ modelName, colorName }: { modelName: string; colorName: string }) {
  const model = catalogEntry(modelName);
  const hex = model?.colors.find((color) => color.name === colorName)?.hex ?? "#777777";
  return <span className="device-mark" style={{ "--device-color": hex } as React.CSSProperties} aria-hidden="true" />;
}

function ProductName({ transaction }: { transaction: Pick<Transaction, "phoneModel" | "phoneColor"> }) {
  return (
    <span className="product-name">
      <ProductMark modelName={transaction.phoneModel} colorName={transaction.phoneColor} />
      <span className="product-copy">
        <strong>{transaction.phoneModel}</strong>
        <span>{transaction.phoneColor}</span>
      </span>
    </span>
  );
}

function CurrencyTotals({ values }: { values: Record<string, number> }) {
  const present = Object.entries(values).filter(([, amount]) => amount !== 0);
  if (!present.length) return <span className="empty-total">—</span>;
  return (
    <span className="currency-totals">
      {present.map(([currency, amount]) => <span key={currency}>{formatMoney(amount, currency)}</span>)}
    </span>
  );
}

function TransactionTable({
  transactions,
  onView,
}: {
  transactions: Transaction[];
  onView: (transaction: Transaction) => void;
}) {
  if (!transactions.length) return <EmptyState title="No transactions yet" action="Record a buy or sale to start your ledger." />;

  return (
    <div className="table-scroll">
      <table className="ledger-table">
        <thead>
          <tr>
            <th scope="col">Phone</th>
            <th scope="col">Type</th>
            <th scope="col" className="number-column">Price</th>
            <th scope="col">Date</th>
            <th scope="col" className="attachment-column">Files</th>
            <th scope="col"><span className="visually-hidden">Open transaction</span></th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((transaction) => (
            <tr key={transaction.id}>
              <td><ProductName transaction={transaction} /></td>
              <td>
                <span className={`transaction-direction ${transaction.direction}`}>
                  {transaction.direction === "buy" ? <ArrowDownLeft size={15} aria-hidden="true" /> : <ArrowUpRight size={15} aria-hidden="true" />}
                  {transaction.direction === "buy" ? "Buy" : "Sell"}
                </span>
              </td>
              <td className="number-column amount-cell">{formatMoney(transaction.amount, transaction.currency)}</td>
              <td className="date-cell">{formatDate(transaction.date)}</td>
              <td className="attachment-column">
                <span className="file-count"><FileImage size={15} aria-hidden="true" />{transaction.phonePhotos.length + 2}</span>
              </td>
              <td className="row-action-cell">
                <button className="row-action" type="button" aria-label={`View ${transaction.phoneModel} transaction`} onClick={() => onView(transaction)}>
                  <ChevronRight size={17} aria-hidden="true" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EmptyState({ title, action }: { title: string; action: string }) {
  return (
    <div className="empty-state">
      <span className="empty-state-mark"><Smartphone size={20} aria-hidden="true" /></span>
      <h3>{title}</h3>
      <p>{action}</p>
    </div>
  );
}

function Overview({ transactions, onView }: { transactions: Transaction[]; onView: (transaction: Transaction) => void }) {
  const summary = summarizeTransactions(transactions);
  const recent = transactions.slice(0, 6);

  return (
    <>
      <section className="overview-summary" aria-label="Inventory summary">
        <div className="on-hand-stat">
          <span className="stat-label">Phones on hand</span>
          <strong>{summary.unitsInStock}</strong>
          <span className="stat-note">units</span>
        </div>
        <div className="summary-total">
          <span className="stat-label">Purchases</span>
          <CurrencyTotals values={summary.purchases} />
        </div>
        <div className="summary-total">
          <span className="stat-label">Sales</span>
          <CurrencyTotals values={summary.sales} />
        </div>
        <div className="summary-total summary-count">
          <span className="stat-label">Transactions</span>
          <strong>{summary.transactions}</strong>
          <span className="stat-note">{summary.buys} buys · {summary.sells} sells</span>
        </div>
      </section>

      <section className="content-section">
        <div className="section-heading">
          <div>
            <h2>Recent transactions</h2>
            <p>Latest activity in your ledger</p>
          </div>
        </div>
        <div className="content-surface">
          <TransactionTable transactions={recent} onView={onView} />
        </div>
      </section>
    </>
  );
}

function Stock({ transactions }: { transactions: Transaction[] }) {
  const inventory = getInventory(transactions);
  if (!inventory.length) return <EmptyState title="No phones in stock" action="Buy a phone or record its current stock to see it here." />;

  return (
    <section className="content-section">
      <div className="section-heading stock-heading">
        <div>
          <h2>Current stock</h2>
          <p>{inventory.reduce((count, row) => count + row.units, 0)} phones across {inventory.length} model and color combinations</p>
        </div>
      </div>
      <div className="content-surface">
        <div className="table-scroll">
          <table className="ledger-table stock-table">
            <thead>
              <tr><th scope="col">Phone</th><th scope="col" className="number-column">In stock</th><th scope="col" className="number-column">Bought for</th><th scope="col" className="number-column">Sold for</th><th scope="col">Last activity</th></tr>
            </thead>
            <tbody>
              {inventory.map((row) => (
                <tr key={`${row.modelId}-${row.phoneColor}`}>
                  <td><ProductName transaction={row} /></td>
                  <td className={`number-column stock-units ${row.units < 0 ? "negative-stock" : ""}`}>{row.units}</td>
                  <td className="number-column"><CurrencyTotals values={row.purchases} /></td>
                  <td className="number-column"><CurrencyTotals values={row.sales} /></td>
                  <td className="date-cell">{formatDate(row.latestDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function Transactions({
  transactions,
  onView,
}: {
  transactions: Transaction[];
  onView: (transaction: Transaction) => void;
}) {
  const [query, setQuery] = useState("");
  const [direction, setDirection] = useState<DirectionFilter>("all");
  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return transactions.filter((transaction) => {
      const matchesDirection = direction === "all" || transaction.direction === direction;
      const content = `${transaction.phoneModel} ${transaction.phoneColor} ${transaction.notes}`.toLocaleLowerCase();
      return matchesDirection && (!normalized || content.includes(normalized));
    });
  }, [direction, query, transactions]);

  return (
    <section className="content-section">
      <div className="section-heading transactions-heading">
        <div>
          <h2>All transactions</h2>
          <p>{filtered.length} of {transactions.length}</p>
        </div>
        <div className="transaction-filters">
          <label className="visually-hidden" htmlFor="transaction-search">Search transactions</label>
          <input id="transaction-search" type="search" placeholder="Search model or color" value={query} onChange={(event) => setQuery(event.target.value)} />
          <label className="visually-hidden" htmlFor="direction-filter">Filter by transaction type</label>
          <select id="direction-filter" value={direction} onChange={(event) => setDirection(event.target.value as DirectionFilter)}>
            <option value="all">All types</option>
            <option value="buy">Buys</option>
            <option value="sell">Sells</option>
          </select>
        </div>
      </div>
      <div className="content-surface">
        <TransactionTable transactions={filtered} onView={onView} />
      </div>
    </section>
  );
}

function TransactionDetails({
  transaction,
  onClose,
  onDelete,
}: {
  transaction: Transaction;
  onClose: () => void;
  onDelete: () => void;
}) {
  const title = transaction.direction === "buy" ? "Seller ID" : "Buyer ID";
  const allImages = [
    ...transaction.phonePhotos.map((image, index) => ({ ...image, label: `Phone photo ${index + 1}` })),
    { ...transaction.idFront, label: `${title} front` },
    { ...transaction.idBack, label: `${title} back` },
  ];

  return (
    <div className="dialog-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="detail-dialog" role="dialog" aria-modal="true" aria-label="Transaction details">
        <header className="detail-header">
          <div>
            <span className={`transaction-direction ${transaction.direction}`}>
              {transaction.direction === "buy" ? <ArrowDownLeft size={15} aria-hidden="true" /> : <ArrowUpRight size={15} aria-hidden="true" />}
              {transaction.direction === "buy" ? "Buy" : "Sell"}
            </span>
            <h2>Transaction details</h2>
          </div>
          <button className="icon-button" type="button" aria-label="Close transaction details" onClick={onClose}><X size={18} aria-hidden="true" /></button>
        </header>

        <div className="detail-content">
          <ProductName transaction={transaction} />
          <dl className="detail-facts">
            <div><dt>Price</dt><dd>{formatMoney(transaction.amount, transaction.currency)}</dd></div>
            <div><dt>Date</dt><dd>{formatDate(transaction.date)}</dd></div>
            {transaction.notes && <div className="detail-notes"><dt>Notes</dt><dd>{transaction.notes}</dd></div>}
          </dl>
          <div className="detail-attachments">
            <h3>Photos and ID</h3>
            <div className="detail-image-grid">
              {allImages.map((image) => (
                <figure key={image.url}>
                  <img src={image.url} alt={image.label} />
                  <figcaption>{image.label}</figcaption>
                </figure>
              ))}
            </div>
          </div>
        </div>

        <footer className="detail-footer">
          <button className="button button-danger-quiet" type="button" onClick={onDelete}>Delete transaction</button>
          <button className="button button-secondary" type="button" onClick={onClose}>Close</button>
        </footer>
      </section>
    </div>
  );
}

export default function App() {
  const router = useRouter();
  const [page, setPage] = useState<Page>("overview");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [selected, setSelected] = useState<Transaction>();
  const [formOpen, setFormOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [toast, setToast] = useState("");

  const refresh = async () => {
    setLoadError("");
    setLoading(true);
    try {
      setTransactions(await fetchTransactions());
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "The server could not be reached.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const saveTransaction = async (payload: Parameters<typeof createTransaction>[0]) => {
    const transaction = await createTransaction(payload);
    setTransactions((current) => [transaction, ...current].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)));
    setFormOpen(false);
    setToast("Transaction saved");
  };

  const deleteTransaction = async (transaction: Transaction) => {
    const action = transaction.direction === "buy" ? "buy" : "sale";
    if (!window.confirm(`Delete this ${action} of ${transaction.phoneModel}?`)) return;
    try {
      await removeTransaction(transaction.id);
      setTransactions((current) => current.filter((item) => item.id !== transaction.id));
      setSelected(undefined);
      setToast("Transaction deleted");
    } catch (error) {
      setToast(error instanceof ApiError ? error.message : "Could not delete this transaction");
    }
  };

  const signOut = async () => {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) {
      setToast("Could not sign out. Try again.");
      return;
    }
    router.refresh();
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#overview" onClick={(event) => { event.preventDefault(); setPage("overview"); }}>
          <span className="brand-mark"><Smartphone size={17} aria-hidden="true" /></span>
          <span>Phone Inventory</span>
        </a>
        <nav className="primary-nav" aria-label="Main navigation">
          {(Object.keys(pageTitles) as Page[]).map((item) => (
            <button key={item} type="button" aria-current={page === item ? "page" : undefined} onClick={() => setPage(item)}>
              {pageTitles[item]}
            </button>
          ))}
        </nav>
        <div className="account-actions">
          <button className="button button-primary new-transaction-button" type="button" onClick={() => setFormOpen(true)}>
            <Plus size={17} aria-hidden="true" />
            <span>New transaction</span>
          </button>
          <button className="sign-out-button" type="button" onClick={() => void signOut()} aria-label="Sign out" title="Sign out">
            <LogOut size={17} aria-hidden="true" />
          </button>
        </div>
      </header>

      <main className="page-container">
        <div className="page-heading">
          <div>
            <h1>{pageTitles[page]}</h1>
            <p>{page === "overview" ? "Your phones and recent trades." : page === "stock" ? "Phones currently available to sell." : "Buys and sells recorded in this account."}</p>
          </div>
        </div>

        {loadError ? (
          <div className="error-state" role="alert">
            <CircleAlert size={20} aria-hidden="true" />
            <div><strong>Could not load your inventory</strong><p>{loadError}</p></div>
            <button className="button button-secondary" type="button" onClick={() => void refresh()}>Try again</button>
          </div>
        ) : loading ? (
          <div className="loading-state" role="status">Loading your ledger…</div>
        ) : page === "overview" ? (
          <Overview transactions={transactions} onView={setSelected} />
        ) : page === "stock" ? (
          <Stock transactions={transactions} />
        ) : (
          <Transactions transactions={transactions} onView={setSelected} />
        )}
      </main>

      <footer className="app-footer"><span>Private account</span><span>{transactions.length} {transactions.length === 1 ? "transaction" : "transactions"}</span></footer>

      <Drawer
        open={formOpen}
        onOpenChange={(open) => {
          if (!open) setFormOpen(false);
        }}
        showSwipeHandle
      >
        <DrawerContent className="transaction-form-drawer">
          {formOpen && (
            <>
              <DrawerTitle className="visually-hidden">New transaction</DrawerTitle>
              <TransactionForm
                onSubmit={saveTransaction}
                onCancel={() => setFormOpen(false)}
              />
            </>
          )}
        </DrawerContent>
      </Drawer>

      {selected && <TransactionDetails transaction={selected} onClose={() => setSelected(undefined)} onDelete={() => void deleteTransaction(selected)} />}
      {toast && <div className="toast" role="status"><span>{toast}</span><button type="button" aria-label="Dismiss notification" onClick={() => setToast("")}><X size={15} aria-hidden="true" /></button></div>}
    </div>
  );
}

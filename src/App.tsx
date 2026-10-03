"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronRight,
  CircleAlert,
  FileImage,
  LogOut,
  Pencil,
  Plus,
  Smartphone,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { IPHONE_CATALOG } from "../lib/catalog/iphones";
import type { Transaction } from "./domain/transactions";
import { createSupabaseBrowserClient } from "./lib/supabase/client";
import { ApiError, createTransaction, fetchTransactions, removeTransaction, updateTransaction } from "./api";
import { TransactionForm } from "./components/TransactionForm";
import { Drawer, DrawerContent, DrawerTitle } from "./components/ui/drawer";
import { getAvailablePhones, getInventory, summarizeTransactions } from "./domain/transaction";

type Page = "overview" | "stock" | "transactions";
type DirectionFilter = "all" | "buy" | "sell";

const pageTitles: Record<Page, string> = {
  overview: "Aperçu",
  stock: "Stock",
  transactions: "Transactions",
};

function formatMoney(amount: number, currency: string): string {
  const number = new Intl.NumberFormat("en-US", { useGrouping: false, maximumFractionDigits: 3 }).format(amount);
  return `${number} ${currency}`;
}

function formatDate(value: string): string {
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("fr-TN", { day: "numeric", month: "short", year: "numeric" }).format(date);
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
  onEdit,
}: {
  transactions: Transaction[];
  onView: (transaction: Transaction) => void;
  onEdit: (transaction: Transaction) => void;
}) {
  if (!transactions.length) return <EmptyState title="Aucune transaction pour le moment" action="Enregistrez un achat ou une vente pour commencer." />;

  return (
    <div className="table-scroll">
      <table className="ledger-table">
        <thead>
          <tr>
            <th scope="col">iPhone</th>
            <th scope="col">Type</th>
            <th scope="col" className="number-column">Prix</th>
            <th scope="col">Date</th>
            <th scope="col" className="attachment-column">Photos</th>
            <th scope="col"><span className="visually-hidden">Ouvrir la transaction</span></th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((transaction) => (
            <tr key={transaction.id}>
              <td>
                <ProductName transaction={transaction} />
                <button
                  className="transaction-card-edit-trigger"
                  type="button"
                  aria-label={`Modifier la transaction ${transaction.phoneModel}`}
                  onClick={() => onEdit(transaction)}
                />
              </td>
              <td>
                <span className={`transaction-direction ${transaction.direction}`}>
                  {transaction.direction === "buy" ? <ArrowDownLeft size={15} aria-hidden="true" /> : <ArrowUpRight size={15} aria-hidden="true" />}
                  {transaction.direction === "buy" ? "Achat" : "Vente"}
                </span>
              </td>
              <td className="number-column amount-cell">{formatMoney(transaction.amount, transaction.currency)}</td>
              <td className="date-cell">{formatDate(transaction.date)}</td>
              <td className="attachment-column">
                <span className="file-count"><FileImage size={15} aria-hidden="true" />{transaction.phonePhotos.length + Number(Boolean(transaction.idFront)) + Number(Boolean(transaction.idBack))}</span>
              </td>
              <td className="row-action-cell">
                <button className="row-action" type="button" aria-label={`Voir la transaction ${transaction.phoneModel}`} onClick={() => onView(transaction)}>
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

function Overview({ transactions, onView, onEdit }: { transactions: Transaction[]; onView: (transaction: Transaction) => void; onEdit: (transaction: Transaction) => void }) {
  const summary = summarizeTransactions(transactions);
  const recent = transactions.slice(0, 6);

  return (
    <>
      <section className="overview-summary" aria-label="Résumé de l’inventaire">
        <div className="on-hand-stat">
          <span className="stat-label">iPhone en stock</span>
          <strong>{summary.unitsInStock}</strong>
          <span className="stat-note">unités</span>
        </div>
        <div className="summary-total">
          <span className="stat-label">Achats</span>
          <CurrencyTotals values={summary.purchases} />
        </div>
        <div className="summary-total">
          <span className="stat-label">Ventes</span>
          <CurrencyTotals values={summary.sales} />
        </div>
        <div className="summary-total summary-count">
          <span className="stat-label">Transactions</span>
          <strong>{summary.transactions}</strong>
          <span className="stat-note">{summary.buys} achats · {summary.sells} ventes</span>
        </div>
      </section>

      <section className="content-section">
        <div className="section-heading">
          <div>
            <h2>Transactions récentes</h2>
            <p>Dernières opérations de votre inventaire</p>
          </div>
        </div>
        <div className="content-surface">
          <TransactionTable transactions={recent} onView={onView} onEdit={onEdit} />
        </div>
      </section>
    </>
  );
}

function Stock({ transactions, onMarkSold }: { transactions: Transaction[]; onMarkSold: (purchase: Transaction) => void }) {
  const inventory = getInventory(transactions);
  const availablePhones = getAvailablePhones(transactions);
  if (!inventory.length) return <EmptyState title="Aucun iPhone en stock" action="Enregistrez un achat pour afficher votre stock ici." />;

  return (
    <>
      <section className="content-section">
        <div className="section-heading stock-heading">
          <div>
            <h2>Téléphones disponibles</h2>
            <p>{availablePhones.length} iPhone prêt{availablePhones.length === 1 ? "" : "s"} à vendre</p>
          </div>
        </div>
        <div className="content-surface">
          {availablePhones.length ? (
            <div className="table-scroll">
              <table className="ledger-table devices-table">
                <thead>
                  <tr><th scope="col">iPhone et identifiants</th><th scope="col" className="number-column">Acheté à</th><th scope="col">Date d’achat</th><th scope="col"><span className="visually-hidden">Action</span></th></tr>
                </thead>
                <tbody>
                  {availablePhones.map((phone) => (
                    <tr key={phone.id}>
                      <td>
                        <ProductName transaction={phone} />
                        <span className="device-identifiers-copy">
                          {phone.imei ? `IMEI ${phone.imei}` : "IMEI —"}
                          {phone.serialNumber ? ` · Série ${phone.serialNumber}` : " · Série —"}
                        </span>
                      </td>
                      <td className="number-column amount-cell">{formatMoney(phone.amount, phone.currency)}</td>
                      <td className="date-cell">{formatDate(phone.date)}</td>
                      <td className="device-sale-action">
                        <button
                          className="button button-secondary stock-sell-button"
                          type="button"
                          aria-label={`Vendre ${phone.phoneModel} ${phone.phoneColor}${phone.imei ? ` — IMEI ${phone.imei}` : phone.serialNumber ? ` — série ${phone.serialNumber}` : ""}`}
                          onClick={() => onMarkSold(phone)}
                        >
                          <ArrowUpRight size={15} aria-hidden="true" />Vendre
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="Aucun téléphone disponible à la vente" action="Les téléphones enregistrés ont déjà été vendus." />
          )}
        </div>
      </section>

      <section className="content-section">
        <div className="section-heading stock-heading">
          <div>
            <h2>Stock par modèle et couleur</h2>
            <p>{inventory.reduce((count, row) => count + row.units, 0)} iPhone · {inventory.length} combinaisons de modèles et couleurs</p>
          </div>
        </div>
        <div className="content-surface">
          <div className="table-scroll">
            <table className="ledger-table stock-table">
            <thead>
              <tr><th scope="col">iPhone</th><th scope="col" className="number-column">En stock</th><th scope="col" className="number-column">Achats</th><th scope="col" className="number-column">Ventes</th><th scope="col">Dernière activité</th></tr>
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
    </>
  );
}

function Transactions({
  transactions,
  onView,
  onEdit,
}: {
  transactions: Transaction[];
  onView: (transaction: Transaction) => void;
  onEdit: (transaction: Transaction) => void;
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
          <h2>Toutes les transactions</h2>
          <p>{filtered.length} sur {transactions.length}</p>
        </div>
        <div className="transaction-filters">
          <label className="visually-hidden" htmlFor="transaction-search">Rechercher des transactions</label>
          <input id="transaction-search" type="search" placeholder="Rechercher un modèle ou une couleur" value={query} onChange={(event) => setQuery(event.target.value)} />
          <label className="visually-hidden" htmlFor="direction-filter">Filtrer par type de transaction</label>
          <select id="direction-filter" value={direction} onChange={(event) => setDirection(event.target.value as DirectionFilter)}>
            <option value="all">Tous les types</option>
            <option value="buy">Achats</option>
            <option value="sell">Ventes</option>
          </select>
        </div>
      </div>
      <div className="content-surface">
        <TransactionTable transactions={filtered} onView={onView} onEdit={onEdit} />
      </div>
    </section>
  );
}

function TransactionDetails({
  transaction,
  onClose,
  onDelete,
  onEdit,
}: {
  transaction: Transaction;
  onClose: () => void;
  onDelete: () => void;
  onEdit: () => void;
}) {
  const title = transaction.direction === "buy" ? "Pièce d’identité du vendeur" : "Pièce d’identité de l’acheteur";
  const allImages = [
    ...transaction.phonePhotos.map((image, index) => ({ ...image, label: `Photo de l’iPhone ${index + 1}` })),
    ...(transaction.idFront ? [{ ...transaction.idFront, label: `${title} — recto` }] : []),
    ...(transaction.idBack ? [{ ...transaction.idBack, label: `${title} — verso` }] : []),
  ];

  return (
    <div className="dialog-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
        <section className="detail-dialog" role="dialog" aria-modal="true" aria-label="Détails de la transaction">
        <header className="detail-header">
          <div>
            <span className={`transaction-direction ${transaction.direction}`}>
              {transaction.direction === "buy" ? <ArrowDownLeft size={15} aria-hidden="true" /> : <ArrowUpRight size={15} aria-hidden="true" />}
              {transaction.direction === "buy" ? "Achat" : "Vente"}
            </span>
            <h2>Détails de la transaction</h2>
          </div>
          <button className="icon-button" type="button" aria-label="Fermer les détails de la transaction" onClick={onClose}><X size={18} aria-hidden="true" /></button>
        </header>

        <div className="detail-content">
          <ProductName transaction={transaction} />
          <dl className="detail-facts">
            <div><dt>Prix</dt><dd>{formatMoney(transaction.amount, transaction.currency)}</dd></div>
            <div><dt>Date</dt><dd>{formatDate(transaction.date)}</dd></div>
            <div><dt>IMEI</dt><dd className="identifier-value">{transaction.imei || "—"}</dd></div>
            <div><dt>Numéro de série</dt><dd className="identifier-value">{transaction.serialNumber || "—"}</dd></div>
            {transaction.notes && <div className="detail-notes"><dt>Remarques</dt><dd>{transaction.notes}</dd></div>}
          </dl>
          <button className="button button-secondary transaction-edit-action" type="button" onClick={onEdit}>
            <Pencil size={15} aria-hidden="true" />Modifier la transaction
          </button>
          {allImages.length > 0 && (
            <div className="detail-attachments">
              <h3>Photos et pièces d’identité</h3>
              <div className="detail-image-grid">
                {allImages.map((image) => (
                  <figure key={image.url}>
                    <img src={image.url} alt={image.label} />
                    <figcaption>{image.label}</figcaption>
                  </figure>
                ))}
              </div>
            </div>
          )}
        </div>

        <footer className="detail-footer">
          <button className="button button-danger-quiet" type="button" onClick={onDelete}>Supprimer la transaction</button>
          <button className="button button-secondary" type="button" onClick={onClose}>Fermer</button>
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
  const [editingTransaction, setEditingTransaction] = useState<Transaction>();
  const [saleOfTransaction, setSaleOfTransaction] = useState<Transaction>();
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
      setLoadError(error instanceof Error ? error.message : "Le serveur est inaccessible.");
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

  const availablePhones = useMemo(() => getAvailablePhones(transactions), [transactions]);

  const closeTransactionForm = () => {
    setFormOpen(false);
    setEditingTransaction(undefined);
    setSaleOfTransaction(undefined);
  };

  const openNewTransaction = () => {
    setEditingTransaction(undefined);
    setSaleOfTransaction(undefined);
    setFormOpen(true);
  };

  const markPhoneSold = (purchase: Transaction) => {
    setEditingTransaction(undefined);
    setSaleOfTransaction(purchase);
    setFormOpen(true);
  };

  const editTransaction = (transaction: Transaction) => {
    setSelected(undefined);
    setSaleOfTransaction(undefined);
    setEditingTransaction(transaction);
    setFormOpen(true);
  };

  const saveTransaction = async (payload: Parameters<typeof createTransaction>[0]) => {
    if (editingTransaction) {
      const updated = await updateTransaction(editingTransaction.id, payload);
      setTransactions((current) => current
        .map((item) => item.id === updated.id ? updated : item)
        .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)));
      closeTransactionForm();
      setToast("Transaction modifiée");
      return;
    }

    const transaction = await createTransaction(payload);
    setTransactions((current) => [transaction, ...current].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)));
    closeTransactionForm();
    setToast(payload.direction === "sell" ? "Téléphone marqué comme vendu" : "Achat enregistré");
  };

  const deleteTransaction = async (transaction: Transaction) => {
    if (transaction.direction === "buy" && transactions.some((item) => item.soldFromTransactionId === transaction.id)) {
      setToast("Supprimez d’abord la vente associée à cet achat.");
      return;
    }
    const action = transaction.direction === "buy" ? "cet achat" : "cette vente";
    if (!window.confirm(`Supprimer ${action} concernant l’iPhone ${transaction.phoneModel} ?`)) return;
    try {
      await removeTransaction(transaction.id);
      setTransactions((current) => current.filter((item) => item.id !== transaction.id));
      setSelected(undefined);
      setToast("Transaction supprimée");
    } catch (error) {
      setToast(error instanceof ApiError ? error.message : "Impossible de supprimer la transaction.");
    }
  };

  const signOut = async () => {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) {
      setToast("Impossible de vous déconnecter. Réessayez.");
      return;
    }
    router.refresh();
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#overview" onClick={(event) => { event.preventDefault(); setPage("overview"); }}>
          <span className="brand-mark"><Smartphone size={17} aria-hidden="true" /></span>
          <span>Inventaire iPhone</span>
        </a>
        <nav className="primary-nav" aria-label="Navigation principale">
          {(Object.keys(pageTitles) as Page[]).map((item) => (
            <button key={item} type="button" aria-current={page === item ? "page" : undefined} onClick={() => setPage(item)}>
              {pageTitles[item]}
            </button>
          ))}
        </nav>
        <div className="account-actions">
          <button className="button button-primary new-transaction-button" type="button" aria-label="Nouvelle transaction" onClick={openNewTransaction}>
            <Plus size={17} aria-hidden="true" />
            <span className="new-transaction-label-wide">Nouvelle transaction</span>
            <span className="new-transaction-label-compact" aria-hidden="true">Ajouter</span>
          </button>
          <button className="sign-out-button" type="button" onClick={() => void signOut()} aria-label="Se déconnecter" title="Se déconnecter">
            <LogOut size={17} aria-hidden="true" />
          </button>
        </div>
      </header>

      <main className="page-container">
        <div className="page-heading">
          <div>
            <h1>{pageTitles[page]}</h1>
            <p>{page === "overview" ? "Votre stock et vos dernières transactions." : page === "stock" ? "Les iPhone actuellement disponibles à la vente." : "Les achats et ventes enregistrés dans ce compte."}</p>
          </div>
        </div>

        {loadError ? (
          <div className="error-state" role="alert">
            <CircleAlert size={20} aria-hidden="true" />
            <div><strong>Impossible de charger votre inventaire</strong><p>{loadError}</p></div>
            <button className="button button-secondary" type="button" onClick={() => void refresh()}>Réessayer</button>
          </div>
        ) : loading ? (
          <div className="loading-state" role="status">Chargement de votre inventaire…</div>
        ) : page === "overview" ? (
          <Overview transactions={transactions} onView={setSelected} onEdit={editTransaction} />
        ) : page === "stock" ? (
          <Stock transactions={transactions} onMarkSold={markPhoneSold} />
        ) : (
          <Transactions transactions={transactions} onView={setSelected} onEdit={editTransaction} />
        )}
      </main>

      <footer className="app-footer"><span>Compte privé</span><span>{transactions.length} {transactions.length === 1 ? "transaction" : "transactions"}</span></footer>

      <Drawer
        open={formOpen}
        onOpenChange={(open) => {
          if (!open) closeTransactionForm();
        }}
        showSwipeHandle
      >
        <DrawerContent className="transaction-form-drawer">
          {formOpen && (
            <>
              <DrawerTitle className="visually-hidden">{editingTransaction ? "Modifier la transaction" : saleOfTransaction ? "Vendre un téléphone du stock" : "Nouvelle transaction"}</DrawerTitle>
              <TransactionForm
                key={editingTransaction?.id ?? (saleOfTransaction ? `sale-${saleOfTransaction.id}` : "new")}
                initial={editingTransaction}
                saleOf={saleOfTransaction}
                availablePhones={availablePhones}
                identityLocked={Boolean(editingTransaction?.direction === "buy" && transactions.some((item) => item.soldFromTransactionId === editingTransaction.id))}
                onSubmit={saveTransaction}
                onCancel={closeTransactionForm}
              />
            </>
          )}
        </DrawerContent>
      </Drawer>

      {selected && <TransactionDetails transaction={selected} onClose={() => setSelected(undefined)} onDelete={() => void deleteTransaction(selected)} onEdit={() => editTransaction(selected)} />}
      {toast && <div className="toast" role="status"><span>{toast}</span><button type="button" aria-label="Masquer la notification" onClick={() => setToast("")}><X size={15} aria-hidden="true" /></button></div>}
    </div>
  );
}

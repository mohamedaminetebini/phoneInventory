import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Camera, ImagePlus, Search, X } from "lucide-react";
import {
  IPHONE_CATALOG,
  getIPhoneColors,
  type IPhoneCatalogItem,
} from "../../lib/catalog/iphones";
import type { Currency, Direction, ImageInput, SavedImage, Transaction, TransactionFormData, TransactionFormImage } from "../domain/transactions";
import { ModelPicker } from "./ModelPicker";
import { Drawer, DrawerContent, DrawerTitle } from "./ui/drawer";

type TransactionFormProps = {
  initial?: Transaction;
  saleOf?: Transaction;
  availablePhones?: Transaction[];
  identityLocked?: boolean;
  onSubmit: (transaction: TransactionFormData) => Promise<void>;
  onCancel: () => void;
};

const currencies: Currency[] = ["TND", "EUR", "USD"];
const maxPhonePhotos = 5;
const maxSourceBytes = 20 * 1024 * 1024;

function localToday(): string {
  const now = new Date();
  return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"), String(now.getDate()).padStart(2, "0")].join("-");
}

function readAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Impossible de lire cette image."));
    reader.onerror = () => reject(new Error("Impossible de lire cette image."));
    reader.readAsDataURL(blob);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Ce fichier n’est pas une image lisible."));
    image.src = src;
  });
}

async function prepareImage(file: File): Promise<ImageInput> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    throw new Error("Choisissez une image au format JPEG, PNG ou WebP.");
  }
  if (file.size > maxSourceBytes) throw new Error("Choisissez une image de moins de 20 Mo.");

  const source = await readAsDataUrl(file);
  const image = await loadImage(source);
  const longestEdge = 1800;
  const scale = Math.min(1, longestEdge / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Votre navigateur n’a pas pu préparer cette image.");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  const compressed = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error("Votre navigateur n’a pas pu préparer cette image.")),
      "image/jpeg",
      0.84,
    );
  });
  return {
    name: file.name || "photo.jpg",
    mimeType: "image/jpeg",
    dataUrl: await readAsDataUrl(compressed),
    file: compressed,
  };
}

type ImagePreview =
  | { kind: "upload"; key: string; name: string; previewUrl: string; input: ImageInput }
  | { kind: "existing"; key: string; name: string; previewUrl: string; saved: SavedImage };

function AttachmentPicker({
  label,
  image,
  onChange,
  onRemove,
  multiple = false,
  hideFieldLabel = false,
  wide = false,
  addLabel = "Ajouter une photo",
  addHint,
}: {
  label: string;
  image?: ImagePreview;
  onChange: (files: FileList | null) => void;
  onRemove?: () => void;
  multiple?: boolean;
  hideFieldLabel?: boolean;
  wide?: boolean;
  addLabel?: string;
  addHint?: string;
}) {
  const inputId = useId();

  return (
    <div className={`attachment-field${wide ? " attachment-field-wide" : ""}`}>
      {!hideFieldLabel && <span className="field-label">{label}</span>}
      {image ? (
        <div className="attachment-preview">
          <img src={image.previewUrl} alt={`${label} — aperçu`} />
          <span className="attachment-name" title={image.name}>{image.name}</span>
          {onRemove && (
            <button className="attachment-remove" type="button" aria-label={`Supprimer ${label}`} onClick={onRemove}>
              <X size={15} aria-hidden="true" />
            </button>
          )}
          <label className="attachment-replace" htmlFor={inputId}>Remplacer</label>
        </div>
      ) : (
        <label className={`attachment-add${wide ? " attachment-add-wide" : ""}`} htmlFor={inputId}>
          {multiple ? <ImagePlus size={19} aria-hidden="true" /> : <Camera size={19} aria-hidden="true" />}
          {wide ? (
            <span className="attachment-add-copy">
              <strong>{addLabel}</strong>
              {addHint && <span>{addHint}</span>}
            </span>
          ) : <span>{addLabel}</span>}
        </label>
      )}
      <input
        id={inputId}
        className="visually-hidden file-input"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        aria-label={label}
        multiple={multiple}
        onChange={(event) => {
          onChange(event.target.files);
          event.target.value = "";
        }}
      />
    </div>
  );
}

function preview(image: ImageInput): ImagePreview {
  return { kind: "upload", key: `${image.name}-${image.dataUrl.slice(-24)}`, name: image.name, previewUrl: image.dataUrl, input: image };
}

function savedPreview(image: SavedImage): ImagePreview {
  return { kind: "existing", key: image.path, name: image.name, previewUrl: image.url, saved: image };
}

function formImage(image: ImagePreview): TransactionFormImage {
  return image.kind === "existing"
    ? { kind: "existing", image: image.saved }
    : { kind: "upload", image: image.input };
}

function PurchasePicker({
  phones,
  value,
  onSelect,
}: {
  phones: Transaction[];
  value?: Transaction;
  onSelect: (phone: Transaction) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const results = phones.filter((phone) =>
    `${phone.phoneModel} ${phone.phoneColor} ${phone.imei ?? ""} ${phone.serialNumber ?? ""}`
      .toLocaleLowerCase()
      .includes(normalizedQuery),
  );

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <>
      <button
        className={value ? "purchase-picker-trigger is-selected" : "purchase-picker-trigger"}
        type="button"
        onClick={() => { setQuery(""); setOpen(true); }}
        aria-label={value ? `Téléphone à vendre : ${value.phoneModel}, ${value.phoneColor}` : "Choisir un téléphone en stock"}
      >
        {value ? (
          <>
            <span className="purchase-picker-copy">
              <strong>{value.phoneModel} · {value.phoneColor}</strong>
              <span>{value.imei ? `IMEI ${value.imei}` : "IMEI non renseigné"}{value.serialNumber ? ` · Série ${value.serialNumber}` : ""} · Achat {value.date} · {value.amount} {value.currency}</span>
            </span>
            <span className="purchase-picker-change">Modifier</span>
          </>
        ) : <><span>Choisir un téléphone du stock</span><span aria-hidden="true">⌄</span></>}
      </button>

      <Drawer open={open} onOpenChange={setOpen} showSwipeHandle>
        <DrawerContent className="model-picker-drawer-popup purchase-picker-drawer-popup">
          <DrawerTitle className="visually-hidden">Choisir un téléphone en stock</DrawerTitle>
          <section className="model-dialog model-picker-panel">
            <div className="model-dialog-header">
              <h2>Choisir le téléphone vendu</h2>
              <button className="icon-button" type="button" aria-label="Fermer la liste des téléphones" onClick={() => setOpen(false)}>
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            <label className="model-search">
              <Search size={17} aria-hidden="true" />
              <span className="visually-hidden">Rechercher un téléphone en stock</span>
              <input
                ref={inputRef}
                type="search"
                aria-label="Rechercher un téléphone en stock"
                placeholder="Modèle, IMEI ou numéro de série"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              {query && <span className="search-result-count">{results.length}</span>}
            </label>
            <div className="model-results">
              {results.map((phone) => (
                <button
                  key={phone.id}
                  className="model-option purchase-picker-option"
                  type="button"
                  onClick={() => { onSelect(phone); setOpen(false); }}
                >
                  <span className="device-mark" aria-hidden="true" />
                  <span className="purchase-option-copy">
                    <strong>{phone.phoneModel} · {phone.phoneColor}</strong>
                    <span>{phone.imei ? `IMEI ${phone.imei}` : "IMEI —"}{phone.serialNumber ? ` · Série ${phone.serialNumber}` : " · Série —"}</span>
                  </span>
                  <span className="model-option-year">{phone.date} · {phone.amount} {phone.currency}</span>
                </button>
              ))}
              {results.length === 0 && (
                <p className="model-empty">{phones.length ? `Aucun téléphone ne correspond à « ${query} ».` : "Aucun téléphone disponible. Enregistrez un achat pour commencer."}</p>
              )}
            </div>
          </section>
        </DrawerContent>
      </Drawer>
    </>
  );
}

export function TransactionForm({ initial, saleOf, availablePhones = [], identityLocked = false, onSubmit, onCancel }: TransactionFormProps) {
  const deviceSource = saleOf ?? initial;
  const initialModel = deviceSource ? IPHONE_CATALOG.find((item) => item.name === deviceSource.phoneModel) : undefined;
  const [direction, setDirection] = useState<Direction>(saleOf ? "sell" : initial?.direction ?? "buy");
  const [saleTarget, setSaleTarget] = useState<Transaction | undefined>(saleOf);
  const [model, setModel] = useState<IPhoneCatalogItem | undefined>(initialModel);
  const [colorName, setColorName] = useState(deviceSource?.phoneColor ?? "");
  const [imei, setImei] = useState(deviceSource?.imei ?? "");
  const [imeiTouched, setImeiTouched] = useState(false);
  const [serialNumber, setSerialNumber] = useState(deviceSource?.serialNumber ?? "");
  const [amount, setAmount] = useState(initial ? String(initial.amount) : "");
  const [currency, setCurrency] = useState<Currency>(saleOf?.currency ?? initial?.currency ?? "TND");
  const [date, setDate] = useState(initial?.date ?? localToday());
  const [phonePhotos, setPhonePhotos] = useState<ImagePreview[]>(() => initial?.phonePhotos.map(savedPreview) ?? []);
  const [idFront, setIdFront] = useState<ImagePreview | undefined>(() => initial?.idFront ? savedPreview(initial.idFront) : undefined);
  const [idBack, setIdBack] = useState<ImagePreview | undefined>(() => initial?.idBack ? savedPreview(initial.idBack) : undefined);
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [attachmentError, setAttachmentError] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const colors = model ? getIPhoneColors(model.id) : [];
  const parsedAmount = Number(amount);
  const normalizedImei = imei.trim();
  const imeiIsInvalid = Boolean(normalizedImei && !/^\d{15}$/.test(normalizedImei));
  const showImeiError = imeiTouched && imeiIsInvalid;
  const linkedPurchaseId = saleTarget?.id ?? initial?.soldFromTransactionId ?? null;
  const editingLegacySale = Boolean(initial?.direction === "sell" && !initial.soldFromTransactionId);
  const awaitingSalePhone = direction === "sell" && !linkedPurchaseId && !editingLegacySale;
  const lockedPhoneIdentity = Boolean(saleTarget || initial?.soldFromTransactionId || identityLocked);
  const ready = Boolean(model && colorName && parsedAmount > 0 && Number.isFinite(parsedAmount)
    && (direction !== "sell" || linkedPurchaseId || editingLegacySale));

  const selectModel = (nextModel: IPhoneCatalogItem) => {
    setModel(nextModel);
    if (!getIPhoneColors(nextModel.id).some((color) => color.name === colorName)) {
      setColorName("");
    }
  };

  const selectDirection = (nextDirection: Direction) => {
    if (nextDirection === direction) return;
    setDirection(nextDirection);
    setIdFront(undefined);
    setIdBack(undefined);
    if (nextDirection === "buy") {
      setSaleTarget(undefined);
    } else {
      setSaleTarget(undefined);
      setModel(undefined);
      setColorName("");
      setImei("");
      setSerialNumber("");
    }
  };

  const selectSaleTarget = (phone: Transaction) => {
    setSaleTarget(phone);
    setModel(IPHONE_CATALOG.find((item) => item.name === phone.phoneModel));
    setColorName(phone.phoneColor);
    setImei(phone.imei ?? "");
    setSerialNumber(phone.serialNumber ?? "");
  };

  const handlePhonePhotos = async (files: FileList | null) => {
    if (!files?.length) return;
    setAttachmentError("");
    const chosen = Array.from(files);
    if (phonePhotos.length + chosen.length > maxPhonePhotos) {
      setAttachmentError(`Ajoutez jusqu’à ${maxPhonePhotos} photos de l’iPhone.`);
      return;
    }
    try {
      const prepared = await Promise.all(chosen.map(prepareImage));
      setPhonePhotos((current) => [...current, ...prepared.map(preview)]);
    } catch (error) {
      setAttachmentError(error instanceof Error ? error.message : "Impossible de préparer cette image.");
    }
  };

  const handleReplacePhonePhoto = (key: string) => async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    setAttachmentError("");
    try {
      const replacement = preview(await prepareImage(file));
      setPhonePhotos((current) => current.map((image) => image.key === key ? replacement : image));
    } catch (error) {
      setAttachmentError(error instanceof Error ? error.message : "Impossible de préparer cette image.");
    }
  };

  const handleSingleImage = (setter: (image: ImagePreview | undefined) => void) => async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    setAttachmentError("");
    try {
      setter(preview(await prepareImage(file)));
    } catch (error) {
      setAttachmentError(error instanceof Error ? error.message : "Impossible de préparer cette image.");
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError("");
    if (!model || !colorName || !ready) {
      setFormError(direction === "sell" && !linkedPurchaseId
        ? "Choisissez un téléphone disponible et saisissez son prix de vente."
        : "Choisissez un modèle, une couleur et saisissez un prix valide.");
      return;
    }
    if (imeiIsInvalid) {
      setImeiTouched(true);
      setFormError("L’IMEI doit contenir exactement 15 chiffres.");
      return;
    }

    setSaving(true);
    try {
      await onSubmit({
        direction,
        soldFromTransactionId: linkedPurchaseId,
        modelId: model.id,
        colorName,
        imei: imei.trim(),
        serialNumber: serialNumber.trim(),
        amount: parsedAmount,
        currency,
        date: date || localToday(),
        phonePhotos: phonePhotos.map(formImage),
        ...(idFront ? { idFront: formImage(idFront) } : {}),
        ...(idBack ? { idBack: formImage(idBack) } : {}),
        notes,
      });
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Impossible d’enregistrer la transaction.");
    } finally {
      setSaving(false);
    }
  };

  const removePhonePhoto = (key: string) => {
    setPhonePhotos((current) => current.filter((image) => image.key !== key));
  };

  const idTitle = direction === "buy" ? "Pièce d’identité du vendeur" : "Pièce d’identité de l’acheteur";

  return (
    <form className="transaction-form" aria-label="Formulaire de transaction" onSubmit={handleSubmit}>
      <header className="transaction-form-header">
        <div>
          <h2>{initial ? "Modifier la transaction" : saleOf ? "Vendre un iPhone du stock" : "Nouvelle transaction"}</h2>
          <p>{initial ? "Modifiez les informations enregistrées" : direction === "sell" ? "La vente reste liée à l’achat de ce téléphone" : "Un iPhone par transaction"}</p>
        </div>
        <button className="icon-button" type="button" aria-label="Fermer le formulaire de transaction" onClick={onCancel}>
          <X size={18} aria-hidden="true" />
        </button>
      </header>

      <div className="transaction-form-scroll">
        <fieldset className="direction-fieldset">
          <legend className="visually-hidden">Type de transaction</legend>
          <span className="direction-label" aria-hidden="true">Type de transaction</span>
          {initial || saleOf ? (
            <span className={`direction-fixed ${direction}`}>{direction === "buy" ? "Achat" : "Vente"}</span>
          ) : (
            <div className="direction-switch" data-direction={direction}>
              <button type="button" aria-pressed={direction === "buy"} onClick={() => selectDirection("buy")}>Achat</button>
              <button type="button" aria-pressed={direction === "sell"} onClick={() => selectDirection("sell")}>Vente</button>
            </div>
          )}
        </fieldset>

        {direction === "sell" && !initial && (
          <section className="form-section sale-phone-section">
            <h3>Téléphone vendu</h3>
            <PurchasePicker phones={availablePhones} value={saleTarget} onSelect={selectSaleTarget} />
          </section>
        )}

        <section className="form-section">
          <h3>Détails de l’iPhone</h3>
          {awaitingSalePhone ? (
            <p className="field-hint">Choisissez d’abord un téléphone en stock. Son modèle, sa couleur et ses identifiants seront repris de l’achat.</p>
          ) : (
            <>
              <div className="form-field">
                <span className="field-label">Modèle d’iPhone <span className="required-mark">Obligatoire</span></span>
                {lockedPhoneIdentity ? <div className="locked-device-value">{model?.name ?? "Modèle inconnu"}</div> : <ModelPicker value={model} onSelect={selectModel} />}
              </div>

              <div className="form-field">
                <span className="field-label">Couleur <span className="required-mark">Obligatoire</span></span>
                {lockedPhoneIdentity ? (
                  <div className="locked-device-value">
                    <span className="color-swatch" style={{ backgroundColor: colors.find((color) => color.name === colorName)?.hex ?? "#777777" }} aria-hidden="true" />
                    {colorName || "Couleur inconnue"}
                  </div>
                ) : colors.length ? (
                  <div className="color-options" aria-label="Couleurs disponibles">
                    {colors.map((color) => (
                      <button
                        className="color-option"
                        type="button"
                        key={color.name}
                        aria-pressed={colorName === color.name}
                        onClick={() => setColorName(color.name)}
                      >
                        <span className="color-swatch" style={{ backgroundColor: color.hex ?? "#777777" }} aria-hidden="true" />
                        <span>{color.name}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="field-hint">Choisissez un modèle pour afficher ses couleurs.</p>
                )}
              </div>

              <div className="device-identifiers">
                <label className="form-field">
                  <span className="field-label">IMEI <span className="required-mark">Facultatif</span></span>
                  <input
                    aria-label="IMEI"
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={15}
                    aria-invalid={showImeiError || undefined}
                    aria-describedby="imei-hint"
                    value={imei}
                    onChange={(event) => setImei(event.target.value)}
                    onBlur={() => setImeiTouched(true)}
                    placeholder="15 chiffres"
                    readOnly={lockedPhoneIdentity}
                  />
                  <span id="imei-hint" className={`field-hint${showImeiError ? " field-hint-error" : ""}`}>
                    {showImeiError ? "L’IMEI doit contenir exactement 15 chiffres." : "15 chiffres, sans espaces ni tirets"}
                  </span>
                </label>
                <label className="form-field">
                  <span className="field-label">Numéro de série <span className="required-mark">Facultatif</span></span>
                  <input
                    aria-label="Numéro de série"
                    type="text"
                    autoComplete="off"
                    maxLength={50}
                    value={serialNumber}
                    onChange={(event) => setSerialNumber(event.target.value)}
                    readOnly={lockedPhoneIdentity}
                  />
                </label>
              </div>
            </>
          )}
        </section>

        <section className="form-section">
          <h3>Prix et date</h3>
          <div className="price-date-grid">
            <label className="form-field">
              <span className="field-label">Prix <span className="required-mark">Obligatoire</span></span>
              <span className="amount-input-wrap">
                <input
                  type="number"
                  aria-label="Prix"
                  inputMode="decimal"
                  min="0.001"
                  max="10000000"
                  step="0.001"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  placeholder="0"
                  required
                />
                <select aria-label="Devise" value={currency} onChange={(event) => setCurrency(event.target.value as Currency)}>
                  {currencies.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </span>
            </label>
            <label className="form-field">
              <span className="field-label">Date <span className="required-mark">Facultatif</span></span>
              <input aria-label="Date" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
            </label>
          </div>
        </section>

        <section className="form-section">
          <div className="form-section-title-row">
            <h3>Photos de l’iPhone</h3>
            <span className="section-optional">Facultatif · jusqu’à {maxPhonePhotos}</span>
          </div>
          <div className="photo-collection">
            {phonePhotos.map((image) => (
              <AttachmentPicker
                key={image.key}
                label="Photo de l’iPhone"
                image={image}
                onChange={handleReplacePhonePhoto(image.key)}
                onRemove={() => removePhonePhoto(image.key)}
              />
            ))}
            {phonePhotos.length < maxPhonePhotos && (
              <AttachmentPicker
                label="Ajouter des photos de l’iPhone"
                onChange={handlePhonePhotos}
                multiple
                hideFieldLabel
                wide={phonePhotos.length === 0}
                addLabel={phonePhotos.length === 0 ? "Ajouter des photos de l’iPhone" : "Ajouter d’autres photos"}
                addHint={`JPEG, PNG ou WebP · jusqu’à ${maxPhonePhotos} photos`}
              />
            )}
          </div>
        </section>

        <section className="form-section">
          <div className="form-section-title-row">
            <h3>{direction === "buy" ? "Pièces d’identité du vendeur" : "Pièces d’identité de l’acheteur"}</h3>
            <span className="section-optional">Facultatif</span>
          </div>
          <div className="id-photo-grid">
            <AttachmentPicker
              label={`${idTitle} — recto`}
              image={idFront}
              onChange={handleSingleImage(setIdFront)}
              onRemove={() => setIdFront(undefined)}
            />
            <AttachmentPicker
              label={`${idTitle} — verso`}
              image={idBack}
              onChange={handleSingleImage(setIdBack)}
              onRemove={() => setIdBack(undefined)}
            />
          </div>
        </section>

        <details className="more-details" open={Boolean(initial)}>
          <summary>{initial ? "Plus d’informations" : "Plus de détails"}</summary>
          <label className="form-field">
            <span className="field-label">Remarques</span>
            <textarea aria-label="Remarques" rows={3} maxLength={3000} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Ajouter une remarque sur cette transaction" />
          </label>
        </details>

        {(attachmentError || formError) && <p className="form-error" role="alert">{attachmentError || formError}</p>}
      </div>

      <footer className="transaction-form-footer">
        <button className="button button-secondary" type="button" onClick={onCancel}>Annuler</button>
        <button className="button button-primary" type="submit" disabled={!ready || saving || imeiIsInvalid}>
          {saving ? "Enregistrement…" : initial ? "Enregistrer les modifications" : "Enregistrer la transaction"}
        </button>
      </footer>
    </form>
  );
}

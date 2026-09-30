import { useState, type FormEvent } from "react";
import { Camera, ImagePlus, X } from "lucide-react";
import {
  getIPhoneColors,
  type IPhoneCatalogItem,
} from "../../lib/catalog/iphones";
import type { Currency, Direction, ImageInput, NewTransaction } from "../domain/transactions";
import { ModelPicker } from "./ModelPicker";

type TransactionFormProps = {
  onSubmit: (transaction: NewTransaction) => Promise<void>;
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

type ImagePreview = ImageInput & { key: string };

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
  const inputId = `attachment-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

  return (
    <div className={`attachment-field${wide ? " attachment-field-wide" : ""}`}>
      {!hideFieldLabel && <span className="field-label">{label}</span>}
      {image ? (
        <div className="attachment-preview">
          <img src={image.dataUrl} alt={`${label} — aperçu`} />
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
  return { ...image, key: `${image.name}-${image.dataUrl.slice(-24)}` };
}

export function TransactionForm({ onSubmit, onCancel }: TransactionFormProps) {
  const [direction, setDirection] = useState<Direction>("buy");
  const [model, setModel] = useState<IPhoneCatalogItem>();
  const [colorName, setColorName] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<Currency>("TND");
  const [date, setDate] = useState(localToday);
  const [phonePhotos, setPhonePhotos] = useState<ImagePreview[]>([]);
  const [idFront, setIdFront] = useState<ImagePreview>();
  const [idBack, setIdBack] = useState<ImagePreview>();
  const [notes, setNotes] = useState("");
  const [attachmentError, setAttachmentError] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const colors = model ? getIPhoneColors(model.id) : [];
  const parsedAmount = Number(amount);
  const ready = Boolean(model && colorName && parsedAmount > 0 && Number.isFinite(parsedAmount) && date && idFront && idBack);

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
    if (!model || !colorName || !idFront || !idBack || !ready) {
      setFormError("Choisissez un modèle et une couleur, saisissez un prix et ajoutez les deux faces de la pièce d’identité.");
      return;
    }

    setSaving(true);
    try {
      const withoutKey = ({ key: _key, ...image }: ImagePreview) => image;
      await onSubmit({
        direction,
        modelId: model.id,
        colorName,
        amount: parsedAmount,
        currency,
        date,
        phonePhotos: phonePhotos.map(withoutKey),
        idFront: withoutKey(idFront),
        idBack: withoutKey(idBack),
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
          <h2>Nouvelle transaction</h2>
          <p>Un iPhone par transaction</p>
        </div>
        <button className="icon-button" type="button" aria-label="Fermer le formulaire de transaction" onClick={onCancel}>
          <X size={18} aria-hidden="true" />
        </button>
      </header>

      <div className="transaction-form-scroll">
        <fieldset className="direction-fieldset">
          <legend className="visually-hidden">Type de transaction</legend>
          <span className="direction-label" aria-hidden="true">Type de transaction</span>
          <div className="direction-switch" data-direction={direction}>
            <button type="button" aria-pressed={direction === "buy"} onClick={() => selectDirection("buy")}>Achat</button>
            <button type="button" aria-pressed={direction === "sell"} onClick={() => selectDirection("sell")}>Vente</button>
          </div>
        </fieldset>

        <section className="form-section">
          <h3>Détails de l’iPhone</h3>
          <div className="form-field">
            <span className="field-label">Modèle d’iPhone <span className="required-mark">Obligatoire</span></span>
            <ModelPicker value={model} onSelect={selectModel} />
          </div>

          <div className="form-field">
            <span className="field-label">Couleur <span className="required-mark">Obligatoire</span></span>
            {colors.length ? (
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
                  placeholder="0.000"
                  required
                />
                <select aria-label="Devise" value={currency} onChange={(event) => setCurrency(event.target.value as Currency)}>
                  {currencies.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </span>
            </label>
            <label className="form-field">
              <span className="field-label">Date <span className="required-mark">Obligatoire</span></span>
              <input aria-label="Date" type="date" value={date} onChange={(event) => setDate(event.target.value)} required />
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
                onChange={handlePhonePhotos}
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
            <span className="section-optional">Recto et verso obligatoires</span>
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

        <details className="more-details">
          <summary>Plus de détails</summary>
          <label className="form-field">
            <span className="field-label">Remarques</span>
            <textarea aria-label="Remarques" rows={3} maxLength={3000} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Ajouter une remarque sur cette transaction" />
          </label>
        </details>

        {(attachmentError || formError) && <p className="form-error" role="alert">{attachmentError || formError}</p>}
      </div>

      <footer className="transaction-form-footer">
        <button className="button button-secondary" type="button" onClick={onCancel}>Annuler</button>
        <button className="button button-primary" type="submit" disabled={!ready || saving}>
          {saving ? "Enregistrement…" : "Enregistrer la transaction"}
        </button>
      </footer>
    </form>
  );
}

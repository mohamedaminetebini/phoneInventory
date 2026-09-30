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
    reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Could not read this image."));
    reader.onerror = () => reject(new Error("Could not read this image."));
    reader.readAsDataURL(blob);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("This file is not a readable image."));
    image.src = src;
  });
}

async function prepareImage(file: File): Promise<ImageInput> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    throw new Error("Choose a JPEG, PNG, or WebP image.");
  }
  if (file.size > maxSourceBytes) throw new Error("Choose an image smaller than 20 MB.");

  const source = await readAsDataUrl(file);
  const image = await loadImage(source);
  const longestEdge = 1800;
  const scale = Math.min(1, longestEdge / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Your browser could not prepare this image.");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  const compressed = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error("Your browser could not prepare this image.")),
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
  addLabel = "Add photo",
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
          <img src={image.dataUrl} alt={`${label} preview`} />
          <span className="attachment-name" title={image.name}>{image.name}</span>
          {onRemove && (
            <button className="attachment-remove" type="button" aria-label={`Remove ${label}`} onClick={onRemove}>
              <X size={15} aria-hidden="true" />
            </button>
          )}
          <label className="attachment-replace" htmlFor={inputId}>Replace</label>
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
      setAttachmentError(`Add up to ${maxPhonePhotos} phone photos.`);
      return;
    }
    try {
      const prepared = await Promise.all(chosen.map(prepareImage));
      setPhonePhotos((current) => [...current, ...prepared.map(preview)]);
    } catch (error) {
      setAttachmentError(error instanceof Error ? error.message : "Could not prepare this image.");
    }
  };

  const handleSingleImage = (setter: (image: ImagePreview | undefined) => void) => async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    setAttachmentError("");
    try {
      setter(preview(await prepareImage(file)));
    } catch (error) {
      setAttachmentError(error instanceof Error ? error.message : "Could not prepare this image.");
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError("");
    if (!model || !colorName || !idFront || !idBack || !ready) {
      setFormError("Choose a model and color, enter a price, and add both ID images.");
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
      setFormError(error instanceof Error ? error.message : "The transaction could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  const removePhonePhoto = (key: string) => {
    setPhonePhotos((current) => current.filter((image) => image.key !== key));
  };

  const idTitle = direction === "buy" ? "Seller ID" : "Buyer ID";

  return (
    <form className="transaction-form" aria-label="Transaction form" onSubmit={handleSubmit}>
      <header className="transaction-form-header">
        <div>
          <h2>New transaction</h2>
          <p>One phone per transaction</p>
        </div>
        <button className="icon-button" type="button" aria-label="Close transaction form" onClick={onCancel}>
          <X size={18} aria-hidden="true" />
        </button>
      </header>

      <div className="transaction-form-scroll">
        <fieldset className="direction-fieldset">
          <legend className="visually-hidden">Transaction type</legend>
          <span className="direction-label" aria-hidden="true">Transaction type</span>
          <div className="direction-switch" data-direction={direction}>
            <button type="button" aria-pressed={direction === "buy"} onClick={() => selectDirection("buy")}>Buy</button>
            <button type="button" aria-pressed={direction === "sell"} onClick={() => selectDirection("sell")}>Sell</button>
          </div>
        </fieldset>

        <section className="form-section">
          <h3>Phone details</h3>
          <div className="form-field">
            <span className="field-label">iPhone model <span className="required-mark">Required</span></span>
            <ModelPicker value={model} onSelect={selectModel} />
          </div>

          <div className="form-field">
            <span className="field-label">Color <span className="required-mark">Required</span></span>
            {colors.length ? (
              <div className="color-options" aria-label="Available colors">
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
              <p className="field-hint">Choose a model to see its colors.</p>
            )}
          </div>
        </section>

        <section className="form-section">
          <h3>Price and date</h3>
          <div className="price-date-grid">
            <label className="form-field">
              <span className="field-label">Price <span className="required-mark">Required</span></span>
              <span className="amount-input-wrap">
                <input
                  type="number"
                  aria-label="Price"
                  inputMode="decimal"
                  min="0.001"
                  max="10000000"
                  step="0.001"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  placeholder="0.000"
                  required
                />
                <select aria-label="Currency" value={currency} onChange={(event) => setCurrency(event.target.value as Currency)}>
                  {currencies.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </span>
            </label>
            <label className="form-field">
              <span className="field-label">Date <span className="required-mark">Required</span></span>
              <input aria-label="Date" type="date" value={date} onChange={(event) => setDate(event.target.value)} required />
            </label>
          </div>
        </section>

        <section className="form-section">
          <div className="form-section-title-row">
            <h3>Phone photos</h3>
            <span className="section-optional">Optional · up to {maxPhonePhotos}</span>
          </div>
          <div className="photo-collection">
            {phonePhotos.map((image) => (
              <AttachmentPicker
                key={image.key}
                label="Phone photo"
                image={image}
                onChange={handlePhonePhotos}
                onRemove={() => removePhonePhoto(image.key)}
              />
            ))}
            {phonePhotos.length < maxPhonePhotos && (
              <AttachmentPicker
                label="Add phone photos"
                onChange={handlePhonePhotos}
                multiple
                hideFieldLabel
                wide={phonePhotos.length === 0}
                addLabel={phonePhotos.length === 0 ? "Add phone photos" : "Add more photos"}
                addHint={`JPEG, PNG or WebP · up to ${maxPhonePhotos} photos`}
              />
            )}
          </div>
        </section>

        <section className="form-section">
          <div className="form-section-title-row">
            <h3>{idTitle} photos</h3>
            <span className="section-optional">Front and back required</span>
          </div>
          <div className="id-photo-grid">
            <AttachmentPicker
              label={`${idTitle} front`}
              image={idFront}
              onChange={handleSingleImage(setIdFront)}
              onRemove={() => setIdFront(undefined)}
            />
            <AttachmentPicker
              label={`${idTitle} back`}
              image={idBack}
              onChange={handleSingleImage(setIdBack)}
              onRemove={() => setIdBack(undefined)}
            />
          </div>
        </section>

        <details className="more-details">
          <summary>More details</summary>
          <label className="form-field">
            <span className="field-label">Notes</span>
            <textarea aria-label="Notes" rows={3} maxLength={3000} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Add a note about this transaction" />
          </label>
        </details>

        {(attachmentError || formError) && <p className="form-error" role="alert">{attachmentError || formError}</p>}
      </div>

      <footer className="transaction-form-footer">
        <button className="button button-secondary" type="button" onClick={onCancel}>Cancel</button>
        <button className="button button-primary" type="submit" disabled={!ready || saving}>
          {saving ? "Saving…" : "Save transaction"}
        </button>
      </footer>
    </form>
  );
}

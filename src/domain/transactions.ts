export type Direction = "buy" | "sell";
export type Currency = "TND" | "EUR" | "USD";
export type ImageMimeType = "image/jpeg";

/** Browser-only upload. `dataUrl` is used for the local preview and is never sent to the app API. */
export type ImageInput = {
  name: string;
  mimeType: ImageMimeType;
  dataUrl: string;
  file: Blob;
};

export type SavedImage = {
  name: string;
  mimeType: ImageMimeType;
  url: string;
  path: string;
};

export type TransactionFormImage =
  | { kind: "existing"; image: SavedImage }
  | { kind: "upload"; image: ImageInput };

export type Transaction = {
  id: string;
  direction: Direction;
  soldFromTransactionId: string | null;
  phoneModel: string;
  phoneColor: string;
  imei: string | null;
  serialNumber: string | null;
  amount: number;
  currency: Currency;
  date: string;
  phonePhotos: SavedImage[];
  idFront: SavedImage | null;
  idBack: SavedImage | null;
  notes: string;
  createdAt: string;
};

export type NewTransaction = {
  direction: Direction;
  soldFromTransactionId: string | null;
  modelId: string;
  colorName: string;
  imei: string;
  serialNumber: string;
  amount: number;
  currency: Currency;
  date: string;
  phonePhotos: ImageInput[];
  idFront?: ImageInput;
  idBack?: ImageInput;
  notes: string;
};

export type TransactionFormData = Omit<NewTransaction, "phonePhotos" | "idFront" | "idBack"> & {
  phonePhotos: TransactionFormImage[];
  idFront?: TransactionFormImage;
  idBack?: TransactionFormImage;
};

/** Small JSON request sent after photos have been uploaded directly to private Storage. */
export type CreateTransactionPayload = {
  id: string;
  direction: Direction;
  soldFromTransactionId: string | null;
  modelId: string;
  colorName: string;
  imei: string;
  serialNumber: string;
  amount: number;
  currency: Currency;
  date: string;
  phonePhotos: string[];
  idFront: string | null;
  idBack: string | null;
  notes: string;
};

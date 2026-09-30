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
};

export type Transaction = {
  id: string;
  direction: Direction;
  phoneModel: string;
  phoneColor: string;
  amount: number;
  currency: Currency;
  date: string;
  phonePhotos: SavedImage[];
  idFront: SavedImage;
  idBack: SavedImage;
  notes: string;
  createdAt: string;
};

export type NewTransaction = {
  direction: Direction;
  modelId: string;
  colorName: string;
  amount: number;
  currency: Currency;
  date: string;
  phonePhotos: ImageInput[];
  idFront: ImageInput;
  idBack: ImageInput;
  notes: string;
};

/** Small JSON request sent after photos have been uploaded directly to private Storage. */
export type CreateTransactionPayload = {
  id: string;
  direction: Direction;
  modelId: string;
  colorName: string;
  amount: number;
  currency: Currency;
  date: string;
  phonePhotos: string[];
  idFront: string;
  idBack: string;
  notes: string;
};

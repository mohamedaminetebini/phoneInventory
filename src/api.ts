import type { CreateTransactionPayload, ImageInput, Transaction, TransactionFormData, TransactionFormImage } from "./domain/transactions";
import { createSupabaseBrowserClient } from "./lib/supabase/client";

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "ApiError";
  }
}

async function readError(response: Response): Promise<ApiError> {
  try {
    const body = await response.json() as { error?: string; fields?: Record<string, string[]> };
    const fieldMessage = body.fields
      ? Object.values(body.fields).flat().find(Boolean)
      : undefined;
    return new ApiError(fieldMessage ?? body.error ?? "La requête n’a pas pu aboutir.", response.status);
  } catch {
    return new ApiError("La requête n’a pas pu aboutir.", response.status);
  }
}

export async function fetchTransactions(): Promise<Transaction[]> {
  const response = await fetch("/api/transactions", { cache: "no-store" });
  if (!response.ok) throw await readError(response);
  const body = await response.json() as { transactions: Transaction[] };
  return body.transactions;
}

export async function createTransaction(input: TransactionFormData): Promise<Transaction> {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) throw new ApiError("Supabase n’est pas encore configuré.", 503);

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) throw new ApiError("Votre session a expiré. Reconnectez-vous pour enregistrer cette transaction.", 401);

  const id = crypto.randomUUID();
  const uploadedPaths: string[] = [];
  let committed = false;
  const upload = async (image: ImageInput, fileName: string): Promise<string> => {
    if (image.file.size === 0 || image.file.size > 5 * 1024 * 1024) {
      throw new ApiError("Chaque photo doit faire 5 Mo maximum.", 400);
    }
    const path = `${user.id}/${id}/${fileName}`;
    const { error } = await supabase.storage.from("transaction-photos").upload(path, image.file, {
      contentType: "image/jpeg",
      cacheControl: "0",
      upsert: false,
    });
    if (error) throw new ApiError("Impossible d’envoyer une photo. Vérifiez votre connexion et réessayez.", 400);
    uploadedPaths.push(path);
    return path;
  };

  try {
    const phonePhotos: string[] = [];
    for (const [index, photo] of input.phonePhotos.entries()) {
      if (photo.kind !== "upload") throw new ApiError("Une nouvelle transaction ne peut pas réutiliser d’anciennes photos.", 400);
      phonePhotos.push(await upload(photo.image, `phone-${index + 1}.jpg`));
    }
    const idFront = input.idFront ? await uploadNewAttachment(upload, input.idFront, "id-front.jpg") : null;
    const idBack = input.idBack ? await uploadNewAttachment(upload, input.idBack, "id-back.jpg") : null;
    const payload: CreateTransactionPayload = {
      id,
      direction: input.direction,
      modelId: input.modelId,
      colorName: input.colorName,
      imei: input.imei,
      serialNumber: input.serialNumber,
      amount: input.amount,
      currency: input.currency,
      date: input.date,
      phonePhotos,
      idFront,
      idBack,
      notes: input.notes,
    };

    const response = await fetch("/api/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
    if (!response.ok) throw await readError(response);
    committed = true;
    const body = await response.json() as { transaction: Transaction };
    return body.transaction;
  } catch (error) {
    if (!committed && uploadedPaths.length) {
      await supabase.storage.from("transaction-photos").remove(uploadedPaths);
    }
    throw error;
  }
}

async function uploadNewAttachment(
  upload: (image: ImageInput, fileName: string) => Promise<string>,
  image: TransactionFormImage,
  fileName: string,
): Promise<string> {
  if (image.kind !== "upload") throw new ApiError("Une nouvelle transaction ne peut pas réutiliser d’anciennes photos.", 400);
  return upload(image.image, fileName);
}

export async function removeTransaction(id: string): Promise<void> {
  const response = await fetch(`/api/transactions/${encodeURIComponent(id)}`, { method: "DELETE", cache: "no-store" });
  if (!response.ok) throw await readError(response);
}

export async function updateTransaction(
  id: string,
  input: TransactionFormData,
): Promise<Transaction> {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) throw new ApiError("Supabase n’est pas encore configuré.", 503);
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) throw new ApiError("Votre session a expiré. Reconnectez-vous pour modifier cette transaction.", 401);

  const uploadedPaths: string[] = [];
  let committed = false;
  const upload = async (image: ImageInput, fileName: string): Promise<string> => {
    if (image.file.size === 0 || image.file.size > 5 * 1024 * 1024) {
      throw new ApiError("Chaque photo doit faire 5 Mo maximum.", 400);
    }
    const path = `${user.id}/${id}/${fileName}`;
    const { error } = await supabase.storage.from("transaction-photos").upload(path, image.file, {
      contentType: "image/jpeg",
      cacheControl: "0",
      upsert: false,
    });
    if (error) throw new ApiError("Impossible d’envoyer une photo. Vérifiez votre connexion et réessayez.", 400);
    uploadedPaths.push(path);
    return path;
  };

  const resolveImage = (image: TransactionFormImage, fileName: string): Promise<string> => image.kind === "existing"
    ? Promise.resolve(image.image.path)
    : upload(image.image, fileName);

  try {
    const phonePhotos: string[] = [];
    for (const [index, photo] of input.phonePhotos.entries()) {
      phonePhotos.push(await resolveImage(photo, `phone-${index + 1}-${crypto.randomUUID()}.jpg`));
    }
    const idFront = input.idFront
      ? await resolveImage(input.idFront, `id-front-${crypto.randomUUID()}.jpg`)
      : null;
    const idBack = input.idBack
      ? await resolveImage(input.idBack, `id-back-${crypto.randomUUID()}.jpg`)
      : null;

    const payload: CreateTransactionPayload = {
      id,
      direction: input.direction,
      modelId: input.modelId,
      colorName: input.colorName,
      imei: input.imei,
      serialNumber: input.serialNumber,
      amount: input.amount,
      currency: input.currency,
      date: input.date,
      phonePhotos,
      idFront,
      idBack,
      notes: input.notes,
    };
    const response = await fetch(`/api/transactions/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
    if (!response.ok) throw await readError(response);
    committed = true;
    const body = await response.json() as { transaction: Transaction };
    return body.transaction;
  } catch (error) {
    if (!committed && uploadedPaths.length) {
      await supabase.storage.from("transaction-photos").remove(uploadedPaths);
    }
    throw error;
  }
}

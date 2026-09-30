import type { CreateTransactionPayload, ImageInput, NewTransaction, Transaction } from "./domain/transactions";
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

export async function createTransaction(input: NewTransaction): Promise<Transaction> {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) throw new ApiError("Supabase n’est pas encore configuré.", 503);

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) throw new ApiError("Votre session a expiré. Reconnectez-vous pour enregistrer cette transaction.", 401);

  const id = crypto.randomUUID();
  const uploadedPaths: string[] = [];
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
      phonePhotos.push(await upload(photo, `phone-${index + 1}.jpg`));
    }
    const idFront = await upload(input.idFront, "id-front.jpg");
    const idBack = await upload(input.idBack, "id-back.jpg");
    const payload: CreateTransactionPayload = {
      id,
      direction: input.direction,
      modelId: input.modelId,
      colorName: input.colorName,
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
    const body = await response.json() as { transaction: Transaction };
    return body.transaction;
  } catch (error) {
    if (uploadedPaths.length) {
      await supabase.storage.from("transaction-photos").remove(uploadedPaths);
    }
    throw error;
  }
}

export async function removeTransaction(id: string): Promise<void> {
  const response = await fetch(`/api/transactions/${encodeURIComponent(id)}`, { method: "DELETE", cache: "no-store" });
  if (!response.ok) throw await readError(response);
}

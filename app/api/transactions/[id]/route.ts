import { privateJson, isSameOriginMutation } from "@/lib/api-response";
import { getAuthenticatedSupabase } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { createTransactionSchema, presentTransaction, toTransactionUpdate, validateTransactionPhotoPaths } from "@/lib/transaction-schema";
import type { CreateTransactionPayload } from "@/domain/transactions";

const transactionColumns = "id,direction,sold_from_transaction_id,model_id,phone_model,phone_color,imei,serial_number,amount,currency,date,phone_photos,id_front_path,id_back_path,notes,created_at";
const maxRequestBytes = 32_000;

async function parseBoundedJson(request: Request): Promise<
  { kind: "ok"; value: unknown } | { kind: "too-large" } | { kind: "invalid" }
> {
  const reader = request.body?.getReader();
  if (!reader) return { kind: "invalid" };
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxRequestBytes) {
        await reader.cancel();
        return { kind: "too-large" };
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return { kind: "ok", value: JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as unknown };
  } catch {
    return { kind: "invalid" };
  } finally {
    reader.releaseLock();
  }
}

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!isSameOriginMutation(request)) return privateJson({ error: "Impossible de vérifier cette requête." }, 403);
  const contentLength = request.headers.get("content-length");
  if (contentLength && (!/^\d+$/.test(contentLength) || Number(contentLength) > maxRequestBytes)) {
    return privateJson({ error: "Les informations de la transaction sont trop volumineuses." }, 413);
  }
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    return privateJson({ error: "Les informations de la transaction doivent être envoyées au format JSON." }, 415);
  }

  const authenticated = await getAuthenticatedSupabase();
  if (!authenticated) return privateJson({ error: "Connectez-vous pour modifier la transaction." }, 401);

  const { id } = await context.params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return privateJson({ error: "Transaction introuvable." }, 404);
  }

  const parsedBody = await parseBoundedJson(request);
  if (parsedBody.kind === "too-large") {
    return privateJson({ error: "Les informations de la transaction sont trop volumineuses." }, 413);
  }
  if (parsedBody.kind === "invalid") {
    return privateJson({ error: "Les informations de la transaction ne sont pas au format JSON valide." }, 400);
  }

  const parsed = createTransactionSchema.safeParse(parsedBody.value);
  if (!parsed.success) {
    return privateJson({
      error: "Vérifiez les informations de la transaction.",
      fields: parsed.error.flatten().fieldErrors,
    }, 400);
  }
  if (parsed.data.id !== id) return privateJson({ error: "L’identifiant de la transaction ne correspond pas." }, 400);
  if (!validateTransactionPhotoPaths(parsed.data, authenticated.user.id, true)) {
    return privateJson({ error: "Impossible de vérifier les photos jointes." }, 400);
  }

  const serviceSupabase = createSupabaseServiceClient();
  if (!serviceSupabase) return privateJson({ error: "L’enregistrement des transactions n’est pas configuré sur le serveur." }, 503);

  const { data: current, error: currentError } = await serviceSupabase
    .from("phone_transactions")
    .select("direction,sold_from_transaction_id,phone_photos,id_front_path,id_back_path")
    .eq("id", id)
    .eq("user_id", authenticated.user.id)
    .maybeSingle();
  if (currentError) return privateJson({ error: "Impossible de charger la transaction à modifier." }, 500);
  if (!current) return privateJson({ error: "Transaction introuvable." }, 404);
  if (parsed.data.direction !== current.direction
    || parsed.data.soldFromTransactionId !== current.sold_from_transaction_id) {
    return privateJson({ error: "Le type de transaction et le téléphone associé ne peuvent pas être modifiés." }, 400);
  }

  const existingPaths = new Set([
    ...current.phone_photos,
    current.id_front_path,
    current.id_back_path,
  ].filter((path): path is string => Boolean(path)));
  const desiredPaths = new Set([
    ...parsed.data.phonePhotos,
    parsed.data.idFront,
    parsed.data.idBack,
  ].filter((path): path is string => Boolean(path)));
  const newPaths = [...desiredPaths].filter((path) => !existingPaths.has(path));
  const folder = `${authenticated.user.id}/${id}`;
  const uploadId = "[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
  const newUploadPath = new RegExp(`^${folder}/(?:phone-[1-5]|id-front|id-back)-${uploadId}\\.jpg$`);
  if (newPaths.some((path) => !newUploadPath.test(path))) {
    return privateJson({ error: "Les photos modifiées ne correspondent pas à cette transaction." }, 400);
  }

  if (newPaths.length) {
    const { data: storedFiles, error: storageLookupError } = await serviceSupabase.storage
      .from("transaction-photos")
      .list(folder, { limit: 100 });
    if (storageLookupError) return privateJson({ error: "Impossible de vérifier les nouvelles photos." }, 500);
    const storedPaths = new Set((storedFiles ?? []).map((file) => `${folder}/${file.name}`));
    if (newPaths.some((path) => !storedPaths.has(path))) {
      return privateJson({ error: "Une nouvelle photo n’a pas été envoyée correctement." }, 400);
    }
  }

  const { data, error } = await serviceSupabase
    .from("phone_transactions")
    .update(toTransactionUpdate(parsed.data as CreateTransactionPayload))
    .eq("id", id)
    .eq("user_id", authenticated.user.id)
    .select(transactionColumns)
    .maybeSingle();

  if (error?.code === "23514") return privateJson({ error: "Les informations du téléphone vendu doivent correspondre à son achat." }, 409);
  if (error) return privateJson({ error: "Impossible de modifier la transaction." }, 500);
  if (!data) return privateJson({ error: "Transaction introuvable." }, 404);

  const removedPaths = [...existingPaths].filter((path) => !desiredPaths.has(path));
  if (removedPaths.length) {
    const { error: cleanupError } = await serviceSupabase.storage.from("transaction-photos").remove(removedPaths);
    if (cleanupError) console.error("Could not remove replaced transaction photos from private storage.");
  }

  return privateJson({ transaction: presentTransaction(data) });
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!isSameOriginMutation(request)) return privateJson({ error: "Impossible de vérifier cette requête." }, 403);
  const authenticated = await getAuthenticatedSupabase();
  if (!authenticated) return privateJson({ error: "Connectez-vous pour gérer les transactions." }, 401);

  const { id } = await context.params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return privateJson({ error: "Transaction introuvable." }, 404);
  }

  const serviceSupabase = createSupabaseServiceClient();
  if (!serviceSupabase) return privateJson({ error: "L’enregistrement des transactions n’est pas configuré sur le serveur." }, 503);
  const { data: linkedSale, error: linkedSaleError } = await serviceSupabase
    .from("phone_transactions")
    .select("id")
    .eq("user_id", authenticated.user.id)
    .eq("sold_from_transaction_id", id)
    .maybeSingle();
  if (linkedSaleError) return privateJson({ error: "Impossible de vérifier cette transaction." }, 500);
  if (linkedSale) return privateJson({ error: "Supprimez d’abord la vente associée à cet achat." }, 409);

  const { data: transaction, error: selectError } = await authenticated.supabase
    .from("phone_transactions")
    .select("phone_photos,id_front_path,id_back_path")
    .eq("id", id)
    .maybeSingle();

  if (selectError) return privateJson({ error: "Impossible de supprimer la transaction." }, 500);
  if (!transaction) return privateJson({ error: "Transaction introuvable." }, 404);

  const paths = [
    ...transaction.phone_photos,
    transaction.id_front_path,
    transaction.id_back_path,
  ].filter((path): path is string => Boolean(path));
  if (paths.length) {
    const { error: storageError } = await authenticated.supabase.storage.from("transaction-photos").remove(paths);
    if (storageError) return privateJson({ error: "Impossible de supprimer les photos jointes. Réessayez." }, 500);
  }

  const { error: deleteError } = await authenticated.supabase
    .from("phone_transactions")
    .delete()
    .eq("id", id);

  if (deleteError) return privateJson({ error: "Impossible de supprimer la transaction." }, 500);

  return privateJson({ ok: true });
}

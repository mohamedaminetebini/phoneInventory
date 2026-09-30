import { NextResponse } from "next/server";
import { getIPhoneById } from "@catalog/iphones";
import { privateJson, isSameOriginMutation } from "@/lib/api-response";
import { getAuthenticatedSupabase } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { createTransactionSchema, presentTransaction, toTransactionInsert, validateTransactionPhotoPaths } from "@/lib/transaction-schema";
import type { CreateTransactionPayload } from "@/domain/transactions";

export const dynamic = "force-dynamic";

const transactionColumns = "id,direction,model_id,phone_model,phone_color,amount,currency,date,phone_photos,id_front_path,id_back_path,notes,created_at";
const maxRequestBytes = 32_000;

async function parseJsonBody(request: Request): Promise<
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
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return { kind: "ok", value: JSON.parse(text) as unknown };
  } catch {
    return { kind: "invalid" };
  } finally {
    reader.releaseLock();
  }
}

export async function GET() {
  const authenticated = await getAuthenticatedSupabase();
  if (!authenticated) return privateJson({ error: "Connectez-vous pour accéder à votre inventaire." }, 401);

  const { data, error } = await authenticated.supabase
    .from("phone_transactions")
    .select(transactionColumns)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error || !data) return privateJson({ error: "Impossible de charger votre inventaire." }, 500);
  return privateJson({ transactions: data.map((row) => presentTransaction(row)) });
}

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) return privateJson({ error: "Impossible de vérifier cette requête." }, 403);
  const contentLength = request.headers.get("content-length");
  if (contentLength && (!/^\d+$/.test(contentLength) || Number(contentLength) > maxRequestBytes)) {
    return privateJson({ error: "Les informations de la transaction sont trop volumineuses." }, 413);
  }
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    return privateJson({ error: "Les informations de la transaction doivent être envoyées au format JSON." }, 415);
  }

  const authenticated = await getAuthenticatedSupabase();
  if (!authenticated) return privateJson({ error: "Connectez-vous pour enregistrer une transaction." }, 401);

  const parsedBody = await parseJsonBody(request);
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

  if (!validateTransactionPhotoPaths(parsed.data, authenticated.user.id)) {
    return privateJson({ error: "Impossible de vérifier les photos jointes." }, 400);
  }

  const model = getIPhoneById(parsed.data.modelId);
  if (!model) return privateJson({ error: "Choisissez un modèle d’iPhone dans le catalogue." }, 400);

  const serviceSupabase = createSupabaseServiceClient();
  if (!serviceSupabase) return privateJson({ error: "Le stockage des transactions n’est pas configuré sur le serveur." }, 503);

  const payload = parsed.data as CreateTransactionPayload;
  const { data, error } = await serviceSupabase
    .from("phone_transactions")
    .insert(toTransactionInsert(payload, authenticated.user.id))
    .select(transactionColumns)
    .single();

  if (error || !data) return privateJson({ error: "Impossible d’enregistrer la transaction." }, 500);
  return privateJson({ transaction: presentTransaction(data) }, 201);
}

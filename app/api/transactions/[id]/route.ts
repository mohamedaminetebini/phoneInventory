import { privateJson, isSameOriginMutation } from "@/lib/api-response";
import { getAuthenticatedSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!isSameOriginMutation(request)) return privateJson({ error: "This request could not be verified." }, 403);
  const authenticated = await getAuthenticatedSupabase();
  if (!authenticated) return privateJson({ error: "Sign in to manage transactions." }, 401);

  const { id } = await context.params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return privateJson({ error: "Transaction not found." }, 404);
  }

  const { data: transaction, error: selectError } = await authenticated.supabase
    .from("phone_transactions")
    .select("phone_photos,id_front_path,id_back_path")
    .eq("id", id)
    .maybeSingle();

  if (selectError) return privateJson({ error: "The transaction could not be deleted." }, 500);
  if (!transaction) return privateJson({ error: "Transaction not found." }, 404);

  const paths = [
    ...transaction.phone_photos,
    transaction.id_front_path,
    transaction.id_back_path,
  ];
  if (paths.length) {
    const { error: storageError } = await authenticated.supabase.storage.from("transaction-photos").remove(paths);
    if (storageError) return privateJson({ error: "The attached photos could not be deleted. Try again." }, 500);
  }

  const { error: deleteError } = await authenticated.supabase
    .from("phone_transactions")
    .delete()
    .eq("id", id);

  if (deleteError) return privateJson({ error: "The transaction could not be deleted." }, 500);

  return privateJson({ ok: true });
}

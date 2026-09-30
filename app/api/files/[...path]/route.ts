import { getAuthenticatedSupabase } from "@/lib/supabase/server";
import { PHOTO_BUCKET } from "@/lib/supabase/config";
import { privateJson } from "@/lib/api-response";

export const dynamic = "force-dynamic";

const allowedPath = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\/(?:phone-[1-5]|id-front|id-back)\.jpg$/i;

export async function GET(_request: Request, context: { params: Promise<{ path: string[] }> }) {
  const authenticated = await getAuthenticatedSupabase();
  if (!authenticated) return privateJson({ error: "Connectez-vous pour afficher cette photo." }, 401);

  const { path: segments } = await context.params;
  const path = segments.join("/");
  if (!allowedPath.test(path) || !path.startsWith(`${authenticated.user.id}/`)) {
    return privateJson({ error: "Photo introuvable." }, 404);
  }

  const { data, error } = await authenticated.supabase.storage.from(PHOTO_BUCKET).download(path);
  if (error || !data || data.type !== "image/jpeg") return privateJson({ error: "Photo introuvable." }, 404);

  return new Response(data, {
    headers: {
      "Content-Type": "image/jpeg",
      "Content-Length": String(data.size),
      "Content-Disposition": "inline; filename=\"transaction-photo.jpg\"",
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

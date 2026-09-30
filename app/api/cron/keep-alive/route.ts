import { timingSafeEqual } from "node:crypto";
import { privateJson } from "@/lib/api-response";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function hasValidCronAuthorization(request: Request, secret: string): boolean {
  const provided = Buffer.from(request.headers.get("authorization") ?? "", "utf8");
  const expected = Buffer.from(`Bearer ${secret}`, "utf8");

  return provided.length === expected.length && timingSafeEqual(provided, expected);
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (!cronSecret || !hasValidCronAuthorization(request, cronSecret)) {
    return privateJson({ error: "Unauthorized." }, 401);
  }

  const supabase = createSupabaseServiceClient();
  if (!supabase) {
    return privateJson({ error: "The database check is not configured." }, 503);
  }

  const { error } = await supabase
    .from("phone_transactions")
    .select("id")
    .limit(1);

  if (error) {
    return privateJson({ error: "The database check failed." }, 503);
  }

  return privateJson({ ok: true });
}

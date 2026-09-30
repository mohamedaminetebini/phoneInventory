import App from "../src/App";
import { AuthPanel } from "../src/components/AuthPanel";
import { SupabaseSetup } from "../src/components/SupabaseSetup";
import { createSupabaseServerClient } from "../src/lib/supabase/server";
import { isSupabaseServiceConfigured } from "../src/lib/supabase/service";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const supabase = await createSupabaseServerClient();
  if (!supabase || !isSupabaseServiceConfigured()) return <SupabaseSetup />;

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error && error.name !== "AuthSessionMissingError") {
    return <AuthPanel initialError="Supabase could not verify your session. Check the project URL and publishable key, then reload." />;
  }
  if (!user) return <AuthPanel />;
  return <App />;
}

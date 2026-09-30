import { Smartphone } from "lucide-react";

export function SupabaseSetup() {
  return (
    <main className="auth-page">
      <section className="auth-panel setup-panel" aria-labelledby="setup-title">
        <span className="brand auth-brand">
          <span className="brand-mark"><Smartphone size={17} aria-hidden="true" /></span>
          <span>Phone Inventory</span>
        </span>
        <h1 id="setup-title">Connect your database</h1>
        <p className="auth-description">Add your Supabase project values to enable sign-in and private transaction storage.</p>
        <div className="setup-values">
          <div><code>NEXT_PUBLIC_SUPABASE_URL</code><span>Project URL</span></div>
          <div><code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code><span>Publishable key</span></div>
          <div><code>SUPABASE_SERVICE_ROLE_KEY</code><span>Server-only secret · never expose in browser code</span></div>
        </div>
        <p className="setup-note">Put these in <code>.env.local</code> for local development or the Vercel project environment settings after importing the SQL setup from <code>supabase/migrations</code>. Never add <code>SUPABASE_SERVICE_ROLE_KEY</code> to a <code>NEXT_PUBLIC_</code> variable.</p>
      </section>
    </main>
  );
}

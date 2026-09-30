import { Smartphone } from "lucide-react";

export function SupabaseSetup() {
  return (
    <main className="auth-page">
      <section className="auth-panel setup-panel" aria-labelledby="setup-title">
        <span className="brand auth-brand">
          <span className="brand-mark"><Smartphone size={17} aria-hidden="true" /></span>
          <span>Inventaire iPhone</span>
        </span>
        <h1 id="setup-title">Connecter votre base de données</h1>
        <p className="auth-description">Ajoutez les paramètres de votre projet Supabase pour activer la connexion et le stockage privé des transactions.</p>
        <div className="setup-values">
          <div><code>NEXT_PUBLIC_SUPABASE_URL</code><span>URL du projet</span></div>
          <div><code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code><span>Clé publiable</span></div>
          <div><code>SUPABASE_SERVICE_ROLE_KEY</code><span>Clé secrète réservée au serveur · ne jamais l’exposer dans le navigateur</span></div>
        </div>
        <p className="setup-note">Ajoutez ces variables dans <code>.env.local</code> pour le développement local ou dans les paramètres d’environnement du projet Vercel. Exécutez d’abord le script SQL de <code>supabase/migrations</code>. N’ajoutez jamais <code>SUPABASE_SERVICE_ROLE_KEY</code> à une variable commençant par <code>NEXT_PUBLIC_</code>.</p>
      </section>
    </main>
  );
}

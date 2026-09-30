"use client";

import { useState, type FormEvent } from "react";
import { Smartphone } from "lucide-react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function AuthPanel({ initialError = "" }: { initialError?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(initialError);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setError("Supabase n’est pas encore configuré. Ajoutez les paramètres publics du projet, puis rechargez la page.");
      return;
    }

    setBusy(true);
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) throw new Error("L’adresse e-mail ou le mot de passe est incorrect.");
      router.refresh();
    } catch {
      setError("La connexion a échoué. Vérifiez vos identifiants et réessayez.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-panel" aria-labelledby="auth-title">
        <a className="brand auth-brand" href="/">
          <span className="brand-mark"><Smartphone size={17} aria-hidden="true" /></span>
          <span>Inventaire iPhone</span>
        </a>
        <h1 id="auth-title">Se connecter</h1>
        <p className="auth-description">Accédez à votre inventaire privé et aux photos de vos transactions.</p>

        <form className="auth-form" onSubmit={submit}>
          <label className="form-field">
            <span className="field-label">Adresse e-mail</span>
            <input autoComplete="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </label>
          <label className="form-field">
            <span className="field-label">Mot de passe</span>
            <input autoComplete="current-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
          </label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="button button-primary auth-submit" type="submit" disabled={busy}>
            {busy ? "Veuillez patienter…" : "Se connecter"}
          </button>
        </form>
      </section>
    </main>
  );
}

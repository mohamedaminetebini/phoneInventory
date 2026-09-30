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
      setError("Supabase is not configured yet. Add the public project values and reload.");
      return;
    }

    setBusy(true);
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) throw new Error("Email or password is incorrect.");
      router.refresh();
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : "Sign-in could not be completed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-panel" aria-labelledby="auth-title">
        <a className="brand auth-brand" href="/">
          <span className="brand-mark"><Smartphone size={17} aria-hidden="true" /></span>
          <span>Phone Inventory</span>
        </a>
        <h1 id="auth-title">Sign in</h1>
        <p className="auth-description">Access your private inventory and transaction photos.</p>

        <form className="auth-form" onSubmit={submit}>
          <label className="form-field">
            <span className="field-label">Email</span>
            <input autoComplete="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </label>
          <label className="form-field">
            <span className="field-label">Password</span>
            <input autoComplete="current-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
          </label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="button button-primary auth-submit" type="submit" disabled={busy}>
            {busy ? "Please wait…" : "Sign in"}
          </button>
        </form>
      </section>
    </main>
  );
}

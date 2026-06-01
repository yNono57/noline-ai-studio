"use client";

import { useEffect, useState } from "react";
import { Lock, Mail, UserPlus } from "lucide-react";
import {
  getStoredSession,
  isSupabaseBrowserConfigured,
  signInWithEmail,
  signOutLocal,
  signUpWithEmail
} from "@/lib/supabase-client";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionEmail, setSessionEmail] = useState("");

  useEffect(() => {
    setSessionEmail(getStoredSession()?.user.email || "");
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const session =
        mode === "signin"
          ? await signInWithEmail(email, password)
          : await signUpWithEmail(email, password);

      setSessionEmail(session?.user.email || email);
      setMessage(mode === "signin" ? "Connexion reussie." : "Compte cree. Verifiez vos e-mails si la confirmation est active.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Authentification impossible.");
    } finally {
      setLoading(false);
    }
  }

  function signOut() {
    signOutLocal();
    setSessionEmail("");
    setMessage("Vous etes deconnecte.");
  }

  return (
    <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[0.9fr_1.1fr]">
      <section className="surface premium-border rounded-lg p-6 shadow-premium">
        <p className="text-sm font-black uppercase tracking-[0.24em] text-noline-orange">
          Authentification
        </p>
        <h1 className="mt-2 text-3xl font-black text-white sm:text-4xl">Espace utilisateur</h1>
        <p className="mt-3 text-sm leading-6 text-noline-muted">
          Connectez-vous pour sauvegarder automatiquement vos creations et appliquer le quota
          mensuel.
        </p>

        {!isSupabaseBrowserConfigured() ? (
          <div className="mt-5 rounded-md border border-noline-orange/40 bg-noline-orange/10 p-4 text-sm text-white">
            Supabase n'est pas encore configure. Ajoutez les variables dans `.env.local` pour activer
            l'authentification.
          </div>
        ) : null}

        {sessionEmail ? (
          <div className="mt-6 rounded-md border border-white/10 bg-noline-black p-4">
            <p className="text-sm font-bold text-white">Connecte avec {sessionEmail}</p>
            <button
              type="button"
              onClick={signOut}
              className="mt-4 rounded-md border border-white/12 px-4 py-2 text-sm font-black text-white transition hover:bg-white hover:text-noline-black"
            >
              Deconnexion
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-white">Email</span>
              <span className="flex items-center gap-3 rounded-md border border-white/10 bg-noline-black px-4 py-3 focus-within:border-noline-orange">
                <Mail className="h-4 w-4 text-noline-muted" />
                <input
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  type="email"
                  required
                  placeholder="contact@club.fr"
                  className="w-full bg-transparent text-sm text-white outline-none placeholder:text-noline-muted"
                />
              </span>
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-white">Mot de passe</span>
              <span className="flex items-center gap-3 rounded-md border border-white/10 bg-noline-black px-4 py-3 focus-within:border-noline-orange">
                <Lock className="h-4 w-4 text-noline-muted" />
                <input
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  type="password"
                  required
                  minLength={6}
                  placeholder="Minimum 6 caracteres"
                  className="w-full bg-transparent text-sm text-white outline-none placeholder:text-noline-muted"
                />
              </span>
            </label>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setMode("signin")}
                className={`rounded-md px-4 py-2 text-sm font-black ${
                  mode === "signin" ? "bg-white text-noline-black" : "bg-white/5 text-white"
                }`}
              >
                Connexion
              </button>
              <button
                type="button"
                onClick={() => setMode("signup")}
                className={`rounded-md px-4 py-2 text-sm font-black ${
                  mode === "signup" ? "bg-white text-noline-black" : "bg-white/5 text-white"
                }`}
              >
                Inscription
              </button>
            </div>

            {error ? <p className="rounded-md bg-red-500/10 p-3 text-sm text-red-100">{error}</p> : null}
            {message ? <p className="rounded-md bg-noline-orange/10 p-3 text-sm text-white">{message}</p> : null}

            <button
              type="submit"
              disabled={loading || !isSupabaseBrowserConfigured()}
              className="flex w-full items-center justify-center gap-2 rounded-md bg-noline-orange px-5 py-3 text-sm font-black text-noline-black transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {mode === "signin" ? <Lock className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
              {loading ? "Veuillez patienter..." : mode === "signin" ? "Se connecter" : "Creer un compte"}
            </button>
          </form>
        )}
      </section>

      <section className="surface premium-border rounded-lg p-6 shadow-premium">
        <h2 className="text-xl font-black text-white">Quota mensuel</h2>
        <div className="mt-5 grid gap-4">
          <div className="rounded-lg border border-white/10 bg-noline-black p-5">
            <p className="text-sm font-black text-white">Gratuit</p>
            <p className="mt-2 text-3xl font-black text-white">5 generations/mois</p>
            <p className="mt-3 text-sm leading-6 text-noline-muted">
              Le compteur est applique par utilisateur connecte via Supabase.
            </p>
          </div>
          <div className="rounded-lg border border-noline-orange bg-noline-orange p-5 text-noline-black">
            <p className="text-sm font-black">Starter / Pro</p>
            <p className="mt-2 text-3xl font-black">19 EUR / 49 EUR</p>
            <p className="mt-3 text-sm leading-6 text-noline-black/75">
              Les plans sont stockes dans la table `subscriptions`.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

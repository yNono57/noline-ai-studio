"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Lock } from "lucide-react";
import { getRecoverySession, onPasswordRecovery, signOutLocal, updatePassword } from "@/lib/supabase-client";

export function ResetPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const unsubscribe = onPasswordRecovery((session) => { if (active) { setReady(Boolean(session)); setLoading(false); } });
    void getRecoverySession().then((session) => { if (active) { setReady(Boolean(session)); setLoading(false); } }).catch(() => { if (active) { setError("Ce lien de récupération est invalide ou a expiré."); setLoading(false); } });
    return () => { active = false; unsubscribe(); };
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    if (password !== confirmation) { setError("Les mots de passe ne correspondent pas."); return; }
    setLoading(true);
    try {
      await updatePassword(password);
      await signOutLocal();
      router.replace("/login?passwordUpdated=1");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Impossible de mettre à jour le mot de passe.");
      setLoading(false);
    }
  }

  return (
    <section className="surface premium-border mx-auto max-w-lg rounded-lg p-6 shadow-premium">
      <KeyRound className="h-7 w-7 text-noline-orange" />
      <h1 className="mt-3 text-3xl font-black text-white">Nouveau mot de passe</h1>
      <p className="mt-3 text-sm leading-6 text-noline-muted">Choisissez un nouveau mot de passe pour votre compte NØLINE.</p>
      {loading ? <p className="mt-6 text-sm text-white">Vérification du lien…</p> : null}
      {!loading && !ready ? <p className="mt-6 rounded-md bg-red-500/10 p-3 text-sm text-red-100">{error || "Ce lien de récupération est invalide ou a expiré. Demandez un nouveau lien depuis la page de connexion."}</p> : null}
      {ready ? <form onSubmit={submit} className="mt-6 space-y-4">
        <PasswordField label="Nouveau mot de passe" value={password} onChange={setPassword} />
        <PasswordField label="Confirmer le mot de passe" value={confirmation} onChange={setConfirmation} />
        {error ? <p className="rounded-md bg-red-500/10 p-3 text-sm text-red-100">{error}</p> : null}
        <button type="submit" disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-md bg-noline-orange px-5 py-3 text-sm font-black text-noline-black transition hover:bg-white disabled:opacity-60"><Lock className="h-4 w-4" />{loading ? "Mise à jour…" : "Définir le mot de passe"}</button>
      </form> : null}
    </section>
  );
}

function PasswordField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="block"><span className="mb-2 block text-sm font-bold text-white">{label}</span><span className="flex items-center gap-3 rounded-md border border-white/10 bg-noline-black px-4 py-3 focus-within:border-noline-orange"><Lock className="h-4 w-4 text-noline-muted" /><input value={value} onChange={(event) => onChange(event.target.value)} type="password" required minLength={6} autoComplete="new-password" className="w-full bg-transparent text-sm text-white outline-none" /></span></label>;
}

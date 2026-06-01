"use client";

import { useEffect, useState } from "react";
import { CreditCard, LogOut, UserRound } from "lucide-react";
import { getAuthHeaders, getStoredSession, signOutLocal } from "@/lib/supabase-client";
import { StripePortalButton } from "./StripeButtons";

type AccountData = {
  user?: { email?: string };
  quota?: { used: number; limit: number; plan: string };
  subscription?: { plan?: string; status?: string };
};

export function SettingsView() {
  const [account, setAccount] = useState<AccountData | null>(null);
  const [email, setEmail] = useState("");

  useEffect(() => {
    setEmail(getStoredSession()?.user.email || "");
    fetch("/api/account", { headers: getAuthHeaders() })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => setAccount(data))
      .catch(() => setAccount(null));
  }, []);

  function logout() {
    signOutLocal();
    setEmail("");
    setAccount(null);
  }

  return (
    <section className="max-w-4xl">
      <p className="text-sm font-black uppercase tracking-[0.24em] text-noline-orange">
        Parametres
      </p>
      <h1 className="mt-2 text-3xl font-black text-white sm:text-4xl">Compte et abonnement</h1>
      <div className="mt-8 grid gap-4">
        <div className="surface premium-border rounded-lg p-5">
          <div className="flex items-center gap-3">
            <UserRound className="h-5 w-5 text-noline-orange" />
            <h2 className="text-lg font-black text-white">Profil utilisateur</h2>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <input
              placeholder="Nom"
              className="rounded-md border border-white/10 bg-noline-black px-4 py-3 text-sm text-white outline-none focus:border-noline-orange"
            />
            <input
              value={account?.user?.email || email}
              readOnly
              placeholder="Email"
              className="rounded-md border border-white/10 bg-noline-black px-4 py-3 text-sm text-white outline-none"
            />
          </div>
        </div>
        <div className="surface premium-border rounded-lg p-5">
          <div className="flex items-center gap-3">
            <CreditCard className="h-5 w-5 text-noline-orange" />
            <h2 className="text-lg font-black text-white">Gestion abonnement</h2>
          </div>
          <p className="mt-3 text-sm text-noline-muted">
            Plan actuel: {(account?.subscription?.plan || account?.quota?.plan || "free").toUpperCase()}.
            Quota: {account?.quota?.used || 0}/{account?.quota?.limit || 5}.
          </p>
          <StripePortalButton />
        </div>
        <button
          type="button"
          onClick={logout}
          className="inline-flex w-fit items-center gap-2 rounded-md border border-white/12 px-5 py-3 text-sm font-black text-white transition hover:bg-white hover:text-noline-black"
        >
          <LogOut className="h-4 w-4" />
          Deconnexion
        </button>
      </div>
    </section>
  );
}

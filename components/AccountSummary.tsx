"use client";

import { useEffect, useState } from "react";
import { CreditCard, Gauge, UserRound } from "lucide-react";
import { getAuthHeaders, getStoredSession, isSupabaseBrowserConfigured } from "@/lib/supabase-client";

type AccountData = {
  user?: { email?: string };
  quota?: { used: number; limit: number; plan: string; month: string };
  subscription?: { plan?: string; status?: string };
};

export function AccountSummary() {
  const [data, setData] = useState<AccountData | null>(null);
  const [localEmail, setLocalEmail] = useState("");

  useEffect(() => {
    setLocalEmail(getStoredSession()?.user.email || "");

    if (!isSupabaseBrowserConfigured()) return;

    fetch("/api/account", { headers: getAuthHeaders() })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => setData(payload))
      .catch(() => setData(null));
  }, []);

  const used = data?.quota?.used ?? 0;
  const limit = data?.quota?.limit ?? 5;
  const progress = Math.min(100, Math.round((used / limit) * 100));

  return (
    <section className="grid gap-4 lg:grid-cols-3">
      <div className="surface premium-border rounded-lg p-5">
        <UserRound className="h-5 w-5 text-noline-orange" />
        <p className="mt-4 text-sm font-bold text-noline-muted">Utilisateur</p>
        <p className="mt-1 text-lg font-black text-white">
          {data?.user?.email || localEmail || "Non connecte"}
        </p>
      </div>
      <div className="surface premium-border rounded-lg p-5">
        <Gauge className="h-5 w-5 text-noline-orange" />
        <p className="mt-4 text-sm font-bold text-noline-muted">Quota mensuel</p>
        <p className="mt-1 text-lg font-black text-white">
          {used}/{limit} generations
        </p>
        <div className="mt-3 h-2 rounded-full bg-white/10">
          <div className="h-2 rounded-full bg-noline-orange" style={{ width: `${progress}%` }} />
        </div>
      </div>
      <div className="surface premium-border rounded-lg p-5">
        <CreditCard className="h-5 w-5 text-noline-orange" />
        <p className="mt-4 text-sm font-bold text-noline-muted">Abonnement</p>
        <p className="mt-1 text-lg font-black text-white">
          {(data?.subscription?.plan || data?.quota?.plan || "free").toUpperCase()}
        </p>
      </div>
    </section>
  );
}

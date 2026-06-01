"use client";

import { useState } from "react";
import { CreditCard, Loader2 } from "lucide-react";
import { getAuthHeaders } from "@/lib/supabase-client";

type StripeButtonsProps = {
  plan: "starter" | "pro";
  label?: string;
  variant?: "dark" | "orange";
};

export function StripeCheckoutButton({ plan, label, variant = "dark" }: StripeButtonsProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function checkout() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders()
        },
        body: JSON.stringify({ plan })
      });
      const data = (await response.json()) as { url?: string; error?: string };

      if (!response.ok || !data.url) {
        throw new Error(data.error || "Paiement indisponible.");
      }

      window.location.href = data.url;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Paiement indisponible.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={checkout}
        disabled={loading}
        className={`mt-6 inline-flex w-full items-center justify-center gap-2 rounded-md px-4 py-3 text-sm font-black transition disabled:cursor-wait disabled:opacity-70 ${
          variant === "orange"
            ? "bg-noline-black text-white hover:bg-white hover:text-noline-black"
            : "bg-noline-orange text-noline-black hover:bg-white"
        }`}
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
        {label || `Choisir ${plan}`}
      </button>
      {error ? <p className="mt-3 text-xs font-bold text-red-200">{error}</p> : null}
    </div>
  );
}

export function StripePortalButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function openPortal() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/stripe/portal", {
        method: "POST",
        headers: getAuthHeaders()
      });
      const data = (await response.json()) as { url?: string; error?: string };

      if (!response.ok || !data.url) {
        throw new Error(data.error || "Portail Stripe indisponible.");
      }

      window.location.href = data.url;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Portail Stripe indisponible.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={openPortal}
        disabled={loading}
        className="mt-4 inline-flex items-center gap-2 rounded-md bg-noline-orange px-4 py-2 text-sm font-black text-noline-black transition hover:bg-white disabled:cursor-wait disabled:opacity-70"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
        Gerer mon abonnement
      </button>
      {error ? <p className="mt-3 text-xs font-bold text-red-200">{error}</p> : null}
    </div>
  );
}

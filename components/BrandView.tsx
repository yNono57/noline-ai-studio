"use client";

import { useEffect, useState } from "react";
import { ImagePlus, Save } from "lucide-react";
import { defaultBrand, readBrand, saveBrand, type ClientBrand } from "@/lib/brand";
import { getAuthHeaders, isSupabaseBrowserConfigured } from "@/lib/supabase-client";

export function BrandView() {
  const [brand, setBrand] = useState<ClientBrand>(defaultBrand);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!isSupabaseBrowserConfigured()) {
      setBrand(readBrand());
      return;
    }

    fetch("/api/brand", { headers: getAuthHeaders() })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!data?.brand) {
          setBrand(readBrand());
          return;
        }

        setBrand({
          structureName: data.brand.structure_name || "",
          logo: data.brand.logo || "",
          primaryColor: data.brand.primary_color || "#FF6B00",
          secondaryColor: data.brand.secondary_color || "#FFFFFF",
          typography: data.brand.typography || "Arial",
          socials: data.brand.socials || "",
          email: data.brand.email || "",
          website: data.brand.website || ""
        });
      })
      .catch(() => setBrand(readBrand()));
  }, []);

  function update<K extends keyof ClientBrand>(key: K, value: ClientBrand[K]) {
    setBrand((current) => ({ ...current, [key]: value }));
    setSaved(false);
  }

  function uploadLogo(file: File | undefined) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => update("logo", String(reader.result || ""));
    reader.readAsDataURL(file);
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSupabaseBrowserConfigured()) {
      fetch("/api/brand", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders()
        },
        body: JSON.stringify(brand)
      }).catch(() => saveBrand(brand));
    } else {
      saveBrand(brand);
    }
    setSaved(true);
  }

  return (
    <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
      <form onSubmit={submit} className="surface premium-border rounded-lg p-5 shadow-premium">
        <p className="text-sm font-black uppercase tracking-[0.24em] text-noline-orange">
          Marque client
        </p>
        <h1 className="mt-2 text-3xl font-black text-white">Identite sauvegardee</h1>
        <div className="mt-6 grid gap-4">
          <Field label="Nom de la structure" value={brand.structureName} onChange={(value) => update("structureName", value)} placeholder="Ex. AS Montreuil" />
          <label className="block">
            <span className="mb-2 block text-sm font-bold text-white">Logo</span>
            <input
              type="file"
              accept="image/*"
              onChange={(event) => uploadLogo(event.target.files?.[0])}
              className="w-full rounded-md border border-white/10 bg-noline-black px-3 py-2 text-sm text-white file:mr-3 file:rounded-md file:border-0 file:bg-noline-orange file:px-3 file:py-2 file:text-xs file:font-black file:text-noline-black"
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <Color label="Couleur principale" value={brand.primaryColor} onChange={(value) => update("primaryColor", value)} />
            <Color label="Couleur secondaire" value={brand.secondaryColor} onChange={(value) => update("secondaryColor", value)} />
          </div>
          <Field label="Typographie" value={brand.typography} onChange={(value) => update("typography", value)} placeholder="Ex. Inter, Montserrat, Arial" />
          <Field label="Reseaux sociaux" value={brand.socials} onChange={(value) => update("socials", value)} placeholder="@club, facebook.com/club" />
          <Field label="Adresse e-mail" value={brand.email} onChange={(value) => update("email", value)} placeholder="contact@club.fr" />
          <Field label="Site web" value={brand.website} onChange={(value) => update("website", value)} placeholder="https://club.fr" />
        </div>
        <button className="mt-5 inline-flex items-center gap-2 rounded-md bg-noline-orange px-5 py-3 text-sm font-black text-noline-black transition hover:bg-white">
          <Save className="h-4 w-4" />
          Enregistrer la marque
        </button>
        {saved ? <p className="mt-3 text-sm font-bold text-noline-orange">Marque sauvegardee.</p> : null}
      </form>

      <aside className="surface premium-border rounded-lg p-5 shadow-premium">
        <p className="text-sm font-black text-white">Apercu</p>
        <div className="mt-5 rounded-lg border border-white/10 bg-noline-black p-5">
          <div className="flex items-center gap-4">
            <div className="grid h-20 w-20 place-items-center rounded-md bg-white">
              {brand.logo ? (
                <img src={brand.logo} alt="" className="max-h-16 max-w-16 object-contain" />
              ) : (
                <ImagePlus className="h-7 w-7 text-noline-black" />
              )}
            </div>
            <div>
              <h2 className="text-2xl font-black text-white">{brand.structureName || "Nom client"}</h2>
              <p className="mt-1 text-sm text-noline-muted">{brand.website || "site-web.fr"}</p>
            </div>
          </div>
          <div className="mt-6 flex gap-3">
            <span className="h-10 flex-1 rounded-md" style={{ background: brand.primaryColor }} />
            <span className="h-10 flex-1 rounded-md border border-white/10" style={{ background: brand.secondaryColor }} />
          </div>
          <p className="mt-5 text-sm leading-6 text-noline-muted">
            {brand.socials || "Reseaux sociaux"} - {brand.email || "contact@client.fr"}
          </p>
        </div>
      </aside>
    </section>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-white">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-md border border-white/10 bg-noline-black px-4 py-3 text-sm text-white outline-none placeholder:text-noline-muted focus:border-noline-orange"
      />
    </label>
  );
}

function Color({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-white">{label}</span>
      <input type="color" value={value} onChange={(event) => onChange(event.target.value)} className="h-12 w-full rounded-md border border-white/10 bg-noline-black p-1" />
    </label>
  );
}

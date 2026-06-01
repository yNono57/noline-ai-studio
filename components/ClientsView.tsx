"use client";

import { useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import {
  deleteClient,
  emptyAgencyClient,
  readClients,
  setActiveClientId,
  upsertClient,
  type AgencyClient
} from "@/lib/agency";
import { readVisualHistory } from "@/lib/visual-history";
import { readHistory } from "@/lib/history";

type ClientForm = Omit<AgencyClient, "id" | "createdAt" | "updatedAt">;

export function ClientsView() {
  const [clients, setClients] = useState<AgencyClient[]>([]);
  const [form, setForm] = useState<ClientForm>(emptyAgencyClient);
  const [editingId, setEditingId] = useState("");
  const [activeId, setActiveId] = useState("");

  useEffect(() => setClients(readClients()), []);

  function update<K extends keyof ClientForm>(key: K, value: ClientForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function uploadLogo(file: File | undefined) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => update("logo", String(reader.result || ""));
    reader.readAsDataURL(file);
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const now = new Date().toISOString();
    const existing = clients.find((client) => client.id === editingId);
    const client: AgencyClient = {
      ...form,
      id: editingId || crypto.randomUUID(),
      createdAt: existing?.createdAt || now,
      updatedAt: now
    };
    const next = upsertClient(client);
    setClients(next);
    setActiveClientId(client.id);
    setActiveId(client.id);
    setForm(emptyAgencyClient);
    setEditingId("");
  }

  function edit(client: AgencyClient) {
    setEditingId(client.id);
    setForm({
      name: client.name,
      sector: client.sector,
      logo: client.logo,
      primaryColor: client.primaryColor,
      secondaryColor: client.secondaryColor,
      socials: client.socials,
      email: client.email,
      website: client.website,
      notes: client.notes
    });
  }

  function remove(id: string) {
    setClients(deleteClient(id));
  }

  function activate(id: string) {
    setActiveClientId(id);
    setActiveId(id);
  }

  return (
    <section className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
      <form onSubmit={submit} className="surface premium-border rounded-lg p-5 shadow-premium">
        <p className="text-sm font-black uppercase tracking-[0.24em] text-noline-orange">Clients</p>
        <h1 className="mt-2 text-3xl font-black text-white">Mode agence</h1>
        <div className="mt-6 grid gap-4">
          <Field label="Nom client" value={form.name} onChange={(value) => update("name", value)} placeholder="Ex. AS Montreuil" required />
          <label className="block">
            <span className="mb-2 block text-sm font-bold text-white">Secteur</span>
            <select value={form.sector} onChange={(event) => update("sector", event.target.value)} className="w-full rounded-md border border-white/10 bg-noline-black px-4 py-3 text-sm text-white outline-none focus:border-noline-orange">
              {["Club sportif", "Association", "Commerce local", "Restaurant", "Salon de coiffure / beaute", "Mariage / evenementiel", "Formation / securite"].map((sector) => (
                <option key={sector}>{sector}</option>
              ))}
            </select>
          </label>
          <input type="file" accept="image/*" onChange={(event) => uploadLogo(event.target.files?.[0])} className="rounded-md border border-white/10 bg-noline-black px-3 py-2 text-sm text-white file:mr-3 file:rounded-md file:border-0 file:bg-noline-orange file:px-3 file:py-2 file:text-xs file:font-black file:text-noline-black" />
          <div className="grid gap-3 sm:grid-cols-2">
            <Color label="Couleur 1" value={form.primaryColor} onChange={(value) => update("primaryColor", value)} />
            <Color label="Couleur 2" value={form.secondaryColor} onChange={(value) => update("secondaryColor", value)} />
          </div>
          <Field label="Reseaux sociaux" value={form.socials} onChange={(value) => update("socials", value)} placeholder="@client, facebook.com/client" />
          <Field label="E-mail" value={form.email} onChange={(value) => update("email", value)} placeholder="contact@client.fr" />
          <Field label="Site web" value={form.website} onChange={(value) => update("website", value)} placeholder="https://client.fr" />
          <TextArea label="Notes" value={form.notes} onChange={(value) => update("notes", value)} placeholder="Contexte, offres, objectifs..." />
        </div>
        <button className="mt-5 inline-flex items-center gap-2 rounded-md bg-noline-orange px-5 py-3 text-sm font-black text-noline-black hover:bg-white">
          <Plus className="h-4 w-4" />
          {editingId ? "Enregistrer" : "Ajouter le client"}
        </button>
      </form>

      <div className="surface premium-border rounded-lg p-5 shadow-premium">
        <h2 className="text-xl font-black text-white">Portefeuille clients</h2>
        <div className="mt-5 grid gap-3">
          {clients.length === 0 ? <p className="rounded-md bg-noline-black p-5 text-sm text-noline-muted">Aucun client ajoute.</p> : null}
          {clients.map((client) => (
            <article key={client.id} className="rounded-lg border border-white/10 bg-noline-black p-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                  <div className="grid h-14 w-14 place-items-center rounded-md bg-white">
                    {client.logo ? <img src={client.logo} alt="" className="max-h-11 max-w-11 object-contain" /> : <span className="text-xs font-black text-noline-black">LOGO</span>}
                  </div>
                  <div>
                    <p className="font-black text-white">{client.name}</p>
                    <p className="text-sm text-noline-muted">{client.sector}</p>
                    <p className="mt-1 text-xs text-noline-muted">
                      {countCreations(client.name)} creation(s) liee(s)
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => activate(client.id)} className={`rounded-md px-3 py-2 text-xs font-black ${activeId === client.id ? "bg-noline-orange text-noline-black" : "bg-white/10 text-white"}`}>Choisir</button>
                  <button onClick={() => edit(client)} className="grid h-9 w-9 place-items-center rounded-md border border-white/10 text-white hover:bg-white hover:text-noline-black"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => remove(client.id)} className="grid h-9 w-9 place-items-center rounded-md border border-white/10 text-white hover:bg-red-500"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function countCreations(clientName: string) {
  const textCount = readHistory().filter((item) => JSON.stringify(item.values).includes(clientName)).length;
  const visualCount = readVisualHistory().filter((item) => item.title.toLowerCase().includes(clientName.toLowerCase())).length;
  return textCount + visualCount;
}

function Field({ label, value, onChange, placeholder, required = false }: { label: string; value: string; onChange: (value: string) => void; placeholder: string; required?: boolean }) {
  return <label className="block"><span className="mb-2 block text-sm font-bold text-white">{label}</span><input required={required} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="w-full rounded-md border border-white/10 bg-noline-black px-4 py-3 text-sm text-white outline-none placeholder:text-noline-muted focus:border-noline-orange" /></label>;
}

function TextArea({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  return <label className="block"><span className="mb-2 block text-sm font-bold text-white">{label}</span><textarea rows={3} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="w-full rounded-md border border-white/10 bg-noline-black px-4 py-3 text-sm text-white outline-none placeholder:text-noline-muted focus:border-noline-orange" /></label>;
}

function Color({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="block"><span className="mb-2 block text-sm font-bold text-white">{label}</span><input type="color" value={value} onChange={(event) => onChange(event.target.value)} className="h-12 w-full rounded-md border border-white/10 bg-noline-black p-1" /></label>;
}

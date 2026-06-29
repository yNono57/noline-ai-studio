"use client";

import Link from "next/link";
import { Eye, Pencil, Plus, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { deleteClient, emptyAgencyClient, readClients, upsertClient, type AgencyClient } from "@/lib/agency";
import { readHistory } from "@/lib/history";

type Form = Omit<AgencyClient, "id" | "createdAt" | "updatedAt">;

export function ClientsPortfolioView() {
  const [clients, setClients] = useState<AgencyClient[]>([]);
  const [form, setForm] = useState<Form>(emptyAgencyClient);
  const [editing, setEditing] = useState("");
  const [open, setOpen] = useState(false);
  const [viewing, setViewing] = useState<AgencyClient | null>(null);
  useEffect(() => setClients(readClients()), []);
  const documents = readHistory().filter((item) => item.clientId).length;
  const sectors = new Set(clients.map((client) => client.sector)).size;

  function edit(client?: AgencyClient) { setEditing(client?.id || ""); setForm(client ? { ...client } : emptyAgencyClient); setOpen(true); }
  function submit(event: React.FormEvent) { event.preventDefault(); const now = new Date().toISOString(); const existing = clients.find((item) => item.id === editing); const client: AgencyClient = { ...form, id: editing || crypto.randomUUID(), createdAt: existing?.createdAt || now, updatedAt: now }; setClients(upsertClient(client)); setOpen(false); }
  function remove(client: AgencyClient) { if (confirm(`Supprimer ${client.name} ?`)) setClients(deleteClient(client.id)); }
  const update = (key: keyof Form, value: string) => setForm((current) => ({ ...current, [key]: value }));

  return <section>
    <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-black uppercase tracking-[0.24em] text-noline-orange">Portefeuille</p><h1 className="mt-2 text-4xl font-black text-white">Clients</h1><p className="mt-3 text-noline-muted">Centralisez les identités, contacts, marque, notes et documents de vos clients.</p></div><button onClick={() => edit()} className="rounded-md bg-noline-orange px-4 py-2 text-sm font-black text-black"><Plus className="mr-2 inline h-4 w-4" />Nouveau client</button></div>
    <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[["Clients",clients.length],["Secteurs",sectors],["Avec marque",clients.filter((item) => item.logo || item.slogan).length],["Documents liés",documents]].map(([label,value]) => <div key={label} className="surface premium-border rounded-xl p-5"><p className="text-sm text-noline-muted">{label}</p><p className="mt-2 text-3xl font-black text-white">{value}</p></div>)}</div>
    <div className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{clients.map((client) => <article key={client.id} className="surface premium-border rounded-xl p-5"><div className="flex items-center gap-4"><div className="grid h-14 w-14 place-items-center rounded-lg bg-white text-xs font-black text-black">{client.logo ? <img src={client.logo} alt="" className="max-h-12 max-w-12" /> : "LOGO"}</div><div><h2 className="font-black text-white">{client.name}</h2><p className="text-sm text-noline-muted">{client.sector}</p></div></div><div className="mt-5 flex flex-wrap gap-2"><Action onClick={() => setViewing(client)} icon={Eye} label="Voir" /><Action onClick={() => edit(client)} icon={Pencil} label="Modifier" /><Action onClick={() => remove(client)} icon={Trash2} label="Supprimer" /><Link href="/agents" className="rounded-md bg-white/8 px-3 py-2 text-xs font-black text-white">Lancer un agent</Link><Link href="/workflows" className="rounded-md bg-white/8 px-3 py-2 text-xs font-black text-white">Workflow</Link><Link href="/presentation" className="rounded-md bg-noline-orange px-3 py-2 text-xs font-black text-black">Proposition</Link></div></article>)}</div>
    {clients.length === 0 ? <div className="surface premium-border mt-7 rounded-xl p-10 text-center text-noline-muted">Ajoutez votre premier client pour centraliser sa marque et lancer des productions contextualisées.</div> : null}
    {open ? <Modal title={editing ? "Modifier le client" : "Nouveau client"} close={() => setOpen(false)}><form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">{(["name","sector","role","email","phone","website","facebook","instagram","linkedin","tiktok","slogan"] as const).map((key) => <Field key={key} label={key === "role" ? "Contact principal" : key} value={form[key]} onChange={(value) => update(key,value)} required={key === "name"} />)}<Field label="Couleur principale" type="color" value={form.primaryColor} onChange={(value) => update("primaryColor",value)} /><Field label="Couleur secondaire" type="color" value={form.secondaryColor} onChange={(value) => update("secondaryColor",value)} /><label className="sm:col-span-2"><span className="text-xs text-noline-muted">Notes</span><textarea className="field mt-1" rows={3} value={form.notes} onChange={(event) => update("notes",event.target.value)} /></label><button className="rounded-md bg-noline-orange px-4 py-3 font-black text-black sm:col-span-2">Enregistrer</button></form></Modal> : null}
    {viewing ? <Modal title={viewing.name} close={() => setViewing(null)}><div className="grid gap-4 sm:grid-cols-2"><Info label="Identité" value={`${viewing.sector} · ${viewing.role}`} /><Info label="Coordonnées" value={`${viewing.email}\n${viewing.phone}\n${viewing.website}`} /><Info label="Réseaux" value={`${viewing.facebook}\n${viewing.instagram}\n${viewing.linkedin}\n${viewing.tiktok}`} /><Info label="Marque" value={`${viewing.slogan}\n${viewing.primaryColor} · ${viewing.secondaryColor}`} /><Info label="Notes" value={viewing.notes} /><Info label="Prochaines actions" value="Lancer un agent, un workflow ou créer une proposition." /></div></Modal> : null}
  </section>;
}

function Modal({ title, close, children }: { title: string; close: () => void; children: React.ReactNode }) { return <div className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4"><div className="surface premium-border max-h-[92vh] w-full max-w-3xl overflow-auto rounded-xl p-6"><div className="mb-5 flex justify-between"><h2 className="text-2xl font-black text-white">{title}</h2><button onClick={close}><X className="text-white" /></button></div>{children}</div></div>; }
function Field({ label, value, onChange, type = "text", required = false }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean }) { return <label><span className="text-xs capitalize text-noline-muted">{label}</span><input className="field mt-1" type={type} required={required} value={value} onChange={(event) => onChange(event.target.value)} /></label>; }
function Action({ onClick, icon: Icon, label }: { onClick: () => void; icon: typeof Eye; label: string }) { return <button onClick={onClick} className="inline-flex items-center gap-1 rounded-md border border-white/10 px-3 py-2 text-xs font-black text-white"><Icon className="h-3 w-3" />{label}</button>; }
function Info({ label, value }: { label: string; value: string }) { return <div className="rounded-lg bg-black p-4"><p className="text-xs font-black uppercase text-noline-orange">{label}</p><p className="mt-2 whitespace-pre-line text-sm text-white">{value || "Non renseigné"}</p></div>; }

"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BriefcaseBusiness,
  CalendarCheck,
  Mail,
  Pencil,
  Phone,
  Plus,
  Search,
  Trash2,
  Users
} from "lucide-react";
import {
  deleteProspect,
  prospectStatuses,
  readProspects,
  upsertProspect,
  type Prospect,
  type ProspectStatus
} from "@/lib/crm";
import { StatCard } from "./StatCard";

type ProspectForm = Omit<Prospect, "id" | "createdAt" | "updatedAt">;

const emptyForm: ProspectForm = {
  company: "",
  contactName: "",
  email: "",
  phone: "",
  need: "",
  status: "Nouveau",
  value: "",
  nextAction: "",
  notes: ""
};

export function CrmView() {
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [form, setForm] = useState<ProspectForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"Tous" | ProspectStatus>("Tous");

  useEffect(() => {
    setProspects(readProspects());
  }, []);

  const filteredProspects = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return prospects.filter((prospect) => {
      const matchesStatus = statusFilter === "Tous" || prospect.status === statusFilter;
      const matchesQuery =
        !normalizedQuery ||
        [prospect.company, prospect.contactName, prospect.email, prospect.need]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);

      return matchesStatus && matchesQuery;
    });
  }, [prospects, query, statusFilter]);

  const openValue = prospects
    .filter((prospect) => prospect.status !== "Gagne" && prospect.status !== "Perdu")
    .reduce((total, prospect) => total + parsePrice(prospect.value), 0);
  const wonCount = prospects.filter((prospect) => prospect.status === "Gagne").length;
  const activeCount = prospects.filter(
    (prospect) => prospect.status !== "Gagne" && prospect.status !== "Perdu"
  ).length;

  function updateField<K extends keyof ProspectForm>(key: K, value: ProspectForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const now = new Date().toISOString();
    const existing = prospects.find((prospect) => prospect.id === editingId);
    const prospect: Prospect = {
      ...form,
      id: editingId || crypto.randomUUID(),
      createdAt: existing?.createdAt || now,
      updatedAt: now
    };

    setProspects(upsertProspect(prospect));
    resetForm();
  }

  function edit(prospect: Prospect) {
    setEditingId(prospect.id);
    setForm({
      company: prospect.company,
      contactName: prospect.contactName,
      email: prospect.email,
      phone: prospect.phone,
      need: prospect.need,
      status: prospect.status,
      value: prospect.value,
      nextAction: prospect.nextAction,
      notes: prospect.notes
    });
  }

  function remove(id: string) {
    setProspects(deleteProspect(id));
    if (editingId === id) resetForm();
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.24em] text-noline-orange">CRM</p>
          <h1 className="mt-2 text-3xl font-black text-white sm:text-4xl">Suivi des prospects</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-noline-muted">
            Centralisez les prospects, leur besoin, le statut commercial et la prochaine action.
          </p>
        </div>
        <button
          type="button"
          onClick={resetForm}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-noline-orange px-4 py-2 text-sm font-black text-noline-black transition hover:bg-white"
        >
          <Plus className="h-4 w-4" />
          Nouveau prospect
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Prospects" value={`${prospects.length}`} helper="Total enregistre" icon={Users} />
        <StatCard label="Actifs" value={`${activeCount}`} helper="Opportunites ouvertes" icon={BriefcaseBusiness} />
        <StatCard label="Gagnes" value={`${wonCount}`} helper="Clients convertis" icon={CalendarCheck} />
        <StatCard label="Pipeline" value={formatCurrency(openValue)} helper="Valeur estimee ouverte" icon={BriefcaseBusiness} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
        <form onSubmit={submit} className="surface premium-border rounded-lg p-5 shadow-premium">
          <div className="mb-5">
            <h2 className="text-xl font-black text-white">
              {editingId ? "Modifier le prospect" : "Ajouter un prospect"}
            </h2>
            <p className="mt-2 text-sm text-noline-muted">
              Les informations sont sauvegardees dans ce navigateur.
            </p>
          </div>

          <div className="grid gap-4">
            <TextField label="Entreprise / club" value={form.company} onChange={(value) => updateField("company", value)} placeholder="Ex. AS Montreuil" required />
            <TextField label="Contact" value={form.contactName} onChange={(value) => updateField("contactName", value)} placeholder="Ex. Marie Dupont" required />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label="Email" value={form.email} onChange={(value) => updateField("email", value)} placeholder="contact@club.fr" type="email" />
              <TextField label="Telephone" value={form.phone} onChange={(value) => updateField("phone", value)} placeholder="06 00 00 00 00" />
            </div>
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-white">Statut</span>
              <select
                value={form.status}
                onChange={(event) => updateField("status", event.target.value as ProspectStatus)}
                className="w-full rounded-md border border-white/10 bg-noline-black px-4 py-3 text-sm text-white outline-none transition focus:border-noline-orange"
              >
                {prospectStatuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
            <TextField label="Valeur estimee" value={form.value} onChange={(value) => updateField("value", value)} placeholder="Ex. 1 800 EUR" />
            <TextArea label="Besoin" value={form.need} onChange={(value) => updateField("need", value)} placeholder="Ex. Creation de contenus et recherche de sponsors" required />
            <TextArea label="Prochaine action" value={form.nextAction} onChange={(value) => updateField("nextAction", value)} placeholder="Ex. Envoyer une proposition commerciale jeudi" />
            <TextArea label="Notes" value={form.notes} onChange={(value) => updateField("notes", value)} placeholder="Contexte, objections, decisionnaires..." />
          </div>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <button
              type="submit"
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-md bg-noline-orange px-5 py-3 text-sm font-black text-noline-black transition hover:bg-white"
            >
              <Plus className="h-4 w-4" />
              {editingId ? "Enregistrer" : "Ajouter"}
            </button>
            {editingId ? (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-md border border-white/12 px-5 py-3 text-sm font-black text-white transition hover:bg-white hover:text-noline-black"
              >
                Annuler
              </button>
            ) : null}
          </div>
        </form>

        <div className="surface premium-border rounded-lg p-5 shadow-premium">
          <div className="mb-5 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h2 className="text-xl font-black text-white">Pipeline commercial</h2>
              <p className="mt-2 text-sm text-noline-muted">
                {filteredProspects.length} prospect(s) affiche(s)
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-[1fr_12rem]">
              <label className="flex items-center gap-2 rounded-md border border-white/10 bg-noline-black px-3 py-2">
                <Search className="h-4 w-4 text-noline-muted" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Rechercher"
                  className="w-full bg-transparent text-sm text-white outline-none placeholder:text-noline-muted"
                />
              </label>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as "Tous" | ProspectStatus)}
                className="rounded-md border border-white/10 bg-noline-black px-3 py-2 text-sm text-white outline-none focus:border-noline-orange"
              >
                <option value="Tous">Tous</option>
                {prospectStatuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {filteredProspects.length === 0 ? (
            <div className="rounded-lg border border-white/10 bg-noline-black p-8 text-center text-sm text-noline-muted">
              Aucun prospect a afficher.
            </div>
          ) : (
            <div className="grid gap-3">
              {filteredProspects.map((prospect) => (
                <article key={prospect.id} className="rounded-lg border border-white/10 bg-noline-black p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-black text-white">{prospect.company}</h3>
                        <span className="rounded-md bg-noline-orange px-2 py-1 text-xs font-black text-noline-black">
                          {prospect.status}
                        </span>
                      </div>
                      <p className="mt-1 text-sm font-semibold text-noline-muted">{prospect.contactName}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => edit(prospect)}
                        className="grid h-9 w-9 place-items-center rounded-md border border-white/10 text-white transition hover:bg-white hover:text-noline-black"
                        aria-label="Modifier"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(prospect.id)}
                        className="grid h-9 w-9 place-items-center rounded-md border border-white/10 text-white transition hover:bg-red-500 hover:text-white"
                        aria-label="Supprimer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 text-sm text-noline-muted md:grid-cols-2">
                    <InfoLine icon={Mail} value={prospect.email || "Email non renseigne"} />
                    <InfoLine icon={Phone} value={prospect.phone || "Telephone non renseigne"} />
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <SmallPanel label="Besoin" value={prospect.need} />
                    <SmallPanel label="Prochaine action" value={prospect.nextAction || "A definir"} />
                  </div>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-3">
                    <p className="text-sm font-black text-white">{prospect.value || "Valeur non renseignee"}</p>
                    <p className="text-xs text-noline-muted">
                      Mis a jour le {new Intl.DateTimeFormat("fr-FR").format(new Date(prospect.updatedAt))}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required = false
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-white">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        type={type}
        required={required}
        className="w-full rounded-md border border-white/10 bg-noline-black px-4 py-3 text-sm text-white outline-none transition placeholder:text-noline-muted focus:border-noline-orange"
      />
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
  placeholder,
  required = false
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-white">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        rows={3}
        className="w-full rounded-md border border-white/10 bg-noline-black px-4 py-3 text-sm text-white outline-none transition placeholder:text-noline-muted focus:border-noline-orange"
      />
    </label>
  );
}

function InfoLine({ icon: Icon, value }: { icon: typeof Mail; value: string }) {
  return (
    <p className="flex min-w-0 items-center gap-2">
      <Icon className="h-4 w-4 shrink-0 text-noline-orange" />
      <span className="truncate">{value}</span>
    </p>
  );
}

function SmallPanel({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-white/10 bg-white/5 p-3">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-noline-orange">{label}</p>
      <p className="mt-2 text-sm leading-6 text-white">{value || "Non renseigne"}</p>
    </div>
  );
}

function parsePrice(value: string) {
  const normalized = value.replace(/\s/g, "").replace(",", ".");
  const match = normalized.match(/\d+(\.\d+)?/);
  return match ? Number(match[0]) : 0;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0
  }).format(value);
}

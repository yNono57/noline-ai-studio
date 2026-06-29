"use client";

import { useEffect, useState } from "react";
import { Bot, CheckCircle2, Columns3, List, Plus, Trash2, Users } from "lucide-react";
import {
  deleteProspect,
  normalizeProspect,
  normalizeTask,
  normalizeTimeline,
  prospectStatuses,
  readProspects,
  upsertProspect,
  type CrmTask,
  type Prospect,
  type ProspectStatus,
  type TimelineEvent
} from "@/lib/crm";
import { getAuthenticatedHeaders, isSupabaseBrowserConfigured } from "@/lib/supabase-client";
import { StatCard } from "./StatCard";

type FormState = Omit<Prospect, "id" | "createdAt" | "updatedAt">;
const emptyForm: FormState = {
  contactName: "", phone: "", email: "", company: "", website: "", facebook: "",
  linkedin: "", sector: "", estimatedRevenue: null, estimatedBudget: null, source: "",
  tags: [], need: "", status: "Nouveau", notes: ""
};

export function CrmView() {
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [tasks, setTasks] = useState<CrmTask[]>([]);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [view, setView] = useState<"kanban" | "list">("kanban");
  const [note, setNote] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskType, setTaskType] = useState<CrmTask["type"]>("Relancer");
  const [taskDue, setTaskDue] = useState("");
  const [summary, setSummary] = useState("");
  const [error, setError] = useState("");
  const remote = isSupabaseBrowserConfigured();
  const selected = prospects.find((item) => item.id === selectedId);

  useEffect(() => { void loadCrm(); }, []);
  useEffect(() => { if (selectedId && remote) void loadDetails(selectedId); }, [selectedId, remote]);

  async function loadCrm() {
    if (!remote) { setProspects(readProspects()); return; }
    try {
      const [crmResponse, taskResponse] = await Promise.all([apiFetch("/api/crm"), apiFetch("/api/tasks")]);
      const crmData = await crmResponse.json();
      const taskData = await taskResponse.json();
      if (!crmResponse.ok) throw new Error(crmData.error || "Chargement impossible.");
      setProspects((crmData.prospects || []).map((item: Record<string, unknown>) => normalizeProspect(item)));
      setTasks((taskData.tasks || []).map((item: Record<string, unknown>) => normalizeTask(item)));
    } catch (caught) { setError(message(caught)); setProspects(readProspects()); }
  }

  async function loadDetails(id: string) {
    const response = await apiFetch(`/api/timeline?prospectId=${encodeURIComponent(id)}`);
    const data = await response.json();
    if (response.ok) setTimeline((data.timeline || []).map((item: Record<string, unknown>) => normalizeTimeline(item)));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError("");
    const now = new Date().toISOString();
    if (!remote) {
      const prospect = { ...form, id: editingId || crypto.randomUUID(), createdAt: now, updatedAt: now };
      setProspects(upsertProspect(prospect)); reset(); return;
    }
    try {
      const response = await apiFetch("/api/crm", { method: editingId ? "PATCH" : "POST", body: JSON.stringify({ ...form, id: editingId }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      const prospect = normalizeProspect(data.prospect);
      setProspects((current) => editingId ? current.map((item) => item.id === prospect.id ? prospect : item) : [prospect, ...current]);
      reset();
    } catch (caught) { setError(message(caught)); }
  }

  function edit(item: Prospect) { setEditingId(item.id); setForm({ ...item }); }
  function reset() { setEditingId(""); setForm(emptyForm); }
  async function remove(item: Prospect) {
    if (!confirm(`Supprimer ${item.company} ?`)) return;
    if (remote) await apiFetch(`/api/crm?id=${encodeURIComponent(item.id)}`, { method: "DELETE" });
    else deleteProspect(item.id);
    setProspects((current) => current.filter((prospect) => prospect.id !== item.id));
    if (selectedId === item.id) setSelectedId("");
  }

  async function addNote() {
    if (!selected || !note.trim() || !remote) return;
    const response = await apiFetch("/api/timeline", { method: "POST", body: JSON.stringify({ prospectId: selected.id, type: "note", title: "Note", content: note }) });
    const data = await response.json(); if (response.ok) setTimeline((current) => [normalizeTimeline(data.event), ...current]);
    setNote("");
  }

  async function addTask() {
    if (!selected || !taskTitle.trim() || !remote) return;
    const response = await apiFetch("/api/tasks", { method: "POST", body: JSON.stringify({ prospectId: selected.id, title: taskTitle, type: taskType, dueAt: taskDue || null }) });
    const data = await response.json(); if (response.ok) setTasks((current) => [...current, normalizeTask(data.task)]);
    setTaskTitle(""); setTaskDue("");
  }

  async function toggleTask(task: CrmTask) {
    const response = await apiFetch("/api/tasks", { method: "PATCH", body: JSON.stringify({ id: task.id, completed: !task.completed }) });
    const data = await response.json(); if (response.ok) setTasks((current) => current.map((item) => item.id === task.id ? normalizeTask(data.task) : item));
  }

  async function summarize() {
    if (!selected) return; setSummary("Analyse en cours…");
    const response = await apiFetch("/api/crm", { method: "POST", body: JSON.stringify({ action: "summary", prospectId: selected.id }) });
    const data = await response.json(); setSummary(response.ok ? data.summary : data.error || "Résumé indisponible.");
  }

  const won = prospects.filter((item) => item.status === "Gagné").length;
  const potential = prospects.reduce((sum, item) => sum + (item.estimatedBudget || 0), 0);
  const overdue = tasks.filter((task) => !task.completed && task.dueAt && new Date(task.dueAt) < new Date()).length;
  const conversion = prospects.length ? Math.round((won / prospects.length) * 100) : 0;

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-sm font-black uppercase tracking-[0.24em] text-noline-orange">CRM intelligent V6.1</p><h1 className="mt-2 text-4xl font-black text-white">Pipeline commercial</h1></div>
        <div className="flex gap-2"><Toggle active={view === "kanban"} onClick={() => setView("kanban")} icon={Columns3} label="Kanban" /><Toggle active={view === "list"} onClick={() => setView("list")} icon={List} label="Liste" /></div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Prospects" value={`${prospects.length}`} helper="Total" icon={Users} />
        <StatCard label="Conversion" value={`${conversion}%`} helper="Gagnés / total" icon={CheckCircle2} />
        <StatCard label="CA potentiel" value={money(potential)} helper="Budgets estimés" icon={Users} />
        <StatCard label="Tâches en retard" value={`${overdue}`} helper="À traiter" icon={CheckCircle2} />
        <StatCard label="Signatures" value={`${won}`} helper="Prospects gagnés" icon={CheckCircle2} />
      </div>
      {error ? <p className="rounded-md bg-red-500/10 p-3 text-sm text-red-100">{error}</p> : null}

      <form onSubmit={submit} className="surface premium-border rounded-xl p-5">
        <h2 className="font-black text-white">{editingId ? "Modifier le prospect" : "Nouveau prospect"}</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <Field label="Entreprise" value={form.company} onChange={(company) => setForm({ ...form, company })} required />
          <Field label="Contact" value={form.contactName} onChange={(contactName) => setForm({ ...form, contactName })} />
          <Field label="Téléphone" value={form.phone} onChange={(phone) => setForm({ ...form, phone })} />
          <Field label="Email" value={form.email} onChange={(email) => setForm({ ...form, email })} />
          <Field label="Site web" value={form.website} onChange={(website) => setForm({ ...form, website })} />
          <Field label="Facebook" value={form.facebook} onChange={(facebook) => setForm({ ...form, facebook })} />
          <Field label="LinkedIn" value={form.linkedin} onChange={(linkedin) => setForm({ ...form, linkedin })} />
          <Field label="Secteur" value={form.sector} onChange={(sector) => setForm({ ...form, sector })} />
          <Field label="Source" value={form.source} onChange={(source) => setForm({ ...form, source })} />
          <Field label="CA estimé" type="number" value={form.estimatedRevenue?.toString() || ""} onChange={(value) => setForm({ ...form, estimatedRevenue: number(value) })} />
          <Field label="Budget estimé" type="number" value={form.estimatedBudget?.toString() || ""} onChange={(value) => setForm({ ...form, estimatedBudget: number(value) })} />
          <Field label="Tags (virgules)" value={form.tags.join(", ")} onChange={(value) => setForm({ ...form, tags: value.split(",").map((tag) => tag.trim()).filter(Boolean) })} />
          <select className="field" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as ProspectStatus })}>{prospectStatuses.map((status) => <option key={status}>{status}</option>)}</select>
          <Field label="Besoin" value={form.need} onChange={(need) => setForm({ ...form, need })} />
          <Field label="Notes" value={form.notes} onChange={(notes) => setForm({ ...form, notes })} />
        </div>
        <div className="mt-4 flex gap-2"><button className="rounded-md bg-noline-orange px-4 py-2 text-sm font-black text-noline-black"><Plus className="mr-2 inline h-4 w-4" />Enregistrer</button>{editingId ? <button type="button" onClick={reset} className="rounded-md border border-white/10 px-4 py-2 text-sm text-white">Annuler</button> : null}</div>
      </form>

      {view === "kanban" ? <Kanban prospects={prospects} select={setSelectedId} edit={edit} remove={remove} /> : <ProspectList prospects={prospects} select={setSelectedId} edit={edit} remove={remove} />}

      {selected ? (
        <section className="surface premium-border rounded-xl p-5">
          <h2 className="text-2xl font-black text-white">{selected.company}</h2>
          <div className="mt-5 grid gap-5 lg:grid-cols-3">
            <Panel title="Résumé IA"><button onClick={() => void summarize()} className="rounded-md bg-noline-orange px-3 py-2 text-xs font-black text-noline-black"><Bot className="mr-2 inline h-4 w-4" />Analyser</button><p className="mt-3 whitespace-pre-wrap text-sm text-noline-muted">{summary || "Historique, opportunités, risques et prochaine action."}</p></Panel>
            <Panel title="Notes"><textarea className="field" rows={3} value={note} onChange={(event) => setNote(event.target.value)} /><button onClick={() => void addNote()} className="mt-2 rounded-md border border-white/10 px-3 py-2 text-xs text-white">Ajouter</button></Panel>
            <Panel title="Nouvelle tâche"><Field label="Titre" value={taskTitle} onChange={setTaskTitle} /><select className="field mt-2" value={taskType} onChange={(event) => setTaskType(event.target.value as CrmTask["type"])}>{["Rappeler","Envoyer devis","Relancer","Préparer rendez-vous"].map((type) => <option key={type}>{type}</option>)}</select><input type="datetime-local" className="field mt-2" value={taskDue} onChange={(event) => setTaskDue(event.target.value)} /><button onClick={() => void addTask()} className="mt-2 rounded-md border border-white/10 px-3 py-2 text-xs text-white">Créer</button></Panel>
          </div>
          <div className="mt-5 grid gap-5 lg:grid-cols-2"><Panel title="Tâches">{tasks.filter((task) => task.prospectId === selected.id).map((task) => <button key={task.id} onClick={() => void toggleTask(task)} className="mb-2 flex w-full justify-between rounded-md bg-white/5 p-3 text-left text-sm text-white"><span>{task.title}</span><span>{task.completed ? "✓" : task.dueAt ? new Date(task.dueAt).toLocaleDateString("fr-FR") : "—"}</span></button>)}</Panel><Panel title="Timeline">{timeline.map((event) => <div key={event.id} className="mb-3 border-l-2 border-noline-orange pl-3"><p className="text-sm font-bold text-white">{event.title}</p><p className="text-xs text-noline-muted">{event.content} · {new Date(event.createdAt).toLocaleString("fr-FR")}</p></div>)}</Panel></div>
        </section>
      ) : null}
    </section>
  );
}

function Kanban({ prospects, select, edit, remove }: CardsProps) { return <div className="grid gap-4 overflow-x-auto xl:grid-cols-6">{prospectStatuses.map((status) => <div key={status} className="min-w-64 rounded-xl border border-white/10 bg-white/[0.03] p-3"><h3 className="mb-3 text-sm font-black text-white">{status} ({prospects.filter((item) => item.status === status).length})</h3>{prospects.filter((item) => item.status === status).map((item) => <Card key={item.id} item={item} select={select} edit={edit} remove={remove} />)}</div>)}</div>; }
function ProspectList({ prospects, select, edit, remove }: CardsProps) { return <div className="grid gap-3">{prospects.map((item) => <Card key={item.id} item={item} select={select} edit={edit} remove={remove} />)}</div>; }
type CardsProps = { prospects: Prospect[]; select: (id: string) => void; edit: (item: Prospect) => void; remove: (item: Prospect) => void };
function Card({ item, select, edit, remove }: { item: Prospect; select: (id: string) => void; edit: (item: Prospect) => void; remove: (item: Prospect) => void }) { return <article className="mb-2 rounded-lg border border-white/10 bg-noline-black p-3"><button onClick={() => select(item.id)} className="w-full text-left"><p className="font-black text-white">{item.company}</p><p className="text-xs text-noline-muted">{item.contactName || item.sector}</p><p className="mt-2 text-sm font-bold text-noline-orange">{money(item.estimatedBudget || 0)}</p></button><div className="mt-2 flex gap-2"><button onClick={() => edit(item)} className="text-xs text-white">Modifier</button><button onClick={() => void remove(item)} className="text-xs text-red-300"><Trash2 className="inline h-3 w-3" /> Supprimer</button></div></article>; }
function Field({ label, value, onChange, type = "text", required = false }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean }) { return <label className="block"><span className="mb-1 block text-xs font-bold text-noline-muted">{label}</span><input className="field" required={required} type={type} value={value} onChange={(event) => onChange(event.target.value)} /></label>; }
function Panel({ title, children }: { title: string; children: React.ReactNode }) { return <div className="rounded-lg border border-white/10 bg-noline-black p-4"><h3 className="mb-3 font-black text-white">{title}</h3>{children}</div>; }
function Toggle({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: typeof List; label: string }) { return <button onClick={onClick} className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-black ${active ? "bg-white text-black" : "bg-white/5 text-white"}`}><Icon className="h-4 w-4" />{label}</button>; }
function number(value: string) { const parsed = Number(value); return value && Number.isFinite(parsed) ? parsed : null; }
function money(value: number) { return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value); }
function message(error: unknown) { return error instanceof Error ? error.message : "Une erreur est survenue."; }
async function apiFetch(url: string, init: RequestInit = {}) { let headers = await getAuthenticatedHeaders(); let response = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...headers, ...(init.headers || {}) }, cache: "no-store" }); if (response.status === 401) { headers = await getAuthenticatedHeaders(true); response = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...headers, ...(init.headers || {}) }, cache: "no-store" }); } return response; }

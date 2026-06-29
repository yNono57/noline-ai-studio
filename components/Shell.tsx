"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3, Bot, BriefcaseBusiness, Clock3, ContactRound, CreditCard,
  FileText, LayoutTemplate, LogIn, Palette, Settings, Sparkles,
  UsersRound, Wand2, Workflow
} from "lucide-react";
import { Brand } from "./Brand";

const sections = [
  { label: "", items: [{ href: "/dashboard", label: "Dashboard", icon: BarChart3 }] },
  { label: "Production IA", items: [
    { href: "/agents", label: "Agents", icon: Bot },
    { href: "/workflows", label: "Workflows", icon: Workflow },
    { href: "/generate", label: "Studio IA", icon: Sparkles },
    { href: "/generators", label: "Générateurs", icon: Wand2 },
    { href: "/agent-builder", label: "Agent Builder", icon: Bot }
  ]},
  { label: "CRM", items: [
    { href: "/clients", label: "Clients", icon: UsersRound },
    { href: "/crm", label: "Prospects", icon: ContactRound }
  ]},
  { label: "Documents", items: [
    { href: "/documents", label: "Documents", icon: FileText },
    { href: "/history", label: "Historique IA", icon: Clock3 },
    { href: "/creations", label: "Visuels & exports", icon: LayoutTemplate }
  ]},
  { label: "Marque", items: [
    { href: "/templates", label: "Templates", icon: LayoutTemplate },
    { href: "/brand", label: "Marque client", icon: Palette },
    { href: "/presentation", label: "Présentation", icon: BriefcaseBusiness }
  ]},
  { label: "Compte", items: [
    { href: "/pricing", label: "Tarifs", icon: CreditCard },
    { href: "/settings", label: "Paramètres", icon: Settings },
    { href: "/login", label: "Connexion", icon: LogIn }
  ]}
];
const items = sections.flatMap((section) => section.items);

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const active = (href: string) => pathname === href || (href !== "/dashboard" && pathname.startsWith(`${href}/`));
  const linkClass = (href: string) => `flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-bold transition ${active(href) ? "bg-white text-noline-black" : "text-noline-muted hover:bg-white/10 hover:text-white"}`;

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[17rem_1fr]">
      <aside className="sticky top-0 z-40 hidden h-dvh min-h-0 flex-col border-r border-white/10 bg-noline-black/92 p-4 backdrop-blur-xl lg:flex">
        <header className="shrink-0"><Link href="/" aria-label="Accueil NOLINE AI STUDIO"><Brand /></Link></header>
        <nav className="mt-6 min-h-0 flex-1 space-y-5 overflow-y-auto pr-1">
          {sections.map((section) => (
            <div key={section.label || "main"}>
              {section.label ? <p className="mb-1 px-3 text-[10px] font-black uppercase tracking-[0.2em] text-noline-muted/70">{section.label}</p> : null}
              <div className="space-y-1">
                {section.items.map((item) => { const Icon = item.icon; return <Link key={item.href} href={item.href} className={linkClass(item.href)}><Icon className="h-4 w-4" />{item.label}</Link>; })}
              </div>
            </div>
          ))}
        </nav>
        <footer className="mt-4 shrink-0"><div className="rounded-lg border border-noline-orange/40 bg-noline-orange/10 p-4"><BriefcaseBusiness className="h-5 w-5 text-noline-orange" /><p className="mt-3 text-sm font-black text-white">NOLINE Pro</p><p className="mt-1 text-xs leading-5 text-noline-muted">Votre production, vos clients et vos documents au même endroit.</p></div></footer>
      </aside>
      <div className="min-w-0">
        <header className="sticky top-0 z-30 border-b border-white/10 bg-noline-black/88 backdrop-blur-xl lg:hidden">
          <div className="flex items-center justify-between px-4 py-4"><Link href="/dashboard"><Brand /></Link><Link href="/generate" className="rounded-md bg-noline-orange px-4 py-2 text-sm font-black text-noline-black">Créer</Link></div>
          <nav className="flex gap-2 overflow-x-auto border-t border-white/10 px-4 py-2">
            {items.map((item) => { const Icon = item.icon; return <Link key={item.href} href={item.href} className={`flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-xs font-bold ${active(item.href) ? "bg-white text-noline-black" : "bg-white/5 text-noline-muted"}`}><Icon className="h-4 w-4" />{item.label}</Link>; })}
          </nav>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}

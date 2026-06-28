"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Bot,
  BriefcaseBusiness,
  Clock3,
  ContactRound,
  CreditCard,
  LayoutTemplate,
  LogIn,
  Palette,
  Settings,
  Sparkles,
  UsersRound,
  Wand2
} from "lucide-react";
import { Brand } from "./Brand";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: BarChart3 },
  { href: "/agents", label: "Agents", icon: Bot },
  { href: "/generate", label: "Studio IA", icon: Sparkles },
  { href: "/agent-builder", label: "Agent Builder", icon: Bot },
  { href: "/clients", label: "Clients", icon: UsersRound },
  { href: "/history", label: "Historique", icon: Clock3 },
  { href: "/creations", label: "Créations", icon: LayoutTemplate },
  { href: "/generators", label: "Générateurs classiques", icon: Wand2 },
  { href: "/templates", label: "Templates", icon: LayoutTemplate },
  { href: "/presentation", label: "Presentation", icon: BriefcaseBusiness },
  { href: "/brand", label: "Marque client", icon: Palette },
  { href: "/crm", label: "CRM", icon: ContactRound },
  { href: "/pricing", label: "Tarifs", icon: CreditCard },
  { href: "/settings", label: "Parametres", icon: Settings },
  { href: "/login", label: "Connexion", icon: LogIn }
];

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[17rem_1fr]">
      <aside className="sticky top-0 z-40 hidden h-dvh min-h-0 flex-col border-r border-white/10 bg-noline-black/92 p-4 backdrop-blur-xl lg:flex">
        <header className="shrink-0">
          <Link href="/" aria-label="Accueil NOLINE AI STUDIO">
            <Brand />
          </Link>
        </header>
        <nav className="mt-6 min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`));

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-bold transition ${
                  active
                    ? "bg-white text-noline-black"
                    : "text-noline-muted hover:bg-white/10 hover:text-white"
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <footer className="mt-4 shrink-0">
          <div className="rounded-lg border border-noline-orange/40 bg-noline-orange/10 p-4">
            <BriefcaseBusiness className="h-5 w-5 text-noline-orange" />
            <p className="mt-3 text-sm font-black text-white">NOLINE Pro</p>
            <p className="mt-1 text-xs leading-5 text-noline-muted">
              Templates, CRM et marque client pour produire plus vite.
            </p>
          </div>
        </footer>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-30 border-b border-white/10 bg-noline-black/88 backdrop-blur-xl lg:hidden">
          <div className="flex items-center justify-between px-4 py-4">
            <Link href="/" aria-label="Accueil NOLINE AI STUDIO">
              <Brand />
            </Link>
            <Link
              href="/generate"
              className="inline-flex items-center gap-2 rounded-md bg-noline-orange px-4 py-2 text-sm font-black text-noline-black transition hover:bg-white"
            >
              <Sparkles className="h-4 w-4" />
              Creer
            </Link>
          </div>
          <nav className="flex gap-2 overflow-x-auto border-t border-white/10 px-4 py-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`));

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-xs font-bold ${
                    active ? "bg-white text-noline-black" : "bg-white/5 text-noline-muted"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}

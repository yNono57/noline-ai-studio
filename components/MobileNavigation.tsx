"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { BarChart3, Code2, CreditCard, LogIn, LogOut, Menu, MessageCircle, Settings, Sparkles, UserRound, X } from "lucide-react";
import { getStoredSession, signOutLocal, type AuthSession } from "@/lib/supabase-client";
import { Brand } from "./Brand";

type MobileNavigationProps = { active: (href: string) => boolean };

const productLinks = [
  { href: "/nova", label: "Nova", icon: MessageCircle },
  { href: "/generate", label: "Muse", icon: Sparkles },
  { href: "/forge", label: "Forge", icon: Code2 }
];

export function MobileNavigation({ active }: MobileNavigationProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [sessionEmail, setSessionEmail] = useState("");

  useEffect(() => {
    const syncSession = (event?: Event) => {
      const session = event instanceof CustomEvent ? (event.detail as AuthSession | null) : getStoredSession();
      setSessionEmail(session?.user.email || "");
    };
    syncSession();
    window.addEventListener("noline-auth-session", syncSession);
    window.addEventListener("storage", syncSession);
    return () => {
      window.removeEventListener("noline-auth-session", syncSession);
      window.removeEventListener("storage", syncSession);
    };
  }, []);

  useEffect(() => { setOpen(false); }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  async function logout() {
    await signOutLocal();
    setSessionEmail("");
    setOpen(false);
  }

  const mobileLink = (href: string) => `flex min-h-11 items-center gap-3 rounded-md px-3 py-2.5 text-sm font-bold transition ${active(href) ? "bg-white text-noline-black" : "text-white hover:bg-white/10"}`;

  return <>
    <header className="sticky top-0 z-50 border-b border-white/10 bg-noline-black/95 backdrop-blur-xl lg:hidden">
      <div className="flex min-h-[4.5rem] items-center gap-2 px-3 sm:px-4">
        <Link href="/dashboard" aria-label="Accueil NØLINE" className="min-w-0 flex-1"><Brand /></Link>
        {!sessionEmail && pathname !== "/login" ? <Link href="/login" className="flex min-h-11 shrink-0 items-center rounded-md bg-noline-orange px-3 text-xs font-black text-noline-black">Se connecter</Link> : null}
        <button type="button" aria-label={open ? "Fermer le menu" : "Ouvrir le menu"} aria-expanded={open} aria-controls="mobile-main-menu" onClick={() => setOpen((value) => !value)} className="grid h-11 w-11 shrink-0 place-items-center rounded-md border border-white/15 text-white">
          {open ? <X className="h-5 w-5" /> : sessionEmail ? <UserRound className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>
    </header>

    {open ? <div className="fixed inset-0 top-[4.5rem] z-40 lg:hidden">
      <button type="button" aria-label="Fermer le menu" onClick={() => setOpen(false)} className="absolute inset-0 bg-black/65" />
      <aside id="mobile-main-menu" aria-label="Menu principal mobile" className="absolute inset-y-0 right-0 flex w-[min(88vw,22rem)] flex-col border-l border-white/10 bg-noline-black shadow-2xl">
        <nav className="min-h-0 flex-1 overflow-y-auto p-4">
          {sessionEmail ? <div className="mb-5 rounded-lg border border-white/10 bg-white/5 p-3"><p className="text-xs text-noline-muted">Connecté</p><p className="mt-1 truncate text-sm font-bold text-white">{sessionEmail}</p></div> : null}
          <p className="mb-2 px-3 text-[10px] font-black uppercase tracking-[0.2em] text-noline-muted">Navigation</p>
          <Link href="/dashboard" className={mobileLink("/dashboard")}><BarChart3 className="h-5 w-5" />Dashboard</Link>
          <div className="mt-1 space-y-1">{productLinks.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={mobileLink(href)}><Icon className="h-5 w-5 text-noline-orange" />{label}</Link>)}</div>

          <p className="mb-2 mt-6 px-3 text-[10px] font-black uppercase tracking-[0.2em] text-noline-muted">Compte</p>
          {sessionEmail ? <>
            <Link href="/settings" className={mobileLink("/settings")}><Settings className="h-5 w-5" />Compte et profil</Link>
            <Link href="/pricing" className={mobileLink("/pricing")}><CreditCard className="h-5 w-5" />Abonnement et quota</Link>
            <button type="button" onClick={logout} className="flex min-h-11 w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm font-bold text-white hover:bg-white/10"><LogOut className="h-5 w-5" />Déconnexion</button>
          </> : <Link href="/login" className="flex min-h-11 items-center gap-3 rounded-md bg-noline-orange px-3 py-2.5 text-sm font-black text-noline-black"><LogIn className="h-5 w-5" />Se connecter</Link>}
        </nav>
      </aside>
    </div> : null}
  </>;
}

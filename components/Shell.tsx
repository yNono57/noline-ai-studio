"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BarChart3, Bot, BriefcaseBusiness, ChevronDown, Clock3, Code2, ContactRound,
  CreditCard, Crown, FileText, LayoutTemplate, LogIn, MessageCircle,
  Palette, Settings, Sparkles, UsersRound, Workflow
} from "lucide-react";
import { Brand } from "./Brand";

type ProductKey = "nova" | "muse" | "forge" | "apex";
type NavItem = { href?: string; label: string; future?: boolean };
type Product = { key: ProductKey; label: string; icon: typeof MessageCircle; items: NavItem[] };

const products: Product[] = [
  { key: "nova", label: "Nova", icon: MessageCircle, items: [
    { href: "/nova", label: "Chat" }, { label: "Projets", future: true }, { label: "Historique", future: true }
  ] },
  { key: "muse", label: "Muse", icon: Sparkles, items: [
    { href: "/generate", label: "Créer" }, { href: "/creations", label: "Images" },
    { label: "Vidéos", future: true }, { href: "/generators", label: "Bibliothèque" }
  ] },
  { key: "forge", label: "Forge", icon: Code2, items: [
    { label: "Agent de code", future: true }, { label: "Projets", future: true },
    { label: "Repositories", future: true }, { label: "Sessions", future: true }
  ] },
  { key: "apex", label: "Apex", icon: Crown, items: [
    { label: "Engineering", future: true }, { label: "Projets", future: true },
    { label: "Repositories", future: true }, { label: "Sessions", future: true }
  ] }
];

const sections = [
  { label: "Automatisation", items: [
    { href: "/agents", label: "Agents", icon: Bot }, { href: "/workflows", label: "Workflows", icon: Workflow },
    { href: "/agent-builder", label: "Agent Builder", icon: Bot }
  ] },
  { label: "Business", items: [
    { href: "/clients", label: "Clients", icon: UsersRound }, { href: "/crm", label: "Prospects", icon: ContactRound }
  ] },
  { label: "Documents", items: [
    { href: "/documents", label: "Documents", icon: FileText }, { href: "/history", label: "Historique IA", icon: Clock3 }
  ] },
  { label: "Marque", items: [
    { href: "/templates", label: "Templates", icon: LayoutTemplate }, { href: "/brand", label: "Marque client", icon: Palette },
    { href: "/presentation", label: "Présentation", icon: BriefcaseBusiness }
  ] },
  { label: "Compte", items: [
    { href: "/pricing", label: "Tarifs", icon: CreditCard }, { href: "/settings", label: "Paramètres", icon: Settings },
    { href: "/login", label: "Connexion", icon: LogIn }
  ] }
];

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const routeProduct = productForPath(pathname);
  const [openProduct, setOpenProduct] = useState<ProductKey | null>(routeProduct);
  const active = (href: string) => pathname === href || (href !== "/dashboard" && pathname.startsWith(`${href}/`));
  const linkClass = (href: string) => `flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-bold transition ${active(href) ? "bg-white text-noline-black" : "text-noline-muted hover:bg-white/10 hover:text-white"}`;

  useEffect(() => { if (routeProduct) setOpenProduct(routeProduct); }, [routeProduct]);

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[17rem_1fr]">
      <aside className="sticky top-0 z-40 hidden h-dvh min-h-0 flex-col border-r border-white/10 bg-noline-black/92 p-4 backdrop-blur-xl lg:flex">
        <header className="shrink-0"><Link href="/" aria-label="Accueil NOLINE AI STUDIO"><Brand /></Link></header>
        <nav aria-label="Navigation principale" className="mt-6 min-h-0 flex-1 space-y-5 overflow-y-auto pr-1">
          <Link href="/dashboard" className={linkClass("/dashboard")}><BarChart3 className="h-4 w-4" />Dashboard</Link>
          <section aria-labelledby="noline-products">
            <p id="noline-products" className="mb-1 px-3 text-[10px] font-black uppercase tracking-[0.2em] text-noline-muted/70">NØLINE AI</p>
            <div className="space-y-1">{products.map((product) => <ProductMenu key={product.key} product={product} open={openProduct === product.key} active={active} onToggle={() => setOpenProduct((current) => current === product.key ? null : product.key)} />)}</div>
          </section>
          {sections.map((section) => <section key={section.label} aria-labelledby={`section-${section.label}`}>
            <p id={`section-${section.label}`} className="mb-1 px-3 text-[10px] font-black uppercase tracking-[0.2em] text-noline-muted/70">{section.label}</p>
            <div className="space-y-1">{section.items.map((item) => { const Icon = item.icon; return <Link key={item.href} href={item.href} className={linkClass(item.href)}><Icon className="h-4 w-4" />{item.label}</Link>; })}</div>
          </section>)}
        </nav>
        <footer className="mt-4 shrink-0"><div className="rounded-lg border border-noline-orange/40 bg-noline-orange/10 p-4"><BriefcaseBusiness className="h-5 w-5 text-noline-orange" /><p className="mt-3 text-sm font-black text-white">NOLINE Pro</p><p className="mt-1 text-xs leading-5 text-noline-muted">Votre production, vos clients et vos documents au même endroit.</p></div></footer>
      </aside>
      <div className="min-w-0">
        <header className="sticky top-0 z-30 border-b border-white/10 bg-noline-black/88 backdrop-blur-xl lg:hidden">
          <div className="flex items-center justify-between px-4 py-4"><Link href="/dashboard"><Brand /></Link><Link href="/generate" className="rounded-md bg-noline-orange px-4 py-2 text-sm font-black text-noline-black">Créer</Link></div>
          <nav aria-label="Produits NØLINE AI" className="flex gap-2 overflow-x-auto border-t border-white/10 px-4 py-2">
            <Link href="/dashboard" className={`flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-xs font-bold ${active("/dashboard") ? "bg-white text-noline-black" : "bg-white/5 text-noline-muted"}`}><BarChart3 className="h-4 w-4" />Dashboard</Link>
            {products.map((product) => { const Icon = product.icon; const expanded = openProduct === product.key; return <button key={product.key} type="button" aria-expanded={expanded} aria-controls={`mobile-${product.key}-menu`} onClick={() => setOpenProduct((current) => current === product.key ? null : product.key)} className={`flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-xs font-bold ${routeProduct === product.key ? "bg-white text-noline-black" : "bg-white/5 text-noline-muted"}`}><Icon className="h-4 w-4" />{product.label}<ChevronDown className={`h-3 w-3 transition ${expanded ? "rotate-180" : ""}`} /></button>; })}
          </nav>
          {openProduct ? <MobileProductMenu product={products.find((product) => product.key === openProduct)!} active={active} /> : null}
        </header>
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}

function ProductMenu({ product, open, active, onToggle }: { product: Product; open: boolean; active: (href: string) => boolean; onToggle: () => void }) {
  const Icon = product.icon;
  const productActive = product.items.some((item) => item.href && active(item.href));
  return <div><button type="button" aria-expanded={open} aria-controls={`${product.key}-menu`} onClick={onToggle} className={`flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-black transition ${productActive ? "bg-noline-orange/15 text-white" : "text-noline-muted hover:bg-white/10 hover:text-white"}`}><Icon className={`h-4 w-4 ${productActive ? "text-noline-orange" : ""}`} /><span className="flex-1 text-left">{product.label}</span><ChevronDown className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`} /></button>{open ? <div id={`${product.key}-menu`} className="ml-5 mt-1 space-y-1 border-l border-white/10 pl-2">{product.items.map((item) => <ProductItem key={item.label} item={item} active={active} />)}</div> : null}</div>;
}

function MobileProductMenu({ product, active }: { product: Product; active: (href: string) => boolean }) {
  return <nav id={`mobile-${product.key}-menu`} aria-label={`Navigation ${product.label}`} className="flex gap-2 overflow-x-auto border-t border-white/10 px-4 py-2">{product.items.map((item) => <ProductItem key={item.label} item={item} active={active} mobile />)}</nav>;
}

function ProductItem({ item, active, mobile = false }: { item: NavItem; active: (href: string) => boolean; mobile?: boolean }) {
  const classes = mobile ? `shrink-0 rounded-md px-3 py-2 text-xs font-bold ${item.href && active(item.href) ? "bg-white text-noline-black" : "bg-white/5 text-noline-muted"}` : `flex items-center justify-between rounded-md px-3 py-2 text-xs font-bold transition ${item.href && active(item.href) ? "bg-white text-noline-black" : "text-noline-muted hover:bg-white/10 hover:text-white"}`;
  if (item.href) return <Link href={item.href} className={classes}>{item.label}</Link>;
  return <span aria-disabled="true" className={`${classes} cursor-not-allowed opacity-45`}>{item.label}<span className={mobile ? "ml-2 text-[9px] uppercase" : "text-[9px] uppercase"}>Bientôt</span></span>;
}

function productForPath(pathname: string): ProductKey | null {
  for (const product of products) if (product.items.some((item) => item.href && (pathname === item.href || pathname.startsWith(`${item.href}/`)))) return product.key;
  return null;
}

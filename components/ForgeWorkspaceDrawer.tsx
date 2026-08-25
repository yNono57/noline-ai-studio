"use client";

import { X } from "lucide-react";
import type { ReactNode } from "react";

export function ForgeWorkspaceDrawer({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  return <>
    {open ? <button type="button" aria-label="Fermer le Workspace" onClick={onClose} className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm xl:hidden" /> : null}
    <aside aria-label="Workspace Forge" className={`fixed inset-y-0 right-0 z-50 flex w-[min(92vw,26rem)] flex-col border-l border-white/10 bg-[#090909] shadow-2xl transition-transform duration-200 xl:static xl:z-auto xl:h-full xl:w-[23rem] xl:rounded-xl xl:border xl:shadow-premium ${open ? "translate-x-0" : "translate-x-full xl:hidden"}`}>
      <header className="flex min-h-16 items-center gap-3 border-b border-white/10 px-4">
        <div className="min-w-0 flex-1"><p className="text-[10px] font-black uppercase tracking-[0.2em] text-noline-orange">Workspace</p><h2 className="truncate text-sm font-black text-white">{title}</h2></div>
        <button type="button" onClick={onClose} aria-label="Fermer le Workspace" className="flex h-11 w-11 items-center justify-center rounded-lg text-noline-muted hover:bg-white/10 hover:text-white"><X className="h-5 w-5" /></button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">{children}</div>
    </aside>
  </>;
}

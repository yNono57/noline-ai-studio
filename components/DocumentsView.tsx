"use client";

import Link from "next/link";
import { Clock3, FileText, Heart, Image, Workflow } from "lucide-react";

const sections = [
  { href: "/history", title: "Historique IA", description: "Textes et rapports générés par vos agents.", icon: Clock3 },
  { href: "/workflows", title: "Workflows", description: "Missions métier structurées et résultats.", icon: Workflow },
  { href: "/creations", title: "Visuels & exports", description: "Créations graphiques et fichiers exportés.", icon: Image },
  { href: "/history", title: "Favoris", description: "Vos contenus et agents enregistrés.", icon: Heart }
];

export function DocumentsView() {
  return <section><p className="text-sm font-black uppercase tracking-[0.24em] text-noline-orange">Documents</p><h1 className="mt-2 text-4xl font-black text-white">Votre bibliothèque de production</h1><p className="mt-3 text-noline-muted">Retrouvez les textes, workflows, exports, visuels et favoris sans doublons.</p><div className="mt-8 grid gap-4 md:grid-cols-2">{sections.map(({ href, title, description, icon: Icon }) => <Link key={title} href={href} className="surface premium-border group rounded-xl p-6 transition hover:border-noline-orange/60"><Icon className="h-6 w-6 text-noline-orange" /><h2 className="mt-4 text-xl font-black text-white">{title}</h2><p className="mt-2 text-sm text-noline-muted">{description}</p><span className="mt-5 inline-flex items-center gap-2 text-sm font-black text-noline-orange"><FileText className="h-4 w-4" />Ouvrir</span></Link>)}</div></section>;
}

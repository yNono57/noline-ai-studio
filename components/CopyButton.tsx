"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <button
      type="button"
      onClick={copy}
      disabled={!text}
      className="inline-flex items-center gap-2 rounded-md bg-white px-4 py-2 text-sm font-black text-noline-black transition hover:bg-noline-orange disabled:cursor-not-allowed disabled:opacity-50"
    >
      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      {copied ? "Copie" : "Copier"}
    </button>
  );
}

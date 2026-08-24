"use client";

import { useState } from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import {
  deleteForgeRuntimeFile,
  executeForgeRuntimeCommand,
  getForgeRuntimeGitDiff,
  getForgeRuntimeGitStatus,
  readForgeRuntimeFile,
  writeForgeRuntimeFile,
} from "@/lib/forge/forge-client";

const TEST_FILE = ".forge-runtime-test.txt";
const TEST_CONTENT = "NOLINE Forge Daytona runtime validation";
type Result = { state: "idle" | "loading" | "pass" | "fail"; message: string };
type TestName = "read" | "write" | "command" | "git" | "cleanup";
const initialResult = (): Result => ({ state: "idle", message: "NON TESTÉ" });

export function ForgeRuntimeDiagnostics({ conversationId }: { conversationId: string }) {
  const [results, setResults] = useState<Record<TestName, Result>>({ read: initialResult(), write: initialResult(), command: initialResult(), git: initialResult(), cleanup: initialResult() });
  const [active, setActive] = useState<TestName | null>(null);

  async function run(name: TestName, operation: () => Promise<string>) {
    if (active) return;
    setActive(name); setResults((current) => ({ ...current, [name]: { state: "loading", message: "TEST…" } }));
    try { const message = await operation(); setResults((current) => ({ ...current, [name]: { state: "pass", message } })); }
    catch (error) { setResults((current) => ({ ...current, [name]: { state: "fail", message: error instanceof Error ? error.message : "Diagnostic indisponible." } })); }
    finally { setActive(null); }
  }

  const read = () => run("read", async () => { const { file } = await readForgeRuntimeFile(conversationId, "package.json"); return `package.json lu · ${file.content.length} caractères`; });
  const write = () => run("write", async () => { await writeForgeRuntimeFile(conversationId, TEST_FILE, TEST_CONTENT); return "fichier créé dans le sandbox"; });
  const command = () => run("command", async () => {
    const { result } = await executeForgeRuntimeCommand(conversationId, { command: "node", args: ["--version"], cwd: ".", timeoutMs: 10_000, maxOutputBytes: 10_000 });
    const output = result.stdout.trim().slice(0, 200);
    if (result.timedOut || result.exitCode !== 0) throw new Error(`Commande refusée · exitCode ${result.exitCode ?? "—"}`);
    return `exitCode ${result.exitCode} · ${output || "sortie vide"}`;
  });
  const git = () => run("git", async () => {
    const [{ status }, { diff }] = await Promise.all([getForgeRuntimeGitStatus(conversationId), getForgeRuntimeGitDiff(conversationId)]);
    const paths = [...status.added, ...status.modified, ...status.deleted];
    if (!paths.includes(TEST_FILE)) throw new Error("Le fichier test n’est pas détecté par Git.");
    return `Git status · Changes: ${paths.length} · Git diff: PASS${diff.truncated ? " (borné)" : ""}`;
  });
  const cleanup = () => run("cleanup", async () => {
    await deleteForgeRuntimeFile(conversationId, TEST_FILE);
    const { status } = await getForgeRuntimeGitStatus(conversationId);
    const paths = [...status.added, ...status.modified, ...status.deleted];
    if (paths.includes(TEST_FILE)) throw new Error("Le fichier test est encore détecté par Git.");
    return `fichier supprimé · Changes restantes: ${paths.length}`;
  });

  const tests: Array<{ name: TestName; label: string; action: () => Promise<void> }> = [
    { name: "read", label: "Tester la lecture", action: read },
    { name: "write", label: "Créer fichier test", action: write },
    { name: "command", label: "Tester commande", action: command },
    { name: "git", label: "Vérifier Git", action: git },
    { name: "cleanup", label: "Nettoyer le test", action: cleanup },
  ];

  return <details className="mt-3 rounded-md border border-white/10 bg-black/20 p-2">
    <summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 font-black text-white">Diagnostic Runtime<ChevronDown className="ml-auto h-4 w-4" /></summary>
    <div className="mt-2 grid gap-2">
      {tests.map((test) => {
        const result = results[test.name];
        return <div key={test.name} className="rounded-md border border-white/10 p-2">
          <button type="button" onClick={test.action} disabled={Boolean(active)} className="flex min-h-10 w-full items-center justify-center gap-2 rounded-md bg-white/10 px-3 py-2 font-black text-white disabled:opacity-40">
            {result.state === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}{test.label}
          </button>
          <p aria-live="polite" className={`mt-2 break-words text-[11px] ${result.state === "pass" ? "text-emerald-300" : result.state === "fail" ? "text-red-300" : "text-noline-muted"}`}>
            {result.state === "pass" ? "PASS — " : result.state === "fail" ? "FAIL — " : ""}{result.message}
          </p>
        </div>;
      })}
    </div>
  </details>;
}

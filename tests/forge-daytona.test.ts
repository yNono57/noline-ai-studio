/* eslint-disable @typescript-eslint/no-require-imports */
const daytonaAssert = require("node:assert/strict");
const daytonaTest = require("node:test");
const daytonaFs = require("node:fs");
const daytonaPath = require("node:path");
const { parseGitPorcelain, quoteSandboxArgument } = require("../lib/forge/daytona-foundation.ts");
const provider = daytonaFs.readFileSync("lib/forge/daytona-runtime-provider.ts", "utf8");
const github = daytonaFs.readFileSync("lib/forge/github-provider.ts", "utf8");
const runtimeRoot = "app/api/forge/conversations/[conversationId]/workspace/runtime";

daytonaTest("SDK Daytona officiel est fixe", () => {
  const manifest = JSON.parse(daytonaFs.readFileSync("package.json", "utf8"));
  daytonaAssert.equal(manifest.dependencies["@daytona/sdk"], "0.207.0");
});

daytonaTest("arguments sandbox sont cites sans permettre une injection shell", () => {
  daytonaAssert.equal(quoteSandboxArgument("src/a b.ts"), "'src/a b.ts'");
  daytonaAssert.equal(quoteSandboxArgument("a'b"), "'a'\"'\"'b'");
});

daytonaTest("git status classe added modified deleted", () => {
  const status = parseGitPorcelain("?? added.ts\0 M modified.ts\0D  deleted.ts\0");
  daytonaAssert.deepEqual(status, { added: ["added.ts"], modified: ["modified.ts"], deleted: ["deleted.ts"] });
});

daytonaTest("provisioning clone le SHA immuable et nettoie les credentials Git", () => {
  daytonaAssert.match(provider, /sandbox\.git\.clone\(url, ROOT, source\.branch, source\.baseCommitSha/);
  daytonaAssert.match(provider, /git rev-parse HEAD/);
  daytonaAssert.match(provider, /git remote -v/);
  daytonaAssert.match(provider, /git remote set-url origin/);
  daytonaAssert.match(provider, /credentialLeaked/);
  daytonaAssert.match(provider, /delete source\.credential/);
});

daytonaTest("token GitHub de provisioning est limite au repository et contents read", () => {
  daytonaAssert.match(github, /repositories: \[repo\]/);
  daytonaAssert.match(github, /permissions: \{ contents: "read" \}/);
  daytonaAssert.doesNotMatch(github, /contents: "write"/);
});

daytonaTest("aucune execution de commande n'utilise le host Vercel", () => {
  daytonaAssert.doesNotMatch(provider, /child_process|execSync|spawnSync|Bun\.spawn|Deno\.Command/);
  daytonaAssert.match(provider, /sandbox\.process\.executeSessionCommand/);
});

daytonaTest("routes runtime rederivent toutes l'utilisateur authentifie", () => {
  const routes = ["route.ts", "file/route.ts", "files/route.ts", "command/route.ts", "git/status/route.ts", "git/diff/route.ts"];
  for (const route of routes) {
    const source = daytonaFs.readFileSync(daytonaPath.join(runtimeRoot, route), "utf8");
    daytonaAssert.match(source, /authenticateForge\(request\)/);
    daytonaAssert.doesNotMatch(source, /providerRuntimeId|DAYTONA_API_KEY|GITHUB_APP_PRIVATE_KEY/);
  }
});

daytonaTest("provider expose status et diff mais aucune capacite commit ou push", () => {
  daytonaAssert.match(provider, /git status --porcelain/);
  daytonaAssert.match(provider, /git diff --no-ext-diff/);
  daytonaAssert.doesNotMatch(provider, /git commit|git push|\.git\.commit|\.git\.push/);
});

daytonaTest("sorties et durees de commande sont bornees", () => {
  daytonaAssert.match(provider, /command\.maxOutputBytes/);
  daytonaAssert.match(provider, /Math\.ceil\(command\.timeoutMs \/ 1000\)/);
  daytonaAssert.match(provider, /timedOut: true/);
});

daytonaTest("aucun secret provider n'est journalise ou retourne", () => {
  daytonaAssert.doesNotMatch(provider, /console\.|return apiKey|Authorization/);
  const shared = daytonaFs.readFileSync(daytonaPath.join(runtimeRoot, "_shared.ts"), "utf8");
  daytonaAssert.doesNotMatch(shared, /stack|cause|process\.env/);
});
daytonaTest("suppression runtime reste confinée au sandbox et authentifiée", () => {
  daytonaAssert.match(provider, /sandbox\.fs\.deleteFile\(sandboxPath\(path\), false\)/);
  const route = daytonaFs.readFileSync(daytonaPath.join(runtimeRoot, "file/route.ts"), "utf8");
  daytonaAssert.match(route, /export async function DELETE/);
  daytonaAssert.match(route, /authenticateForge\(request\)/);
  daytonaAssert.match(route, /forgeRuntimeService\.deleteFile\(user\.id, conversationId, path\)/);
});

daytonaTest("interface diagnostic utilise seulement les API runtime bornées", () => {
  const ui = daytonaFs.readFileSync("components/ForgeRuntimeDiagnostics.tsx", "utf8");
  for (const label of ["Tester la lecture", "Créer fichier test", "Tester commande", "Vérifier Git", "Nettoyer le test"]) daytonaAssert.match(ui, new RegExp(label));
  daytonaAssert.match(ui, /command: "node"/);
  daytonaAssert.match(ui, /timeoutMs: 10_000/);
  daytonaAssert.doesNotMatch(ui, /DAYTONA_API_KEY|GITHUB_APP_PRIVATE_KEY|installation token|git commit|git push/i);
});

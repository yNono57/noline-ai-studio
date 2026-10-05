/* global console, URL */
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const POLICY_PATH = fileURLToPath(new URL("../../config/security/npm-audit-exceptions.json", import.meta.url));

export function evaluateAuditReport(report, policy, now = new Date()) {
  const exceptions = new Map(policy.exceptions.map((entry) => [entry.advisoryId.toUpperCase(), entry]));
  const accepted = new Set();
  const rejected = [];
  const visiting = new Set();

  function advisoryId(via) {
    const match = typeof via.url === "string" ? via.url.match(/GHSA-[a-z0-9-]+/i) : null;
    return match?.[0]?.toUpperCase() ?? null;
  }

  function isAcceptedPackage(name) {
    if (visiting.has(name)) return false;
    const vulnerability = report.vulnerabilities?.[name];
    if (!vulnerability) return false;
    visiting.add(name);
    let allowed = vulnerability.via.length > 0;
    for (const via of vulnerability.via) {
      if (typeof via === "string") {
        allowed = isAcceptedPackage(via) && allowed;
        continue;
      }
      const id = advisoryId(via);
      const exception = id ? exceptions.get(id) : null;
      const expiry = exception ? new Date(`${exception.expiresOn}T23:59:59.999Z`) : null;
      if (!exception || exception.package !== via.name || !expiry || now > expiry) allowed = false;
      else accepted.add(id);
    }
    visiting.delete(name);
    return allowed;
  }

  for (const name of Object.keys(report.vulnerabilities ?? {})) if (!isAcceptedPackage(name)) rejected.push(name);
  return { accepted: [...accepted].sort(), rejected: [...new Set(rejected)].sort() };
}

export function loadAuditPolicy() {
  return JSON.parse(readFileSync(POLICY_PATH, "utf8"));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const npmCli = process.env.npm_execpath;
  const result = npmCli
    ? spawnSync(process.execPath, [npmCli, "audit", "--json"], { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 })
    : spawnSync(process.platform === "win32" ? "npm.cmd" : "npm", ["audit", "--json"], { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 });
  if (!result.stdout) { console.error("SECURITY AUDIT FAILED: npm audit returned no JSON report."); process.exit(1); }
  let report;
  try { report = JSON.parse(result.stdout); } catch { console.error("SECURITY AUDIT FAILED: npm audit output was not valid JSON."); process.exit(1); }
  const evaluation = evaluateAuditReport(report, loadAuditPolicy(), new Date());
  if (evaluation.rejected.length > 0) { console.error(`SECURITY AUDIT FAILED: unapproved vulnerable packages: ${evaluation.rejected.join(", ")}`); process.exit(1); }
  if (evaluation.accepted.length === 0 && (report.metadata?.vulnerabilities?.total ?? 0) > 0) { console.error("SECURITY AUDIT FAILED: vulnerabilities were present but no approved advisory matched."); process.exit(1); }
  if (evaluation.accepted.length > 0) console.log(`SECURITY AUDIT PASS WITH TEMPORARY EXCEPTION: ${evaluation.accepted.join(", ")}`);
  else console.log("SECURITY AUDIT PASS: zero advisories accepted.");
}

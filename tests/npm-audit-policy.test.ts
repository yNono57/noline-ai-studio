import assert from "node:assert/strict";
import test from "node:test";
import { evaluateAuditReport, loadAuditPolicy } from "../scripts/security/audit-policy.mjs";

const advisory = { source: 1240992, name: "braces", url: "https://github.com/advisories/GHSA-vfj7-8cjw-p6xm" };
const report = (extra = {}) => ({ vulnerabilities: { braces: { via: [advisory] }, micromatch: { via: ["braces"] }, "fast-glob": { via: ["micromatch"] }, "@daytona/sdk": { via: ["fast-glob"] }, ...extra }, metadata: { vulnerabilities: { total: 4 } } });

test("temporary policy accepts only the approved braces advisory and its dependency effects", () => {
  assert.deepEqual(evaluateAuditReport(report(), loadAuditPolicy(), new Date("2026-10-10T12:00:00Z")), { accepted: ["GHSA-VFJ7-8CJW-P6XM"], rejected: [] });
});

test("an unrelated advisory still fails the security gate", () => {
  const result = evaluateAuditReport(report({ other: { via: [{ name: "other", url: "https://github.com/advisories/GHSA-aaaa-bbbb-cccc" }] } }), loadAuditPolicy(), new Date("2026-10-10T12:00:00Z"));
  assert.deepEqual(result.rejected, ["other"]);
});

test("the exception fails closed after 2026-10-19", () => {
  const result = evaluateAuditReport(report(), loadAuditPolicy(), new Date("2026-10-20T00:00:00Z"));
  assert.ok(result.rejected.includes("braces"));
  assert.ok(result.rejected.includes("@daytona/sdk"));
});

test("package and advisory identity must both match", () => {
  const result = evaluateAuditReport(report({ braces: { via: [{ ...advisory, name: "not-braces" }] } }), loadAuditPolicy(), new Date("2026-10-10T12:00:00Z"));
  assert.ok(result.rejected.includes("braces"));
});

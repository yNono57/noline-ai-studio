import assert from "node:assert/strict";
import test from "node:test";
import { EnvironmentIsolationError, SUPABASE_PROJECTS, assertSupabaseMutationEnvironment, inspectEnvironmentIdentity } from "../lib/environment-identity";

const url = (ref: string) => `https://${ref}.supabase.co`;

test("Preview + STAGING is allowed", () => {
  assert.equal(assertSupabaseMutationEnvironment({ VERCEL_ENV: "preview", NEXT_PUBLIC_SUPABASE_URL: url(SUPABASE_PROJECTS.staging) }).mutationGuard, "PASS");
});

test("Preview + Production is rejected before mutation", () => {
  assert.throws(() => assertSupabaseMutationEnvironment({ VERCEL_ENV: "preview", NEXT_PUBLIC_SUPABASE_URL: url(SUPABASE_PROJECTS.production) }), EnvironmentIsolationError);
});

test("Production accepts only Production", () => {
  assert.equal(assertSupabaseMutationEnvironment({ VERCEL_ENV: "production", NEXT_PUBLIC_SUPABASE_URL: url(SUPABASE_PROJECTS.production) }).mutationGuard, "PASS");
  assert.throws(() => assertSupabaseMutationEnvironment({ VERCEL_ENV: "production", NEXT_PUBLIC_SUPABASE_URL: url(SUPABASE_PROJECTS.staging) }), EnvironmentIsolationError);
});

test("Development requires an explicit non-Production project ref", () => {
  assert.equal(assertSupabaseMutationEnvironment({ NODE_ENV: "development", NOLINE_DEVELOPMENT_SUPABASE_PROJECT_REF: SUPABASE_PROJECTS.staging, NEXT_PUBLIC_SUPABASE_URL: url(SUPABASE_PROJECTS.staging) }).mutationGuard, "PASS");
  assert.throws(() => assertSupabaseMutationEnvironment({ NODE_ENV: "development", NEXT_PUBLIC_SUPABASE_URL: url(SUPABASE_PROJECTS.staging) }), EnvironmentIsolationError);
  assert.throws(() => assertSupabaseMutationEnvironment({ NODE_ENV: "development", NOLINE_DEVELOPMENT_SUPABASE_PROJECT_REF: SUPABASE_PROJECTS.production, NEXT_PUBLIC_SUPABASE_URL: url(SUPABASE_PROJECTS.production) }), EnvironmentIsolationError);
});

test("Missing and unknown projects fail closed", () => {
  assert.equal(inspectEnvironmentIdentity({ VERCEL_ENV: "preview" }).mutationGuard, "REJECTED");
  assert.throws(() => assertSupabaseMutationEnvironment({ VERCEL_ENV: "preview", NEXT_PUBLIC_SUPABASE_URL: "https://unknown.invalid" }), EnvironmentIsolationError);
});

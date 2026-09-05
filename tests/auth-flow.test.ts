{
/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const { registerHooks } = require("node:module");

registerHooks({ resolve(specifier: string, context: unknown, nextResolve: (value: string, context: unknown) => unknown) { try { return nextResolve(specifier, context); } catch (error) { if (specifier.startsWith(".") && !specifier.endsWith(".ts")) return nextResolve(`${specifier}.ts`, context); throw error; } } });

const { buildPasswordRecoveryRedirect, INVALID_LOGIN_MESSAGE, isInvalidLoginError, SAFE_RESET_MESSAGE, SAFE_SIGNUP_MESSAGE } = require("../lib/supabase-client.ts");
const clientSource = fs.readFileSync(path.join(process.cwd(), "lib/supabase-client.ts"), "utf8");
const loginSource = fs.readFileSync(path.join(process.cwd(), "components/LoginForm.tsx"), "utf8");
const recoverySource = fs.readFileSync(path.join(process.cwd(), "components/ResetPasswordForm.tsx"), "utf8");

test("inscription nouvelle et potentiellement existante: message identique et non révélateur", () => {
  assert.match(clientSource, /\.auth\.signUp\(/);
  assert.match(SAFE_SIGNUP_MESSAGE, /Si cette adresse peut être utilisée/);
  assert.doesNotMatch(SAFE_SIGNUP_MESSAGE, /existe déjà|n'existe pas/i);
});

test("confirmation email requise: l'UX demande de vérifier la boîte mail", () => {
  assert.match(SAFE_SIGNUP_MESSAGE, /email de confirmation/);
  assert.match(SAFE_SIGNUP_MESSAGE, /confirmer ton adresse/);
});

test("mauvais mot de passe: message utile sans énumération", () => {
  assert.equal(isInvalidLoginError(new Error("Invalid login credentials")), true);
  assert.match(INVALID_LOGIN_MESSAGE, /Email ou mot de passe incorrect/);
  assert.match(INVALID_LOGIN_MESSAGE, /réinitialiser/);
});

test("récupération: API officielle et message neutre", () => {
  assert.match(clientSource, /\.auth\.resetPasswordForEmail\(/);
  assert.match(loginSource, /Mot de passe oublié \?/);
  assert.doesNotMatch(SAFE_RESET_MESSAGE, /aucun compte|compte existe/i);
});

test("retour recovery: URL Production et Preview conserve l'origine", () => {
  assert.equal(buildPasswordRecoveryRedirect("https://noline-ai.fr"), "https://noline-ai.fr/auth/reset-password");
  assert.equal(buildPasswordRecoveryRedirect("https://preview.vercel.app/"), "https://preview.vercel.app/auth/reset-password");
  assert.match(recoverySource, /onPasswordRecovery/);
});

test("nouveau mot de passe: updateUser puis retour connexion", () => {
  assert.match(clientSource, /\.auth\.updateUser\(\{ password \}\)/);
  assert.match(recoverySource, /password !== confirmation/);
  assert.match(recoverySource, /\/login\?passwordUpdated=1/);
});

test("connexion: méthode officielle signInWithPassword", () => {
  assert.match(clientSource, /\.auth\.signInWithPassword\(/);
});
}

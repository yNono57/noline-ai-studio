{
/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");

const shell = fs.readFileSync(path.join(process.cwd(), "components/Shell.tsx"), "utf8");
const mobile = fs.readFileSync(path.join(process.cwd(), "components/MobileNavigation.tsx"), "utf8");
const auth = fs.readFileSync(path.join(process.cwd(), "lib/supabase-client.ts"), "utf8");

test("navigation mobile déconnectée: bouton explicite vers login", () => {
  assert.match(mobile, />Se connecter<\/Link>/);
  assert.match(mobile, /href="\/login"/);
  assert.match(mobile, /"Ouvrir le menu"/);
});

test("navigation mobile connectée: compte, abonnement et déconnexion", () => {
  assert.match(mobile, /href="\/settings"/);
  assert.match(mobile, /Compte et profil/);
  assert.match(mobile, /href="\/pricing"/);
  assert.match(mobile, /Abonnement et quota/);
  assert.match(mobile, /Déconnexion/);
  assert.match(mobile, /await signOutLocal\(\)/);
});

test("les produits réellement routés sont accessibles sans annoncer Apex", () => {
  assert.match(mobile, /href: "\/nova"/);
  assert.match(mobile, /href: "\/generate"/);
  assert.match(mobile, /href: "\/forge"/);
  assert.doesNotMatch(mobile, /href: "\/apex"/);
});

test("drawer refermable par navigation, overlay, bouton et Escape", () => {
  assert.match(mobile, /setOpen\(false\)[\s\S]*\[pathname\]/);
  assert.match(mobile, /event\.key === "Escape"/);
  assert.match(mobile, /aria-label=\{open \? "Fermer le menu" : "Ouvrir le menu"\}/);
  assert.match(mobile, /aria-label="Fermer le menu" onClick=\{\(\) => setOpen\(false\)\}/);
});

test("zones tactiles et scroll mobile sont bornés", () => {
  assert.match(mobile, /min-h-11/);
  assert.match(mobile, /h-11 w-11/);
  assert.match(mobile, /overflow-y-auto/);
  assert.match(mobile, /document\.body\.style\.overflow = "hidden"/);
});

test("desktop conserve sa sidebar et le header mobile disparaît à lg", () => {
  assert.match(shell, /lg:grid-cols-\[17rem_1fr\]/);
  assert.match(shell, /lg:flex/);
  assert.match(mobile, /lg:hidden/);
});

test("les changements de session mettent le menu à jour dans le même onglet", () => {
  assert.match(auth, /new CustomEvent\("noline-auth-session"/);
  assert.match(mobile, /addEventListener\("noline-auth-session"/);
});
}

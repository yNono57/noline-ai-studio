export {};
/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const { isForgeChatNearBottom, scrollForgeChatToLatest } = require("../lib/forge/chat-scroll.ts");

test("conversation longue distingue proximité du bas et remontée manuelle", () => {
  assert.equal(isForgeChatNearBottom({ scrollHeight: 2_000, scrollTop: 1_450, clientHeight: 500 }), true);
  assert.equal(isForgeChatNearBottom({ scrollHeight: 2_000, scrollTop: 900, clientHeight: 500 }), false);
});

test("bouton Récent cible exactement le bas du viewport conversationnel", () => {
  let request: ScrollToOptions | null = null;
  const viewport = { scrollHeight: 2_400, scrollTop: 400, clientHeight: 500, scrollTo: (options: ScrollToOptions) => { request = options; } };
  scrollForgeChatToLatest(viewport, "smooth");
  assert.deepEqual(request, { top: 2_400, behavior: "smooth" });
});

test("restauration et nouvelles étapes restent liées au fil sans boucle de page", () => {
  const source = fs.readFileSync("components/ForgeWorkspace.tsx", "utf8");
  assert.match(source, /h-\[calc\(100dvh-1rem\)\][^\n]*overflow-hidden/);
  assert.match(source, /agentPayload\?\.steps\.length[\s\S]*scrollForgeChatToLatest\(messagesViewport\.current, "smooth"\)/);
  assert.match(source, /onScroll=[\s\S]*isForgeChatNearBottom\(node\)[\s\S]*setShowLatestButton\(!nearBottom\)/);
  assert.match(source, /const scrollToLatest[\s\S]*followMessages\.current = true[\s\S]*scrollForgeChatToLatest\(messagesViewport\.current, "smooth"\)/);
  assert.match(source, /contentLoadedConversationId !== conversationId[\s\S]*scrollForgeChatToLatest\(messagesViewport\.current, "auto"\)[\s\S]*conversationSection\.current\?\.scrollIntoView/);
});
test("session mobile garde le chat prioritaire et le Workspace hors du flux", () => {
  const source = fs.readFileSync("components/ForgeWorkspace.tsx", "utf8");
  const drawer = fs.readFileSync("components/ForgeWorkspaceDrawer.tsx", "utf8");
  assert.match(source, /aria-label="Ouvrir le Workspace"/);
  assert.match(source, /overflow-y-auto overscroll-contain/);
  assert.match(source, /Conversation<\/button>[\s\S]*>Forge<\/button>/);
  assert.match(drawer, /fixed inset-y-0 right-0[\s\S]*xl:static/);
  assert.match(drawer, /onClick=\{onClose\}/);
  const shell = fs.readFileSync("components/Shell.tsx", "utf8");
  assert.equal(shell.includes('const forgeWorkspace = pathname === "/forge"'), true);
  assert.match(shell, /forgeWorkspace \? "hidden"/);
});

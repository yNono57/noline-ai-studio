/* eslint-disable @typescript-eslint/no-require-imports */
const failureAssert = require("node:assert/strict");
const failureTest = require("node:test");
const { registerHooks: registerFailureHooks } = require("node:module");

registerFailureHooks({
  resolve(specifier: string, context: unknown, nextResolve: (value: string, context: unknown) => unknown) {
    try {
      return nextResolve(specifier, context);
    } catch (error) {
      if (specifier.startsWith(".") && !specifier.endsWith(".ts")) return nextResolve(`${specifier}.ts`, context);
      throw error;
    }
  },
});

const { generateNovaReply } = require("../lib/chat/nova-openai.ts");

failureTest("une panne du web search passe par le fallback réel sans appel API", async () => {
  const previousKey = process.env.OPENAI_API_KEY;
  const previousError = console.error;
  process.env.OPENAI_API_KEY = "test-only-not-a-real-key";
  console.error = () => undefined;
  try {
    const reply = await generateNovaReply([
      {
        id: "user-current-price",
        conversation_id: "conversation-test",
        role: "USER",
        content: "Quel est le meilleur prix actuel de la Galaxy Watch8 Classic 46 mm en France ?",
        metadata: null,
        created_at: "2026-09-03T00:00:00.000Z",
      },
    ], async () => { throw new Error("mock web search failure"); });
    failureAssert.equal(reply.searchUsed, false);
    failureAssert.equal(reply.searchFailed, true);
    failureAssert.deepEqual(reply.sources, []);
    failureAssert.match(reply.text, /recherche en direct a échoué/i);
  } finally {
    console.error = previousError;
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousKey;
  }
});

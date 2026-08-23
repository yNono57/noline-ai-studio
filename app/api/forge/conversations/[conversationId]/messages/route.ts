import { NextResponse } from "next/server";
import { createForgeMessage, listForgeMessages, type ForgeMessage } from "@/lib/forge/forge-store";
import { ForgeGenerationError, generateForgeReply } from "@/lib/forge/forge-openai";
import { authenticateForge, forgeErrorResponse, parseForgeMessageInput } from "../../../_shared";

type Context = { params: Promise<{ conversationId: string }> };

export async function GET(request: Request, { params }: Context) {
  try {
    const user = await authenticateForge(request);
    const { conversationId } = await params;
    return NextResponse.json({ messages: await listForgeMessages(user.id, conversationId) });
  } catch (error) { return forgeErrorResponse(error); }
}

export async function POST(request: Request, { params }: Context) {
  try {
    const user = await authenticateForge(request);
    const { conversationId } = await params;
    const input = await parseForgeMessageInput(request);
    let history = await listForgeMessages(user.id, conversationId);
    let userMessage: ForgeMessage;

    if (input.userMessageId) {
      const existing = history.find((message) => message.id === input.userMessageId && message.role === "USER");
      if (!existing) return NextResponse.json({ error: "Message utilisateur introuvable." }, { status: 404 });
      userMessage = existing;
    } else {
      userMessage = await createForgeMessage(user.id, conversationId, { role: "USER", content: input.content });
      history = [...history, userMessage];
    }

    const existingAssistant = history.find((message) => message.role === "ASSISTANT" && message.metadata?.reply_to_message_id === userMessage.id);
    if (existingAssistant) return NextResponse.json({ user_message: userMessage, assistant_message: existingAssistant });

    try {
      const reply = await generateForgeReply(history);
      const assistantMessage = await createForgeMessage(user.id, conversationId, {
        role: "ASSISTANT", content: reply.text, metadata: { model: reply.model, reply_to_message_id: userMessage.id }
      });
      return NextResponse.json({ user_message: userMessage, assistant_message: assistantMessage }, { status: 201 });
    } catch (error) {
      if (error instanceof ForgeGenerationError) {
        return NextResponse.json({ error: error.message, user_message: userMessage }, { status: 502 });
      }
      throw error;
    }
  } catch (error) { return forgeErrorResponse(error); }
}

import { NextResponse } from "next/server";
import { createMessage, listMessages, type Message } from "@/lib/chat/conversation-store";
import { generateNovaReply, NovaGenerationError } from "@/lib/chat/nova-openai";
import {
  authenticate,
  parseNovaMessageInput,
  routeErrorResponse
} from "../../../_shared";

type RouteContext = { params: Promise<{ conversationId: string }> };

export async function GET(request: Request, { params }: RouteContext) {
  try {
    const user = await authenticate(request);
    const { conversationId } = await params;
    const messages = await listMessages(user, conversationId);
    return NextResponse.json({ messages }, { status: 200 });
  } catch (error) {
    return routeErrorResponse(error);
  }
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const user = await authenticate(request);
    const { conversationId } = await params;
    const input = await parseNovaMessageInput(request);
    let history = await listMessages(user, conversationId);
    let userMessage: Message;

    if (input.userMessageId) {
      const existing = history.find(
        (message) => message.id === input.userMessageId && message.role === "USER"
      );
      if (!existing) {
        return NextResponse.json({ error: "Message utilisateur introuvable." }, { status: 404 });
      }
      userMessage = existing;
    } else {
      userMessage = await createMessage(user, conversationId, {
        role: "USER",
        content: input.content
      });
      history = [...history, userMessage];
    }

    const existingAssistant = history.find(
      (message) => message.role === "ASSISTANT" &&
        message.metadata?.reply_to_message_id === userMessage.id
    );
    if (existingAssistant) {
      return NextResponse.json(
        { user_message: userMessage, assistant_message: existingAssistant },
        { status: 200 }
      );
    }

    try {
      const reply = await generateNovaReply(history);
      const assistantMessage = await createMessage(user, conversationId, {
        role: "ASSISTANT",
        content: reply.text,
        metadata: {
          model: reply.model,
          reply_to_message_id: userMessage.id,
          responseId: reply.responseId,
          searchUsed: reply.searchUsed,
          searchFailed: reply.searchFailed || false,
          sources: reply.sources,
          webSearchCallCount: reply.webSearchCallCount,
          usage: reply.usage,
        }
      });
      return NextResponse.json(
        { user_message: userMessage, assistant_message: assistantMessage },
        { status: 201 }
      );
    } catch (error) {
      if (error instanceof NovaGenerationError) {
        return NextResponse.json(
          { error: error.message, user_message: userMessage },
          { status: 502 }
        );
      }
      throw error;
    }
  } catch (error) {
    return routeErrorResponse(error);
  }
}

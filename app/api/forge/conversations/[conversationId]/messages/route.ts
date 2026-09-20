import { NextResponse } from "next/server";
import { createForgeMessage, ensureForgeConversationTitle, getForgeConversation, getForgeProject, listForgeMessages, type ForgeMessage } from "@/lib/forge/forge-store";
import { ForgeGenerationError, generateForgeReply } from "@/lib/forge/forge-openai";
import { authenticateForge, forgeErrorResponse, parseForgeMessageInput } from "../../../_shared";
import { requireActiveGitHubConnection } from "@/lib/forge/github-store";
import { readRepositoryFile } from "@/lib/forge/github-provider";
import { formatUntrustedRepositoryContext } from "@/lib/forge/github-foundation";
import { githubErrorResponse } from "../../../github/_shared";
import { PAID_API_LIMITS, protectPaidApi } from "@/lib/paid-api-security";

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
    const access = await protectPaidApi(request, "forge-message", PAID_API_LIMITS.generation);
    if ("response" in access) return access.response;
    const user = await authenticateForge(request);
    const { conversationId } = await params;
    const input = await parseForgeMessageInput(request);
    let history = await listForgeMessages(user.id, conversationId);
    let userMessage: ForgeMessage | undefined;

    if (input.userMessageId) {
      const existing = history.find((message) => message.id === input.userMessageId && message.role === "USER");
      if (!existing) return NextResponse.json({ error: "Message utilisateur introuvable." }, { status: 404 });
      userMessage = existing;
    }

    if (userMessage) {
      const retryMessage = userMessage;
      const existingAssistant = history.find((message) => message.role === "ASSISTANT" && message.metadata?.reply_to_message_id === retryMessage.id);
      if (existingAssistant) return NextResponse.json({ user_message: retryMessage, assistant_message: existingAssistant, conversation: await ensureForgeConversationTitle(user.id, conversationId, retryMessage.content) });
    }

    let repositoryContext = "";
    if (input.contextPaths.length) {
      const conversation = await getForgeConversation(user.id, conversationId);
      const project = await getForgeProject(user.id, conversation.forge_project_id);
      if (project.repository_provider !== "github" || !project.repository_identifier || !project.default_branch) return NextResponse.json({ error: "Aucun repository GitHub autorisé n’est associé à ce projet." }, { status: 409 });
      const [owner, repo, extra] = project.repository_identifier.split("/");
      if (!owner || !repo || extra) return NextResponse.json({ error: "Repository Forge invalide." }, { status: 400 });
      const connection = await requireActiveGitHubConnection(user.id);
      const files = await Promise.all(input.contextPaths.map((filePath) => readRepositoryFile(connection.installationId, owner, repo, project.default_branch as string, filePath)));
      repositoryContext = formatUntrustedRepositoryContext(files);
    }

    if (!userMessage) {
      userMessage = await createForgeMessage(user.id, conversationId, { role: "USER", content: input.content });
      history = [...history, userMessage];
    }
    const titledConversation = await ensureForgeConversationTitle(user.id, conversationId, userMessage.content);

    try {
      const reply = await generateForgeReply(history, repositoryContext);
      const assistantMessage = await createForgeMessage(user.id, conversationId, {
        role: "ASSISTANT", content: reply.text, metadata: { model: reply.model, reply_to_message_id: userMessage.id }
      });
      return NextResponse.json({ user_message: userMessage, assistant_message: assistantMessage, conversation: titledConversation }, { status: 201 });
    } catch (error) {
      if (error instanceof ForgeGenerationError) {
        return NextResponse.json({ error: error.message, user_message: userMessage }, { status: 502 });
      }
      throw error;
    }
  } catch (error) { return githubErrorResponse(error); }
}

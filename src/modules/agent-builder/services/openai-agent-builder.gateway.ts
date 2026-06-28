import OpenAI from "openai";
import type { AgentBuilderGateway, AgentBuilderRequest } from "./agent-builder.service";
import { getAgentBuilderSchema } from "./agent-builder.schemas";

interface RecommendationsEnvelope {
  recommendations: unknown[];
}

/**
 * Provider OpenAI du module Agent Builder.
 *
 * Les expertises historiques et les modules V3/V4 passent par cette frontière
 * unique. Structured Outputs garantit que chaque réponse respecte le contrat
 * JSON propre à sa tâche avant de poursuivre le pipeline.
 */
export class OpenAIAgentBuilderGateway implements AgentBuilderGateway {
  private readonly client: OpenAI;

  constructor(apiKey: string, private readonly model = "gpt-4.1-mini") {
    this.client = new OpenAI({ apiKey });
  }

  async generate<TResult>(request: AgentBuilderRequest): Promise<TResult> {
    const completion = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        { role: "system", content: request.systemPrompt },
        { role: "user", content: request.userPrompt }
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: request.task,
          strict: true,
          schema: getAgentBuilderSchema(request.task)
        }
      }
    });

    const message = completion.choices[0]?.message;
    if (message?.refusal) {
      throw new Error(`OpenAI a refusé la génération : ${message.refusal}`);
    }
    if (!message?.content) {
      throw new Error("OpenAI n'a retourné aucun contenu.");
    }

    const parsed: unknown = JSON.parse(message.content);
    if (request.task === "generate_recommendations") {
      return (parsed as RecommendationsEnvelope).recommendations as TResult;
    }
    return parsed as TResult;
  }
}

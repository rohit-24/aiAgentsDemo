import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { BaseMessage, AIMessage, HumanMessage, SystemMessage, ToolMessage } from "@langchain/core/messages";
import { ChatResult, ChatGeneration } from "@langchain/core/outputs";
import { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import { StructuredToolInterface } from "@langchain/core/tools";

interface ClaudeMessage {
  role: "user" | "assistant";
  content: ClaudeContent[];
}

interface ClaudeContent {
  type: "text" | "tool_use" | "tool_result";
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  tool_use_id?: string;
  content?: string;
}

interface ClaudeTool {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

interface ClaudeResponse {
  id: string;
  type: string;
  role: string;
  content: ClaudeContent[];
  model: string;
  stop_reason: string;
  stop_sequence: string | null;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

interface CustomClaudeInput {
  endpoint: string;
  bearerToken: string;
  anthropicVersion?: string;
  maxTokens?: number;
  temperature?: number;
}

export class CustomClaudeLLM extends BaseChatModel {
  private endpoint: string;
  private bearerToken: string;
  private anthropicVersion: string;
  private maxTokens: number;
  private temperature: number;
  private boundTools: ClaudeTool[] = [];

  constructor(config: CustomClaudeInput) {
    super({});
    this.endpoint = config.endpoint;
    this.bearerToken = config.bearerToken;
    this.anthropicVersion = config.anthropicVersion || "vertex-2023-10-16";
    this.maxTokens = config.maxTokens || 4096;
    this.temperature = config.temperature || 0.7;
  }

  _llmType(): string {
    return "custom-claude";
  }

  bindTools(tools: StructuredToolInterface[]): CustomClaudeLLM {
    const newInstance = new CustomClaudeLLM({
      endpoint: this.endpoint,
      bearerToken: this.bearerToken,
      anthropicVersion: this.anthropicVersion,
      maxTokens: this.maxTokens,
      temperature: this.temperature,
    });

    newInstance.boundTools = tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: {
        type: "object" as const,
        properties: (tool.schema as any)?.properties || {},
        required: (tool.schema as any)?.required || [],
      },
    }));

    return newInstance;
  }

  private convertMessagesToClaudeFormat(messages: BaseMessage[]): {
    systemPrompt: string | undefined;
    claudeMessages: ClaudeMessage[];
  } {
    let systemPrompt: string | undefined;
    const claudeMessages: ClaudeMessage[] = [];

    for (const message of messages) {
      if (message instanceof SystemMessage) {
        systemPrompt = message.content as string;
      } else if (message instanceof HumanMessage) {
        claudeMessages.push({
          role: "user",
          content: [{ type: "text", text: message.content as string }],
        });
      } else if (message instanceof AIMessage) {
        const content: ClaudeContent[] = [];

        if (message.content) {
          content.push({ type: "text", text: message.content as string });
        }

        // Handle tool calls from AIMessage
        if (message.tool_calls && message.tool_calls.length > 0) {
          for (const toolCall of message.tool_calls) {
            content.push({
              type: "tool_use",
              id: toolCall.id,
              name: toolCall.name,
              input: toolCall.args as Record<string, unknown>,
            });
          }
        }

        if (content.length > 0) {
          claudeMessages.push({ role: "assistant", content });
        }
      } else if (message instanceof ToolMessage) {
        claudeMessages.push({
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: message.tool_call_id,
              content: message.content as string,
            },
          ],
        });
      }
    }

    return { systemPrompt, claudeMessages };
  }

  async _generate(
    messages: BaseMessage[],
    _options: this["ParsedCallOptions"],
    _runManager?: CallbackManagerForLLMRun
  ): Promise<ChatResult> {
    const { systemPrompt, claudeMessages } = this.convertMessagesToClaudeFormat(messages);

    const payload: Record<string, unknown> = {
      anthropic_version: this.anthropicVersion,
      messages: claudeMessages,
      max_tokens: this.maxTokens,
      temperature: this.temperature,
    };

    if (systemPrompt) {
      payload.system = systemPrompt;
    }

    if (this.boundTools.length > 0) {
      payload.tools = this.boundTools;
    }

    const response = await fetch(this.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.bearerToken}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API request failed: ${response.status} - ${errorText}`);
    }

    const data: ClaudeResponse = await response.json();

    // Process response content
    let textContent = "";
    const toolCalls: { id: string; name: string; args: Record<string, unknown> }[] = [];

    for (const content of data.content) {
      if (content.type === "text" && content.text) {
        textContent += content.text;
      } else if (content.type === "tool_use") {
        toolCalls.push({
          id: content.id!,
          name: content.name!,
          args: content.input!,
        });
      }
    }

    const aiMessage = new AIMessage({
      content: textContent,
      tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
    });

    const generation: ChatGeneration = {
      text: textContent,
      message: aiMessage,
      generationInfo: {
        stop_reason: data.stop_reason,
        usage: data.usage,
      },
    };

    return {
      generations: [generation],
      llmOutput: {
        tokenUsage: {
          promptTokens: data.usage.input_tokens,
          completionTokens: data.usage.output_tokens,
          totalTokens: data.usage.input_tokens + data.usage.output_tokens,
        },
      },
    };
  }
}

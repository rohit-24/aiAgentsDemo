import { AgentExecutor, createToolCallingAgent } from "langchain/agents";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StructuredToolInterface } from "@langchain/core/tools";
import { HumanMessage } from "@langchain/core/messages";
import { CustomClaudeLLM } from "./customClaude";

interface AgentConfig {
  endpoint: string;
  bearerToken: string;
  tools?: StructuredToolInterface[];
  maxTokens?: number;
  temperature?: number;
}

export async function createClaudeAgent(config: AgentConfig) {
  const llm = new CustomClaudeLLM({
    endpoint: config.endpoint,
    bearerToken: config.bearerToken,
    maxTokens: config.maxTokens,
    temperature: config.temperature,
  });

  // If no tools provided, return a simple invoke function
  if (!config.tools || config.tools.length === 0) {
    return {
      invoke: async (input: string) => {
        const result = await llm.invoke([new HumanMessage(input)]);
        return {
          output: result.content,
        };
      },
    };
  }

  // Create agent with tools
  const prompt = ChatPromptTemplate.fromMessages([
    ["system", "You are a helpful assistant. Use the available tools when needed to answer user questions accurately."],
    ["human", "{input}"],
    ["placeholder", "{agent_scratchpad}"],
  ]);

  const llmWithTools = llm.bindTools(config.tools);
  const agent = createToolCallingAgent({
    llm: llmWithTools,
    tools: config.tools,
    prompt,
  });

  const agentExecutor = new AgentExecutor({
    agent,
    tools: config.tools,
    verbose: true,
  });

  return agentExecutor;
}

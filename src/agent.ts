import { AgentExecutor, createToolCallingAgent } from "langchain/agents";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { HumanMessage } from "@langchain/core/messages";
import { CustomClaudeLLM } from "./customClaude";

interface AgentConfig {
  endpoint: string;
  bearerToken: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tools?: any[];
  maxTokens?: number;
  temperature?: number;
}

interface AgentResult {
  invoke: (params: { input: string }) => Promise<{ output: unknown }>;
}

export async function createClaudeAgent(config: AgentConfig): Promise<AgentResult> {
  const llm = new CustomClaudeLLM({
    endpoint: config.endpoint,
    bearerToken: config.bearerToken,
    maxTokens: config.maxTokens,
    temperature: config.temperature,
  });

  // If no tools provided, return a simple invoke function
  if (!config.tools || config.tools.length === 0) {
    return {
      invoke: async (params: { input: string }) => {
        const result = await llm.invoke([new HumanMessage(params.input)]);
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

  return {
    invoke: async (params: { input: string }) => {
      const result = await agentExecutor.invoke(params);
      return { output: result.output };
    },
  };
}

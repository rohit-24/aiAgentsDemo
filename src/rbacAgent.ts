import { ChatPromptTemplate } from "@langchain/core/prompts";
import { createToolCallingAgent, AgentExecutor } from "langchain/agents";
import { HumanMessage } from "@langchain/core/messages";
import { CustomClaudeLLM } from "./customClaude";
import { FetchRBACRulesTool } from "./tools/rbacTool";

const RBAC_SYSTEM_PROMPT = `You are an expert RBAC (Role-Based Access Control) rule generator. Your job is to create new RBAC rules based on user requirements while following the exact format and patterns of existing rules.

## RBAC Rule Structure
Each rule must have the following fields:
- name: Follows pattern "RBAC_<API>_<SEGMENTS>_<COUNTRIES>_<USER_TYPE>_<ID>" (e.g., "RBAC_MONEY_TRANSFER_PB_SG_HK_USERS_195")
- description: Clear human-readable description starting with countries in parentheses
- target: Expression that defines WHO can access and WHAT action (uses subject.claims and action)
- condition: Expression that defines additional access conditions (often uses resource access)
- type: Usually "R" for rule
- overridable: "Y" or "N"
- hybrid: "Y" if for hybrid users, "N" otherwise

## Available Claims in target expressions:
- subject.claims['hybridUser']: "Y" or "N"
- subject.claims['segment']: Array - can contain 'RETAIL', 'PB', 'TREASURES', 'TPC'
- subject.claims['roles']: Array - can contain 'SSR', 'RM', etc.
- subject.claims['country']: Country code like 'SG', 'HK', 'IN', etc.
- action['api']: API name like 'CLIENT_EXCHANGE', 'MONEY_TRANSFER', etc.

## Expression Syntax:
- Use .contains('value') to check if array contains a single value
- Use .containsAll(['val1', 'val2']) to check if array contains all values
- Use ['val1', 'val2'].contains(value) to check if value is in a list
- Use == for equality, != for inequality
- Use && for AND, || for OR
- Wrap the entire expression in parentheses

## Example target expressions:
- Hybrid user check: subject.claims['hybridUser'] == 'Y'
- Non-hybrid: subject.claims['hybridUser'] == 'N'
- Country check: ['SG', 'HK'].contains(subject.claims['country'])
- Segment check: subject.claims['segment'].contains('PB')
- Multiple segments: subject.claims['segment'].containsAll(['TREASURES', 'TPC'])
- Exclude segments: !subject.claims['segment'].containsAll(['RETAIL', 'PB'])
- Role check: subject.claims['roles'].contains('SSR')
- API check: action['api'] == 'MONEY_TRANSFER'

## Example condition expressions:
- Always allow: "true"
- Resource access: (subject.hasAccess(['CUSTOMER']) && resource.customerDetails['segments'].contains('PB'))

## Your Task:
1. First, use the fetch_rbac_rules tool to get existing rules for context
2. Analyze the user's requirement
3. Generate a new rule following the exact structure and patterns
4. Return ONLY the JSON rule object(s), no additional explanation

Always output valid JSON that can be directly used in the RBAC system.`;

interface RBACAgentConfig {
  endpoint: string;
  bearerToken: string;
  maxTokens?: number;
  temperature?: number;
}

export async function createRBACAgent(config: RBACAgentConfig) {
  const llm = new CustomClaudeLLM({
    endpoint: config.endpoint,
    bearerToken: config.bearerToken,
    maxTokens: config.maxTokens || 4096,
    temperature: config.temperature || 0.3, // Lower temperature for more consistent rule generation
  });

  const tools = [FetchRBACRulesTool];
  const llmWithTools = llm.bindTools(tools);

  const prompt = ChatPromptTemplate.fromMessages([
    ["system", RBAC_SYSTEM_PROMPT],
    ["human", "{input}"],
    ["placeholder", "{agent_scratchpad}"],
  ]);

  const agent = createToolCallingAgent({
    llm: llmWithTools,
    tools,
    prompt,
  });

  const agentExecutor = new AgentExecutor({
    agent,
    tools,
    verbose: true,
    maxIterations: 5,
  });

  return {
    invoke: async (params: { input: string }) => {
      const result = await agentExecutor.invoke(params);
      return { output: result.output };
    },
  };
}

// Simple version without tools for testing
export async function createSimpleRBACAgent(config: RBACAgentConfig) {
  const llm = new CustomClaudeLLM({
    endpoint: config.endpoint,
    bearerToken: config.bearerToken,
    maxTokens: config.maxTokens || 4096,
    temperature: config.temperature || 0.3,
  });

  return {
    invoke: async (params: { input: string; existingRules?: string }) => {
      const contextPrompt = params.existingRules
        ? `\n\nHere are some existing RBAC rules for reference:\n${params.existingRules}\n\n`
        : "";

      const fullPrompt = `${RBAC_SYSTEM_PROMPT}${contextPrompt}\n\nUser Requirement: ${params.input}\n\nGenerate the RBAC rule(s) as JSON:`;

      const result = await llm.invoke([new HumanMessage(fullPrompt)]);
      return { output: result.content };
    },
  };
}

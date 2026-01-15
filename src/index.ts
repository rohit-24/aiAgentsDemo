import * as dotenv from "dotenv";
import { createClaudeAgent } from "./agent";
import { WeatherTool } from "./tools/weatherTool";

dotenv.config();

async function main() {
  const endpoint = process.env.CLAUDE_API_ENDPOINT;
  const bearerToken = process.env.CLAUDE_BEARER_TOKEN;

  if (!endpoint || !bearerToken) {
    throw new Error("Missing CLAUDE_API_ENDPOINT or CLAUDE_BEARER_TOKEN in environment variables");
  }

  console.log("=== Example 1: Simple chat without tools ===\n");

  const simpleAgent = await createClaudeAgent({
    endpoint,
    bearerToken,
  });

  const simpleResult = await simpleAgent.invoke("What is the capital of France?");
  console.log("Response:", simpleResult.output);

  console.log("\n=== Example 2: Agent with Weather Tool ===\n");

  const weatherTool = new WeatherTool();

  const agentWithTools = await createClaudeAgent({
    endpoint,
    bearerToken,
    tools: [weatherTool],
  });

  const weatherResult = await agentWithTools.invoke({
    input: "What's the weather like in Tokyo?",
  });
  console.log("Response:", weatherResult.output);

  console.log("\n=== Example 3: Question that doesn't need tools ===\n");

  const noToolResult = await agentWithTools.invoke({
    input: "Explain what JavaScript closures are in simple terms.",
  });
  console.log("Response:", noToolResult.output);
}

main().catch(console.error);

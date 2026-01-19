import express from "express";
import cors from "cors";
import path from "path";
import * as dotenv from "dotenv";
import { createRBACAgent, createSimpleRBACAgent } from "./rbacAgent";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "../public")));

// Validate environment variables
const endpoint = process.env.CLAUDE_API_ENDPOINT;
const bearerToken = process.env.CLAUDE_BEARER_TOKEN;

if (!endpoint || !bearerToken) {
  console.error(
    "Missing CLAUDE_API_ENDPOINT or CLAUDE_BEARER_TOKEN in environment variables"
  );
  process.exit(1);
}

// API endpoint to generate RBAC rules
app.post("/api/generate-rule", async (req, res) => {
  try {
    const { requirement, useTools = true } = req.body;

    if (!requirement || typeof requirement !== "string") {
      return res.status(400).json({
        error: "Missing or invalid 'requirement' field in request body",
      });
    }

    console.log(`\n${"=".repeat(50)}`);
    console.log(`Generating RBAC rule for: ${requirement}`);
    console.log(`Using tools: ${useTools}`);
    console.log(`${"=".repeat(50)}\n`);

    let result;

    if (useTools) {
      const agent = await createRBACAgent({
        endpoint: endpoint!,
        bearerToken: bearerToken!,
      });
      result = await agent.invoke({ input: requirement });
    } else {
      const agent = await createSimpleRBACAgent({
        endpoint: endpoint!,
        bearerToken: bearerToken!,
      });
      result = await agent.invoke({ input: requirement });
    }

    // Try to parse the output as JSON
    let parsedOutput = result.output;
    if (typeof result.output === "string") {
      try {
        // Extract JSON from the response (it might be wrapped in markdown code blocks)
        const jsonMatch = result.output.match(/```json\n?([\s\S]*?)\n?```/);
        if (jsonMatch) {
          parsedOutput = JSON.parse(jsonMatch[1]);
        } else {
          // Try parsing directly
          parsedOutput = JSON.parse(result.output);
        }
      } catch {
        // Keep as string if not valid JSON
        parsedOutput = result.output;
      }
    }

    res.json({
      success: true,
      requirement,
      generatedRule: parsedOutput,
    });
  } catch (error) {
    console.error("Error generating RBAC rule:", error);
    res.status(500).json({
      error: "Failed to generate RBAC rule",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Serve the UI
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

app.listen(PORT, () => {
  console.log(`\n${"=".repeat(50)}`);
  console.log(`RBAC Rule Generator Server`);
  console.log(`${"=".repeat(50)}`);
  console.log(`Server running at: http://localhost:${PORT}`);
  console.log(`API endpoint: POST /api/generate-rule`);
  console.log(`Health check: GET /api/health`);
  console.log(`${"=".repeat(50)}\n`);
});

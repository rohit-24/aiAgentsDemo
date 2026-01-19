import { z } from "zod";

interface RBACRule {
  ruleId: number;
  name: string;
  description: string;
  target: string;
  condition: string;
  type: string;
  overridable: string;
  hybrid: string;
}

const rbacFetchSchema = z.object({
  filter: z
    .string()
    .optional()
    .describe(
      "Optional filter keyword to search rules (e.g., 'MONEY_TRANSFER', 'SG', 'PB')"
    ),
});

async function fetchRBACRulesFunc(
  input: z.infer<typeof rbacFetchSchema>
): Promise<string> {
  const endpoint = process.env.RBAC_API_ENDPOINT;
  const token = process.env.CLICON_GATEWAY_TOKEN;

  if (!endpoint || !token) {
    return JSON.stringify({
      error:
        "Missing RBAC_API_ENDPOINT or CLICON_GATEWAY_TOKEN in environment",
    });
  }

  try {
    const response = await fetch(endpoint, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      return JSON.stringify({
        error: `Failed to fetch RBAC rules: ${response.status} ${response.statusText}`,
      });
    }

    let rules: RBACRule[] = (await response.json()) as RBACRule[];

    // Apply filter if provided
    if (input.filter) {
      const filterLower = input.filter.toLowerCase();
      rules = rules.filter(
        (rule) =>
          rule.name.toLowerCase().includes(filterLower) ||
          rule.description.toLowerCase().includes(filterLower) ||
          rule.target.toLowerCase().includes(filterLower)
      );
    }

    // Limit to first 20 rules to avoid token overflow
    const limitedRules = rules.slice(0, 20);

    return JSON.stringify({
      totalRules: rules.length,
      returnedRules: limitedRules.length,
      rules: limitedRules,
    });
  } catch (error) {
    return JSON.stringify({
      error: `Error fetching RBAC rules: ${error instanceof Error ? error.message : "Unknown error"}`,
    });
  }
}

export const FetchRBACRulesTool = {
  name: "fetch_rbac_rules",
  description: `Fetches existing RBAC (Role-Based Access Control) rules from the policies API.
Use this tool to get context about existing rules before generating new ones.
You can optionally filter rules by keywords like country codes (SG, HK), segments (PB, RETAIL, TREASURES),
APIs (MONEY_TRANSFER, CLIENT_EXCHANGE), or user types.`,
  schema: rbacFetchSchema,
  invoke: fetchRBACRulesFunc,
  call: fetchRBACRulesFunc,
};

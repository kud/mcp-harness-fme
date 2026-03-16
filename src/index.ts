#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { z } from "zod"

const SPLIT_API_KEY = process.env.HARNESS_FME_API_KEY
if (!SPLIT_API_KEY) {
  console.error("HARNESS_FME_API_KEY env var is required")
  process.exit(1)
}

const API_BASE = "https://api.split.io/internal/api/v2"

async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T | null> {
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${SPLIT_API_KEY}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    })
    if (!response.ok) {
      console.error(`API error: ${response.status} ${path}`)
      return null
    }
    return (await response.json()) as T
  } catch (err) {
    console.error(`Fetch failed: ${path}`, err)
    return null
  }
}

const ok = (data: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
})

const err = (msg: string) => ({
  content: [{ type: "text" as const, text: `Error: ${msg}` }],
})

const server = new McpServer({ name: "mcp-harness-fme", version: "1.0.0" })

// ─── Workspaces ───

server.registerTool(
  "list_workspaces",
  {
    description: "List all FME workspaces in the account",
    inputSchema: {
      limit: z
        .number()
        .optional()
        .default(20)
        .describe("Number of results to return"),
      offset: z.number().optional().default(0).describe("Pagination offset"),
    },
  },
  async ({ limit, offset }) => {
    const data = await apiFetch<{ objects: unknown[]; totalCount: number }>(
      `/workspaces?limit=${limit}&offset=${offset}`,
    )
    if (!data) return err("failed to fetch workspaces")
    return ok(data)
  },
)

// ─── Environments ───

server.registerTool(
  "list_environments",
  {
    description: "List all environments in a workspace",
    inputSchema: {
      workspace_id: z.string().describe("The workspace ID"),
    },
  },
  async ({ workspace_id }) => {
    const data = await apiFetch<{ objects: unknown[] }>(
      `/environments/ws/${workspace_id}`,
    )
    if (!data) return err("failed to fetch environments")
    return ok(data)
  },
)

// ─── Feature Flags (Splits) ───

server.registerTool(
  "list_feature_flags",
  {
    description: "List feature flags in a workspace",
    inputSchema: {
      workspace_id: z.string().describe("The workspace ID"),
      limit: z
        .number()
        .optional()
        .default(20)
        .describe("Number of results to return (max 50)"),
      offset: z.number().optional().default(0).describe("Pagination offset"),
      search: z.string().optional().describe("Filter flags by name"),
    },
  },
  async ({ workspace_id, limit, offset, search }) => {
    const query = new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
      ...(search ? { q: search } : {}),
    })
    const data = await apiFetch<{ objects: unknown[]; totalCount: number }>(
      `/splits/ws/${workspace_id}?${query}`,
    )
    if (!data) return err("failed to fetch feature flags")
    return ok(data)
  },
)

server.registerTool(
  "get_feature_flag",
  {
    description: "Get metadata for a specific feature flag",
    inputSchema: {
      workspace_id: z.string().describe("The workspace ID"),
      flag_name: z.string().describe("The feature flag name"),
    },
  },
  async ({ workspace_id, flag_name }) => {
    const data = await apiFetch<unknown>(
      `/splits/ws/${workspace_id}/${flag_name}`,
    )
    if (!data) return err(`failed to fetch feature flag: ${flag_name}`)
    return ok(data)
  },
)

server.registerTool(
  "get_flag_definition",
  {
    description:
      "Get the targeting rules and treatment definition of a feature flag in a specific environment",
    inputSchema: {
      workspace_id: z.string().describe("The workspace ID"),
      environment_id: z.string().describe("The environment ID or name"),
      flag_name: z.string().describe("The feature flag name"),
    },
  },
  async ({ workspace_id, environment_id, flag_name }) => {
    const data = await apiFetch<unknown>(
      `/splits/ws/${workspace_id}/environments/${environment_id}/${flag_name}`,
    )
    if (!data) return err(`failed to fetch flag definition: ${flag_name}`)
    return ok(data)
  },
)

server.registerTool(
  "kill_feature_flag",
  {
    description:
      "Kill (disable) a feature flag in an environment — forces all traffic to the default treatment",
    inputSchema: {
      workspace_id: z.string().describe("The workspace ID"),
      environment_id: z.string().describe("The environment ID or name"),
      flag_name: z.string().describe("The feature flag name"),
      confirm: z
        .boolean()
        .default(false)
        .describe("Must be true to execute the kill"),
    },
  },
  async ({ workspace_id, environment_id, flag_name, confirm }) => {
    if (!confirm) return err("set confirm=true to kill this feature flag")
    const data = await apiFetch<unknown>(
      `/splits/ws/${workspace_id}/environments/${environment_id}/${flag_name}/kill`,
      { method: "PUT" },
    )
    if (!data) return err(`failed to kill feature flag: ${flag_name}`)
    return ok(data)
  },
)

server.registerTool(
  "restore_feature_flag",
  {
    description: "Restore (re-enable) a killed feature flag in an environment",
    inputSchema: {
      workspace_id: z.string().describe("The workspace ID"),
      environment_id: z.string().describe("The environment ID or name"),
      flag_name: z.string().describe("The feature flag name"),
    },
  },
  async ({ workspace_id, environment_id, flag_name }) => {
    const data = await apiFetch<unknown>(
      `/splits/ws/${workspace_id}/environments/${environment_id}/${flag_name}/restore`,
      { method: "PUT" },
    )
    if (!data) return err(`failed to restore feature flag: ${flag_name}`)
    return ok(data)
  },
)

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error("mcp-harness-fme running")
}

main().catch((error) => {
  console.error("Fatal:", error)
  process.exit(1)
})

#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { z } from "zod"

const SPLIT_API_KEY = process.env.MCP_HARNESS_FME_API_KEY

export const API_BASE = "https://api.split.io/internal/api/v2"

export const apiFetch = async <T>(
  path: string,
  options: RequestInit = {},
): Promise<T | null> => {
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
  } catch (e) {
    console.error(`Fetch failed: ${path}`, e)
    return null
  }
}

export const ok = (data: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
})

export const err = (msg: string) => ({
  content: [{ type: "text" as const, text: `Error: ${msg}` }],
})

// ─── Workspaces ───

export const listWorkspaces = async ({
  limit,
  offset,
}: {
  limit: number
  offset: number
}) => {
  const data = await apiFetch<{ objects: unknown[]; totalCount: number }>(
    `/workspaces?limit=${limit}&offset=${offset}`,
  )
  return data ? ok(data) : err("failed to fetch workspaces")
}

// ─── Environments ───

export const listEnvironments = async ({
  workspace_id,
}: {
  workspace_id: string
}) => {
  const data = await apiFetch<{ objects: unknown[] }>(
    `/environments/ws/${workspace_id}`,
  )
  return data ? ok(data) : err("failed to fetch environments")
}

// ─── Feature Flags (Splits) ───

export const listFeatureFlags = async ({
  workspace_id,
  limit,
  offset,
  tag,
}: {
  workspace_id: string
  limit: number
  offset: number
  tag?: string
}) => {
  const query = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
    ...(tag ? { tag } : {}),
  })
  const data = await apiFetch<{ objects: unknown[]; totalCount: number }>(
    `/splits/ws/${workspace_id}?${query}`,
  )
  return data ? ok(data) : err("failed to fetch feature flags")
}

export const getFeatureFlag = async ({
  workspace_id,
  flag_name,
}: {
  workspace_id: string
  flag_name: string
}) => {
  const data = await apiFetch<unknown>(
    `/splits/ws/${workspace_id}/${flag_name}`,
  )
  return data ? ok(data) : err(`failed to fetch feature flag: ${flag_name}`)
}

export const getFlagDefinition = async ({
  workspace_id,
  environment_id,
  flag_name,
}: {
  workspace_id: string
  environment_id: string
  flag_name: string
}) => {
  const data = await apiFetch<unknown>(
    `/splits/ws/${workspace_id}/environments/${environment_id}/${flag_name}`,
  )
  return data ? ok(data) : err(`failed to fetch flag definition: ${flag_name}`)
}

export const killFeatureFlag = async ({
  workspace_id,
  environment_id,
  flag_name,
  confirm,
}: {
  workspace_id: string
  environment_id: string
  flag_name: string
  confirm: boolean
}) => {
  if (!confirm) return err("set confirm=true to kill this feature flag")
  const data = await apiFetch<unknown>(
    `/splits/ws/${workspace_id}/environments/${environment_id}/${flag_name}/kill`,
    { method: "PUT" },
  )
  return data ? ok(data) : err(`failed to kill feature flag: ${flag_name}`)
}

export const restoreFeatureFlag = async ({
  workspace_id,
  environment_id,
  flag_name,
}: {
  workspace_id: string
  environment_id: string
  flag_name: string
}) => {
  const data = await apiFetch<unknown>(
    `/splits/ws/${workspace_id}/environments/${environment_id}/${flag_name}/restore`,
    { method: "PUT" },
  )
  return data ? ok(data) : err(`failed to restore feature flag: ${flag_name}`)
}

export const createFeatureFlag = async ({
  workspace_id,
  traffic_type,
  name,
  description,
}: {
  workspace_id: string
  traffic_type: string
  name: string
  description?: string
}) => {
  const body: Record<string, unknown> = { name }
  if (description) body.description = description
  const data = await apiFetch<unknown>(
    `/splits/ws/${workspace_id}/trafficTypes/${traffic_type}`,
    { method: "POST", body: JSON.stringify(body) },
  )
  return data ? ok(data) : err(`failed to create feature flag: ${name}`)
}

export const updateFeatureFlag = async ({
  workspace_id,
  flag_name,
  description,
  tags,
  owners,
}: {
  workspace_id: string
  flag_name: string
  description?: string
  tags?: Array<{ name: string }>
  owners?: Array<{ id: string; type: string }>
}) => {
  const body: Record<string, unknown> = {}
  if (description !== undefined) body.description = description
  if (tags !== undefined) body.tags = tags
  if (owners !== undefined) body.owners = owners
  const data = await apiFetch<unknown>(
    `/splits/ws/${workspace_id}/${flag_name}`,
    { method: "PATCH", body: JSON.stringify(body) },
  )
  return data ? ok(data) : err(`failed to update feature flag: ${flag_name}`)
}

export const deleteFeatureFlag = async ({
  workspace_id,
  flag_name,
  confirm,
}: {
  workspace_id: string
  flag_name: string
  confirm: boolean
}) => {
  if (!confirm) return err("set confirm=true to delete this feature flag")
  const response = await fetch(
    `${API_BASE}/splits/ws/${workspace_id}/${flag_name}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${SPLIT_API_KEY}` },
    },
  )
  if (!response.ok)
    return err(
      `failed to delete feature flag: ${flag_name} (${response.status})`,
    )
  return ok({ deleted: flag_name })
}

export const listFlagDefinitions = async ({
  workspace_id,
  environment_id,
  limit,
  offset,
}: {
  workspace_id: string
  environment_id: string
  limit: number
  offset: number
}) => {
  const query = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  })
  const data = await apiFetch<{ objects: unknown[]; totalCount: number }>(
    `/splits/ws/${workspace_id}/environments/${environment_id}/splits?${query}`,
  )
  return data ? ok(data) : err("failed to fetch flag definitions")
}

const parseDefinition = (definition: string) => {
  try {
    return JSON.parse(definition)
  } catch {
    return null
  }
}

export const createFlagDefinition = async ({
  workspace_id,
  environment_id,
  flag_name,
  definition,
}: {
  workspace_id: string
  environment_id: string
  flag_name: string
  definition: string
}) => {
  const parsed = parseDefinition(definition)
  if (!parsed) return err("definition must be valid JSON")
  const data = await apiFetch<unknown>(
    `/splits/ws/${workspace_id}/${flag_name}/environments/${environment_id}`,
    { method: "POST", body: JSON.stringify(parsed) },
  )
  return data
    ? ok(data)
    : err(`failed to create flag definition for: ${flag_name}`)
}

export const updateFlagDefinition = async ({
  workspace_id,
  environment_id,
  flag_name,
  definition,
}: {
  workspace_id: string
  environment_id: string
  flag_name: string
  definition: string
}) => {
  const parsed = parseDefinition(definition)
  if (!parsed) return err("definition must be valid JSON")
  const data = await apiFetch<unknown>(
    `/splits/ws/${workspace_id}/${flag_name}/environments/${environment_id}`,
    { method: "PUT", body: JSON.stringify(parsed) },
  )
  return data
    ? ok(data)
    : err(`failed to update flag definition for: ${flag_name}`)
}

export const deleteFlagDefinition = async ({
  workspace_id,
  environment_id,
  flag_name,
  confirm,
}: {
  workspace_id: string
  environment_id: string
  flag_name: string
  confirm: boolean
}) => {
  if (!confirm) return err("set confirm=true to delete this flag definition")
  const response = await fetch(
    `${API_BASE}/splits/ws/${workspace_id}/${flag_name}/environments/${environment_id}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${SPLIT_API_KEY}` },
    },
  )
  if (!response.ok)
    return err(
      `failed to delete flag definition: ${flag_name} (${response.status})`,
    )
  return ok({ deleted: flag_name, environment: environment_id })
}

// ─── Segments ───

export const listSegments = async ({
  workspace_id,
  limit,
  offset,
}: {
  workspace_id: string
  limit: number
  offset: number
}) => {
  const query = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  })
  const data = await apiFetch<{ objects: unknown[]; totalCount: number }>(
    `/segments/ws/${workspace_id}?${query}`,
  )
  return data ? ok(data) : err("failed to fetch segments")
}

// ─── Traffic Types ───

export const listTrafficTypes = async ({
  workspace_id,
}: {
  workspace_id: string
}) => {
  const data = await apiFetch<{ objects: unknown[] }>(
    `/trafficTypes/ws/${workspace_id}`,
  )
  return data ? ok(data) : err("failed to fetch traffic types")
}

// ─── Server ───

const server = new McpServer({ name: "mcp-harness-fme", version: "1.0.0" })

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
  listWorkspaces,
)

server.registerTool(
  "list_environments",
  {
    description: "List all environments in a workspace",
    inputSchema: {
      workspace_id: z.string().describe("The workspace ID"),
    },
  },
  listEnvironments,
)

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
      tag: z
        .string()
        .optional()
        .describe("Filter flags by tag (e.g. 'Mobile Suite')"),
    },
  },
  listFeatureFlags,
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
  getFeatureFlag,
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
  getFlagDefinition,
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
  killFeatureFlag,
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
  restoreFeatureFlag,
)

server.registerTool(
  "create_feature_flag",
  {
    description: "Create a new feature flag for a given traffic type",
    inputSchema: {
      workspace_id: z.string().describe("The workspace ID"),
      traffic_type: z
        .string()
        .describe("The traffic type ID or name (e.g. 'user')"),
      name: z.string().describe("The feature flag name (unique per workspace)"),
      description: z.string().optional().describe("Optional description"),
    },
  },
  createFeatureFlag,
)

server.registerTool(
  "update_feature_flag",
  {
    description:
      "Update a feature flag's description, tags, or owners (partial update)",
    inputSchema: {
      workspace_id: z.string().describe("The workspace ID"),
      flag_name: z.string().describe("The feature flag name"),
      description: z.string().optional().describe("New description"),
      tags: z
        .array(z.object({ name: z.string() }))
        .optional()
        .describe("Tags to set — array of {name: string}"),
      owners: z
        .array(z.object({ id: z.string(), type: z.string() }))
        .optional()
        .describe("Owners to set — array of {id, type}"),
    },
  },
  updateFeatureFlag,
)

server.registerTool(
  "delete_feature_flag",
  {
    description:
      "Permanently delete a feature flag from a workspace — irreversible",
    inputSchema: {
      workspace_id: z.string().describe("The workspace ID"),
      flag_name: z.string().describe("The feature flag name"),
      confirm: z
        .boolean()
        .default(false)
        .describe("Must be true to execute the deletion"),
    },
  },
  deleteFeatureFlag,
)

server.registerTool(
  "list_flag_definitions",
  {
    description:
      "List all feature flag definitions (targeting rules) in a specific environment",
    inputSchema: {
      workspace_id: z.string().describe("The workspace ID"),
      environment_id: z.string().describe("The environment ID or name"),
      limit: z
        .number()
        .optional()
        .default(20)
        .describe("Number of results to return (max 50)"),
      offset: z.number().optional().default(0).describe("Pagination offset"),
    },
  },
  listFlagDefinitions,
)

server.registerTool(
  "create_flag_definition",
  {
    description:
      "Create (activate) a feature flag definition in a specific environment with treatments and targeting rules",
    inputSchema: {
      workspace_id: z.string().describe("The workspace ID"),
      environment_id: z.string().describe("The environment ID or name"),
      flag_name: z.string().describe("The feature flag name"),
      definition: z
        .string()
        .describe(
          "Full flag definition as a JSON string — must include treatments array and defaultRule",
        ),
    },
  },
  createFlagDefinition,
)

server.registerTool(
  "update_flag_definition",
  {
    description:
      "Fully replace a feature flag definition (treatments, targeting rules) in an environment",
    inputSchema: {
      workspace_id: z.string().describe("The workspace ID"),
      environment_id: z.string().describe("The environment ID or name"),
      flag_name: z.string().describe("The feature flag name"),
      definition: z
        .string()
        .describe(
          "Complete updated definition as a JSON string — replaces the existing definition",
        ),
    },
  },
  updateFlagDefinition,
)

server.registerTool(
  "delete_flag_definition",
  {
    description:
      "Remove a feature flag definition from an environment — the flag itself remains, but loses its targeting rules in that environment",
    inputSchema: {
      workspace_id: z.string().describe("The workspace ID"),
      environment_id: z.string().describe("The environment ID or name"),
      flag_name: z.string().describe("The feature flag name"),
      confirm: z
        .boolean()
        .default(false)
        .describe("Must be true to execute the deletion"),
    },
  },
  deleteFlagDefinition,
)

server.registerTool(
  "list_segments",
  {
    description: "List all segments in a workspace",
    inputSchema: {
      workspace_id: z.string().describe("The workspace ID"),
      limit: z
        .number()
        .optional()
        .default(20)
        .describe("Number of results to return"),
      offset: z.number().optional().default(0).describe("Pagination offset"),
    },
  },
  listSegments,
)

server.registerTool(
  "list_traffic_types",
  {
    description: "List all traffic types in a workspace",
    inputSchema: {
      workspace_id: z.string().describe("The workspace ID"),
    },
  },
  listTrafficTypes,
)

const main = async () => {
  if (!SPLIT_API_KEY) {
    console.error("MCP_HARNESS_FME_API_KEY env var is required")
    process.exit(1)
  }
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error("mcp-harness-fme running")
}

main().catch((e) => {
  console.error("Fatal:", e)
  process.exit(1)
})

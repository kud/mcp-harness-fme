#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { z } from "zod"

const SPLIT_API_KEY = process.env.MCP_HARNESS_FME_API_KEY

export const API_BASE = "https://api.split.io/internal/api/v2"

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string }

export const apiFetch = async <T>(
  path: string,
  options: RequestInit = {},
): Promise<ApiResult<T>> => {
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
      const body = await response.text().catch(() => "")
      const message = `${response.status}${body ? `: ${body}` : ""}`
      console.error(`API error: ${message} — ${path}`)
      return { ok: false, message }
    }
    return { ok: true, data: (await response.json()) as T }
  } catch (e) {
    const message = e instanceof Error ? e.message : "network error"
    console.error(`Fetch failed: ${path}`, e)
    return { ok: false, message }
  }
}

export const ok = (data: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
})

export const err = (msg: string) => ({
  content: [{ type: "text" as const, text: `Error: ${msg}` }],
})

const flattenTrafficType = (item: Record<string, unknown>): void => {
  const tt = item.trafficType
  if (tt && typeof tt === "object" && !Array.isArray(tt)) {
    const ttRecord = tt as Record<string, unknown>
    if (ttRecord.id !== undefined && item.trafficTypeId === undefined) {
      item.trafficTypeId = ttRecord.id
    }
  }
}

// ─── Workspaces ───

export const listWorkspaces = async ({
  limit,
  offset,
}: {
  limit: number
  offset: number
}) => {
  const result = await apiFetch<{ objects: unknown[]; totalCount: number }>(
    `/workspaces?size=${limit}&offset=${offset}`,
  )
  return result.ok
    ? ok(result.data)
    : err(`failed to fetch workspaces (${result.message})`)
}

// ─── Environments ───

export const listEnvironments = async ({
  workspace_id,
}: {
  workspace_id: string
}) => {
  const result = await apiFetch<{ objects: unknown[] }>(
    `/environments/ws/${workspace_id}`,
  )
  return result.ok
    ? ok(result.data)
    : err(`failed to fetch environments (${result.message})`)
}

// ─── Feature Flags (Splits) ───

export const listFeatureFlags = async ({
  workspace_id,
  limit,
  offset,
  tag,
  rollout_status_id,
  name,
}: {
  workspace_id: string
  limit: number
  offset: number
  tag?: string
  rollout_status_id?: string
  name?: string
}) => {
  const query = new URLSearchParams({
    size: String(limit),
    offset: String(offset),
    ...(tag ? { tag } : {}),
    ...(rollout_status_id ? { rolloutStatus: rollout_status_id } : {}),
    ...(name ? { name } : {}),
  })
  const result = await apiFetch<{ objects: unknown[]; totalCount: number }>(
    `/splits/ws/${workspace_id}?${query}`,
  )
  if (!result.ok)
    return err(`failed to fetch feature flags (${result.message})`)
  const data = result.data
  if (data.objects) {
    for (const item of data.objects) {
      if (item && typeof item === "object")
        flattenTrafficType(item as Record<string, unknown>)
    }
  }
  return ok(data)
}

export const getFeatureFlag = async ({
  workspace_id,
  flag_name,
}: {
  workspace_id: string
  flag_name: string
}) => {
  const result = await apiFetch<Record<string, unknown>>(
    `/splits/ws/${workspace_id}/${flag_name}`,
  )
  if (!result.ok)
    return err(`failed to fetch feature flag: ${flag_name} (${result.message})`)
  flattenTrafficType(result.data)
  return ok(result.data)
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
  const result = await apiFetch<unknown>(
    `/splits/ws/${workspace_id}/${flag_name}/environments/${environment_id}`,
  )
  return result.ok
    ? ok(result.data)
    : err(`failed to fetch flag definition: ${flag_name} (${result.message})`)
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
  const result = await apiFetch<unknown>(
    `/splits/ws/${workspace_id}/${flag_name}/environments/${environment_id}/kill`,
    { method: "PUT" },
  )
  return result.ok
    ? ok(result.data)
    : err(`failed to kill feature flag: ${flag_name} (${result.message})`)
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
  const result = await apiFetch<unknown>(
    `/splits/ws/${workspace_id}/${flag_name}/environments/${environment_id}/restore`,
    { method: "PUT" },
  )
  return result.ok
    ? ok(result.data)
    : err(`failed to restore feature flag: ${flag_name} (${result.message})`)
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
  const result = await apiFetch<unknown>(
    `/splits/ws/${workspace_id}/trafficTypes/${traffic_type}`,
    { method: "POST", body: JSON.stringify(body) },
  )
  return result.ok
    ? ok(result.data)
    : err(`failed to create feature flag: ${name} (${result.message})`)
}

export const updateFeatureFlag = async ({
  workspace_id,
  flag_name,
  description,
  tags,
  owners,
  rollout_status_id,
}: {
  workspace_id: string
  flag_name: string
  description?: string
  tags?: Array<{ name: string } | string>
  owners?: Array<{ id: string; type: string }>
  rollout_status_id?: string
}) => {
  const ops: Array<{ op: string; path: string; value: unknown }> = []
  if (description !== undefined)
    ops.push({ op: "replace", path: "/description", value: description })
  if (tags !== undefined) {
    const normalised = tags.map((t) =>
      typeof t === "string" ? { name: t } : t,
    )
    ops.push({ op: "replace", path: "/tags", value: normalised })
  }
  if (owners !== undefined)
    ops.push({ op: "replace", path: "/owners", value: owners })
  if (rollout_status_id !== undefined)
    ops.push({
      op: "replace",
      path: "/rolloutStatus/id",
      value: rollout_status_id,
    })
  if (ops.length === 0) return err("provide at least one field to update")
  const result = await apiFetch<unknown>(
    `/splits/ws/${workspace_id}/${flag_name}`,
    { method: "PATCH", body: JSON.stringify(ops) },
  )
  return result.ok
    ? ok(result.data)
    : err(`failed to update feature flag: ${flag_name} (${result.message})`)
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
    size: String(limit),
    offset: String(offset),
  })
  // Split.io serves feature flag *definitions* from the /splits path (not a
  // /splitDefinitions resource): GET /splits/ws/{ws}/environments/{env}
  // https://docs.split.io/reference/list-feature-flag-definitions-in-environment
  const result = await apiFetch<{ objects: unknown[]; totalCount: number }>(
    `/splits/ws/${workspace_id}/environments/${environment_id}?${query}`,
  )
  return result.ok
    ? ok(result.data)
    : err(`failed to fetch flag definitions (${result.message})`)
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
  const result = await apiFetch<unknown>(
    `/splits/ws/${workspace_id}/${flag_name}/environments/${environment_id}`,
    { method: "POST", body: JSON.stringify(parsed) },
  )
  return result.ok
    ? ok(result.data)
    : err(
        `failed to create flag definition for: ${flag_name} (${result.message})`,
      )
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
  const result = await apiFetch<unknown>(
    `/splits/ws/${workspace_id}/${flag_name}/environments/${environment_id}`,
    { method: "PUT", body: JSON.stringify(parsed) },
  )
  return result.ok
    ? ok(result.data)
    : err(
        `failed to update flag definition for: ${flag_name} (${result.message})`,
      )
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
    size: String(limit),
    offset: String(offset),
  })
  const result = await apiFetch<{ objects: unknown[]; totalCount: number }>(
    `/segments/ws/${workspace_id}?${query}`,
  )
  return result.ok
    ? ok(result.data)
    : err(`failed to fetch segments (${result.message})`)
}

// ─── Traffic Types ───

export const listTrafficTypes = async ({
  workspace_id,
}: {
  workspace_id: string
}) => {
  const result = await apiFetch<{ objects: unknown[] }>(
    `/trafficTypes/ws/${workspace_id}`,
  )
  return result.ok
    ? ok(result.data)
    : err(`failed to fetch traffic types (${result.message})`)
}

// ─── Rollout Statuses ───

export const listRolloutStatuses = async ({
  workspace_id,
}: {
  workspace_id: string
}) => {
  const result = await apiFetch<unknown>(`/rolloutStatuses/ws/${workspace_id}`)
  return result.ok
    ? ok(result.data)
    : err(`failed to fetch rollout statuses (${result.message})`)
}

// ─── Feature Flag Archive ───

export const archiveFeatureFlag = async ({
  workspace_id,
  flag_name,
  confirm,
}: {
  workspace_id: string
  flag_name: string
  confirm: boolean
}) => {
  if (!confirm) return err("set confirm=true to archive this feature flag")
  const result = await apiFetch<unknown>(
    `/splits/ws/${workspace_id}/${flag_name}/archive`,
    { method: "POST" },
  )
  return result.ok
    ? ok(result.data)
    : err(`failed to archive feature flag: ${flag_name} (${result.message})`)
}

export const unarchiveFeatureFlag = async ({
  workspace_id,
  flag_name,
}: {
  workspace_id: string
  flag_name: string
}) => {
  const result = await apiFetch<unknown>(
    `/splits/ws/${workspace_id}/${flag_name}/unarchive`,
    { method: "POST" },
  )
  return result.ok
    ? ok(result.data)
    : err(`failed to unarchive feature flag: ${flag_name} (${result.message})`)
}

// ─── Rule-Based Segments ───

export const listRuleBasedSegments = async ({
  workspace_id,
  limit,
  offset,
}: {
  workspace_id: string
  limit: number
  offset: number
}) => {
  const query = new URLSearchParams({
    size: String(limit),
    offset: String(offset),
  })
  const result = await apiFetch<unknown>(
    `/rule-based-segments/ws/${workspace_id}?${query}`,
  )
  return result.ok
    ? ok(result.data)
    : err(`failed to fetch rule-based segments (${result.message})`)
}

export const getRuleBasedSegment = async ({
  workspace_id,
  segment_name,
}: {
  workspace_id: string
  segment_name: string
}) => {
  const result = await apiFetch<unknown>(
    `/rule-based-segments/ws/${workspace_id}/${segment_name}`,
  )
  return result.ok
    ? ok(result.data)
    : err(
        `failed to fetch rule-based segment: ${segment_name} (${result.message})`,
      )
}

export const createRuleBasedSegment = async ({
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
  const result = await apiFetch<unknown>(
    `/rule-based-segments/ws/${workspace_id}/trafficTypes/${traffic_type}`,
    { method: "POST", body: JSON.stringify(body) },
  )
  return result.ok
    ? ok(result.data)
    : err(`failed to create rule-based segment: ${name} (${result.message})`)
}

export const deleteRuleBasedSegment = async ({
  workspace_id,
  segment_name,
  confirm,
}: {
  workspace_id: string
  segment_name: string
  confirm: boolean
}) => {
  if (!confirm) return err("set confirm=true to delete this rule-based segment")
  const response = await fetch(
    `${API_BASE}/rule-based-segments/ws/${workspace_id}/${segment_name}`,
    { method: "DELETE", headers: { Authorization: `Bearer ${SPLIT_API_KEY}` } },
  )
  if (!response.ok)
    return err(
      `failed to delete rule-based segment: ${segment_name} (${response.status})`,
    )
  return ok({ deleted: segment_name })
}

// ─── Rule-Based Segment Definitions ───

export const listRuleBasedSegmentDefinitions = async ({
  workspace_id,
  environment_id,
}: {
  workspace_id: string
  environment_id: string
}) => {
  const result = await apiFetch<unknown>(
    `/rule-based-segments/ws/${workspace_id}/environments/${environment_id}`,
  )
  return result.ok
    ? ok(result.data)
    : err(`failed to fetch rule-based segment definitions (${result.message})`)
}

export const updateRuleBasedSegmentDefinition = async ({
  workspace_id,
  environment_id,
  segment_name,
  definition,
}: {
  workspace_id: string
  environment_id: string
  segment_name: string
  definition: string
}) => {
  const parsed = parseDefinition(definition)
  if (!parsed) return err("definition must be valid JSON")
  const result = await apiFetch<unknown>(
    `/rule-based-segments/ws/${workspace_id}/${segment_name}/environments/${environment_id}`,
    { method: "PUT", body: JSON.stringify(parsed) },
  )
  return result.ok
    ? ok(result.data)
    : err(
        `failed to update rule-based segment definition for: ${segment_name} (${result.message})`,
      )
}

export const enableRuleBasedSegmentDefinition = async ({
  workspace_id,
  environment_id,
  segment_name,
}: {
  workspace_id: string
  environment_id: string
  segment_name: string
}) => {
  const result = await apiFetch<unknown>(
    `/rule-based-segments/${environment_id}/${segment_name}`,
    { method: "POST", body: JSON.stringify({}) },
  )
  return result.ok
    ? ok(result.data)
    : err(
        `failed to enable rule-based segment: ${segment_name} (${result.message})`,
      )
}

export const disableRuleBasedSegmentDefinition = async ({
  workspace_id,
  environment_id,
  segment_name,
  confirm,
}: {
  workspace_id: string
  environment_id: string
  segment_name: string
  confirm: boolean
}) => {
  if (!confirm)
    return err("set confirm=true to disable this rule-based segment definition")
  const response = await fetch(
    `${API_BASE}/rule-based-segments/${environment_id}/${segment_name}`,
    { method: "DELETE", headers: { Authorization: `Bearer ${SPLIT_API_KEY}` } },
  )
  if (!response.ok)
    return err(
      `failed to disable rule-based segment: ${segment_name} (${response.status})`,
    )
  return ok({ disabled: segment_name, environment: environment_id })
}

export const createRuleBasedSegmentChangeRequest = async ({
  workspace_id,
  environment_id,
  title,
  operation_type,
  rule_based_segment,
  comment,
  approvers,
}: {
  workspace_id: string
  environment_id: string
  title: string
  operation_type: string
  rule_based_segment: string
  comment?: string
  approvers?: string[]
}) => {
  const parsed = parseDefinition(rule_based_segment)
  if (!parsed) return err("rule_based_segment must be valid JSON")
  const body: Record<string, unknown> = {
    title,
    operationType: operation_type,
    ruleBasedSegment: parsed,
    ...(comment ? { comment } : {}),
    ...(approvers ? { approvers } : {}),
  }
  const result = await apiFetch<unknown>(
    `/changeRequests/ws/${workspace_id}/environments/${environment_id}`,
    { method: "POST", body: JSON.stringify(body) },
  )
  return result.ok
    ? ok(result.data)
    : err(`failed to create change request (${result.message})`)
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
      rollout_status_id: z
        .string()
        .optional()
        .describe(
          "Filter by rollout status UUID (use list_rollout_statuses to discover valid IDs)",
        ),
      name: z
        .string()
        .optional()
        .describe("Filter flags by name (partial match)"),
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
        .array(z.union([z.object({ name: z.string() }), z.string()]))
        .optional()
        .describe("Tags to set — array of {name: string} or plain strings"),
      owners: z
        .array(z.object({ id: z.string(), type: z.string() }))
        .optional()
        .describe("Owners to set — array of {id, type}"),
      rollout_status_id: z
        .string()
        .optional()
        .describe(
          "Rollout status UUID to set (use list_rollout_statuses to discover valid IDs)",
        ),
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

server.registerTool(
  "list_rollout_statuses",
  {
    description:
      "List rollout status definitions for a workspace (e.g. Killed, Permanent, Ramping) — use the returned IDs to filter feature flags by rollout status",
    inputSchema: {
      workspace_id: z.string().describe("The workspace ID"),
    },
  },
  listRolloutStatuses,
)

server.registerTool(
  "archive_feature_flag",
  {
    description:
      "Archive a feature flag — removes it from active use while preserving history. Subject to OPA policy checks (409 on failure).",
    inputSchema: {
      workspace_id: z.string().describe("The workspace ID"),
      flag_name: z.string().describe("The feature flag name"),
      confirm: z
        .boolean()
        .default(false)
        .describe("Must be true to execute the archive"),
    },
  },
  archiveFeatureFlag,
)

server.registerTool(
  "unarchive_feature_flag",
  {
    description:
      "Unarchive a previously archived feature flag, restoring it to active use",
    inputSchema: {
      workspace_id: z.string().describe("The workspace ID"),
      flag_name: z.string().describe("The feature flag name"),
    },
  },
  unarchiveFeatureFlag,
)

server.registerTool(
  "list_rule_based_segments",
  {
    description: "List all rule-based segments in a workspace",
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
  listRuleBasedSegments,
)

server.registerTool(
  "get_rule_based_segment",
  {
    description: "Get a rule-based segment's workspace-level metadata by name",
    inputSchema: {
      workspace_id: z.string().describe("The workspace ID"),
      segment_name: z.string().describe("The segment name"),
    },
  },
  getRuleBasedSegment,
)

server.registerTool(
  "create_rule_based_segment",
  {
    description:
      "Create a new rule-based segment in a workspace under a specific traffic type",
    inputSchema: {
      workspace_id: z.string().describe("The workspace ID"),
      traffic_type: z.string().describe("The traffic type ID or name"),
      name: z.string().describe("The segment name (unique per workspace)"),
      description: z.string().optional().describe("Optional description"),
    },
  },
  createRuleBasedSegment,
)

server.registerTool(
  "delete_rule_based_segment",
  {
    description:
      "Permanently delete a rule-based segment from a workspace — environment-level configs must be removed separately",
    inputSchema: {
      workspace_id: z.string().describe("The workspace ID"),
      segment_name: z.string().describe("The segment name"),
      confirm: z
        .boolean()
        .default(false)
        .describe("Must be true to execute the deletion"),
    },
  },
  deleteRuleBasedSegment,
)

server.registerTool(
  "list_rule_based_segment_definitions",
  {
    description:
      "List rule-based segment definitions in a specific environment",
    inputSchema: {
      workspace_id: z.string().describe("The workspace ID"),
      environment_id: z.string().describe("The environment ID or name"),
    },
  },
  listRuleBasedSegmentDefinitions,
)

server.registerTool(
  "update_rule_based_segment_definition",
  {
    description:
      "Update a rule-based segment definition in an environment (rules, exclusions, matchers)",
    inputSchema: {
      workspace_id: z.string().describe("The workspace ID"),
      environment_id: z.string().describe("The environment ID or name"),
      segment_name: z.string().describe("The segment name"),
      definition: z
        .string()
        .describe(
          "Full segment definition as a JSON string — includes rules, excludedKeys, excludedSegments",
        ),
    },
  },
  updateRuleBasedSegmentDefinition,
)

server.registerTool(
  "enable_rule_based_segment_definition",
  {
    description:
      "Enable (activate) a rule-based segment in a specific environment — creates an empty definition that can then be configured via update",
    inputSchema: {
      workspace_id: z.string().describe("The workspace ID"),
      environment_id: z.string().describe("The environment ID or name"),
      segment_name: z.string().describe("The segment name"),
    },
  },
  enableRuleBasedSegmentDefinition,
)

server.registerTool(
  "disable_rule_based_segment_definition",
  {
    description:
      "Disable (remove) a rule-based segment from a specific environment — workspace-level metadata is preserved",
    inputSchema: {
      workspace_id: z.string().describe("The workspace ID"),
      environment_id: z.string().describe("The environment ID or name"),
      segment_name: z.string().describe("The segment name"),
      confirm: z
        .boolean()
        .default(false)
        .describe("Must be true to execute the disable"),
    },
  },
  disableRuleBasedSegmentDefinition,
)

server.registerTool(
  "create_rule_based_segment_change_request",
  {
    description:
      "Submit a change request for a rule-based segment definition — supports approval flow via approvers",
    inputSchema: {
      workspace_id: z.string().describe("The workspace ID"),
      environment_id: z.string().describe("The environment ID or name"),
      title: z.string().describe("Change request title"),
      operation_type: z
        .string()
        .describe("Change operation type (e.g. UPDATE)"),
      rule_based_segment: z
        .string()
        .describe("The segment definition to apply as a JSON string"),
      comment: z
        .string()
        .optional()
        .describe("Optional comment for the change request"),
      approvers: z
        .array(z.string())
        .optional()
        .describe("Email addresses of approvers"),
    },
  },
  createRuleBasedSegmentChangeRequest,
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

// Tests import this module to exercise the tool handlers against a mocked
// fetch; starting the stdio server (and its missing-key exit) during import
// would abort the test runner. The real CLI still starts normally.
if (process.env.VITEST !== "true") {
  main().catch((e) => {
    console.error("Fatal:", e)
    process.exit(1)
  })
}

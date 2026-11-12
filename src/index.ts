#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { resolveApiKey } from "@kud/harness-fme"
import { z } from "zod"
import {
  addSegmentKeys,
  addSegmentToTreatment,
  archiveFeatureFlag,
  createFeatureFlag,
  createFlagDefinition,
  createRuleBasedSegment,
  createRuleBasedSegmentChangeRequest,
  createSegment,
  deleteFeatureFlag,
  deleteFlagDefinition,
  deleteRuleBasedSegment,
  deleteSegment,
  disableRuleBasedSegmentDefinition,
  disableSegmentInEnvironment,
  enableRuleBasedSegmentDefinition,
  enableSegmentInEnvironment,
  getFeatureFlag,
  getFlagDefinition,
  getFlagUrl,
  getRuleBasedSegment,
  killFeatureFlag,
  listEnvironments,
  listFeatureFlags,
  listFlagDefinitions,
  listRolloutStatuses,
  listRuleBasedSegmentDefinitions,
  listRuleBasedSegments,
  listSegmentDefinitions,
  listSegmentKeys,
  listSegments,
  listTrafficTypes,
  listWorkspaces,
  removeSegmentKeys,
  restoreFeatureFlag,
  unarchiveFeatureFlag,
  updateFeatureFlag,
  updateFlagDefinition,
  updateRuleBasedSegmentDefinition,
} from "./tools.js"
import { limitField, offsetField } from "./schemas.js"
import { readPackageVersion } from "./version.js"

// The tool handlers live in ./tools.ts and are re-exported so tests (and any
// other caller) can exercise them against a mocked fetch.
export * from "./tools.js"

// ─── Server ───

export const serverVersion = readPackageVersion()

export const server = new McpServer({
  name: "mcp-harness-fme",
  version: serverVersion,
})

server.registerTool(
  "list_workspaces",
  {
    description: "List all FME workspaces in the account",
    inputSchema: {
      limit: limitField(50, 20, "Number of results to return"),
      offset: offsetField(),
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
      limit: limitField(50, 20, "Number of results to return (max 50)"),
      offset: offsetField(),
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
      "List all feature flag definitions (targeting rules) in a specific environment. Full definitions are large; pass summary: true to get name/id only when you just need to locate a flag.",
    inputSchema: {
      workspace_id: z.string().describe("The workspace ID"),
      environment_id: z.string().describe("The environment ID or name"),
      limit: limitField(50, 20, "Number of results to return (max 50)"),
      offset: offsetField(),
      summary: z
        .boolean()
        .optional()
        .default(false)
        .describe(
          "Return only name and id per flag instead of full treatment/rule bodies — avoids oversized responses in environments with many flags",
        ),
    },
  },
  listFlagDefinitions,
)

server.registerTool(
  "get_flag_url",
  {
    description:
      "Build a deep-link to a feature flag's definition in the Harness FME web UI. Pass workspace, flag, and environment by name or id — the org slug, project, flag id, and env id are resolved for you. Requires MCP_HARNESS_FME_ACCOUNT_ID and MCP_HARNESS_FME_ORG_GUID env vars on the server (those IDs are not exposed by the API — copy them once from a flag URL in the browser).",
    inputSchema: {
      workspace: z.string().describe("The workspace name or ID"),
      flag: z.string().describe("The feature flag name or GUID"),
      environment: z
        .string()
        .describe("The environment name or ID (e.g. 'Prod')"),
    },
  },
  getFlagUrl,
)

server.registerTool(
  "add_segment_to_treatment",
  {
    description:
      "Add a segment to a specific treatment of a feature flag via read-modify-write — safer than update_flag_definition's full replace, where a dropped field silently removes existing targeting. Idempotent: a no-op if the segment is already on the treatment. For workspaces where list_workspaces reports requiresTitleAndComments: true, pass title (and comment).",
    inputSchema: {
      workspace_id: z.string().describe("The workspace ID"),
      environment_id: z.string().describe("The environment ID or name"),
      flag_name: z.string().describe("The feature flag name"),
      treatment: z
        .string()
        .describe("The treatment name to add the segment to (e.g. 'on')"),
      segment: z.string().describe("The segment name to add"),
      title: z
        .string()
        .optional()
        .describe(
          "Change title. Required for workspaces with requiresTitleAndComments: true",
        ),
      comment: z
        .string()
        .optional()
        .describe(
          "Change comment. Required for workspaces with requiresTitleAndComments: true",
        ),
    },
  },
  addSegmentToTreatment,
)

server.registerTool(
  "create_flag_definition",
  {
    description:
      "Create (activate) a feature flag definition in a specific environment with treatments and targeting rules. For workspaces where list_workspaces reports requiresTitleAndComments: true, pass title (and comment) or the API rejects the write with a 400.",
    inputSchema: {
      workspace_id: z.string().describe("The workspace ID"),
      environment_id: z.string().describe("The environment ID or name"),
      flag_name: z.string().describe("The feature flag name"),
      definition: z
        .string()
        .describe(
          "Full flag definition as a JSON string — must include treatments array and defaultRule",
        ),
      title: z
        .string()
        .optional()
        .describe(
          "Change title. Required for workspaces with requiresTitleAndComments: true",
        ),
      comment: z
        .string()
        .optional()
        .describe(
          "Change comment. Required for workspaces with requiresTitleAndComments: true",
        ),
    },
  },
  createFlagDefinition,
)

server.registerTool(
  "update_flag_definition",
  {
    description:
      "Fully replace a feature flag definition (treatments, targeting rules) in an environment. For workspaces where list_workspaces reports requiresTitleAndComments: true, pass title (and comment) or the API rejects the write with a 400.",
    inputSchema: {
      workspace_id: z.string().describe("The workspace ID"),
      environment_id: z.string().describe("The environment ID or name"),
      flag_name: z.string().describe("The feature flag name"),
      definition: z
        .string()
        .describe(
          "Complete updated definition as a JSON string — replaces the existing definition",
        ),
      title: z
        .string()
        .optional()
        .describe(
          "Change title. Required for workspaces with requiresTitleAndComments: true",
        ),
      comment: z
        .string()
        .optional()
        .describe(
          "Change comment. Required for workspaces with requiresTitleAndComments: true",
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
      limit: limitField(50, 20, "Number of results to return (max 50)"),
      offset: offsetField(),
    },
  },
  listSegments,
)

server.registerTool(
  "list_segment_definitions",
  {
    description:
      "List classic segments activated in a specific environment, with their traffic type and creation time",
    inputSchema: {
      workspace_id: z.string().describe("The workspace ID"),
      environment_id: z.string().describe("The environment ID or name"),
      limit: limitField(50, 20, "Number of results to return (max 50)"),
      offset: offsetField(),
    },
  },
  listSegmentDefinitions,
)

server.registerTool(
  "list_segment_keys",
  {
    description:
      "List the member keys (identifiers) of a classic segment in an environment — use this to check whether a given key is already in the segment before adding it",
    inputSchema: {
      environment_id: z.string().describe("The environment ID or name"),
      segment_name: z.string().describe("The segment name"),
      limit: limitField(100, 100, "Number of keys to return (max 100)"),
      offset: offsetField(),
    },
  },
  listSegmentKeys,
)

server.registerTool(
  "create_segment",
  {
    description:
      "Create a new classic (explicit-membership) segment in a workspace under a specific traffic type",
    inputSchema: {
      workspace_id: z.string().describe("The workspace ID"),
      traffic_type: z.string().describe("The traffic type ID or name"),
      name: z.string().describe("The segment name (unique per workspace)"),
      description: z.string().optional().describe("Optional description"),
      owners: z
        .array(z.object({ id: z.string(), type: z.string() }))
        .optional()
        .describe("Owners to set — array of {id, type}"),
    },
  },
  createSegment,
)

server.registerTool(
  "enable_segment_in_environment",
  {
    description:
      "Activate a classic segment in a specific environment — creates an empty membership that keys can then be added to",
    inputSchema: {
      environment_id: z.string().describe("The environment ID or name"),
      segment_name: z.string().describe("The segment name"),
    },
  },
  enableSegmentInEnvironment,
)

server.registerTool(
  "add_segment_keys",
  {
    description:
      "Add member keys to a classic segment in an environment. Appends by default; pass replace: true to wipe existing membership first (confirm: true required for that case). Max 10,000 keys per call, 100,000 members per segment — split larger batches across multiple calls. For workspaces where list_workspaces reports requiresTitleAndComments: true, pass title and comment.",
    inputSchema: {
      environment_id: z.string().describe("The environment ID or name"),
      segment_name: z.string().describe("The segment name"),
      keys: z
        .array(z.string())
        .describe("Member keys to add (max 10,000 per call)"),
      replace: z
        .boolean()
        .optional()
        .default(false)
        .describe(
          "Replace the segment's entire membership with these keys instead of appending — requires confirm: true",
        ),
      title: z
        .string()
        .optional()
        .describe(
          "Change title. Required for workspaces with requiresTitleAndComments: true",
        ),
      comment: z
        .string()
        .optional()
        .describe(
          "Change comment. Required for workspaces with requiresTitleAndComments: true",
        ),
      confirm: z
        .boolean()
        .default(false)
        .describe("Must be true when replace: true is set"),
    },
  },
  addSegmentKeys,
)

server.registerTool(
  "remove_segment_keys",
  {
    description:
      "Remove specific member keys from a classic segment in an environment. For workspaces where list_workspaces reports requiresTitleAndComments: true, pass title and comment.",
    inputSchema: {
      environment_id: z.string().describe("The environment ID or name"),
      segment_name: z.string().describe("The segment name"),
      keys: z.array(z.string()).describe("Member keys to remove"),
      title: z
        .string()
        .optional()
        .describe(
          "Change title. Required for workspaces with requiresTitleAndComments: true",
        ),
      comment: z
        .string()
        .optional()
        .describe(
          "Change comment. Required for workspaces with requiresTitleAndComments: true",
        ),
      confirm: z
        .boolean()
        .default(false)
        .describe("Must be true to execute the removal"),
    },
  },
  removeSegmentKeys,
)

server.registerTool(
  "disable_segment_in_environment",
  {
    description:
      "Disable (remove) a classic segment from a specific environment — workspace-level metadata and other environments' activations are preserved",
    inputSchema: {
      environment_id: z.string().describe("The environment ID or name"),
      segment_name: z.string().describe("The segment name"),
      confirm: z
        .boolean()
        .default(false)
        .describe("Must be true to execute the disable"),
    },
  },
  disableSegmentInEnvironment,
)

server.registerTool(
  "delete_segment",
  {
    description:
      "Permanently delete a classic segment from a workspace — environment-level activations must be removed separately first",
    inputSchema: {
      workspace_id: z.string().describe("The workspace ID"),
      segment_name: z.string().describe("The segment name"),
      confirm: z
        .boolean()
        .default(false)
        .describe("Must be true to execute the deletion"),
    },
  },
  deleteSegment,
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
      limit: limitField(50, 20, "Number of results to return"),
      offset: offsetField(),
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
  if (!resolveApiKey()) {
    console.error(
      "MCP_HARNESS_FME_API_KEY env var is required (HARNESS_FME_API_KEY also works)",
    )
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

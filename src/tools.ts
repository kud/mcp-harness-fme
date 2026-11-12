import * as fme from "@kud/harness-fme"

export { API_BASE, rateLimitWaitMs } from "@kud/harness-fme"

let cachedClient: fme.FmeClient | undefined

// Built on first use so the key is read when a tool runs, not when the module
// loads. HARNESS_FME_API_KEY is accepted alongside MCP_HARNESS_FME_API_KEY.
const client = (): fme.FmeClient => {
  cachedClient ??= fme.createClient({
    apiKey: fme.resolveApiKey() ?? "",
    onError: (message, path) =>
      console.error(`API error: ${message} — ${path}`),
  })
  return cachedClient
}

export const ok = (data: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
})

export const err = (msg: string) => ({
  content: [{ type: "text" as const, text: `Error: ${msg}` }],
})

const respond = <T>(result: fme.FmeResult<T>) =>
  result.ok ? ok(result.data) : err(result.message)

// ─── Workspaces ───

export const listWorkspaces = async ({
  limit,
  offset,
}: {
  limit: number
  offset: number
}) => respond(await fme.listWorkspaces(client(), { limit, offset }))

// ─── Environments ───

export const listEnvironments = async ({
  workspace_id,
}: {
  workspace_id: string
}) =>
  respond(await fme.listEnvironments(client(), { workspaceId: workspace_id }))

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
}) =>
  respond(
    await fme.listFeatureFlags(client(), {
      workspaceId: workspace_id,
      limit,
      offset,
      tag,
      rolloutStatusId: rollout_status_id,
      name,
    }),
  )

export const getFeatureFlag = async ({
  workspace_id,
  flag_name,
}: {
  workspace_id: string
  flag_name: string
}) =>
  respond(
    await fme.getFeatureFlag(client(), {
      workspaceId: workspace_id,
      flagName: flag_name,
    }),
  )

export const getFlagDefinition = async ({
  workspace_id,
  environment_id,
  flag_name,
}: {
  workspace_id: string
  environment_id: string
  flag_name: string
}) =>
  respond(
    await fme.getFlagDefinition(client(), {
      workspaceId: workspace_id,
      environmentId: environment_id,
      flagName: flag_name,
    }),
  )

// The account ID and org GUID are Harness *platform* identifiers the Split API
// does not expose, so they stay env-configured (read at call time so the
// server needn't restart and tests can vary them).
export const getFlagUrl = async ({
  workspace,
  flag,
  environment,
}: {
  workspace: string
  flag: string
  environment: string
}) => {
  const accountId = process.env.MCP_HARNESS_FME_ACCOUNT_ID
  const orgGuid = process.env.MCP_HARNESS_FME_ORG_GUID
  if (!accountId || !orgGuid)
    return err(
      "get_flag_url needs MCP_HARNESS_FME_ACCOUNT_ID and MCP_HARNESS_FME_ORG_GUID set on the server. " +
        "These are the account ID and org GUID from a Harness FME flag URL in your browser " +
        "(app.harness.io/ng/account/<MCP_HARNESS_FME_ACCOUNT_ID>/… and …/org/<MCP_HARNESS_FME_ORG_GUID>/…) — copy them once.",
    )
  return respond(
    await fme.buildFlagUrl(client(), {
      accountId,
      orgGuid,
      workspace,
      flag,
      environment,
    }),
  )
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
  return respond(
    await fme.killFeatureFlag(client(), {
      workspaceId: workspace_id,
      environmentId: environment_id,
      flagName: flag_name,
    }),
  )
}

export const restoreFeatureFlag = async ({
  workspace_id,
  environment_id,
  flag_name,
}: {
  workspace_id: string
  environment_id: string
  flag_name: string
}) =>
  respond(
    await fme.restoreFeatureFlag(client(), {
      workspaceId: workspace_id,
      environmentId: environment_id,
      flagName: flag_name,
    }),
  )

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
}) =>
  respond(
    await fme.createFeatureFlag(client(), {
      workspaceId: workspace_id,
      trafficType: traffic_type,
      name,
      description,
    }),
  )

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
}) =>
  respond(
    await fme.updateFeatureFlag(client(), {
      workspaceId: workspace_id,
      flagName: flag_name,
      description,
      tags,
      owners,
      rolloutStatusId: rollout_status_id,
    }),
  )

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
  return respond(
    await fme.deleteFeatureFlag(client(), {
      workspaceId: workspace_id,
      flagName: flag_name,
    }),
  )
}

// Trim a flag definition to just its identifying fields. Full definitions
// carry every treatment/rule body, so an environment with 100+ flags can blow
// past a host's per-result token cap — summary mode is for callers that only
// need to locate a flag by name/id. undefined keys drop out of JSON.stringify.
const summariseFlagDefinition = (o: unknown) => {
  if (!o || typeof o !== "object") return o
  const { name, id } = o as Record<string, unknown>
  return { name, id }
}

export const listFlagDefinitions = async ({
  workspace_id,
  environment_id,
  limit,
  offset,
  summary,
}: {
  workspace_id: string
  environment_id: string
  limit: number
  offset: number
  summary?: boolean
}) => {
  const result = await fme.listFlagDefinitions(client(), {
    workspaceId: workspace_id,
    environmentId: environment_id,
    limit,
    offset,
  })
  if (!result.ok) return err(result.message)
  return ok(
    summary
      ? {
          ...result.data,
          objects: result.data.objects.map(summariseFlagDefinition),
        }
      : result.data,
  )
}

export const createFlagDefinition = async ({
  workspace_id,
  environment_id,
  flag_name,
  definition,
  title,
  comment,
}: {
  workspace_id: string
  environment_id: string
  flag_name: string
  definition: string
  title?: string
  comment?: string
}) =>
  respond(
    await fme.createFlagDefinition(client(), {
      workspaceId: workspace_id,
      environmentId: environment_id,
      flagName: flag_name,
      definition,
      title,
      comment,
    }),
  )

export const updateFlagDefinition = async ({
  workspace_id,
  environment_id,
  flag_name,
  definition,
  title,
  comment,
}: {
  workspace_id: string
  environment_id: string
  flag_name: string
  definition: string
  title?: string
  comment?: string
}) =>
  respond(
    await fme.updateFlagDefinition(client(), {
      workspaceId: workspace_id,
      environmentId: environment_id,
      flagName: flag_name,
      definition,
      title,
      comment,
    }),
  )

export const addSegmentToTreatment = async ({
  workspace_id,
  environment_id,
  flag_name,
  treatment,
  segment,
  title,
  comment,
}: {
  workspace_id: string
  environment_id: string
  flag_name: string
  treatment: string
  segment: string
  title?: string
  comment?: string
}) =>
  respond(
    await fme.addSegmentToTreatment(client(), {
      workspaceId: workspace_id,
      environmentId: environment_id,
      flagName: flag_name,
      treatment,
      segment,
      title,
      comment,
    }),
  )

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
  return respond(
    await fme.deleteFlagDefinition(client(), {
      workspaceId: workspace_id,
      environmentId: environment_id,
      flagName: flag_name,
    }),
  )
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
}) =>
  respond(
    await fme.listSegments(client(), {
      workspaceId: workspace_id,
      limit,
      offset,
    }),
  )

export const listSegmentDefinitions = async ({
  workspace_id,
  environment_id,
  limit,
  offset,
}: {
  workspace_id: string
  environment_id: string
  limit: number
  offset: number
}) =>
  respond(
    await fme.listSegmentDefinitions(client(), {
      workspaceId: workspace_id,
      environmentId: environment_id,
      limit,
      offset,
    }),
  )

export const listSegmentKeys = async ({
  environment_id,
  segment_name,
  limit,
  offset,
}: {
  environment_id: string
  segment_name: string
  limit: number
  offset: number
}) =>
  respond(
    await fme.listSegmentKeys(client(), {
      environmentId: environment_id,
      segmentName: segment_name,
      limit,
      offset,
    }),
  )

export const createSegment = async ({
  workspace_id,
  traffic_type,
  name,
  description,
  owners,
}: {
  workspace_id: string
  traffic_type: string
  name: string
  description?: string
  owners?: Array<{ id: string; type: string }>
}) =>
  respond(
    await fme.createSegment(client(), {
      workspaceId: workspace_id,
      trafficType: traffic_type,
      name,
      description,
      owners,
    }),
  )

export const enableSegmentInEnvironment = async ({
  environment_id,
  segment_name,
}: {
  environment_id: string
  segment_name: string
}) =>
  respond(
    await fme.enableSegmentInEnvironment(client(), {
      environmentId: environment_id,
      segmentName: segment_name,
    }),
  )

export const addSegmentKeys = async ({
  environment_id,
  segment_name,
  keys,
  replace,
  title,
  comment,
  confirm,
}: {
  environment_id: string
  segment_name: string
  keys: string[]
  replace?: boolean
  title?: string
  comment?: string
  confirm: boolean
}) => {
  if (replace && !confirm)
    return err("set confirm=true to replace this segment's existing keys")
  return respond(
    await fme.addSegmentKeys(client(), {
      environmentId: environment_id,
      segmentName: segment_name,
      keys,
      replace,
      title,
      comment,
    }),
  )
}

export const removeSegmentKeys = async ({
  environment_id,
  segment_name,
  keys,
  title,
  comment,
  confirm,
}: {
  environment_id: string
  segment_name: string
  keys: string[]
  title?: string
  comment?: string
  confirm: boolean
}) => {
  if (!confirm) return err("set confirm=true to remove keys from this segment")
  return respond(
    await fme.removeSegmentKeys(client(), {
      environmentId: environment_id,
      segmentName: segment_name,
      keys,
      title,
      comment,
    }),
  )
}

export const disableSegmentInEnvironment = async ({
  environment_id,
  segment_name,
  confirm,
}: {
  environment_id: string
  segment_name: string
  confirm: boolean
}) => {
  if (!confirm)
    return err("set confirm=true to disable this segment in the environment")
  return respond(
    await fme.disableSegmentInEnvironment(client(), {
      environmentId: environment_id,
      segmentName: segment_name,
    }),
  )
}

export const deleteSegment = async ({
  workspace_id,
  segment_name,
  confirm,
}: {
  workspace_id: string
  segment_name: string
  confirm: boolean
}) => {
  if (!confirm) return err("set confirm=true to delete this segment")
  return respond(
    await fme.deleteSegment(client(), {
      workspaceId: workspace_id,
      segmentName: segment_name,
    }),
  )
}

// ─── Traffic Types ───

export const listTrafficTypes = async ({
  workspace_id,
}: {
  workspace_id: string
}) =>
  respond(await fme.listTrafficTypes(client(), { workspaceId: workspace_id }))

// ─── Rollout Statuses ───

export const listRolloutStatuses = async ({
  workspace_id,
}: {
  workspace_id: string
}) =>
  respond(
    await fme.listRolloutStatuses(client(), { workspaceId: workspace_id }),
  )

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
  return respond(
    await fme.archiveFeatureFlag(client(), {
      workspaceId: workspace_id,
      flagName: flag_name,
    }),
  )
}

export const unarchiveFeatureFlag = async ({
  workspace_id,
  flag_name,
}: {
  workspace_id: string
  flag_name: string
}) =>
  respond(
    await fme.unarchiveFeatureFlag(client(), {
      workspaceId: workspace_id,
      flagName: flag_name,
    }),
  )

// ─── Rule-Based Segments ───

export const listRuleBasedSegments = async ({
  workspace_id,
  limit,
  offset,
}: {
  workspace_id: string
  limit: number
  offset: number
}) =>
  respond(
    await fme.listRuleBasedSegments(client(), {
      workspaceId: workspace_id,
      limit,
      offset,
    }),
  )

export const getRuleBasedSegment = async ({
  workspace_id,
  segment_name,
}: {
  workspace_id: string
  segment_name: string
}) =>
  respond(
    await fme.getRuleBasedSegment(client(), {
      workspaceId: workspace_id,
      segmentName: segment_name,
    }),
  )

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
}) =>
  respond(
    await fme.createRuleBasedSegment(client(), {
      workspaceId: workspace_id,
      trafficType: traffic_type,
      name,
      description,
    }),
  )

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
  return respond(
    await fme.deleteRuleBasedSegment(client(), {
      workspaceId: workspace_id,
      segmentName: segment_name,
    }),
  )
}

// ─── Rule-Based Segment Definitions ───

export const listRuleBasedSegmentDefinitions = async ({
  workspace_id,
  environment_id,
}: {
  workspace_id: string
  environment_id: string
}) =>
  respond(
    await fme.listRuleBasedSegmentDefinitions(client(), {
      workspaceId: workspace_id,
      environmentId: environment_id,
    }),
  )

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
}) =>
  respond(
    await fme.updateRuleBasedSegmentDefinition(client(), {
      workspaceId: workspace_id,
      environmentId: environment_id,
      segmentName: segment_name,
      definition,
    }),
  )

export const enableRuleBasedSegmentDefinition = async ({
  environment_id,
  segment_name,
}: {
  workspace_id: string
  environment_id: string
  segment_name: string
}) =>
  respond(
    await fme.enableRuleBasedSegmentDefinition(client(), {
      environmentId: environment_id,
      segmentName: segment_name,
    }),
  )

export const disableRuleBasedSegmentDefinition = async ({
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
  return respond(
    await fme.disableRuleBasedSegmentDefinition(client(), {
      environmentId: environment_id,
      segmentName: segment_name,
    }),
  )
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
}) =>
  respond(
    await fme.createRuleBasedSegmentChangeRequest(client(), {
      workspaceId: workspace_id,
      environmentId: environment_id,
      title,
      operationType: operation_type,
      ruleBasedSegment: rule_based_segment,
      comment,
      approvers,
    }),
  )

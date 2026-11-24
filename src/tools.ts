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

// Every epoch-millisecond time in a result gets an ISO 8601 twin beside it
// (`lastUpdateTime` and `lastUpdateTimeIso`), so no caller converts by hand.
export const ok = (data: unknown) => ({
  content: [
    {
      type: "text" as const,
      text: JSON.stringify(fme.withIsoTimes(data), null, 2),
    },
  ],
})

export const err = (msg: string) => ({
  content: [{ type: "text" as const, text: `Error: ${msg}` }],
})

const respond = <T>(result: fme.FmeResult<T>) =>
  result.ok ? ok(result.data) : err(result.message)

// Workspace names resolved once per server process: they change rarely and
// every tool takes one, so a lookup per call would spend the shared rate limit.
const workspaceIds = new Map<string, string>()

export const resetNameCache = () => workspaceIds.clear()

const resolveWorkspaceId = async (
  reference: string,
): Promise<fme.FmeResult<string>> => {
  const cached = workspaceIds.get(reference.toLowerCase())
  if (cached) return { ok: true, data: cached }
  const result = await fme.resolveWorkspaceId(client(), reference)
  if (result.ok && result.data !== reference)
    workspaceIds.set(reference.toLowerCase(), result.data)
  return result
}

// Lets a tool take its workspace by name or id: a GUID passes straight
// through, a name is looked up and swapped for its id before the handler runs.
const withNames =
  <A extends { workspace_id: string }, R>(handler: (args: A) => Promise<R>) =>
  async (args: A): Promise<R | ReturnType<typeof err>> => {
    const workspace = await resolveWorkspaceId(args.workspace_id)
    if (!workspace.ok) return err(workspace.message)
    return handler({ ...args, workspace_id: workspace.data })
  }

// ─── Workspaces ───

export const listWorkspaces = async ({
  limit,
  offset,
}: {
  limit: number
  offset: number
}) => respond(await fme.listWorkspaces(client(), { limit, offset }))

// ─── Environments ───

export const listEnvironments = withNames(
  async ({ workspace_id }: { workspace_id: string }) =>
    respond(
      await fme.listEnvironments(client(), { workspaceId: workspace_id }),
    ),
)

// ─── Feature Flags (Splits) ───

export const listFeatureFlags = withNames(
  async ({
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
    ),
)

export const getFeatureFlag = withNames(
  async ({
    workspace_id,
    flag_name,
  }: {
    workspace_id: string
    flag_name: string
  }) => {
    const result = await fme.getFeatureFlag(client(), {
      workspaceId: workspace_id,
      flagName: flag_name,
    })
    if (!result.ok) return err(result.message)
    // Owners come back as ids; each gains its display name, the id kept.
    return ok(await fme.withOwnerNames(client(), result.data))
  },
)

export const compareFlagEnvironments = withNames(
  async ({
    workspace_id,
    flag_name,
    environments,
  }: {
    workspace_id: string
    flag_name: string
    environments?: string[]
  }) => {
    const all = await fme.getEnvironments(client(), {
      workspaceId: workspace_id,
    })
    if (!all.ok) return err(all.message)
    let selected = all.data
    if (environments && environments.length > 0) {
      selected = []
      for (const reference of environments) {
        const found = all.data.find(
          (e) =>
            e.id === reference ||
            e.name.toLowerCase() === reference.toLowerCase(),
        )
        if (!found)
          return err(
            `environment not found: ${reference}. Available: ${
              all.data.map((e) => e.name).join(", ") || "none"
            }`,
          )
        selected.push(found)
      }
    }
    const result = await fme.compareFlagEnvironments(client(), {
      workspaceId: workspace_id,
      flagName: flag_name,
      environments: selected,
    })
    if (!result.ok) return err(result.message)
    return ok({
      flag: result.data.flag,
      differences: result.data.differences,
      environments: result.data.environments.map(
        ({ definition: _definition, ...view }) => view,
      ),
    })
  },
)

// The admin API has no flag audit log; a flag's published change requests are
// the record it keeps, each with the definition it proposed.
export const getFlagHistory = withNames(
  async ({
    workspace_id,
    environment_id,
    flag_name,
    status,
    limit,
  }: {
    workspace_id: string
    environment_id: string
    flag_name: string
    status?: string
    limit?: number
  }) => {
    const environment = await fme.resolveEnvironment(
      client(),
      workspace_id,
      environment_id,
    )
    if (!environment.ok) return err(environment.message)
    const result = await fme.getFlagHistory(client(), {
      environmentId: environment.data.id,
      flagName: flag_name,
      status,
      limit,
    })
    if (!result.ok) return err(result.message)
    return ok({
      flag: flag_name,
      environment: environment.data.name,
      source:
        "change requests; changes made without an approval flow are not recorded by the API",
      changes: result.data.map(
        ({ definition: _definition, ...change }) => change,
      ),
    })
  },
)

export const getFlagDefinition = withNames(
  async ({
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
    ),
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

export const killFeatureFlag = withNames(
  async ({
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
  },
)

export const restoreFeatureFlag = withNames(
  async ({
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
    ),
)

export const createFeatureFlag = withNames(
  async ({
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
    ),
)

export const updateFeatureFlag = withNames(
  async ({
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
    ),
)

export const deleteFeatureFlag = withNames(
  async ({
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
  },
)

// Trim a flag definition to just its identifying fields. Full definitions
// carry every treatment/rule body, so an environment with 100+ flags can blow
// past a host's per-result token cap — summary mode is for callers that only
// need to locate a flag by name/id. undefined keys drop out of JSON.stringify.
const summariseFlagDefinition = (o: unknown) => {
  if (!o || typeof o !== "object") return o
  const { name, id } = o as Record<string, unknown>
  return { name, id }
}

export const listFlagDefinitions = withNames(
  async ({
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
  },
)

export const createFlagDefinition = withNames(
  async ({
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
    ),
)

export const updateFlagDefinition = withNames(
  async ({
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
    ),
)

export const addSegmentToTreatment = withNames(
  async ({
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
    ),
)

export const deleteFlagDefinition = withNames(
  async ({
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
  },
)

// ─── Segments ───

export const listSegments = withNames(
  async ({
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
    ),
)

export const listSegmentDefinitions = withNames(
  async ({
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
    ),
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

export const createSegment = withNames(
  async ({
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
    ),
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

export const deleteSegment = withNames(
  async ({
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
  },
)

// ─── Traffic Types ───

export const listTrafficTypes = withNames(
  async ({ workspace_id }: { workspace_id: string }) =>
    respond(
      await fme.listTrafficTypes(client(), { workspaceId: workspace_id }),
    ),
)

// ─── Rollout Statuses ───

export const listRolloutStatuses = withNames(
  async ({ workspace_id }: { workspace_id: string }) =>
    respond(
      await fme.listRolloutStatuses(client(), { workspaceId: workspace_id }),
    ),
)

// ─── Feature Flag Archive ───

export const archiveFeatureFlag = withNames(
  async ({
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
  },
)

export const unarchiveFeatureFlag = withNames(
  async ({
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
    ),
)

// ─── Rule-Based Segments ───

export const listRuleBasedSegments = withNames(
  async ({
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
    ),
)

export const getRuleBasedSegment = withNames(
  async ({
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
    ),
)

export const createRuleBasedSegment = withNames(
  async ({
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
    ),
)

export const deleteRuleBasedSegment = withNames(
  async ({
    workspace_id,
    segment_name,
    confirm,
  }: {
    workspace_id: string
    segment_name: string
    confirm: boolean
  }) => {
    if (!confirm)
      return err("set confirm=true to delete this rule-based segment")
    return respond(
      await fme.deleteRuleBasedSegment(client(), {
        workspaceId: workspace_id,
        segmentName: segment_name,
      }),
    )
  },
)

// ─── Rule-Based Segment Definitions ───

export const listRuleBasedSegmentDefinitions = withNames(
  async ({
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
    ),
)

export const updateRuleBasedSegmentDefinition = withNames(
  async ({
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
    ),
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

export const createRuleBasedSegmentChangeRequest = withNames(
  async ({
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
    ),
)

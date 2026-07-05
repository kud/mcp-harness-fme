import { beforeEach, describe, expect, it, vi } from "vitest"
import * as api from "../index.js"

const mockFetch = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal("fetch", mockFetch)
})

const jsonResponse = (data: unknown) =>
  Promise.resolve({ ok: true, json: () => Promise.resolve(data) })

const errorResponse = (status = 500) => Promise.resolve({ ok: false, status })

// ─── Workspaces ───

describe("listWorkspaces", () => {
  it("returns workspaces on success", async () => {
    mockFetch.mockReturnValue(
      jsonResponse({ objects: [{ id: "ws1" }], totalCount: 1 }),
    )
    const result = await api.listWorkspaces({ limit: 20, offset: 0 })
    expect(result.content[0].text).toContain("ws1")
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/workspaces?size=20&offset=0"),
      expect.any(Object),
    )
  })

  it("returns error when fetch fails", async () => {
    mockFetch.mockReturnValue(errorResponse())
    const result = await api.listWorkspaces({ limit: 20, offset: 0 })
    expect(result.content[0].text).toContain("Error:")
  })
})

// ─── Environments ───

describe("listEnvironments", () => {
  it("returns environments on success", async () => {
    mockFetch.mockReturnValue(
      jsonResponse({ objects: [{ name: "production" }] }),
    )
    const result = await api.listEnvironments({ workspace_id: "ws1" })
    expect(result.content[0].text).toContain("production")
  })

  it("returns error when fetch fails", async () => {
    mockFetch.mockReturnValue(errorResponse())
    const result = await api.listEnvironments({ workspace_id: "ws1" })
    expect(result.content[0].text).toContain("Error:")
  })
})

// ─── Feature Flags ───

describe("listFeatureFlags", () => {
  it("returns flags on success", async () => {
    mockFetch.mockReturnValue(
      jsonResponse({ objects: [{ name: "my-flag" }], totalCount: 1 }),
    )
    const result = await api.listFeatureFlags({
      workspace_id: "ws1",
      limit: 20,
      offset: 0,
    })
    expect(result.content[0].text).toContain("my-flag")
  })

  it("includes tag filter in query when provided", async () => {
    mockFetch.mockReturnValue(jsonResponse({ objects: [], totalCount: 0 }))
    await api.listFeatureFlags({
      workspace_id: "ws1",
      limit: 20,
      offset: 0,
      tag: "Mobile Suite",
    })
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("tag=Mobile+Suite"),
      expect.any(Object),
    )
  })

  it("returns error when fetch fails", async () => {
    mockFetch.mockReturnValue(errorResponse())
    const result = await api.listFeatureFlags({
      workspace_id: "ws1",
      limit: 20,
      offset: 0,
    })
    expect(result.content[0].text).toContain("Error:")
  })
})

describe("getFeatureFlag", () => {
  it("returns flag on success", async () => {
    mockFetch.mockReturnValue(jsonResponse({ name: "my-flag", id: "abc" }))
    const result = await api.getFeatureFlag({
      workspace_id: "ws1",
      flag_name: "my-flag",
    })
    expect(result.content[0].text).toContain("my-flag")
  })

  it("returns error when fetch fails", async () => {
    mockFetch.mockReturnValue(errorResponse())
    const result = await api.getFeatureFlag({
      workspace_id: "ws1",
      flag_name: "my-flag",
    })
    expect(result.content[0].text).toContain("Error:")
    expect(result.content[0].text).toContain("my-flag")
  })
})

describe("getFlagDefinition", () => {
  it("returns definition on success", async () => {
    mockFetch.mockReturnValue(jsonResponse({ treatments: ["on", "off"] }))
    const result = await api.getFlagDefinition({
      workspace_id: "ws1",
      environment_id: "production",
      flag_name: "my-flag",
    })
    expect(result.content[0].text).toContain("on")
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/splits/ws/ws1/my-flag/environments/production"),
      expect.any(Object),
    )
  })

  it("returns error when fetch fails", async () => {
    mockFetch.mockReturnValue(errorResponse())
    const result = await api.getFlagDefinition({
      workspace_id: "ws1",
      environment_id: "production",
      flag_name: "my-flag",
    })
    expect(result.content[0].text).toContain("Error:")
  })
})

describe("killFeatureFlag", () => {
  it("blocks execution without confirm", async () => {
    const result = await api.killFeatureFlag({
      workspace_id: "ws1",
      environment_id: "production",
      flag_name: "my-flag",
      confirm: false,
    })
    expect(result.content[0].text).toContain("Error:")
    expect(result.content[0].text).toContain("confirm=true")
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it("kills flag when confirmed", async () => {
    mockFetch.mockReturnValue(jsonResponse({ killed: true }))
    const result = await api.killFeatureFlag({
      workspace_id: "ws1",
      environment_id: "production",
      flag_name: "my-flag",
      confirm: true,
    })
    expect(result.content[0].text).toContain("killed")
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining(
        "/splits/ws/ws1/my-flag/environments/production/kill",
      ),
      expect.objectContaining({ method: "PUT" }),
    )
  })

  it("returns error when api fails", async () => {
    mockFetch.mockReturnValue(errorResponse())
    const result = await api.killFeatureFlag({
      workspace_id: "ws1",
      environment_id: "production",
      flag_name: "my-flag",
      confirm: true,
    })
    expect(result.content[0].text).toContain("Error:")
  })
})

describe("restoreFeatureFlag", () => {
  it("restores flag on success", async () => {
    mockFetch.mockReturnValue(jsonResponse({ killed: false }))
    const result = await api.restoreFeatureFlag({
      workspace_id: "ws1",
      environment_id: "production",
      flag_name: "my-flag",
    })
    expect(result.content[0].text).toContain("killed")
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining(
        "/splits/ws/ws1/my-flag/environments/production/restore",
      ),
      expect.objectContaining({ method: "PUT" }),
    )
  })

  it("returns error when api fails", async () => {
    mockFetch.mockReturnValue(errorResponse())
    const result = await api.restoreFeatureFlag({
      workspace_id: "ws1",
      environment_id: "production",
      flag_name: "my-flag",
    })
    expect(result.content[0].text).toContain("Error:")
  })
})

describe("createFeatureFlag", () => {
  it("creates flag on success", async () => {
    mockFetch.mockReturnValue(jsonResponse({ name: "new-flag" }))
    const result = await api.createFeatureFlag({
      workspace_id: "ws1",
      traffic_type: "user",
      name: "new-flag",
    })
    expect(result.content[0].text).toContain("new-flag")
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/splits/ws/ws1/trafficTypes/user"),
      expect.objectContaining({ method: "POST" }),
    )
  })

  it("includes description in body when provided", async () => {
    mockFetch.mockReturnValue(jsonResponse({ name: "new-flag" }))
    await api.createFeatureFlag({
      workspace_id: "ws1",
      traffic_type: "user",
      name: "new-flag",
      description: "My flag",
    })
    const call = mockFetch.mock.calls[0]
    expect(JSON.parse(call[1]?.body as string)).toMatchObject({
      description: "My flag",
    })
  })

  it("returns error when api fails", async () => {
    mockFetch.mockReturnValue(errorResponse())
    const result = await api.createFeatureFlag({
      workspace_id: "ws1",
      traffic_type: "user",
      name: "new-flag",
    })
    expect(result.content[0].text).toContain("Error:")
  })
})

describe("updateFeatureFlag", () => {
  it("updates flag on success", async () => {
    mockFetch.mockReturnValue(
      jsonResponse({ name: "my-flag", description: "Updated" }),
    )
    const result = await api.updateFeatureFlag({
      workspace_id: "ws1",
      flag_name: "my-flag",
      description: "Updated",
    })
    expect(result.content[0].text).toContain("Updated")
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/splits/ws/ws1/my-flag"),
      expect.objectContaining({ method: "PATCH" }),
    )
  })

  it("returns error when api fails", async () => {
    mockFetch.mockReturnValue(errorResponse())
    const result = await api.updateFeatureFlag({
      workspace_id: "ws1",
      flag_name: "my-flag",
    })
    expect(result.content[0].text).toContain("Error:")
  })
})

describe("deleteFeatureFlag", () => {
  it("blocks execution without confirm", async () => {
    const result = await api.deleteFeatureFlag({
      workspace_id: "ws1",
      flag_name: "my-flag",
      confirm: false,
    })
    expect(result.content[0].text).toContain("Error:")
    expect(result.content[0].text).toContain("confirm=true")
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it("deletes flag when confirmed", async () => {
    mockFetch.mockReturnValue(Promise.resolve({ ok: true }))
    const result = await api.deleteFeatureFlag({
      workspace_id: "ws1",
      flag_name: "my-flag",
      confirm: true,
    })
    expect(result.content[0].text).toContain("my-flag")
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/splits/ws/ws1/my-flag"),
      expect.objectContaining({ method: "DELETE" }),
    )
  })

  it("returns error when api fails", async () => {
    mockFetch.mockReturnValue(Promise.resolve({ ok: false, status: 404 }))
    const result = await api.deleteFeatureFlag({
      workspace_id: "ws1",
      flag_name: "my-flag",
      confirm: true,
    })
    expect(result.content[0].text).toContain("Error:")
    expect(result.content[0].text).toContain("404")
  })
})

// ─── Flag Definitions ───

describe("listFlagDefinitions", () => {
  it("returns definitions on success", async () => {
    mockFetch.mockReturnValue(
      jsonResponse({ objects: [{ name: "my-flag" }], totalCount: 1 }),
    )
    const result = await api.listFlagDefinitions({
      workspace_id: "ws1",
      environment_id: "production",
      limit: 20,
      offset: 0,
    })
    expect(result.content[0].text).toContain("my-flag")
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/splits/ws/ws1/environments/production"),
      expect.any(Object),
    )
  })

  it("returns error when fetch fails", async () => {
    mockFetch.mockReturnValue(errorResponse())
    const result = await api.listFlagDefinitions({
      workspace_id: "ws1",
      environment_id: "production",
      limit: 20,
      offset: 0,
    })
    expect(result.content[0].text).toContain("Error:")
  })
})

describe("createFlagDefinition", () => {
  const validDefinition = JSON.stringify({
    treatments: [{ name: "on" }, { name: "off" }],
    defaultRule: [{ treatment: "off", size: 100 }],
  })

  it("creates definition on success", async () => {
    mockFetch.mockReturnValue(jsonResponse({ name: "my-flag" }))
    const result = await api.createFlagDefinition({
      workspace_id: "ws1",
      environment_id: "production",
      flag_name: "my-flag",
      definition: validDefinition,
    })
    expect(result.content[0].text).toContain("my-flag")
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/splits/ws/ws1/my-flag/environments/production"),
      expect.objectContaining({ method: "POST" }),
    )
  })

  it("returns error for invalid JSON", async () => {
    const result = await api.createFlagDefinition({
      workspace_id: "ws1",
      environment_id: "production",
      flag_name: "my-flag",
      definition: "not valid json {",
    })
    expect(result.content[0].text).toContain("valid JSON")
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it("returns error when api fails", async () => {
    mockFetch.mockReturnValue(errorResponse())
    const result = await api.createFlagDefinition({
      workspace_id: "ws1",
      environment_id: "production",
      flag_name: "my-flag",
      definition: validDefinition,
    })
    expect(result.content[0].text).toContain("Error:")
  })
})

describe("updateFlagDefinition", () => {
  const validDefinition = JSON.stringify({
    treatments: [{ name: "on" }, { name: "off" }],
    defaultRule: [{ treatment: "on", size: 100 }],
  })

  it("updates definition on success", async () => {
    mockFetch.mockReturnValue(jsonResponse({ name: "my-flag" }))
    const result = await api.updateFlagDefinition({
      workspace_id: "ws1",
      environment_id: "production",
      flag_name: "my-flag",
      definition: validDefinition,
    })
    expect(result.content[0].text).toContain("my-flag")
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/splits/ws/ws1/my-flag/environments/production"),
      expect.objectContaining({ method: "PUT" }),
    )
  })

  it("returns error for invalid JSON", async () => {
    const result = await api.updateFlagDefinition({
      workspace_id: "ws1",
      environment_id: "production",
      flag_name: "my-flag",
      definition: "{{broken",
    })
    expect(result.content[0].text).toContain("valid JSON")
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it("returns error when api fails", async () => {
    mockFetch.mockReturnValue(errorResponse())
    const result = await api.updateFlagDefinition({
      workspace_id: "ws1",
      environment_id: "production",
      flag_name: "my-flag",
      definition: validDefinition,
    })
    expect(result.content[0].text).toContain("Error:")
  })
})

describe("deleteFlagDefinition", () => {
  it("blocks execution without confirm", async () => {
    const result = await api.deleteFlagDefinition({
      workspace_id: "ws1",
      environment_id: "production",
      flag_name: "my-flag",
      confirm: false,
    })
    expect(result.content[0].text).toContain("Error:")
    expect(result.content[0].text).toContain("confirm=true")
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it("deletes definition when confirmed", async () => {
    mockFetch.mockReturnValue(Promise.resolve({ ok: true }))
    const result = await api.deleteFlagDefinition({
      workspace_id: "ws1",
      environment_id: "production",
      flag_name: "my-flag",
      confirm: true,
    })
    expect(result.content[0].text).toContain("my-flag")
    expect(result.content[0].text).toContain("production")
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/splits/ws/ws1/my-flag/environments/production"),
      expect.objectContaining({ method: "DELETE" }),
    )
  })

  it("returns error when api fails", async () => {
    mockFetch.mockReturnValue(Promise.resolve({ ok: false, status: 403 }))
    const result = await api.deleteFlagDefinition({
      workspace_id: "ws1",
      environment_id: "production",
      flag_name: "my-flag",
      confirm: true,
    })
    expect(result.content[0].text).toContain("Error:")
    expect(result.content[0].text).toContain("403")
  })
})

// ─── Segments ───

describe("listSegments", () => {
  it("returns segments on success", async () => {
    mockFetch.mockReturnValue(
      jsonResponse({ objects: [{ name: "beta-users" }], totalCount: 1 }),
    )
    const result = await api.listSegments({
      workspace_id: "ws1",
      limit: 20,
      offset: 0,
    })
    expect(result.content[0].text).toContain("beta-users")
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/segments/ws/ws1"),
      expect.any(Object),
    )
  })

  it("returns error when fetch fails", async () => {
    mockFetch.mockReturnValue(errorResponse())
    const result = await api.listSegments({
      workspace_id: "ws1",
      limit: 20,
      offset: 0,
    })
    expect(result.content[0].text).toContain("Error:")
  })
})

// ─── Traffic Types ───

describe("listTrafficTypes", () => {
  it("returns traffic types on success", async () => {
    mockFetch.mockReturnValue(jsonResponse({ objects: [{ name: "user" }] }))
    const result = await api.listTrafficTypes({ workspace_id: "ws1" })
    expect(result.content[0].text).toContain("user")
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/trafficTypes/ws/ws1"),
      expect.any(Object),
    )
  })

  it("returns error when fetch fails", async () => {
    mockFetch.mockReturnValue(errorResponse())
    const result = await api.listTrafficTypes({ workspace_id: "ws1" })
    expect(result.content[0].text).toContain("Error:")
  })
})

// ─── Rollout Statuses ───

describe("listRolloutStatuses", () => {
  it("returns statuses on success", async () => {
    mockFetch.mockReturnValue(
      jsonResponse({ objects: [{ name: "Pre-Production" }] }),
    )
    const result = await api.listRolloutStatuses({ workspace_id: "ws1" })
    expect(result.content[0].text).toContain("Pre-Production")
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/rolloutStatuses/ws/ws1"),
      expect.any(Object),
    )
  })

  it("returns error when fetch fails", async () => {
    mockFetch.mockReturnValue(errorResponse())
    const result = await api.listRolloutStatuses({ workspace_id: "ws1" })
    expect(result.content[0].text).toContain("Error:")
  })
})

// ─── Feature Flag Archive ───

describe("archiveFeatureFlag", () => {
  it("blocks execution without confirm", async () => {
    const result = await api.archiveFeatureFlag({
      workspace_id: "ws1",
      flag_name: "my-flag",
      confirm: false,
    })
    expect(result.content[0].text).toContain("Error:")
    expect(result.content[0].text).toContain("confirm=true")
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it("archives flag when confirmed", async () => {
    mockFetch.mockReturnValue(jsonResponse({ archived: true }))
    const result = await api.archiveFeatureFlag({
      workspace_id: "ws1",
      flag_name: "my-flag",
      confirm: true,
    })
    expect(result.content[0].text).toContain("archived")
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/splits/ws/ws1/my-flag/archive"),
      expect.objectContaining({ method: "POST" }),
    )
  })
})

describe("unarchiveFeatureFlag", () => {
  it("unarchives flag on success", async () => {
    mockFetch.mockReturnValue(jsonResponse({ archived: false }))
    const result = await api.unarchiveFeatureFlag({
      workspace_id: "ws1",
      flag_name: "my-flag",
    })
    expect(result.content[0].text).toContain("archived")
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/splits/ws/ws1/my-flag/unarchive"),
      expect.objectContaining({ method: "POST" }),
    )
  })

  it("returns error when api fails", async () => {
    mockFetch.mockReturnValue(errorResponse())
    const result = await api.unarchiveFeatureFlag({
      workspace_id: "ws1",
      flag_name: "my-flag",
    })
    expect(result.content[0].text).toContain("Error:")
  })
})

// ─── Rule-Based Segments ───

describe("listRuleBasedSegments", () => {
  it("returns segments on success", async () => {
    mockFetch.mockReturnValue(
      jsonResponse({ objects: [{ name: "power-users" }], totalCount: 1 }),
    )
    const result = await api.listRuleBasedSegments({
      workspace_id: "ws1",
      limit: 20,
      offset: 0,
    })
    expect(result.content[0].text).toContain("power-users")
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/rule-based-segments/ws/ws1"),
      expect.any(Object),
    )
  })

  it("returns error when fetch fails", async () => {
    mockFetch.mockReturnValue(errorResponse())
    const result = await api.listRuleBasedSegments({
      workspace_id: "ws1",
      limit: 20,
      offset: 0,
    })
    expect(result.content[0].text).toContain("Error:")
  })
})

describe("getRuleBasedSegment", () => {
  it("returns segment on success", async () => {
    mockFetch.mockReturnValue(jsonResponse({ name: "power-users" }))
    const result = await api.getRuleBasedSegment({
      workspace_id: "ws1",
      segment_name: "power-users",
    })
    expect(result.content[0].text).toContain("power-users")
  })

  it("returns error when fetch fails", async () => {
    mockFetch.mockReturnValue(errorResponse())
    const result = await api.getRuleBasedSegment({
      workspace_id: "ws1",
      segment_name: "power-users",
    })
    expect(result.content[0].text).toContain("Error:")
  })
})

describe("createRuleBasedSegment", () => {
  it("creates segment on success", async () => {
    mockFetch.mockReturnValue(jsonResponse({ name: "power-users" }))
    const result = await api.createRuleBasedSegment({
      workspace_id: "ws1",
      traffic_type: "user",
      name: "power-users",
    })
    expect(result.content[0].text).toContain("power-users")
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/rule-based-segments/ws/ws1/trafficTypes/user"),
      expect.objectContaining({ method: "POST" }),
    )
  })

  it("returns error when api fails", async () => {
    mockFetch.mockReturnValue(errorResponse())
    const result = await api.createRuleBasedSegment({
      workspace_id: "ws1",
      traffic_type: "user",
      name: "power-users",
    })
    expect(result.content[0].text).toContain("Error:")
  })
})

describe("deleteRuleBasedSegment", () => {
  it("blocks execution without confirm", async () => {
    const result = await api.deleteRuleBasedSegment({
      workspace_id: "ws1",
      segment_name: "power-users",
      confirm: false,
    })
    expect(result.content[0].text).toContain("Error:")
    expect(result.content[0].text).toContain("confirm=true")
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it("deletes segment when confirmed", async () => {
    mockFetch.mockReturnValue(Promise.resolve({ ok: true }))
    const result = await api.deleteRuleBasedSegment({
      workspace_id: "ws1",
      segment_name: "power-users",
      confirm: true,
    })
    expect(result.content[0].text).toContain("power-users")
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/rule-based-segments/ws/ws1/power-users"),
      expect.objectContaining({ method: "DELETE" }),
    )
  })
})

describe("enableRuleBasedSegmentDefinition", () => {
  it("enables segment definition on success", async () => {
    mockFetch.mockReturnValue(jsonResponse({}))
    const result = await api.enableRuleBasedSegmentDefinition({
      workspace_id: "ws1",
      environment_id: "production",
      segment_name: "power-users",
    })
    expect(result.content[0].text).toBeDefined()
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/rule-based-segments/production/power-users"),
      expect.objectContaining({ method: "POST" }),
    )
  })
})

describe("disableRuleBasedSegmentDefinition", () => {
  it("blocks execution without confirm", async () => {
    const result = await api.disableRuleBasedSegmentDefinition({
      workspace_id: "ws1",
      environment_id: "production",
      segment_name: "power-users",
      confirm: false,
    })
    expect(result.content[0].text).toContain("Error:")
    expect(result.content[0].text).toContain("confirm=true")
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it("disables segment definition when confirmed", async () => {
    mockFetch.mockReturnValue(Promise.resolve({ ok: true }))
    const result = await api.disableRuleBasedSegmentDefinition({
      workspace_id: "ws1",
      environment_id: "production",
      segment_name: "power-users",
      confirm: true,
    })
    expect(result.content[0].text).toContain("power-users")
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/rule-based-segments/production/power-users"),
      expect.objectContaining({ method: "DELETE" }),
    )
  })
})

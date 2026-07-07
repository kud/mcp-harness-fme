import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
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

describe("getFlagUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("assembles the deep-link URL when both env vars are set", async () => {
    vi.stubEnv("MCP_HARNESS_FME_ACCOUNT_ID", "acc-123")
    vi.stubEnv("MCP_HARNESS_FME_ORG_GUID", "org-guid-xyz")
    const result = await api.getFlagUrl({
      workspace_id: "ws1",
      environment_id: "env1",
      flag_id: "flag-9",
      org_slug: "MyOrg",
      project: "Default",
    })
    const text = result.content[0].text
    expect(text).toContain("account/acc-123")
    expect(text).toContain("org/org-guid-xyz")
    expect(text).toContain("ws/ws1")
    expect(text).toContain("splits/flag-9")
    expect(text).toContain("env/env1")
    expect(text).toContain("orgs/MyOrg")
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it("returns an error mentioning MCP_HARNESS_FME_ACCOUNT_ID when env vars are unset", async () => {
    vi.stubEnv("MCP_HARNESS_FME_ACCOUNT_ID", "")
    vi.stubEnv("MCP_HARNESS_FME_ORG_GUID", "")
    const result = await api.getFlagUrl({
      workspace_id: "ws1",
      environment_id: "env1",
      flag_id: "flag-9",
      org_slug: "MyOrg",
      project: "Default",
    })
    expect(result.content[0].text).toContain("MCP_HARNESS_FME_ACCOUNT_ID")
    expect(mockFetch).not.toHaveBeenCalled()
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

  it("strips deep fields down to name/id when summary is true", async () => {
    mockFetch.mockReturnValue(
      jsonResponse({
        objects: [
          {
            name: "f1",
            id: "1",
            treatments: [{ name: "on" }, { name: "off" }],
            rules: [{ condition: "always" }],
          },
        ],
        totalCount: 1,
      }),
    )
    const result = await api.listFlagDefinitions({
      workspace_id: "ws1",
      environment_id: "production",
      limit: 20,
      offset: 0,
      summary: true,
    })
    expect(result.content[0].text).toContain("f1")
    expect(result.content[0].text).not.toContain("treatments")
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/splits/ws/ws1/environments/production"),
      expect.any(Object),
    )
  })

  it("returns the full definitions unchanged when summary is omitted", async () => {
    const objects = [
      {
        name: "f1",
        id: "1",
        treatments: [{ name: "on" }, { name: "off" }],
        rules: [{ condition: "always" }],
      },
    ]
    mockFetch.mockReturnValue(jsonResponse({ objects, totalCount: 1 }))
    const result = await api.listFlagDefinitions({
      workspace_id: "ws1",
      environment_id: "production",
      limit: 20,
      offset: 0,
    })
    expect(result.content[0].text).toContain("treatments")
    expect(JSON.parse(result.content[0].text)).toEqual({
      objects,
      totalCount: 1,
    })
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

  it("merges title and comment into the request body", async () => {
    mockFetch.mockReturnValue(jsonResponse({ name: "my-flag" }))
    await api.createFlagDefinition({
      workspace_id: "ws1",
      environment_id: "production",
      flag_name: "my-flag",
      definition: validDefinition,
      title: "my title",
      comment: "my comment",
    })
    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ body: expect.stringContaining('"title"') }),
    )
    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ body: expect.stringContaining('"comment"') }),
    )
    const [, options] = mockFetch.mock.calls[0]
    const body = JSON.parse(options.body as string)
    expect(body).toEqual({
      treatments: [{ name: "on" }, { name: "off" }],
      defaultRule: [{ treatment: "off", size: 100 }],
      title: "my title",
      comment: "my comment",
    })
  })

  it("omits title/comment from the body when not provided", async () => {
    mockFetch.mockReturnValue(jsonResponse({ name: "my-flag" }))
    await api.createFlagDefinition({
      workspace_id: "ws1",
      environment_id: "production",
      flag_name: "my-flag",
      definition: validDefinition,
    })
    const [, options] = mockFetch.mock.calls[0]
    expect(options.body as string).not.toContain('"title"')
    expect(options.body as string).not.toContain('"comment"')
  })

  it("returns error when definition is a JSON array and title/comment are given", async () => {
    const result = await api.createFlagDefinition({
      workspace_id: "ws1",
      environment_id: "production",
      flag_name: "my-flag",
      definition: JSON.stringify([1, 2, 3]),
      title: "my title",
    })
    expect(result.content[0].text).toContain("must be a JSON object")
    expect(mockFetch).not.toHaveBeenCalled()
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

  it("merges title and comment into the request body", async () => {
    mockFetch.mockReturnValue(jsonResponse({ name: "my-flag" }))
    await api.updateFlagDefinition({
      workspace_id: "ws1",
      environment_id: "production",
      flag_name: "my-flag",
      definition: validDefinition,
      title: "my title",
      comment: "my comment",
    })
    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ body: expect.stringContaining('"title"') }),
    )
    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ body: expect.stringContaining('"comment"') }),
    )
    const [, options] = mockFetch.mock.calls[0]
    const body = JSON.parse(options.body as string)
    expect(body).toEqual({
      treatments: [{ name: "on" }, { name: "off" }],
      defaultRule: [{ treatment: "on", size: 100 }],
      title: "my title",
      comment: "my comment",
    })
  })

  it("omits title/comment from the body when not provided", async () => {
    mockFetch.mockReturnValue(jsonResponse({ name: "my-flag" }))
    await api.updateFlagDefinition({
      workspace_id: "ws1",
      environment_id: "production",
      flag_name: "my-flag",
      definition: validDefinition,
    })
    const [, options] = mockFetch.mock.calls[0]
    expect(options.body as string).not.toContain('"title"')
    expect(options.body as string).not.toContain('"comment"')
  })

  it("returns error when definition is a JSON array and title/comment are given", async () => {
    const result = await api.updateFlagDefinition({
      workspace_id: "ws1",
      environment_id: "production",
      flag_name: "my-flag",
      definition: JSON.stringify([1, 2, 3]),
      comment: "my comment",
    })
    expect(result.content[0].text).toContain("must be a JSON object")
    expect(mockFetch).not.toHaveBeenCalled()
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

describe("addSegmentToTreatment", () => {
  it("appends the segment to the treatment and keeps existing segments", async () => {
    mockFetch
      .mockReturnValueOnce(
        jsonResponse({
          name: "my-flag",
          treatments: [{ name: "on", segments: ["Seg_A"] }, { name: "off" }],
        }),
      )
      .mockReturnValueOnce(jsonResponse({ name: "my-flag" }))

    const result = await api.addSegmentToTreatment({
      workspace_id: "ws1",
      environment_id: "production",
      flag_name: "my-flag",
      treatment: "on",
      segment: "Seg_B",
    })

    expect(mockFetch).toHaveBeenCalledTimes(2)
    const [, putOptions] = mockFetch.mock.calls[1]
    expect(putOptions).toMatchObject({ method: "PUT" })
    expect(putOptions.body as string).toContain("Seg_A")
    expect(putOptions.body as string).toContain("Seg_B")
    expect(result.content[0].text).toContain("my-flag")
  })

  it("returns unchanged and skips the write when the segment is already present", async () => {
    mockFetch.mockReturnValueOnce(
      jsonResponse({
        name: "my-flag",
        treatments: [{ name: "on", segments: ["Seg_B"] }, { name: "off" }],
      }),
    )

    const result = await api.addSegmentToTreatment({
      workspace_id: "ws1",
      environment_id: "production",
      flag_name: "my-flag",
      treatment: "on",
      segment: "Seg_B",
    })

    expect(result.content[0].text).toContain("unchanged")
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it("returns an error naming the treatment when it is not found", async () => {
    mockFetch.mockReturnValueOnce(
      jsonResponse({ name: "my-flag", treatments: [{ name: "off" }] }),
    )

    const result = await api.addSegmentToTreatment({
      workspace_id: "ws1",
      environment_id: "production",
      flag_name: "my-flag",
      treatment: "on",
      segment: "Seg_B",
    })

    expect(result.content[0].text).toContain("Error:")
    expect(result.content[0].text).toContain('"on"')
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it("merges title and comment into the PUT body on success", async () => {
    mockFetch
      .mockReturnValueOnce(
        jsonResponse({
          name: "my-flag",
          treatments: [{ name: "on", segments: ["Seg_A"] }, { name: "off" }],
        }),
      )
      .mockReturnValueOnce(jsonResponse({ name: "my-flag" }))

    await api.addSegmentToTreatment({
      workspace_id: "ws1",
      environment_id: "production",
      flag_name: "my-flag",
      treatment: "on",
      segment: "Seg_B",
      title: "my title",
      comment: "my comment",
    })

    const [, putOptions] = mockFetch.mock.calls[1]
    expect(putOptions.body as string).toContain('"title"')
    expect(putOptions.body as string).toContain('"comment"')
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

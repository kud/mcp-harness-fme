import { beforeEach, describe, expect, it, vi } from "vitest"
import * as api from "../index.js"

const ACME_ID = "11111111-2222-4333-8444-555555555555"
const STAGING = { id: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee", name: "staging" }
const PRODUCTION = {
  id: "99999999-8888-4777-8666-555555555555",
  name: "production",
}

const definition = (overrides: Record<string, unknown> = {}) => ({
  name: "checkout-redesign",
  killed: false,
  treatments: [{ name: "on" }, { name: "off" }],
  defaultTreatment: "off",
  trafficAllocation: 100,
  rules: [],
  defaultRule: [{ treatment: "off", size: 100 }],
  lastUpdateTime: 1_767_323_045_678,
  creationTime: 1_767_323_000_000,
  ...overrides,
})

type Route = (url: URL) => unknown | undefined

const routes: Route[] = []
const mockFetch = vi.fn(async (input: string) => {
  const url = new URL(input)
  for (const route of routes) {
    const body = route(url)
    if (body !== undefined)
      return { ok: true, status: 200, json: async () => body }
  }
  return { ok: false, status: 404, text: async () => "not found" }
})

const path = (url: URL) => url.pathname.replace("/internal/api/v2", "")

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal("fetch", mockFetch)
  api.resetNameCache()
  routes.length = 0
  routes.push((url) =>
    path(url) === "/workspaces"
      ? { objects: [{ id: ACME_ID, name: "acme" }], totalCount: 1 }
      : undefined,
  )
  routes.push((url) =>
    path(url) === `/environments/ws/${ACME_ID}`
      ? [STAGING, PRODUCTION]
      : undefined,
  )
})

const parse = (result: { content: { text: string }[] }) =>
  JSON.parse(result.content[0].text)

describe("workspace by name", () => {
  it("resolves a workspace name to its id before calling the API", async () => {
    routes.push((url) =>
      path(url) === `/splits/ws/${ACME_ID}/checkout-redesign`
        ? { name: "checkout-redesign" }
        : undefined,
    )
    const result = await api.getFeatureFlag({
      workspace_id: "acme",
      flag_name: "checkout-redesign",
    })
    expect(parse(result).name).toBe("checkout-redesign")
  })

  it("looks a name up once per process", async () => {
    routes.push((url) =>
      path(url).startsWith(`/trafficTypes/ws/${ACME_ID}`) ? [] : undefined,
    )
    await api.listTrafficTypes({ workspace_id: "acme" })
    await api.listTrafficTypes({ workspace_id: "ACME" })
    const lookups = mockFetch.mock.calls.filter((c) =>
      String(c[0]).includes("/workspaces?"),
    )
    expect(lookups).toHaveLength(1)
  })

  it("does not look up a GUID", async () => {
    routes.push((url) =>
      path(url).startsWith(`/trafficTypes/ws/${ACME_ID}`) ? [] : undefined,
    )
    await api.listTrafficTypes({ workspace_id: ACME_ID })
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it("names the available workspaces when the name is unknown", async () => {
    const result = await api.listEnvironments({ workspace_id: "globex" })
    expect(result.content[0].text).toContain("Error:")
    expect(result.content[0].text).toContain("Available: acme")
  })
})

describe("ISO times", () => {
  it("puts an ISO twin beside every epoch-millisecond time", async () => {
    routes.push((url) =>
      path(url) ===
      `/splits/ws/${ACME_ID}/checkout-redesign/environments/production`
        ? definition()
        : undefined,
    )
    const out = parse(
      await api.getFlagDefinition({
        workspace_id: "acme",
        environment_id: "production",
        flag_name: "checkout-redesign",
      }),
    )
    expect(out.lastUpdateTime).toBe(1_767_323_045_678)
    expect(out.lastUpdateTimeIso).toBe("2026-01-02T03:04:05.678Z")
    expect(out.creationTimeIso).toBe("2026-01-02T03:03:20.000Z")
  })
})

describe("owners by name", () => {
  it("resolves users and groups and keeps the ids", async () => {
    routes.push((url) =>
      path(url) === `/splits/ws/${ACME_ID}/checkout-redesign`
        ? {
            name: "checkout-redesign",
            owners: [
              { id: "u-ada", type: "user" },
              { id: "g-payments", type: "group" },
            ],
          }
        : undefined,
    )
    routes.push((url) =>
      path(url) === "/users/u-ada"
        ? { id: "u-ada", name: "Ada Example", email: "ada@acme.test" }
        : path(url) === "/groups/g-payments"
          ? { id: "g-payments", name: "Payments" }
          : undefined,
    )
    const out = parse(
      await api.getFeatureFlag({
        workspace_id: ACME_ID,
        flag_name: "checkout-redesign",
      }),
    )
    expect(out.owners).toEqual([
      {
        id: "u-ada",
        type: "user",
        name: "Ada Example",
        email: "ada@acme.test",
      },
      { id: "g-payments", type: "group", name: "Payments" },
    ])
  })
})

describe("compareFlagEnvironments", () => {
  beforeEach(() => {
    routes.push((url) => {
      const p = path(url)
      if (
        p ===
        `/splits/ws/${ACME_ID}/checkout-redesign/environments/${STAGING.id}`
      )
        return definition({ defaultRule: [{ treatment: "on", size: 100 }] })
      if (
        p ===
        `/splits/ws/${ACME_ID}/checkout-redesign/environments/${PRODUCTION.id}`
      )
        return definition()
      return undefined
    })
  })

  it("shows two environments' differing default rules in one call", async () => {
    const out = parse(
      await api.compareFlagEnvironments({
        workspace_id: "acme",
        flag_name: "checkout-redesign",
      }),
    )
    expect(out.differences).toEqual(["defaultRule"])
    expect(
      out.environments.map(
        (e: { environment: string; defaultRuleText: string }) => [
          e.environment,
          e.defaultRuleText,
        ],
      ),
    ).toEqual([
      ["staging", "on 100%"],
      ["production", "off 100%"],
    ])
    expect(out.environments[0].lastUpdateTimeIso).toBe(
      "2026-01-02T03:04:05.678Z",
    )
    expect(out.environments[0]).not.toHaveProperty("definition")
  })

  it("narrows to the environments named", async () => {
    const out = parse(
      await api.compareFlagEnvironments({
        workspace_id: "acme",
        flag_name: "checkout-redesign",
        environments: ["Production"],
      }),
    )
    expect(out.environments).toHaveLength(1)
    expect(out.differences).toEqual([])
  })

  it("rejects an unknown environment", async () => {
    const result = await api.compareFlagEnvironments({
      workspace_id: "acme",
      flag_name: "checkout-redesign",
      environments: ["sandbox"],
    })
    expect(result.content[0].text).toContain("environment not found: sandbox")
  })
})

describe("getFlagHistory", () => {
  const changeRequest = (
    id: string,
    timestamp: number,
    defaultRule: { treatment: string; size: number }[],
  ) => ({
    id,
    status: "PUBLISHED",
    title: `Change ${id}`,
    requester: "ada@acme.test",
    operationType: "UPDATE",
    approvers: ["grace@acme.test"],
    comments: [{ user: "ada@acme.test", role: "SUBMITTER", timestamp }],
    split: {
      ...definition({ defaultRule }),
      environment: { id: PRODUCTION.id, name: PRODUCTION.name },
    },
  })

  it("shows a default rule switch with its author and before/after", async () => {
    routes.push((url) =>
      path(url) === "/changeRequests"
        ? {
            data: [
              changeRequest("cr-1", 1_767_323_000_000, [
                { treatment: "off", size: 100 },
              ]),
              changeRequest("cr-2", 1_767_323_045_678, [
                { treatment: "on", size: 100 },
              ]),
            ],
            nextMarker: null,
          }
        : undefined,
    )
    const out = parse(
      await api.getFlagHistory({
        workspace_id: "acme",
        environment_id: "production",
        flag_name: "checkout-redesign",
        status: "PUBLISHED",
        limit: 20,
      }),
    )
    expect(out.environment).toBe("production")
    expect(out.changes[0]).toMatchObject({
      id: "cr-2",
      editedBy: "ada@acme.test",
      approvers: ["grace@acme.test"],
      timeIso: "2026-01-02T03:04:05.678Z",
      defaultRuleBefore: "off 100%",
      defaultRuleAfter: "on 100%",
    })
    expect(out.changes[0]).not.toHaveProperty("definition")
    const call = mockFetch.mock.calls
      .map((c) => new URL(String(c[0])))
      .find((u) => path(u) === "/changeRequests")
    expect(call?.searchParams.get("environmentId")).toBe(PRODUCTION.id)
    expect(call?.searchParams.get("status")).toBe("PUBLISHED")
  })

  it("reports an unknown environment", async () => {
    const result = await api.getFlagHistory({
      workspace_id: "acme",
      environment_id: "sandbox",
      flag_name: "checkout-redesign",
    })
    expect(result.content[0].text).toContain("environment not found: sandbox")
  })
})

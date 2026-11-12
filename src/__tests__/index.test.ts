import { createRequire } from "node:module"
import { describe, expect, it } from "vitest"
import * as api from "../index.js"

const require = createRequire(import.meta.url)
const pkg = require("../../package.json") as { version: string }

type InputSchema = {
  safeParse: (value: unknown) => { success: boolean }
  parse: (value: unknown) => Record<string, unknown>
}

// The SDK keeps registered tools private; this reaches the ZodObject each
// registration wraps so tests validate the schema a caller actually hits.
const toolInputSchema = (name: string): InputSchema => {
  const tools = (
    api.server as unknown as {
      _registeredTools: Record<string, { inputSchema?: InputSchema }>
    }
  )._registeredTools
  const schema = tools[name]?.inputSchema
  if (!schema) throw new Error(`tool ${name} has no registered inputSchema`)
  return schema
}

describe("server version", () => {
  it("reports the package.json version", () => {
    expect(api.serverVersion).toBe(pkg.version)
    const info = (
      api.server.server as unknown as { _serverInfo: { version: string } }
    )._serverInfo
    expect(info.version).toBe(pkg.version)
  })
})

describe("list tool limit inputs", () => {
  const cases = [
    { name: "list_workspaces", args: {}, max: 50, def: 20 },
    {
      name: "list_feature_flags",
      args: { workspace_id: "ws1" },
      max: 50,
      def: 20,
    },
    {
      name: "list_flag_definitions",
      args: { workspace_id: "ws1", environment_id: "production" },
      max: 50,
      def: 20,
    },
    { name: "list_segments", args: { workspace_id: "ws1" }, max: 50, def: 20 },
    {
      name: "list_segment_definitions",
      args: { workspace_id: "ws1", environment_id: "production" },
      max: 50,
      def: 20,
    },
    {
      name: "list_segment_keys",
      args: { environment_id: "production", segment_name: "beta-users" },
      max: 100,
      def: 100,
    },
    {
      name: "list_rule_based_segments",
      args: { workspace_id: "ws1" },
      max: 50,
      def: 20,
    },
  ] as const

  it.each(cases)(
    "rejects negative, zero, fractional and oversized limits on $name",
    ({ name, args, max }) => {
      const schema = toolInputSchema(name)
      for (const limit of [-1, 0, 2.5, max + 1]) {
        expect(
          schema.safeParse({ ...args, limit }).success,
          `limit=${limit}`,
        ).toBe(false)
      }
    },
  )

  it.each(cases)(
    "accepts the boundary limits on $name",
    ({ name, args, max }) => {
      const schema = toolInputSchema(name)
      for (const limit of [1, max]) {
        expect(
          schema.safeParse({ ...args, limit }).success,
          `limit=${limit}`,
        ).toBe(true)
      }
    },
  )

  it.each(cases)(
    "applies the documented default limit on $name when omitted",
    ({ name, args, def }) => {
      expect(toolInputSchema(name).parse(args).limit).toBe(def)
    },
  )
})

describe("list tool offset inputs", () => {
  const cases = [
    { name: "list_workspaces", args: {} },
    { name: "list_feature_flags", args: { workspace_id: "ws1" } },
    {
      name: "list_flag_definitions",
      args: { workspace_id: "ws1", environment_id: "production" },
    },
    { name: "list_segments", args: { workspace_id: "ws1" } },
    {
      name: "list_segment_definitions",
      args: { workspace_id: "ws1", environment_id: "production" },
    },
    {
      name: "list_segment_keys",
      args: { environment_id: "production", segment_name: "beta-users" },
    },
    { name: "list_rule_based_segments", args: { workspace_id: "ws1" } },
  ] as const

  it.each(cases)(
    "rejects negative and fractional offsets on $name",
    ({ name, args }) => {
      const schema = toolInputSchema(name)
      for (const offset of [-1, 1.5]) {
        expect(
          schema.safeParse({ ...args, offset }).success,
          `offset=${offset}`,
        ).toBe(false)
      }
    },
  )

  it.each(cases)(
    "accepts non-negative integer offsets on $name",
    ({ name, args }) => {
      const schema = toolInputSchema(name)
      for (const offset of [0, 100]) {
        expect(
          schema.safeParse({ ...args, offset }).success,
          `offset=${offset}`,
        ).toBe(true)
      }
    },
  )

  it.each(cases)(
    "defaults offset to 0 on $name when omitted",
    ({ name, args }) => {
      expect(toolInputSchema(name).parse(args).offset).toBe(0)
    },
  )
})

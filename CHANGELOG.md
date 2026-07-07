# Changelog

All notable changes to this project are documented here.

---

## [1.5.1] — 2026-07-07

### Documentation

- Reframe the README Usage section as client-agnostic — the server is a standard stdio MCP server that works with any MCP client (Claude Desktop, Claude Code, Cursor, Windsurf, Cline, Zed, …), with the `claude mcp add` CLI kept as a labelled Claude Code shortcut. Repo description updated to match.

---

## [1.5.0] — 2026-07-07

### Changed

- `get_flag_url` now takes just `workspace`, `flag`, and `environment` — each by **name or id** — and resolves the org slug, project, flag id, and env id internally (via the same endpoints a caller would otherwise hit). A GUID is used as-is; a name is looked up. Previously it required all five resolved values up front.

### Documentation

- Add a **Configuration** section to the README: a per-tool env-var table and a labelled Harness FME URL schema showing which segments become `MCP_HARNESS_FME_ACCOUNT_ID` / `MCP_HARNESS_FME_ORG_GUID` (and the `/orgs/` slug vs `/org/` GUID gotcha).

---

## [1.4.1] — 2026-07-07

### Changed

- Rename the `get_flag_url` env vars to `MCP_HARNESS_FME_ACCOUNT_ID` and `MCP_HARNESS_FME_ORG_GUID` for consistency with `MCP_HARNESS_FME_API_KEY` — one predictable namespace for all server config, and no collision with generic `HARNESS_*` vars from other tooling.

---

## [1.4.0] — 2026-07-07

### Features

- Add `add_segment_to_treatment` — adds a segment to a flag treatment via read-modify-write instead of a full-replace, so a dropped field can't silently wipe existing targeting. Idempotent: a no-op if the segment is already present.
- Add `get_flag_url` — builds a Harness FME web-UI deep-link for a flag from the `HARNESS_ACCOUNT_ID` and `HARNESS_ORG_GUID` env vars (those IDs are not exposed by the API), plus the workspace/env/flag IDs.
- Add a `summary` option to `list_flag_definitions` that returns only name/id per flag, avoiding oversized responses in environments with many flags.

### Documentation

- Clarify in `list_segments` that the Harness FME API caps segment pages at 20 regardless of the requested `limit`.

---

## [1.3.0] — 2026-07-07

### Features

- Add optional top-level `title` and `comment` params to `create_flag_definition` and `update_flag_definition`, merged into the request body — no longer need to smuggle them inside the `definition` JSON string. Required for workspaces where `list_workspaces` reports `requiresTitleAndComments: true`.

---

## [1.2.2] — 2026-06-01

### Bug Fixes

- Fix `list_flag_definitions` using wrong API endpoint path (`/splits/…/splits` → `/splitDefinitions/…`) ([cd2b645](https://github.com/kud/mcp-harness-fme/commit/cd2b645))

---

## [1.2.1] — 2026-04-22

### Chores

- Update branding and links for Harness FME in README ([e7c5a7b](https://github.com/kud/mcp-harness-fme/commit/e7c5a7b))

---

## [1.2.0] — 2026-04-22

### Features

- Major parity update with official reference implementation ([d5bba22](https://github.com/kud/mcp-harness-fme/commit/d5bba22))

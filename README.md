<div align="center">

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat-square&logo=node.js&logoColor=white)
![npm](https://img.shields.io/npm/v/@kud/mcp-harness-fme?style=flat-square&color=CB3837)
![MIT](https://img.shields.io/badge/licence-MIT-22C55E?style=flat-square)

**MCP server for Harness FME (Split.io) — read and toggle feature flags.**

<a href="https://kud.io/projects/mcp-harness-fme">Website</a> · <a href="https://kud.io/projects/mcp-harness-fme/docs">Documentation</a>

</div>

## Features

- **28 tools** — covers workspaces, environments, feature flags, flag definitions, segments, rule-based segments, and change requests.
- **Kill & restore** — instantly kill a flag to force all traffic to the default treatment, or restore it with a single tool call.
- **Safety guard** — every destructive operation (delete, kill, archive, disable) requires `confirm: true`, preventing accidental changes.
- **Rule-based segments** — create, update, enable, disable, and submit change requests for rule-based segments per environment.
- **Change request flow** — submit segment definition changes with optional approvers for teams that require approval gates.
- **Zero-config startup** — reads `MCP_HARNESS_FME_API_KEY` from the environment and exits immediately if it is missing.

## Install

Add to your MCP client config (see Usage below), or install globally to run manually:

```sh
npx --yes @kud/mcp-harness-fme@latest
```

Set the environment variable `MCP_HARNESS_FME_API_KEY` to your Harness FME API key before starting the server.

## Usage

### Claude Desktop / Claude Code

```json
{
  "mcpServers": {
    "harness-fme": {
      "command": "npx",
      "args": ["--yes", "@kud/mcp-harness-fme@latest"],
      "env": {
        "MCP_HARNESS_FME_API_KEY": "your_api_key"
      }
    }
  }
}
```

For Claude Code, add via the CLI:

```sh
claude mcp add --transport stdio --scope user harness-fme \
  --env MCP_HARNESS_FME_API_KEY=your_api_key \
  -- npx --yes @kud/mcp-harness-fme@latest
```

### Available tools

| Tool                                       | Description                                                                                                                          |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| `list_workspaces`                          | List all FME workspaces in the account                                                                                               |
| `list_environments`                        | List all environments in a workspace                                                                                                 |
| `list_traffic_types`                       | List all traffic types in a workspace                                                                                                |
| `list_rollout_statuses`                    | List rollout status definitions for a workspace                                                                                      |
| `list_feature_flags`                       | List feature flags in a workspace (filter by tag, status, name)                                                                      |
| `get_feature_flag`                         | Get metadata for a specific feature flag                                                                                             |
| `create_feature_flag`                      | Create a new feature flag for a given traffic type                                                                                   |
| `update_feature_flag`                      | Update a flag's description, tags, owners, or rollout status                                                                         |
| `delete_feature_flag`                      | Permanently delete a feature flag (`confirm: true` required)                                                                         |
| `archive_feature_flag`                     | Archive a flag, removing it from active use (`confirm: true` required)                                                               |
| `unarchive_feature_flag`                   | Restore a previously archived feature flag                                                                                           |
| `kill_feature_flag`                        | Kill a flag in an environment — forces default treatment (`confirm: true` required)                                                  |
| `restore_feature_flag`                     | Restore a killed feature flag in an environment                                                                                      |
| `list_flag_definitions`                    | List flag targeting rules in an environment                                                                                          |
| `get_flag_definition`                      | Get treatments and targeting rules for a flag in an environment                                                                      |
| `create_flag_definition`                   | Activate a flag in an environment with treatments and targeting rules — pass `title`/`comment` when `requiresTitleAndComments: true` |
| `update_flag_definition`                   | Fully replace a flag's targeting rules in an environment — pass `title`/`comment` when `requiresTitleAndComments: true`              |
| `delete_flag_definition`                   | Remove a flag's targeting rules from an environment (`confirm: true` required)                                                       |
| `list_segments`                            | List all segments in a workspace                                                                                                     |
| `list_rule_based_segments`                 | List all rule-based segments in a workspace                                                                                          |
| `get_rule_based_segment`                   | Get a rule-based segment's workspace-level metadata                                                                                  |
| `create_rule_based_segment`                | Create a new rule-based segment in a workspace                                                                                       |
| `delete_rule_based_segment`                | Permanently delete a rule-based segment (`confirm: true` required)                                                                   |
| `list_rule_based_segment_definitions`      | List rule-based segment definitions in an environment                                                                                |
| `update_rule_based_segment_definition`     | Update a rule-based segment's rules in an environment                                                                                |
| `enable_rule_based_segment_definition`     | Activate a rule-based segment in an environment                                                                                      |
| `disable_rule_based_segment_definition`    | Remove a rule-based segment from an environment (`confirm: true` required)                                                           |
| `create_rule_based_segment_change_request` | Submit a change request for a segment definition with optional approval flow                                                         |

## Development

```sh
git clone https://github.com/kud/mcp-harness-fme.git
cd mcp-harness-fme
npm install
npm run dev           # run from source with tsx
npm run inspect:dev   # MCP Inspector at http://localhost:5173
npm test              # vitest
npm run build         # compile to dist/
```

The server reads `MCP_HARNESS_FME_API_KEY` at startup and exits immediately if it is absent. All tools are defined in `src/index.ts`.

---

📚 **Full documentation → [mcp-harness-fme/docs](https://kud.io/projects/mcp-harness-fme/docs)**

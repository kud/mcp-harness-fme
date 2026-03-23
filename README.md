# Harness FME MCP Server

```
 ██╗  ██╗ █████╗ ██████╗ ███╗   ██╗███████╗███████╗███████╗    ███████╗███╗   ███╗███████╗
 ██║  ██║██╔══██╗██╔══██╗████╗  ██║██╔════╝██╔════╝██╔════╝    ██╔════╝████╗ ████║██╔════╝
 ███████║███████║██████╔╝██╔██╗ ██║█████╗  ███████╗███████╗    █████╗  ██╔████╔██║█████╗
 ██╔══██║██╔══██║██╔══██╗██║╚██╗██║██╔══╝  ╚════██║╚════██║    ██╔══╝  ██║╚██╔╝██║██╔══╝
 ██║  ██║██║  ██║██║  ██║██║ ╚████║███████╗███████║███████║    ██║     ██║ ╚═╝ ██║███████╗
 ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═══╝╚══════╝╚══════╝╚══════╝    ╚═╝     ╚═╝     ╚═╝╚══════╝
```

<div align="center">

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green?logo=node.js&logoColor=white)](https://nodejs.org/)
[![MCP](https://img.shields.io/badge/MCP-1.10-purple?logo=anthropic)](https://modelcontextprotocol.io/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

**A Harness FME (Split.io) MCP server — read and toggle feature flags from your AI assistant**

[Features](#-features) • [Quick Start](#-quick-start) • [Installation](#-installation-guides) • [Tools](#-available-tools) • [Development](#-development)

</div>

---

## 🌟 Features

- **🚩 Feature Flag Management** - List, inspect, kill, and restore flags across any workspace
- **🔐 Simple Authentication** - Single API key, zero config friction
- **🌍 Multi-Workspace Support** - Work across any number of Harness FME workspaces
- **🌿 Environment-Aware** - Target flags in specific environments (staging, production, etc.)
- **⚡ Modern Stack** - TypeScript 5+, ES2023, Native Fetch API, ESM
- **📦 MCP Protocol** - Native integration with Claude Desktop, Claude Code CLI, Cursor, and more
- **🔒 Safety Guard** - Kill operations require explicit `confirm: true` — no accidental flag kills

---

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- A Harness FME API key ([how to get one](#-authentication))

### Installation

**Option 1: Via npm (recommended):**

```bash
# No installation needed — just use npx in your MCP config
npx --yes @kud/mcp-harness-fme@latest
```

**Option 2: Local installation:**

```bash
git clone https://github.com/kud/mcp-harness-fme.git
cd mcp-harness-fme
npm install
npm run build
```

### Quick Setup Example (Claude CLI)

```bash
claude mcp add --transport stdio --scope user harness-fme \
  --env HARNESS_FME_API_KEY=your_api_key \
  -- npx --yes @kud/mcp-harness-fme@latest
```

✅ Done! Now you can inspect and toggle feature flags from any AI assistant.

---

## 📚 Installation Guides

Choose your development environment:

- [Claude Code CLI](#-claude-code-cli) - Command line interface
- [Claude Desktop](#%EF%B8%8F-claude-desktop) - Desktop application
- [VSCode](#-vscode) - With Cline, Claude Dev, Continue
- [Cursor](#-cursor) - AI-first IDE
- [Windsurf](#-windsurf) - AI-powered code editor
- [JetBrains IDEs](#-all-jetbrains-ides) - IntelliJ, WebStorm, PyCharm, GoLand, etc.

---

### 🎯 Claude Code CLI

**For:** Claude AI via command line interface

<details>
<summary><b>Click to expand Claude Code CLI setup</b></summary>

```bash
claude mcp add --transport stdio --scope user harness-fme \
  --env HARNESS_FME_API_KEY=your_api_key \
  -- npx --yes @kud/mcp-harness-fme@latest
```

**If installed locally:**

```bash
claude mcp add --transport stdio --scope user harness-fme \
  --env HARNESS_FME_API_KEY=your_api_key \
  -- node ~/path/to/mcp-harness-fme/dist/index.js
```

Verify: `claude mcp list` should show `harness-fme`

</details>

---

### 🖥️ Claude Desktop

**For:** Claude AI desktop application

<details>
<summary><b>Click to expand Claude Desktop setup</b></summary>

#### 1. Open Configuration File

**macOS:**

```bash
open ~/Library/Application\ Support/Claude/claude_desktop_config.json
```

**Windows:**

```bash
notepad %APPDATA%\Claude\claude_desktop_config.json
```

#### 2. Add Configuration

**Via npm (recommended):**

```json
{
  "mcpServers": {
    "harness-fme": {
      "command": "npx",
      "args": ["--yes", "@kud/mcp-harness-fme@latest"],
      "env": {
        "HARNESS_FME_API_KEY": "your_api_key"
      }
    }
  }
}
```

**Local installation:**

```json
{
  "mcpServers": {
    "harness-fme": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-harness-fme/dist/index.js"],
      "env": {
        "HARNESS_FME_API_KEY": "your_api_key"
      }
    }
  }
}
```

#### 3. Restart

Quit (Cmd+Q / Alt+F4) and reopen Claude Desktop.

</details>

---

### 📝 VSCode

**For:** VSCode with MCP-compatible extensions (Cline, Claude Dev, Continue)

<details>
<summary><b>Click to expand VSCode setup</b></summary>

Settings (Cmd+, / Ctrl+,) → Search "Cline: MCP Settings" → Edit in settings.json:

```json
{
  "cline.mcpServers": {
    "harness-fme": {
      "command": "npx",
      "args": ["--yes", "@kud/mcp-harness-fme@latest"],
      "env": {
        "HARNESS_FME_API_KEY": "your_api_key"
      }
    }
  }
}
```

Reload window after configuration.

</details>

---

### 🌐 Cursor

**For:** Cursor IDE with built-in AI

<details>
<summary><b>Click to expand Cursor setup</b></summary>

Settings (Cmd+, / Ctrl+,) → Search "MCP" → Edit Config or open `~/.cursor/mcp_config.json`:

```json
{
  "mcpServers": {
    "harness-fme": {
      "command": "npx",
      "args": ["--yes", "@kud/mcp-harness-fme@latest"],
      "env": {
        "HARNESS_FME_API_KEY": "your_api_key"
      }
    }
  }
}
```

Restart Cursor after configuration.

</details>

---

### 🌊 Windsurf

**For:** Windsurf AI-powered code editor

<details>
<summary><b>Click to expand Windsurf setup</b></summary>

Settings → **AI Settings** → **Model Context Protocol** → Add Server:

```json
{
  "mcpServers": {
    "harness-fme": {
      "command": "npx",
      "args": ["--yes", "@kud/mcp-harness-fme@latest"],
      "env": {
        "HARNESS_FME_API_KEY": "your_api_key"
      }
    }
  }
}
```

Or edit `~/.windsurf/mcp_settings.json` directly. Restart Windsurf after configuration.

</details>

---

### 🔧 All JetBrains IDEs

**For:** IntelliJ IDEA, WebStorm, PyCharm, GoLand, RubyMine, PhpStorm, Rider, CLion, DataGrip

<details>
<summary><b>Click to expand JetBrains IDEs setup</b></summary>

Settings (Cmd+, / Ctrl+,) → **Tools** → **AI Assistant** → **Model Context Protocol** → Add Server:

- **Name:** harness-fme
- **Command:** `npx`
- **Arguments:** `--yes @kud/mcp-harness-fme@latest`
- **Environment Variables:**
  ```
  HARNESS_FME_API_KEY=your_api_key
  ```

For local installation, use **Command:** `node` and **Arguments:** `/absolute/path/to/mcp-harness-fme/dist/index.js`

Apply and restart the IDE.

</details>

---

## 🛠️ Available Tools

### 🏢 Workspaces (1 tool)

| Tool              | Description                            |
| ----------------- | -------------------------------------- |
| `list_workspaces` | List all FME workspaces in the account |

### 🌍 Environments (1 tool)

| Tool                | Description                          |
| ------------------- | ------------------------------------ |
| `list_environments` | List all environments in a workspace |

### 🚩 Feature Flags (9 tools)

| Tool                     | Description                                                             |
| ------------------------ | ----------------------------------------------------------------------- |
| `list_feature_flags`     | List feature flags in a workspace (supports tag filter, pagination)     |
| `get_feature_flag`       | Get metadata for a specific feature flag                                |
| `create_feature_flag`    | Create a new feature flag for a given traffic type                      |
| `update_feature_flag`    | Update a flag's description, tags, or owners                            |
| `delete_feature_flag`    | Permanently delete a feature flag (requires `confirm: true`)            |
| `list_flag_definitions`  | List all flag definitions (targeting rules) in an environment           |
| `get_flag_definition`    | Get targeting rules and treatment definition in an environment          |
| `create_flag_definition` | Activate a flag in an environment with treatments and targeting rules   |
| `update_flag_definition` | Fully replace a flag's targeting rules in an environment                |
| `delete_flag_definition` | Remove a flag definition from an environment (requires `confirm: true`) |
| `kill_feature_flag`      | Kill (disable) a flag — forces all traffic to default treatment         |
| `restore_feature_flag`   | Restore (re-enable) a killed feature flag                               |

### 🧩 Segments (1 tool)

| Tool            | Description                      |
| --------------- | -------------------------------- |
| `list_segments` | List all segments in a workspace |

### 🔀 Traffic Types (1 tool)

| Tool                 | Description                           |
| -------------------- | ------------------------------------- |
| `list_traffic_types` | List all traffic types in a workspace |

**Total: 16 Tools** covering full feature flag lifecycle management.

---

## 💬 Example Conversations

Once configured, interact with your feature flags naturally:

```
You: "List all my workspaces"
AI:  Shows all FME workspaces with IDs

You: "List all feature flags in workspace ws_abc123"
AI:  Shows all flags with pagination

You: "Search for flags containing 'dark-mode'"
AI:  Returns matching flags

You: "What are the targeting rules for 'checkout-redesign' in production?"
AI:  Shows treatments, targeting rules, percentage splits

You: "Kill the 'new-payments-flow' flag in production"
AI:  Requires confirm=true, then disables the flag

You: "Restore 'new-payments-flow' in production"
AI:  Re-enables the flag and resumes normal traffic routing
```

---

## 🧪 Development

### Project Structure

```
mcp-harness-fme/
├── src/
│   └── index.ts          # MCP server — all tools in one file
├── dist/                 # Compiled output
├── package.json
├── tsconfig.json
└── README.md
```

### Available Scripts

| Script                | Description                      |
| --------------------- | -------------------------------- |
| `npm run build`       | Compile TypeScript to JavaScript |
| `npm run build:watch` | Watch mode — rebuild on changes  |
| `npm run dev`         | Run in development (tsx)         |
| `npm start`           | Run compiled server              |
| `npm run inspect`     | Open MCP inspector               |
| `npm run inspect:dev` | Inspector in dev mode (no build) |
| `npm run typecheck`   | Type check without building      |
| `npm run clean`       | Remove build artifacts           |

### Development Workflow

```bash
# Terminal 1: Watch mode
npm run build:watch

# Terminal 2: Test with inspector
export HARNESS_FME_API_KEY=your_api_key
npm run inspect:dev
```

Opens `http://localhost:5173` — test all tools interactively!

### Adding New Tools

1. Open `src/index.ts`
2. Call `server.registerTool(...)` with your tool name, schema, and handler
3. Rebuild: `npm run build`

---

## ⚙️ Configuration

### Environment Variables

| Variable              | Required | Description              |
| --------------------- | -------- | ------------------------ |
| `HARNESS_FME_API_KEY` | ✅ Yes   | Your Harness FME API key |

The server exits immediately at startup if the key is missing — no silent failures.

---

## 🔐 Authentication

### Getting Your Harness FME API Key

1. Log in to your [Harness FME account](https://app.split.io)
2. Go to **Admin Settings** → **API Keys**
3. Click **Add API Key**
4. Select type **Admin** (required for management operations)
5. Copy the key — store it somewhere safe

> ⚠️ **Important:** Admin API keys have full read/write access to your workspace. Treat them like passwords. Never commit them to version control.

### Setting the Key

**In your shell:**

```bash
export HARNESS_FME_API_KEY=your_api_key
```

**In MCP config (recommended):**

```json
"env": {
  "HARNESS_FME_API_KEY": "your_api_key"
}
```

---

## 🐛 Troubleshooting

### Server Not Showing in Claude

1. ✅ Check `HARNESS_FME_API_KEY` is set
2. ✅ Run `npm install && npm run build`
3. ✅ Restart Claude completely

### Authentication Errors

```bash
# Test your key directly
curl -H "Authorization: Bearer your_api_key" \
  https://api.split.io/internal/api/v2/workspaces
```

If this returns JSON, your key is valid.

### Build Errors

```bash
npm run clean && npm run build
```

### Check Logs

**Claude Desktop logs:**

- macOS: `~/Library/Logs/Claude/mcp*.log`
- Windows: `%APPDATA%\Claude\logs\mcp*.log`

**Claude Code CLI:**

```bash
claude mcp get harness-fme
```

---

## 🔒 Security Best Practices

- ✅ Use environment variables — never hardcode API keys
- ✅ Never commit your API key to version control
- ✅ Rotate keys regularly via the Harness admin panel
- ✅ Use the `confirm: true` guard on kill operations — it's there for a reason
- ✅ Protect your MCP config files (`claude_desktop_config.json`, etc.)

---

## 📊 Tech Stack

- **Runtime:** Node.js 20+
- **Language:** TypeScript 5+
- **Target:** ES2023
- **Protocol:** MCP 1.10 (stdio transport)
- **HTTP Client:** Native Fetch API
- **Module System:** ESM
- **Schema Validation:** Zod

---

## 🤝 Contributing

Contributions welcome! Please ensure:

1. TypeScript strict mode compliance
2. All tools properly typed with Zod schemas
3. Build passes: `npm run build`
4. No breaking changes to existing tool signatures

---

## 📄 License

MIT License — see [LICENSE](LICENSE) file

---

## 🙏 Acknowledgments

- Built with [Model Context Protocol](https://modelcontextprotocol.io/)
- Powered by the [Harness FME (Split.io) REST API](https://docs.split.io/reference)

---

## 📮 Support

- 🐛 **Issues:** [GitHub Issues](https://github.com/kud/mcp-harness-fme/issues)
- 💬 **Discussions:** [GitHub Discussions](https://github.com/kud/mcp-harness-fme/discussions)

---

<div align="center">

**Made with ❤️ for the feature flag community**

⭐ Star this repo if it helped you!

[Back to Top](#harness-fme-mcp-server)

</div>

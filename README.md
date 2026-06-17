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
[![MCP](https://img.shields.io/badge/MCP-1.27-purple?logo=anthropic)](https://modelcontextprotocol.io/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

</div>

An MCP server for Harness FME (Split.io) — read, toggle, and manage feature flags and rule-based segments from your AI assistant. **28 tools** with a `confirm: true` safety guard on every destructive operation.

## Install

```bash
claude mcp add --transport stdio --scope user harness-fme \
  --env MCP_HARNESS_FME_API_KEY=your_api_key \
  -- npx --yes @kud/mcp-harness-fme@latest
```

Any MCP client works — point its config at `npx --yes @kud/mcp-harness-fme@latest` and set `MCP_HARNESS_FME_API_KEY`.

## Development

```bash
git clone https://github.com/kud/mcp-harness-fme.git
cd mcp-harness-fme
npm install
npm run dev          # run from source with tsx
npm run inspect:dev  # MCP inspector at http://localhost:5173
npm test             # vitest
npm run build        # compile to dist/
```

The server reads `MCP_HARNESS_FME_API_KEY` and exits at startup if it is missing. All tools live in `src/index.ts`.

---

📚 **Full documentation → https://kud.io/projects/mcp-harness-fme/docs**

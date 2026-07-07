// Must match the exact var src/index.ts reads (MCP_HARNESS_FME_API_KEY),
// or the module captures the real key and leaks it into failing-test output.
process.env.MCP_HARNESS_FME_API_KEY = "test-key"

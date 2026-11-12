import { createRequire } from "node:module"

// package.json sits one directory above src/ and dist/ alike, so a single
// relative path resolves from both the source and the compiled entrypoint.
const require = createRequire(import.meta.url)

export const readPackageVersion = (): string =>
  (require("../package.json") as { version: string }).version

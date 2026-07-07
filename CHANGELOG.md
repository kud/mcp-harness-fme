# Changelog

All notable changes to this project are documented here.

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
